#include "PTITCloud.h"

#include <ArduinoJson.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <SD.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <dirent.h>
#include <stdio.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <vector>

#include "Scheduler.h"

namespace ptit_cloud {
namespace {

constexpr const char* PREFIX = "@PTITCLOUD";
constexpr size_t PREFIX_LEN = 10;
constexpr size_t MAX_LINE = 768;
constexpr uint32_t SCAN_MS = 2000;
constexpr size_t MAX_PHOTO = 2 * 1024 * 1024;  // backend device_images.MAX_IMAGE_BYTES
constexpr size_t MAX_TRACKED = 256;
constexpr uint8_t MAX_ATTEMPTS = 3;
constexpr const char* MOUNT = "/sd";  // SD.begin() default mount point (Storage and Camera use it)
constexpr const char* PHOTO_DIR = "/photos";

struct Config {
    String ssid, wpass, host, user, pass, uid, topic;
    uint16_t port = 8883;
    bool tls = true;
    bool valid() const { return ssid.length() && host.length() && uid.length() && topic.length(); }
};

struct Tracked {
    String path;
    size_t size;
    uint8_t stable;
    uint8_t attempts;
    bool done;
};

Config cfg;
uint32_t cfgRevision = 0;
SemaphoreHandle_t cfgLock = nullptr;
Stream* console = nullptr;
bool started = false;
TaskHandle_t task = nullptr;

// Sketch-side input filter state (only touched from the thread that calls cdh.read()).
String pending;
size_t pendingPos = 0;
String capture;
bool capturing = false;
bool lineStart = true;

// One write per line: HardwareSerial / USB CDC writes are locked, so a line never interleaves mid-way.
void say(const String& line) {
    if (!console) return;
    String text = "[CLOUD] " + line + "\n";
    console->write(reinterpret_cast<const uint8_t*>(text.c_str()), text.length());
}

Config currentConfig(uint32_t* revision = nullptr) {
    xSemaphoreTake(cfgLock, portMAX_DELAY);
    Config copy = cfg;
    if (revision) *revision = cfgRevision;
    xSemaphoreGive(cfgLock);
    return copy;
}

void setConfig(const Config& next) {
    xSemaphoreTake(cfgLock, portMAX_DELAY);
    cfg = next;
    ++cfgRevision;
    xSemaphoreGive(cfgLock);
}

void load() {
    Preferences prefs;
    // Read-write open creates the namespace on a never-provisioned board instead of logging "nvs_open failed".
    if (!prefs.begin("ptitcloud", false)) return;
    Config loaded;
    loaded.ssid = prefs.getString("ssid", "");
    loaded.wpass = prefs.getString("wpass", "");
    loaded.host = prefs.getString("host", "");
    loaded.port = prefs.getUShort("port", 8883);
    loaded.tls = prefs.getBool("tls", true);
    loaded.user = prefs.getString("user", "");
    loaded.pass = prefs.getString("pass", "");
    loaded.uid = prefs.getString("uid", "");
    loaded.topic = prefs.getString("topic", "");
    prefs.end();
    setConfig(loaded);
}

bool save(const Config& next) {
    Preferences prefs;
    if (!prefs.begin("ptitcloud", false)) return false;
    prefs.clear();
    prefs.putString("ssid", next.ssid);
    prefs.putString("wpass", next.wpass);
    prefs.putString("host", next.host);
    prefs.putUShort("port", next.port);
    prefs.putBool("tls", next.tls);
    prefs.putString("user", next.user);
    prefs.putString("pass", next.pass);
    prefs.putString("topic", next.topic);
    const bool ok = prefs.putString("uid", next.uid) > 0;
    prefs.end();
    return ok;
}

void announce() {
    const Config c = currentConfig();
    // The broker is reported too: a board provisioned for a retired broker must not be told KEEP.
    // ssid stays last because it may contain spaces.
    say(String("CFG? v1 uid=") + (c.uid.length() ? c.uid : "none") + " host=" + (c.host.length() ? c.host : "none") + ":" +
        String(c.port) + " ssid=" + c.ssid);
}

void startTask();

// Returns true when the line was a configuration answer (not a query).
bool handleLine(const String& line) {
    String body = line.substring(PREFIX_LEN);
    body.trim();
    if (body == "?") { announce(); return false; }
    if (body == "KEEP") return true;
    if (body == "CLEAR") {
        Preferences prefs;
        if (prefs.begin("ptitcloud", false)) { prefs.clear(); prefs.end(); }
        setConfig(Config());
        say("CFG CLEARED");
        return true;
    }
    JsonDocument doc;
    if (deserializeJson(doc, body) || doc["v"].as<int>() != 1) { say("CFG ERR invalid"); return true; }
    Config next;
    next.ssid = doc["ssid"] | "";
    next.wpass = doc["wpass"] | "";
    next.host = doc["host"] | "";
    next.port = doc["port"] | 8883;
    next.tls = doc["tls"] | true;
    next.user = doc["user"] | "";
    next.pass = doc["pass"] | "";
    next.uid = doc["uid"] | "";
    next.topic = doc["topic"] | "";
    if (!next.valid() || next.ssid.length() > 32 || next.wpass.length() > 64 || next.topic.length() > 128) {
        say("CFG ERR invalid");
        return true;
    }
    if (!save(next)) { say("CFG ERR nvs"); return true; }
    setConfig(next);
    say("CFG OK uid=" + next.uid);
    startTask();
    return true;
}

// ---------------------------------------------------------------- photo uplink task

bool lockSpi() { return PTIT_Scheduler::lock(PTIT_BUS_SPI, 500); }
void unlockSpi() { PTIT_Scheduler::unlock(PTIT_BUS_SPI); }

bool isJpegName(const char* name) {
    const size_t n = strlen(name);
    auto ends = [&](const char* ext) {
        const size_t e = strlen(ext);
        return n > e && strcasecmp(name + n - e, ext) == 0;
    };
    return ends(".jpg") || ends(".jpeg");
}

std::vector<Tracked> files;
bool baselined = false;
bool startedWifi = false;
uint32_t wifiRevision = 0;

// POSIX listing: does not open the files, so a photo the sketch is still writing is not disturbed.
// The directory entry size only changes when the sketch closes the file.
void scan() {
    if (SD.cardType() == CARD_NONE) return;  // sketch has not mounted the SD card (yet)
    std::vector<std::pair<String, size_t>> seen;
    if (!lockSpi()) return;
    const String dirPath = String(MOUNT) + PHOTO_DIR;
    DIR* dir = opendir(dirPath.c_str());
    if (dir) {
        struct dirent* entry;
        while ((entry = readdir(dir)) != nullptr && seen.size() < MAX_TRACKED) {
            if (entry->d_type == DT_DIR || !isJpegName(entry->d_name)) continue;
            const String path = String(PHOTO_DIR) + "/" + entry->d_name;
            struct stat st;
            if (stat((String(MOUNT) + path).c_str(), &st) == 0) seen.push_back({path, (size_t)st.st_size});
        }
        closedir(dir);
    }
    unlockSpi();

    // Photos already on the card when the board started are not uploaded again.
    if (!baselined) {
        for (const auto& item : seen) files.push_back({item.first, item.second, 0, 0, true});
        baselined = true;
        say("READY photos=" + String((unsigned)seen.size()));
        return;
    }
    std::vector<Tracked> next;
    for (const auto& item : seen) {
        Tracked* known = nullptr;
        for (auto& f : files) if (f.path == item.first) { known = &f; break; }
        if (!known) { next.push_back({item.first, item.second, 0, 0, false}); continue; }
        Tracked t = *known;
        // Sketches that restart their counter at boot overwrite an old file name: a new size is a new photo.
        if (t.done && item.second != t.size) t = {item.first, item.second, 0, 0, false};
        else if (!t.done) {
            if (item.second > 0 && item.second == t.size) t.stable = t.stable < 9 ? t.stable + 1 : 9;
            else { t.size = item.second; t.stable = 0; }
        }
        next.push_back(t);
    }
    files.swap(next);  // deleted photos are forgotten
}

bool ensureWifi(const Config& c, uint32_t revision) {
    if (startedWifi && revision != wifiRevision) {  // re-provisioned with another network
        WiFi.disconnect();
        startedWifi = false;
    }
    if (WiFi.status() == WL_CONNECTED) return true;
    const wifi_mode_t mode = WiFi.getMode();
    if (mode == WIFI_AP) { say("PHOTO WAIT wifi-ap"); return false; }  // the sketch runs its own access point
    if (!startedWifi && mode == WIFI_MODE_NULL) {
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.begin(c.ssid.c_str(), c.wpass.length() ? c.wpass.c_str() : nullptr);
        startedWifi = true;
        wifiRevision = revision;
        say("WIFI connecting " + c.ssid);
    }
    for (int i = 0; i < 150 && WiFi.status() != WL_CONNECTED; ++i) vTaskDelay(pdMS_TO_TICKS(100));
    if (WiFi.status() != WL_CONNECTED) return false;
    say("WIFI connected " + WiFi.localIP().toString());
    return true;
}

bool checkJpeg(FILE* fp, size_t size) {
    uint8_t head[2] = {0, 0}, tail[2] = {0, 0};
    if (!lockSpi()) return false;
    bool ok = fseek(fp, 0, SEEK_SET) == 0 && fread(head, 1, 2, fp) == 2 && fseek(fp, (long)size - 2, SEEK_SET) == 0
        && fread(tail, 1, 2, fp) == 2 && fseek(fp, 0, SEEK_SET) == 0;
    unlockSpi();
    return ok && head[0] == 0xFF && head[1] == 0xD8 && tail[0] == 0xFF && tail[1] == 0xD9;
}

// Returns true when the photo is finished with (sent or permanently skipped).
bool upload(const Tracked& photo) {
    if (photo.size < 4 || photo.size > MAX_PHOTO) { say("PHOTO FAIL " + photo.path + " size"); return true; }
    uint32_t revision = 0;
    const Config c = currentConfig(&revision);
    if (!c.valid()) return false;
    if (!ensureWifi(c, revision)) { say("PHOTO FAIL " + photo.path + " wifi"); return false; }

    const String full = String(MOUNT) + photo.path;
    if (!lockSpi()) return false;
    FILE* fp = fopen(full.c_str(), "rb");
    unlockSpi();
    if (!fp) { say("PHOTO FAIL " + photo.path + " open"); return false; }
    if (!checkJpeg(fp, photo.size)) {
        fclose(fp);
        say("PHOTO FAIL " + photo.path + " not-jpeg");
        return true;
    }

    static WiFiClientSecure secure;
    static WiFiClient plain;
    Client* net = &plain;
    if (c.tls) {
        secure.setInsecure();  // demo broker; see Docs/DECISIONS.md (TLS verification is a follow-up)
        secure.setHandshakeTimeout(15);
        net = &secure;
    }
    PubSubClient mqtt(*net);
    mqtt.setServer(c.host.c_str(), c.port);
    mqtt.setSocketTimeout(15);
    mqtt.setKeepAlive(30);
    bool sent = false;
    String reason = "mqtt";
    if (mqtt.connect(c.uid.c_str(), c.user.c_str(), c.pass.c_str())) {
        if (mqtt.beginPublish(c.topic.c_str(), photo.size, false)) {
            static uint8_t buffer[1024];
            size_t total = 0;
            bool ok = true;
            while (total < photo.size) {
                if (!lockSpi()) { ok = false; reason = "sd-busy"; break; }
                const size_t n = fread(buffer, 1, sizeof(buffer), fp);
                unlockSpi();
                if (n == 0) { ok = false; reason = "read"; break; }
                if (mqtt.write(buffer, n) != n) { ok = false; reason = "network"; break; }
                total += n;
            }
            sent = mqtt.endPublish() && ok && total == photo.size;
        } else {
            reason = "publish";
        }
        mqtt.disconnect();
    } else {
        reason = "mqtt-state=" + String(mqtt.state());
    }
    net->stop();
    if (lockSpi()) { fclose(fp); unlockSpi(); } else fclose(fp);
    say(sent ? "PHOTO SENT " + photo.path + " " + String(photo.size) : "PHOTO FAIL " + photo.path + " " + reason);
    return sent;
}

void taskMain(void*) {
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(SCAN_MS));
        if (!currentConfig().valid()) continue;
        scan();
        for (auto& photo : files) {
            if (photo.done || photo.stable < 1) continue;  // size unchanged across two scans
            if (upload(photo)) photo.done = true;
            else if (++photo.attempts >= MAX_ATTEMPTS) photo.done = true;
        }
    }
}

void startTask() {
    if (task) return;
    // Core 0 next to the WiFi stack; low priority so it never delays the sketch's own tasks.
    xTaskCreatePinnedToCore(taskMain, "ptit_cloud", 12288, nullptr, 1, &task, 0);
}

// ---------------------------------------------------------------- sketch input filter

void pump(Stream& s) {
    while (pendingPos >= pending.length() && s.available() > 0) {
        if (!capturing) {
            if (!lineStart || s.peek() != '@') return;
            capturing = true;
            capture = "";
        }
        const int c = s.read();
        if (c < 0) return;
        if (c == '\r') continue;
        if (c == '\n') {
            capturing = false;
            lineStart = true;
            if (capture.startsWith(PREFIX)) handleLine(capture);
            else { pending = capture + "\n"; pendingPos = 0; }
            capture = "";
            continue;
        }
        if (capture.length() < MAX_LINE) capture += static_cast<char>(c);
        // Not our prefix: hand the characters back to the sketch at once instead of waiting for the line end.
        if (capture.length() <= PREFIX_LEN && strncmp(capture.c_str(), PREFIX, capture.length()) != 0) {
            pending = capture;
            pendingPos = 0;
            capture = "";
            capturing = false;
            lineStart = false;
        }
    }
}

}  // namespace

void begin(Stream& s) {
    if (started) return;
    started = true;
    console = &s;
    cfgLock = xSemaphoreCreateMutex();
    load();
    // Boot handshake: the web app answers within milliseconds when it is connected; otherwise the
    // sketch is delayed by this window only (shorter once the board is configured).
    announce();
    const uint32_t window = currentConfig().valid() ? 600 : 2000;
    const uint32_t start = millis();
    String line;
    bool answered = false;
    while (!answered && millis() - start < window) {
        while (s.available() > 0 && !answered) {
            const int c = s.read();
            if (c == '\r' || c < 0) continue;
            if (c == '\n') {
                if (line.startsWith(PREFIX)) answered = handleLine(line);
                line = "";
            } else if (line.length() < MAX_LINE) {
                line += static_cast<char>(c);
            }
        }
        delay(5);
    }
    if (currentConfig().valid()) startTask();
}

int available(Stream& s) {
    pump(s);
    const int buffered = (int)(pending.length() - pendingPos);
    if (buffered > 0) return buffered;
    return capturing ? 0 : s.available();
}

int read(Stream& s) {
    pump(s);
    int c;
    if (pendingPos < pending.length()) {
        c = static_cast<uint8_t>(pending[pendingPos++]);
        if (pendingPos >= pending.length()) { pending = ""; pendingPos = 0; }
    } else if (capturing) {
        return -1;
    } else {
        c = s.read();
    }
    if (c >= 0) lineStart = (c == '\n');
    return c;
}

int peek(Stream& s) {
    pump(s);
    if (pendingPos < pending.length()) return static_cast<uint8_t>(pending[pendingPos]);
    return capturing ? -1 : s.peek();
}

}  // namespace ptit_cloud
