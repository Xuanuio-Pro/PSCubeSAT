// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-02b_IMU_Library/blob/c19722e3031b96b7c515518ce71c54f4c03367bd/src/main.cpp
/**
 * VÍ DỤ 4-2b: ĐỌC DỮ LIỆU CẢM BIẾN QUÁN TÍNH 9 TRỤC & LA BÀN BẰNG THƯ VIỆN PTITCUBE
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

    sensor.init(false, true, true); // Bật MPU6500 và QMC5883P
}

void loop() {
    sensor.update();

    float ax = sensor.getAccX();
    float ay = sensor.getAccY();
    float az = sensor.getAccZ();

    float gx = sensor.getGyroX();
    float gy = sensor.getGyroY();
    float gz = sensor.getGyroZ();

    float mx = sensor.getMagX();
    float my = sensor.getMagY();
    float mz = sensor.getMagZ();

    float heading = sensor.getHeading();
    float roll    = sensor.getRoll();
    float pitch   = sensor.getPitch();

    // In 4 dòng viễn trắc chi tiết (tiếng Anh): Gyro, Accel, Mag, Euler
    cdh.printf("Gyro:  X: %6.2f, Y: %6.2f, Z: %6.2f rad/s\n", gx, gy, gz);
    cdh.printf("Accel: X: %6.2f, Y: %6.2f, Z: %6.2f m/s2\n", ax, ay, az);
    cdh.printf("Mag:   X: %6.2f, Y: %6.2f, Z: %6.2f uT\n", mx, my, mz);
    cdh.printf("Roll: %5.1f, Pitch: %5.1f, Head: %5.1f\n", roll, pitch, heading);

    delay(2000);
}
