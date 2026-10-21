// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-02a_IMU_I2C/blob/270d2b381140c82c32ef619ca9b17d0885891732/src/main.cpp
/**
 * VÍ DỤ 4-2a: ĐỌC CẢM BIẾN MPU6050/MPU6500 BẰNG I2C THANH GHI THUẦN
 */
#include <Arduino.h>
#include <Wire.h>

#define MPU_ADDR 0x68 // Địa chỉ I2C của MPU6050/6500

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[RAW] Đọc trực tiếp thanh ghi I2C của MPU6050/MPU6500...");
    
    Wire.begin(); 
    
    // Đánh thức MPU từ chế độ Sleep (Ghi 0 vào thanh ghi PWR_MGMT_1)
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x6B); // Thanh ghi Power Management 1
    Wire.write(0x00); // 0 = Wake up
    if (Wire.endTransmission(true) != 0) {
        Serial.println("[ERROR] MPU wake failed; check address 0x68 and wiring.");
        return;
    }
    
    Serial.println("[RAW] MPU đã được đánh thức.");
}

void loop() {
    // Đọc dữ liệu Gia tốc (Accelerometer) từ thanh ghi 0x3B (ACCEL_XOUT_H)
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    if (Wire.endTransmission(true) != 0) {
        Serial.println("[ERROR] MPU register read failed"); delay(1000); return;
    }
    
    // Yêu cầu 6 bytes (X_H, X_L, Y_H, Y_L, Z_H, Z_L)
    Wire.requestFrom((uint16_t)MPU_ADDR, (uint8_t)6, (bool)true);
    
    if (Wire.available() >= 6) {
        int16_t ax = (Wire.read() << 8) | Wire.read();
        int16_t ay = (Wire.read() << 8) | Wire.read();
        int16_t az = (Wire.read() << 8) | Wire.read();
        
        Serial.printf("[RAW] RAW_ACCEL: X = %d | Y = %d | Z = %d\n", ax, ay, az);
    } else { Serial.println("[ERROR] MPU short read; sample not valid"); }
    
    delay(500);
}
