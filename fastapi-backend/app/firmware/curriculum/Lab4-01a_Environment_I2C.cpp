// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-01a_Environment_I2C/blob/ff8c816c6383378e2283e2fd3c35a66718128562/src/main.cpp
/**
 * VÍ DỤ 4-1a: ĐỌC CẢM BIẾN MÔI TRƯỜNG BMP280 BẰNG ADAFRUIT_BMP280
 */
#include <Arduino.h>
#include <PTITCube.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>

PTIT_CDH cdh;
PTIT_EPS eps;
Adafruit_BMP280 bmp;
bool bmpReady = false;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp nuôi cảm biến qua thư viện EPS
    eps.setBuckState(true);

    Wire.begin(21, 22);

    bmpReady = bmp.begin(0x76) || bmp.begin(0x77);
    if (!bmpReady) {
        cdh.println("Warning: Sensor not detected!");
    }
}

void loop() {
    // Không có cảm biến thì không in số đo: giá trị đọc được sẽ là dữ liệu rác.
    if (!bmpReady) {
        cdh.println("BMP280 unavailable: check wiring (SDA 21, SCL 22)");
        delay(2000);
        return;
    }
    float temp = bmp.readTemperature();
    float pres = bmp.readPressure() / 100.0F; // hPa

    cdh.printf("Temp: %.2f C | Press: %.1f hPa\n", temp, pres);
    delay(2000);
}
