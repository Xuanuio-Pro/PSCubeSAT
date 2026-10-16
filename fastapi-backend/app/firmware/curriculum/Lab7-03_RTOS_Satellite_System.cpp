// Source: https://github.com/PTITCube/Lab7-03_RTOS_Satellite_System
// Unlock only after successful lock. Full runtime integration still requires validation.
/**
 * CUBESAT FIRMWARE - MAIN FILE
 * Đây là file chạy tổng thể kết hợp toàn bộ các phân hệ của vệ tinh:
 * - EPS (Quản lý pin)
 * - Cảm biến (Gia tốc, La bàn, Nhiệt độ, Áp suất)
 * - GPS (Định vị)
 * - Thẻ nhớ MicroSD (Lưu trữ log nội bộ)
 * - Viễn thông LoRa E32 (Gửi/Nhận tin nhắn vô tuyến)
 * - CDH (Xử lý trung tâm, WiFi & MQTT Telemetry)
 *
 * FreeRTOS được quản lý tự động bởi PTIT_Scheduler.
 * Người dùng chỉ cần viết logic nghiệp vụ trong các hàm thông thường.
 */

#include <Arduino.h>
#include "PTITCube.h"
#include <ArduinoJson.h>
#include <atomic>
#ifndef PTIT_ENABLE_GPS
#define PTIT_ENABLE_GPS 1
#endif
#ifndef PTIT_ENABLE_LORA
#define PTIT_ENABLE_LORA 1
#endif

struct BusGuard {
    uint8_t bus; bool held;
    BusGuard(uint8_t b, uint32_t timeout = 100) : bus(b), held(PTIT_Scheduler::lock(b, timeout)) {}
    ~BusGuard() { if (held) PTIT_Scheduler::unlock(bus); }
    explicit operator bool() const { return held; }
    BusGuard(const BusGuard&) = delete;
    BusGuard& operator=(const BusGuard&) = delete;
};

// ============================================================================
// 1. KHAI BÁO CÁC ĐỐI TƯỢNG PHÂN HỆ VỆ TINH
// ============================================================================
PTIT_Sensor sensor;
PTIT_GPS gps;
PTIT_COM lora;
PTIT_EPS eps;
PTIT_Storage storage;
PTIT_CDH cdh;
PTIT_Camera camera;

PTIT_Scheduler scheduler;

// Trạng thái hệ thống
std::atomic<bool> isTelemetryPaused{false};

// ============================================================================
// 2. ĐỊNH NGHĨA CÁC HÀM TASK (logic nghiệp vụ thuần túy)
//    Mỗi hàm sẽ được Scheduler gọi lặp lại theo chu kỳ đã đăng ký.
// ============================================================================

// CDH: Duy trì kết nối WiFi & MQTT
void cdhLoop() {
    BusGuard guard(PTIT_BUS_MQTT);
    if (guard) cdh.update();
}

// Sensor: Đọc cảm biến qua I2C (BMP280, MPU6050/MPU6500, QMC5883L)
void sensorLoop() {
    if (isTelemetryPaused) return;
    if (PTIT_Scheduler::lock(PTIT_BUS_I2C)) {
        sensor.update();
        PTIT_Scheduler::unlock(PTIT_BUS_I2C);
    }
}

// GPS: Feed dữ liệu NMEA từ UART2
void gpsLoop() {
    if (!PTIT_ENABLE_GPS) return;
    if (isTelemetryPaused) return;
    if (PTIT_Scheduler::lock(PTIT_BUS_UART2, 100)) {
        camera.selectGPS();
        gps.update();
        PTIT_Scheduler::unlock(PTIT_BUS_UART2);
    }
}

// COM: Nhận và xử lý lệnh từ trạm mặt đất qua LoRa
// Xử lý các lệnh hệ thống (trả về chuỗi rỗng nếu không phải lệnh hệ thống)
String processSystemCommand(String command) {
    if (command == "ping") {
        if (!PTIT_ENABLE_LORA) return "PONG (local Serial)";
        PTIT_Scheduler::println("[CMD] ping");
        if (PTIT_ENABLE_LORA && PTIT_Scheduler::lock(PTIT_BUS_LORA, 500)) {
            for (int i = 0; i < 4; i++) {
                lora.sendMessage("ACK " + String(i + 1) + "/4");
                delay(200);
            }
            PTIT_Scheduler::unlock(PTIT_BUS_LORA);
        }
        return "PING_HANDLED"; // Cờ đặc biệt để không gửi response chung
    }
    if (command == "reboot") {
        PTIT_Scheduler::println("[CMD] reboot");
        if (PTIT_ENABLE_LORA && PTIT_Scheduler::lock(PTIT_BUS_LORA, 500)) {
            lora.sendMessage("Rebooting...");
            PTIT_Scheduler::unlock(PTIT_BUS_LORA);
        }
        delay(500);
        ESP.restart();
    }
    if (command == "get_gps") {
        BusGuard guard(PTIT_BUS_UART2);
        if (!guard) return "ERR: UART2 busy";
        if (!PTIT_ENABLE_GPS || !gps.hasFix()) return "GPS: no valid fix";
        return "GPS: Lat=" + String(gps.getLat(), 6) + ", Lng=" + String(gps.getLng(), 6);
    }
    if (command == "get_sensor") {
        BusGuard guard(PTIT_BUS_I2C);
        if (!guard) return "ERR: I2C busy";
        return "Sensor: Temp=" + String(sensor.getTemperature(), 2) + "C, Press=" + String(sensor.getPressure(), 2) + "hPa";
    }
    if (command == "get_eps") {
        BusGuard guard(PTIT_BUS_I2C); // Shared sensor/ADC snapshot lock.
        if (!guard) return "ERR: Sensors busy";
        return "EPS: Battery=" + String(eps.getBatteryVoltage(), 2) + "V";
    }
    if (command == "clear_log") {
        if (!PTIT_Scheduler::lock(PTIT_BUS_SPI, 200)) return "ERR: SD busy";
        String res = storage.removeFile("/datalog.txt") ? "Log cleared" : "ERR: rm /datalog.txt";
        PTIT_Scheduler::unlock(PTIT_BUS_SPI);
        return res;
    }
    if (command == "capture") {
        BusGuard uart(PTIT_BUS_UART2, 1000);
        if (!uart) return "ERR: UART2 busy";
        BusGuard spi(PTIT_BUS_SPI, 1000);
        if (!spi) return "ERR: SD busy";
        bool success = camera.capture();
        return success ? "Photo captured!" : "ERR: Capture failed";
    }
    if (command == "status") {
        BusGuard guard(PTIT_BUS_I2C);
        if (!guard) return "ERR: Sensors busy";
        return "STATUS: Up " + String(millis() / 1000) + "s, Bat=" + String(eps.getBatteryVoltage(), 1) + 
               "V, SD=" + (storage.isReady() ? "OK" : "ERR") + (isTelemetryPaused ? " (PAUSED)" : " (ACTIVE)");
    }
    if (command == "uptime") {
        unsigned long sec = millis() / 1000;
        return "Uptime: " + String(sec / 3600) + "h " + String((sec / 60) % 60) + "m " + String(sec % 60) + "s";
    }
    if (command == "pause") {
        isTelemetryPaused = true;
        return "Telemetry PAUSED. Satellite is in standby mode.";
    }
    if (command == "resume") {
        isTelemetryPaused = false;
        return "Telemetry RESUMED. Realtime data active.";
    }
    if (command == "help") {
        return "ping|reboot|uptime|get_gps|get_sensor|get_eps|status|clear_log|capture|pause|resume|pwd|cd|ls|mkdir|rmdir|rm|touch|help";
    }
    return "";
}

// Hỗ trợ lệnh hệ thống + lệnh file/thư mục kiểu Linux
void comLoop() {
    if (!PTIT_ENABLE_LORA) return;
    String cmd = "";
    if (PTIT_Scheduler::lock(PTIT_BUS_LORA)) {
        cmd = lora.update();
        PTIT_Scheduler::unlock(PTIT_BUS_LORA);
    }

    if (cmd.length() > 0) {
        cmd.trim();
        String command = PTIT_Utils::extractCommand(cmd);
        String response = processSystemCommand(command);

        if (response == "PING_HANDLED") return; // Lệnh ping đã tự xử lý

        // Nếu không phải lệnh hệ thống, chuyển cho SD Card xử lý
        if (response == "") {
            if (PTIT_Scheduler::lock(PTIT_BUS_SPI, 200)) {
                response = storage.handleCommand(cmd);
                PTIT_Scheduler::unlock(PTIT_BUS_SPI);
            } else {
                response = "ERR: SD busy";
            }
            if (response == "") response = "ERR: Unknown cmd '" + command + "'. Send 'help'";
        }

        // Gửi phản hồi qua LoRa
        PTIT_Scheduler::println("[CMD] " + command + " → " + response);
        if (PTIT_Scheduler::lock(PTIT_BUS_LORA, 500)) {
            lora.sendMessage(response);
            PTIT_Scheduler::unlock(PTIT_BUS_LORA);
        }
    }
}

// Telemetry: Thu thập dữ liệu → gửi MQTT + LoRa + ghi SD
void telemetryLoop() {
    if (isTelemetryPaused) return;
    String payloads[6];
    const char* labels[] = {"EPS", "Env", "Acc", "Gyro", "Mag", "GPS"};
    const char* topics[] = {"eps", "env", "acc", "gyro", "mag", "gps"};
    JsonDocument doc;
    auto encode = [&](int index) {
        payloads[index].reserve(160);
        serializeJson(doc, payloads[index]); // Non-finite measurements become JSON null.
        doc.clear();
    };
    {
        BusGuard guard(PTIT_BUS_I2C);
        if (!guard) { PTIT_Scheduler::println("[TELEMETRY] I2C snapshot busy; skipped"); return; }
        doc["battery_v"] = eps.getBatteryVoltage(); encode(0);
        doc["temp"] = sensor.getTemperature(); doc["pressure"] = sensor.getPressure(); encode(1);
        doc["acc_x"] = sensor.getAccX(); doc["acc_y"] = sensor.getAccY(); doc["acc_z"] = sensor.getAccZ(); encode(2);
        doc["gyro_x"] = sensor.getGyroX(); doc["gyro_y"] = sensor.getGyroY(); doc["gyro_z"] = sensor.getGyroZ(); encode(3);
        doc["mag_x"] = sensor.getMagX(); doc["mag_y"] = sensor.getMagY(); doc["mag_z"] = sensor.getMagZ(); encode(4);
    }
    {
        BusGuard guard(PTIT_BUS_UART2, 20);
        bool valid = guard && PTIT_ENABLE_GPS && gps.hasFix();
        doc["valid"] = valid;
        if (valid) { doc["lat"] = gps.getLat(); doc["lng"] = gps.getLng(); }
        else { doc["lat"] = nullptr; doc["lng"] = nullptr; }
        encode(5);
    }
    for (int i = 0; i < 6; ++i) PTIT_Scheduler::println(String("[TELEMETRY] ") + labels[i] + ": " + payloads[i]);
    {
        BusGuard guard(PTIT_BUS_SPI, 200);
        if (guard) {
            String batch; batch.reserve(1024);
            for (const auto& payload : payloads) { batch += payload; batch += '\n'; }
            bool saved = storage.appendFile("/datalog.txt", batch.c_str());
            PTIT_Scheduler::println(saved ? "[SD] telemetry saved" : "[SD] telemetry write failed");
        } else PTIT_Scheduler::println("[SD] busy; telemetry not saved");
    }
    {
        BusGuard guard(PTIT_BUS_MQTT, 200);
        if (guard) for (int i = 0; i < 6; ++i) {
            String topic = String("cubesat/telemetry/") + topics[i];
            cdh.publishData(topic.c_str(), payloads[i].c_str());
        }
    }
    if (PTIT_ENABLE_LORA) for (const auto& payload : payloads) {
        if (isTelemetryPaused) break;
        BusGuard guard(PTIT_BUS_LORA, 200);
        if (guard) lora.sendMessage(payload);
    }
}

// Local diagnostic commands use the same resource locks as radio commands.
void serialLoop() {
    static String command;
    static bool discard = false;
    for (int budget = 0; budget < 64 && Serial.available(); ++budget) {
        char c = Serial.read();
        if (c == '\n') {
            if (!discard) {
                command.trim();
                if (command.length()) {
                    String response = processSystemCommand(command);
                    PTIT_Scheduler::println(response.length() ? response : "ERR: Unknown command");
                }
            }
            command = ""; discard = false;
        } else if (!discard && c != '\r') {
            if (command.length() < 128) command += c;
            else { command = ""; discard = true; }
        }
    }
}

// ============================================================================
// 3. SETUP - Khởi tạo phân hệ + đăng ký task
// ============================================================================
void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    // Khởi tạo các phân hệ
    sensor.init();
    if (PTIT_ENABLE_GPS) gps.init();
    if (PTIT_ENABLE_LORA) lora.init();
    eps.init();
    storage.init();
    cdh.init();
    camera.init(12, 14);

    // Cấu hình LoRa
    if (PTIT_ENABLE_LORA) { lora.setChannel(23); lora.setTransmissionMode(0); }

    // Đăng ký các task vào Scheduler
    //                      Tên            Hàm            Chu kỳ   Core  Priority  Stack
    scheduler.addTask("CDH",       cdhLoop,       500,    0,    2,        8192);
    scheduler.addTask("Sensor",    sensorLoop,    200,    1,    3,        4096);
    if (PTIT_ENABLE_GPS) scheduler.addTask("GPS",       gpsLoop,       10,     1,    3,        4096);
    if (PTIT_ENABLE_LORA) scheduler.addTask("COM",       comLoop,       100,    1,    2,        4096);
    scheduler.addTask("Telemetry", telemetryLoop, 5000,   1,    1,        8192);

    // Bật watchdog: nếu task bị treo > 30s → ESP32 tự reset
    scheduler.addTask("Serial", serialLoop, 20, 1, 1, 8192);
    scheduler.enableWatchdog(30);

    // Bắt đầu chạy đa nhiệm!
    scheduler.start();

    Serial.println("CubeSat Firmware v2.0 — Đang hoạt động!");
}

// ============================================================================
// 4. LOOP - Trống (logic đã phân phối vào các task riêng)
// ============================================================================
void loop() {
    vTaskDelay(pdMS_TO_TICKS(10000));
}
