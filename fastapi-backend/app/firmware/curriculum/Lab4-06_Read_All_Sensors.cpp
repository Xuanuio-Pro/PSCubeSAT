// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-06_Read_All_Sensors/blob/126ba36a88f6c945563f8bbd3469f7278414771c/src/main.cpp
/**
 * VÍ DỤ 4-06: ĐỌC TỔNG HỢP TẤT CẢ CẢM BIẾN & ĐỊNH VỊ GPS
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;

PTIT_Sensor sensor;
PTIT_GPS gps;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn toàn bộ cảm biến, GPS qua thư viện EPS
    eps.setBuckState(true);

    sensor.init();
    gps.init();
}

void loop() {
    sensor.update();
    gps.update();

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint >= 2000) {
        lastPrint = millis();

        // Chỉ in tọa độ khi đã chốt vị trí: chưa fix thì getLat()/getLng() trả 0,0.
        if (gps.hasFix()) {
            cdh.printf("TELEM: T: %.1fC | P: %.1fhPa | Roll: %.1f | Pitch: %.1f | GPS: (%.4f, %.4f, %dsats)\n",
                       sensor.getTemperature(), sensor.getPressure(),
                       sensor.getRoll(), sensor.getPitch(),
                       gps.getLat(), gps.getLng(), gps.getSatellites());
        } else {
            cdh.printf("TELEM: T: %.1fC | P: %.1fhPa | Roll: %.1f | Pitch: %.1f | GPS: (no fix, %dsats)\n",
                       sensor.getTemperature(), sensor.getPressure(),
                       sensor.getRoll(), sensor.getPitch(), gps.getSatellites());
        }
        // Gia tốc thô cho mô hình tư thế 3D trên giao diện (cùng định dạng Lab 4-2b).
        cdh.printf("Accel: X: %6.2f, Y: %6.2f, Z: %6.2f m/s2\n",
                   sensor.getAccX(), sensor.getAccY(), sensor.getAccZ());
    }
}
