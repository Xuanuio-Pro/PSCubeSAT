// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-03c_GPS_PTITCube/blob/cb9876b100c8e0a14e02d9933ca2fa153e4bd7af/src/main.cpp
/**
 * LAB 4 - VÍ DỤ 03c: GIẢI MÃ NMEA THÀNH DỮ LIỆU ĐỊNH VỊ BẰNG THƯ VIỆN PTITCUBE
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_GPS gps;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn GPS và ngoại vi qua thư viện EPS
    eps.setBuckState(true);

    gps.init();
}

void loop() {
    gps.update();

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint >= 2000) {
        lastPrint = millis();

        int sats = gps.getSatellites();
        // Chỉ in tọa độ khi đã chốt vị trí (fix hợp lệ, mới hơn 5 s). Thấy vệ tinh chưa có nghĩa
        // là có tọa độ: khi chưa fix, getLat()/getLng() trả 0,0 và bản đồ sẽ vẽ sai vị trí.
        if (gps.hasFix()) {
            cdh.printf("GPS: %d sats | Lat: %.6f, Lng: %.6f | Alt: %.1fm | Spd: %.1fkm/h | HDOP: %.1f\n",
                       sats, gps.getLat(), gps.getLng(),
                       gps.getAltitude(), gps.getSpeed(), gps.getHDOP());
        } else {
            cdh.printf("GPS: Đang quét tìm vệ tinh... (%d sats, chưa có fix)\n", sats);
        }
    }
}
