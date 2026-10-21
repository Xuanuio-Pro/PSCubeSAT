// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-03_Satellite_Comm_System/blob/3053a45cc28a1d7d4028cb90301076ad4ea5145d/src/main.cpp
/**
 * VÍ DỤ TỔNG HỢP: HỆ THỐNG GIAO TIẾP VỆ TINH FULL DUPLEX (COMMAND & TELEMETRY)
 * 
 * Lưu ý: Trạm mặt đất (Ground Station) sử dụng mạch USB-TTL nối trực tiếp với module LoRa,
 * do đó đoạn code này được nạp vào Vệ Tinh (OBC ESP32).
 * 
 * Nhiệm vụ của Vệ tinh:
 * 1. Lắng nghe liên tục lệnh (Command) từ Trạm mặt đất qua LoRa.
 * 2. Thực thi lệnh tương ứng (Đo pin, đọc cảm biến, chụp ảnh...).
 * 3. Đóng gói dữ liệu và phản hồi lại Trạm mặt đất qua LoRa.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <PTITCube.h>

// Khởi tạo các phân hệ
PTIT_COM lora;
PTIT_EPS eps;
PTIT_Sensor sensor;
PTIT_GPS gps;

#define LED_PIN 2

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n==========================================");
    Serial.println("  VỆ TINH (SATELLITE) ĐANG KHỞI ĐỘNG...");
    Serial.println("==========================================");
    
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Khởi tạo các module
    Serial.println("[INIT] Đang khởi tạo LoRa...");
    lora.init();
    
    Serial.println("[INIT] Đang khởi tạo Cảm biến và Nguồn...");
    eps.init();
    sensor.init(); 
    gps.init();

    Serial.println("==========================================");
    Serial.println("VỆ TINH SẴN SÀNG NHẬN LỆNH TỪ TRẠM MẶT ĐẤT");
}

void loop() {
    // Luôn cập nhật cảm biến và GPS để có dữ liệu mới nhất
    sensor.update();
    gps.update();

    // Lắng nghe lệnh từ mặt đất qua sóng LoRa
    String incomingCmd = lora.update();
    
    if (incomingCmd.length() > 0) {
        incomingCmd.trim();
        incomingCmd.toLowerCase(); // Chuẩn hóa chữ thường
        
        Serial.println("\n[RX] Nhận được lệnh từ mặt đất: " + incomingCmd);

        // --- XỬ LÝ CÁC LỆNH (COMMANDS) ---
        
        if (incomingCmd == "ping") {
            lora.sendMessage("pong - Vệ tinh đang hoạt động tốt!");
        } 
        else if (incomingCmd == "battery" || incomingCmd == "bat") {
            float v = eps.getBatteryVoltage();
            char buffer[64];
            snprintf(buffer, sizeof(buffer), "Điện áp Pin vệ tinh: %.2f V", v);
            lora.sendMessage(String(buffer));
        }
        else if (incomingCmd == "sensor" || incomingCmd == "env") {
            float t = sensor.getTemperature();
            float p = sensor.getPressure();
            char buffer[64];
            snprintf(buffer, sizeof(buffer), "Nhiệt độ: %.2f C | Áp suất: %.1f hPa", t, p);
            lora.sendMessage(String(buffer));
        }
        else if (incomingCmd == "imu") {
            char buffer[128];
            snprintf(buffer, sizeof(buffer), "Gia tốc (X:%.1f Y:%.1f Z:%.1f) | Gyro (X:%.1f Y:%.1f Z:%.1f)", 
                     sensor.getAccX(), sensor.getAccY(), sensor.getAccZ(),
                     sensor.getGyroX(), sensor.getGyroY(), sensor.getGyroZ());
            lora.sendMessage(String(buffer));
        }
        else if (incomingCmd == "gps") {
            char buffer[64];
            snprintf(buffer, sizeof(buffer), "GPS: Lat %f, Lng %f", gps.getLat(), gps.getLng());
            if (gps.hasFix()) lora.sendMessage(String(buffer));
            else lora.sendMessage("GPS: no valid fix");
        }
        else if (incomingCmd == "led on") {
            digitalWrite(LED_PIN, HIGH);
            lora.sendMessage("Đã bật LED trên OBC.");
        }
        else if (incomingCmd == "led off") {
            digitalWrite(LED_PIN, LOW);
            lora.sendMessage("Đã tắt LED trên OBC.");
        }
        else if (incomingCmd == "telemetry") {
            // Gửi một gói JSON chứa toàn bộ trạng thái
            JsonDocument doc;
            doc["battery_v"] = eps.getBatteryVoltage();
            doc["temp"] = sensor.getTemperature();
            doc["pressure"] = sensor.getPressure();
            doc["valid"] = gps.hasFix();
            if (gps.hasFix()) { doc["lat"] = gps.getLat(); doc["lng"] = gps.getLng(); }
            else { doc["lat"] = nullptr; doc["lng"] = nullptr; }
            
            String jsonOutput;
            serializeJson(doc, jsonOutput);
            lora.sendMessage(jsonOutput);
        }
        else {
            lora.sendMessage("Lỗi: Lệnh [" + incomingCmd + "] không hợp lệ! Các lệnh hỗ trợ: ping, battery, sensor, imu, gps, led on/off, telemetry.");
        }
    }

    delay(1);
    // Tuỳ chọn: Có thể cấu hình vệ tinh tự động bắn Telemetry mỗi 5 giây mà không cần lệnh
    // Bằng cách sử dụng millis() ở đây.
}
