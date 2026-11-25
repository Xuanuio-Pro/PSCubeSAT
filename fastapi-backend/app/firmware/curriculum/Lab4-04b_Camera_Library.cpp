// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-04b_Camera_Library/blob/95ecd5975c7d3e7d2854f550aff90c6833e27210/src/main.cpp
/**
 * VÍ DỤ 4-4b: CHỤP ẢNH & LƯU THẺ NHỚ BẰNG THƯ VIỆN PTITCUBE
 */
#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>
#include <base64.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_Camera camera;
int imageCount = 0;

// Gửi ảnh đã lưu trên thẻ SD về trình duyệt qua Serial theo từng khối base64 (Camera Viewer).
// Giao thức: IMG_BEGIN:<số byte> -> nhiều dòng IMG_CHUNK:<base64 của 384 byte> -> IMG_END
static bool sendImageOverSerial(const String& path) {
    File file = SD.open(path.c_str(), FILE_READ);
    if (!file) { cdh.println("ERROR:IMG_OPEN"); return false; }
    const size_t size = file.size();
    if (size == 0 || size > 262144) {
        file.close();
        cdh.printf("ERROR:IMG_SIZE:%u\n", (unsigned)size);
        return false;
    }
    cdh.printf("IMG_BEGIN:%u\n", (unsigned)size);
    uint8_t chunk[384];
    size_t sent = 0;
    while (sent < size) {
        const size_t count = file.read(chunk, sizeof(chunk));
        if (count == 0) break;
        cdh.print("IMG_CHUNK:");
        cdh.println(base64::encode(chunk, count));
        sent += count;
        delay(2);
    }
    file.close();
    if (sent != size) { cdh.println("ERROR:IMG_READ"); return false; }
    cdh.println("IMG_END");
    return true;
}

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn camera và ngoại vi qua thư viện EPS
    eps.setBuckState(true);

    if (!camera.init()) {
        cdh.println("Camera: The nho chua san sang; go 'capture' de thu lai.");
    }

    cdh.println("Camera: San sang. Go 'p' hoac 'capture' de chup anh.");
}

void loop() {
    static String cmd;
    // Lệnh dài quá 32 ký tự bị bỏ, không làm tràn bộ nhớ.
    while (cdh.available()) {
        const char c = cdh.read();
        if (c != '\n') {
            if (c != '\r' && cmd.length() < 32) cmd += c;
            continue;
        }
        cmd.trim();
        if (cmd.equalsIgnoreCase("capture") || cmd.equalsIgnoreCase("photo") || cmd.equalsIgnoreCase("p")) {
            // Không ghi đè ảnh cũ trên thẻ nhớ.
            String path;
            do { path = "/photos/image_" + String(imageCount++) + ".jpg"; } while (SD.exists(path.c_str()));
            cdh.println("Camera: Dang chup " + path);

            if (camera.captureToFile(path.c_str())) {
                sendImageOverSerial(path);
            } else {
                cdh.println("Camera: Chup that bai.");
            }
        } else if (cmd.length() > 0) {
            cdh.printf("Camera: Lenh '%s' khong hop le. Go 'capture' de chup anh.\n", cmd.c_str());
        }
        cmd = "";
    }
}
