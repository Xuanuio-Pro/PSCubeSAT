// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab8-01_Custom_Mission/blob/f7c125d4071a0ed925b5d8665954e5303b9c46af/src/main.cpp
/**
 * LAB 8 - ĐỒ ÁN CAPSTONE: THIẾT KẾ & TRIỂN KHAI SỨ MỆNH VỆ TINH CUBESAT
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;

PTIT_EPS eps;
PTIT_Sensor sensor;
PTIT_GPS gps;
PTIT_COM com;
PTIT_Storage storage;

void setup() {
    cdh.begin();

    eps.init();
    sensor.init();
    gps.init();
    storage.init();
    com.init();

    cdh.println("[BOOT] Khung Lab8 san sang: EPS, Sensor, GPS, Storage, COM da khoi tao. Them nhiem vu vao loop().");
}

void loop() {
    eps.update();
    sensor.update();
    gps.update();

    // TODO: Triển khai kịch bản sứ mệnh tùy biến của học viên

    delay(1000);
}
