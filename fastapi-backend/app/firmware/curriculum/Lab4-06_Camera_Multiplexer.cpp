// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-05_Camera_Multiplexer/blob/7e99ead021ffe89deef94c71ec4d535c06bda922/src/main.cpp
/**
 * VÍ DỤ 4-05: CHUYỂN MẠCH CAMERA & GPS QUA MULTIPLEXER 74HC4066
 */
#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>
#include <base64.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_Camera camera;
PTIT_GPS gps;
int photoCount = 0;

// Gửi ảnh vừa lưu về trình duyệt qua Serial (IMG_BEGIN / IMG_CHUNK base64 / IMG_END), giống Lab4-04b.
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

    // Kích hoạt hạ áp cấp nguồn camera, GPS và ngoại vi qua thư viện EPS
    eps.setBuckState(true);

    camera.init();
    gps.init();
    gps.selectGPS();
}

void loop() {
    if (cdh.available()) {
        char cmd = cdh.read();
        if (cmd == 'p' || cmd == 'P') {
            camera.selectCamera();
            delay(200);

            // Không ghi đè ảnh cũ trên thẻ nhớ.
            String path;
            do { path = "/photos/mux_" + String(photoCount++) + ".jpg"; } while (SD.exists(path.c_str()));
            if (camera.captureToFile(path.c_str())) {
                sendImageOverSerial(path);
            } else {
                cdh.println("Camera: Chup that bai.");
            }

            gps.selectGPS();
            delay(100);
        }
    }

    gps.update();
    static unsigned long lastGps = 0;
    if (millis() - lastGps >= 2000) {
        lastGps = millis();
        if (gps.hasFix()) {
            cdh.printf("GPS: Lat: %.6f, Lng: %.6f\n", gps.getLatitude(), gps.getLongitude());
        } else {
            // Cho thấy kênh GPS qua MUX vẫn hoạt động khi chưa có fix (cùng định dạng Lab4-03c).
            cdh.printf("GPS: Đang quét tìm vệ tinh... (%d sats, chưa có fix)\n", gps.getSatellites());
        }
    }
}
