// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-01b_Environment_Library/blob/851b019bc6f5bb02c4a80835638e00ef3b71a696/src/main.cpp
/**
 * VÍ DỤ 4-1b: ĐỌC CẢM BIẾN MÔI TRƯỜNG (BMP280) BẰNG THƯ VIỆN PTITCUBE
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_Sensor sensor;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp nuôi cảm biến qua thư viện EPS
    eps.setBuckState(true);

    sensor.init(true, false, false); // Chỉ bật BMP280
}

void loop() {
    sensor.update();

    float temp = sensor.getTemperature();
    float pres = sensor.getPressure();

    cdh.printf("Temp: %.2f C | Press: %.1f hPa\n", temp, pres);
    delay(2000);
}
