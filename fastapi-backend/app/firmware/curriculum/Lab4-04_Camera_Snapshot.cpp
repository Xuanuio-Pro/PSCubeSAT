// Lab4-04: OBC MUX pins 12/14; send p to capture. Preserve existing SD images.
// Source: https://github.com/PTITCube/Lab4-04_Camera_Snapshot
/**
 * @file 1_Capture_To_SD.cpp
 * @brief Ví dụ cơ bản về khởi tạo Camera và chụp ảnh lưu vào thẻ MicroSD.
 * 
 * Mô tả:
 * - Khởi tạo module ESP32-CAM và thẻ nhớ MicroSD.
 * - Khi nhận p/P qua Serial, chụp một bức ảnh và lưu vào thẻ nhớ với tên 
 *   tuần tự (VD: /photos/image_0.jpg, /photos/image_1.jpg).
 * 
 * Lưu ý: 
 * - Đảm bảo chân CS của thẻ nhớ đã được cấu hình đúng (Mặc định: GPIO 13).
 */

#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>

PTIT_Camera camera;
int imageCount = 0;

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n--- CAMERA / SD INITIALIZATION ---");

    if (!camera.init(12, 14)) {
        Serial.println("[Loi] Khong the khoi tao the nho!");
        Serial.println("[SD] Kiem tra the; gui p de thu mount/chup lai.");
    }

    Serial.println("[OK] Nhap 'p' de chup anh.");
}

void loop() {
    if (Serial.available() > 0) {
        char command = Serial.read();

        if (command == 'p' || command == 'P') {
            String path;
            do { path = "/photos/image_" + String(imageCount++) + ".jpg"; } while (SD.exists(path.c_str()));
            Serial.println("[Camera] Dang chup: " + path);

            if (camera.captureToFile(path.c_str())) {
                Serial.println("[OK] Da luu anh: " + path);

            } else {
                Serial.println("[Loi] Chup anh that bai.");
            }
        }

        // Consume CR/LF from the same Serial Monitor command.
        while (Serial.available() > 0) {
            char trailing = Serial.peek();
            if (trailing != '\r' && trailing != '\n') {
                break;
            }
            Serial.read();
        }
    }
    delay(5);
}
