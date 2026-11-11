/**
 * VÍ DỤ NÂNG CAO: CHỤP ẢNH, LƯU THẺ NHỚ VÀ GỬI LÊN MÁY CHỦ QUA MQTT
 *
 * Gửi p/P qua Serial: chụp ảnh -> lưu /photos/image_N.jpg -> đọc lại file và publish
 * JPEG nhị phân (một message, QoS 0) lên sensors/<DEVICE_UID>/image.
 * Máy chủ kiểm tra JPEG, quyền sở hữu thiết bị rồi hiển thị ở Camera Viewer.
 *
 * Điền các hằng số bên dưới từ "firmware_snippet" khi đăng ký/xoay mật khẩu thiết bị
 * (MQTT_PASSWORD chỉ hiện một lần). Không commit mật khẩu thật lên Git.
 * Không phải bài trong giáo trình: chưa nằm trong catalog đã kiểm chứng.
 */
#include <Arduino.h>
#include <PTITCube.h>
#include <PubSubClient.h>
#include <SD.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "";
const char* WIFI_PASSWORD = "";
const char* MQTT_HOST = "";
const int MQTT_PORT = 8883;
const char* MQTT_USERNAME = "";
const char* MQTT_PASSWORD = "";
const char* MQTT_CLIENT_ID = "";
const char* TOPIC_IMAGE = "";
// Root CA của broker (PEM). Để trống chỉ nên dùng khi thử nghiệm: kết nối sẽ KHÔNG xác thực máy chủ.
const char* ROOT_CA = "";

static const size_t MAX_IMAGE_BYTES = 262144;
static const size_t CHUNK_BYTES = 1024;

PTIT_Camera camera;
WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);
int imageCount = 0;

static bool configured() {
    return strlen(WIFI_SSID) && strlen(MQTT_HOST) && strlen(MQTT_USERNAME) && strlen(MQTT_CLIENT_ID) && strlen(TOPIC_IMAGE);
}

static bool ensureConnected() {
    if (WiFi.status() != WL_CONNECTED) {
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
        const uint32_t started = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) delay(250);
        if (WiFi.status() != WL_CONNECTED) { Serial.println("[WIFI] Khong ket noi duoc WiFi"); return false; }
        Serial.println("[WIFI] Da ket noi WiFi");
    }
    if (!mqtt.connected()) {
        if (!mqtt.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
            Serial.printf("[MQTT] Ket noi that bai, state=%d\n", mqtt.state());
            return false;
        }
        Serial.println("[MQTT] Da ket noi broker");
    }
    return true;
}

static bool publishImage(const String& path) {
    if (!ensureConnected()) return false;
    File file = SD.open(path.c_str(), FILE_READ);
    if (!file) { Serial.println("ERROR:IMG_OPEN"); return false; }
    const size_t size = file.size();
    if (size == 0 || size > MAX_IMAGE_BYTES) {
        file.close();
        Serial.printf("ERROR:IMG_SIZE:%u\n", (unsigned)size);
        return false;
    }
    bool ok = mqtt.beginPublish(TOPIC_IMAGE, size, false);
    uint8_t chunk[CHUNK_BYTES];
    size_t sent = 0;
    while (ok && sent < size) {
        const size_t count = file.read(chunk, sizeof(chunk));
        if (count == 0) { ok = false; break; }
        ok = mqtt.write(chunk, count) == count;
        sent += count;
        mqtt.loop();
    }
    file.close();
    ok = ok && sent == size && mqtt.endPublish();
    Serial.println(ok ? "[MQTT] Da gui anh len may chu" : "[MQTT] Gui anh that bai");
    return ok;
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    if (!configured()) Serial.println("[CAU HINH] Dien WIFI_*, MQTT_*, TOPIC_IMAGE tu firmware_snippet truoc khi nap.");
    if (strlen(ROOT_CA)) secureClient.setCACert(ROOT_CA);
    else { secureClient.setInsecure(); Serial.println("[CANH BAO] Chua co ROOT_CA: khong xac thuc may chu MQTT."); }
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setSocketTimeout(15);
    if (!camera.init(12, 14)) Serial.println("[Loi] Khong the khoi tao the nho!");
    Serial.println("[OK] Nhap 'p' de chup anh va gui len may chu.");
}

void loop() {
    if (Serial.available() > 0) {
        const char command = Serial.read();
        if ((command == 'p' || command == 'P') && configured()) {
            String path;
            do { path = "/photos/image_" + String(imageCount++) + ".jpg"; } while (SD.exists(path.c_str()));
            Serial.println("[Camera] Dang chup: " + path);
            if (camera.captureToFile(path.c_str())) {
                Serial.println("[OK] Da luu anh: " + path);
                publishImage(path);
            } else {
                Serial.println("[Loi] Chup anh that bai.");
            }
        }
        while (Serial.available() > 0 && (Serial.peek() == '\r' || Serial.peek() == '\n')) Serial.read();
    }
    mqtt.loop();
    delay(5);
}
