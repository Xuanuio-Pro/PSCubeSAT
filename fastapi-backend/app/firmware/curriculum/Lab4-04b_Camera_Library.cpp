// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-04b_Camera_Library/blob/cfa93f99b96d4be3e8354a31a3d5b191051c5451/src/main.cpp
// Lab4-04: OBC MUX pins 12/14; send p to capture. Preserve existing SD images.
// Source: https://github.com/PTITCube/Lab4-04_Camera_Snapshot
/**
 * @file 1_Capture_To_SD.cpp
 * @brief Ví dụ cơ bản về khởi tạo Camera và chụp ảnh lưu vào thẻ MicroSD.
 * 
 * Mô tả:
 * - Khởi tạo module ESP32-CAM và thẻ nhớ MicroSD.
 * - Khi nhận p/P qua Serial, chụp một bức ảnh và lưu vào thẻ nhớ với tên 
 *   tuần tự (VD: /photos/image_0.jpg, /photos/image_1.jpg), rồi gửi ảnh vừa lưu
 *   về trình duyệt qua Serial để hiển thị ở Camera Viewer.
 * 
 * Lưu ý: 
 * - Đảm bảo chân CS của thẻ nhớ đã được cấu hình đúng (Mặc định: GPIO 13).
 */

#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>
#include <base64.h>

PTIT_Camera camera;
int imageCount = 0;

// Gửi ảnh đã lưu trên thẻ SD về trình duyệt qua Serial theo từng khối base64 (không cần WiFi/MQTT).
// Giao thức: IMG_BEGIN:<số byte> -> nhiều dòng IMG_CHUNK:<base64 của 384 byte> -> IMG_END
static bool sendImageOverSerial(const String& path) {
    File file = SD.open(path.c_str(), FILE_READ);
    if (!file) { Serial.println("ERROR:IMG_OPEN"); return false; }
    const size_t size = file.size();
    if (size == 0 || size > 262144) {
        file.close();
        Serial.printf("ERROR:IMG_SIZE:%u\n", (unsigned)size);
        return false;
    }
    Serial.printf("IMG_BEGIN:%u\n", (unsigned)size);
    uint8_t chunk[384];
    size_t sent = 0;
    while (sent < size) {
        const size_t count = file.read(chunk, sizeof(chunk));
        if (count == 0) break;
        Serial.print("IMG_CHUNK:");
        Serial.println(base64::encode(chunk, count));
        sent += count;
        delay(2);
    }
    file.close();
    if (sent != size) { Serial.println("ERROR:IMG_READ"); return false; }
    Serial.println("IMG_END");
    return true;
}

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
                sendImageOverSerial(path);

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
