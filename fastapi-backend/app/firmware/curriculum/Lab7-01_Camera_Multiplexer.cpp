/**
 * @file 2_Camera_Multiplexer.cpp
 * @brief Ví dụ minh họa cách sử dụng Multiplexer cho ESP32-CAM và GPS.
 * 
 * Mô tả:
 * - Vệ tinh CubeSat PTITCube sử dụng chung giao tiếp (UART) cho cả 
 *   mạch GPS và ESP32-CAM (truyền ảnh UART hoặc kích hoạt phần cứng).
 * - Bằng cách điều khiển các chân `gpsSelectPin` và `camSelectPin`,
 *   ESP32 có thể chọn giao tiếp với GPS hoặc Camera tùy từng thời điểm.
 */

#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>

// Khởi tạo các phân hệ
PTIT_Camera camera;
PTIT_GPS gps;

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n--- TEST CHUYỂN MẠCH CAMERA & GPS ---");

    // Khởi tạo Camera (chân select GPS = 12, Camera = 14)
    if (!camera.init(12, 14)) {
        Serial.println("[Cảnh báo] Camera init có lỗi (Có thể chưa gắn thẻ nhớ).");
    }

    // Khởi tạo GPS
    gps.init();
}

void loop() {
    Serial.println("\n>>> Chế độ: ƯU TIÊN CAMERA");
    camera.selectCamera(); // Bật kênh giao tiếp cho Camera, tắt GPS
    
    // Đợi một chút để mạch chuyển đổi ổn định
    delay(100); 

    { // Retry SD mount through captureToFile even after initialization failed.
        Serial.println("Chụp ảnh bằng Camera...");
        static uint32_t nextImage = 0;
        String path;
        do { path = "/photos/multiplexer_" + String(nextImage++) + ".jpg"; } while (SD.exists(path.c_str()));
        bool saved = camera.captureToFile(path.c_str());
        Serial.println(saved ? "[RESULT] JPEG saved and validated" : "[RESULT] Capture failed; see camera error above");
    }
    
    delay(5000);

    Serial.println("\n>>> Chế độ: ƯU TIÊN GPS");
    camera.selectGPS(); // Bật kênh giao tiếp cho GPS, tắt Camera
    
    // Đợi một chút để GPS có thể gửi dữ liệu
    delay(1000);

    // Đọc dữ liệu từ GPS trong 5 giây
    Serial.println("Đang đọc dữ liệu GPS...");
    unsigned long startTime = millis();
    while (millis() - startTime < 5000) {
        gps.update();
        if (gps.hasFix()) {
            Serial.print("Lat: "); Serial.print(gps.getLatitude(), 6);
            Serial.print(" - Lng: "); Serial.println(gps.getLongitude(), 6);
            break; // Đã có vị trí, thoát vòng lặp
        }
        delay(10);
    }
    
    if (!gps.hasFix()) {
        Serial.println("GPS chưa chốt được vị trí (No Fix).");
    }

    // Đợi một lát trước vòng lặp tiếp theo
    delay(2000);
}
