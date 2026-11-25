// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-06_Camera_Multiplexer/blob/e62e4bf749f17df0ef79947e0755bd8d1c603c06/src/main.cpp
/**
 * @file Lab4-06_Camera_Multiplexer
 * @brief Ví dụ minh họa cách sử dụng Multiplexer cho ESP32-CAM và GPS.
 * 
 * Mô tả:
 * - Vệ tinh CubeSat PTITCube sử dụng chung đường UART2 cho cả 
 *   mạch GPS và ESP32-CAM.
 * - ESP32-CAM giao tiếp qua UART2 (GPIO 14 TX / GPIO 15 RX).
 * - Bằng cách điều khiển các chân MUX (gpsSelectPin=12, camSelectPin=14),
 *   ESP32 có thể chọn giao tiếp với GPS hoặc Camera tùy từng thời điểm.
 * 
 * Kết nối phần cứng:
 *   OBC UART2 (GPIO16/17) <--MUX--> GPS UART (9600 baud)
 *                          <--MUX--> ESP32-CAM UART2 GPIO14/15 (115200 baud)
 */

#include <Arduino.h>

#include <PTITCube.h>
#include <SD.h>

PTIT_CDH cdh;

// Khởi tạo các phân hệ
PTIT_Camera camera;
PTIT_GPS gps;

void setup() {
    cdh.begin(115200);
    delay(2000);
    
    cdh.println("\n--- TEST CHUYỂN MẠCH CAMERA & GPS ---");
    cdh.println("ESP32-CAM giao tiep qua UART2 (GPIO14-TX, GPIO15-RX)");
    cdh.println("OBC ket noi qua UART2 (GPIO16-RX, GPIO17-TX) + MUX");

    // Khởi tạo Camera (chân select GPS = 12, Camera = 14)
    if (!camera.init(12, 14)) {
        cdh.println("[Canh bao] Camera init co loi (Co the chua gan the nho).");
    }

    // Khởi tạo GPS (cùng chân MUX)
    gps.init(12, 14);
}

void loop() {
    cdh.println("\n>>> Che do: UU TIEN CAMERA");
    camera.selectCamera(); // Bật kênh giao tiếp cho Camera, tắt GPS
    
    // Đợi một chút để mạch chuyển đổi ổn định
    delay(100); 

    { // Retry SD mount through captureToFile even after initialization failed.
        cdh.println("Chụp ảnh bằng Camera...");
        static uint32_t nextImage = 0;
        String path;
        do { path = "/photos/multiplexer_" + String(nextImage++) + ".jpg"; } while (SD.exists(path.c_str()));
        bool saved = camera.captureToFile(path.c_str());
        cdh.println(saved ? "[RESULT] JPEG saved and validated" : "[RESULT] Capture failed; see camera error above");
    }
    
    delay(5000);

    cdh.println("\n>>> Che do: UU TIEN GPS");
    gps.selectGPS(); // Bật kênh giao tiếp cho GPS, tắt Camera
    
    // Đợi một chút để GPS có thể gửi dữ liệu
    delay(1000);

    // Đọc dữ liệu từ GPS trong 5 giây
    cdh.println("Dang doc du lieu GPS...");
    unsigned long startTime = millis();
    while (millis() - startTime < 5000) {
        gps.update();
        if (gps.hasFix()) {
            cdh.print("Lat: "); cdh.print(gps.getLatitude(), 6);
            cdh.print(" - Lng: "); cdh.println(gps.getLongitude(), 6);
            break; // Đã có vị trí, thoát vòng lặp
        }
        delay(10);
    }
    
    if (!gps.hasFix()) {
        cdh.println("GPS chua chot duoc vi tri (No Fix).");
    }

    // Đợi một lát trước vòng lặp tiếp theo
    delay(2000);
}
