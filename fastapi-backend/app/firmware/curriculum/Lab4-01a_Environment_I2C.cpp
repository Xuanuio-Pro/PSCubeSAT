// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-01a_Environment_I2C/blob/f70a2aba0677d9bcb02e257f70df7f40914c7e39/src/main.cpp
/**
 * VÍ DỤ 4-1a: ĐỌC CẢM BIẾN MÔI TRƯỜNG BMP280 BẰNG ADAFRUIT_BMP280
 */
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>

Adafruit_BMP280 bmp;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[RAW] Khởi tạo cảm biến BMP280...");
    
    // I2C mặc định trên ESP32: SDA=21, SCL=22
    Wire.begin(); 
    
    if (!bmp.begin(0x76) && !bmp.begin(0x77)) {
        Serial.println("[ERROR] Không tìm thấy BMP280 ở địa chỉ 0x76. Kiểm tra lại kết nối!");
        while (1) delay(10);
    }
    
    // Cấu hình thông số lấy mẫu
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,     /* Operating Mode. */
                    Adafruit_BMP280::SAMPLING_X2,     /* Temp. oversampling */
                    Adafruit_BMP280::SAMPLING_X16,    /* Pressure oversampling */
                    Adafruit_BMP280::FILTER_X16,      /* Filtering. */
                    Adafruit_BMP280::STANDBY_MS_500); /* Standby time. */
}

void loop() {
    float temp = bmp.readTemperature();
    float pres = bmp.readPressure() / 100.0F; // Chuyển sang hPa
    float alt = bmp.readAltitude(1013.25);    // Theo áp suất chuẩn
    
    Serial.printf("[RAW] Nhiệt độ: %.2f °C | Áp suất: %.2f hPa | Độ cao: %.2f m\n", temp, pres, alt);
    delay(2000);
}
