// Source: https://github.com/PTITCube/Lab4-02b_IMU_Library (local corrected example)
/**
 * VÍ DỤ 4-2: ĐỌC DỮ LIỆU CẢM BIẾN QUÁN TÍNH 9 TRỤC (IMU 9-DOF)
 * 
 * Mô tả:
 * Ví dụ này minh họa cách thu thập toàn bộ dữ liệu 9 trục từ cảm biến:
 * - 3 trục Gia tốc (Accelerometer - MPU6050/MPU6500)
 * - 3 trục Con quay hồi chuyển (Gyroscope - MPU6050/MPU6500)
 * - 3 trục La bàn từ trường (Magnetometer - QMC5883P)
 */

#include <Arduino.h>
#include <PTITCube.h>

PTIT_Sensor mySensor;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test Cảm biến Quán tính 9 trục (IMU)...");
    mySensor.init(false, true, true);
}

void loop() {
    // Phải gọi update() liên tục để lấy giá trị mới nhất
    mySensor.update();

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 1000) {
        lastPrint = millis();
        
        Serial.println("==================================================");
        
        // 1. Dữ liệu Gia tốc (m/s^2) - Đo gia tốc tịnh tiến và trọng lực
        Serial.println(">>> GIA TỐC (ACCELEROMETER) <<<");
        Serial.printf("  X: %6.2f m/s^2 | Y: %6.2f m/s^2 | Z: %6.2f m/s^2\n", 
                      mySensor.getAccX(), mySensor.getAccY(), mySensor.getAccZ());

        // 2. Dữ liệu Vận tốc góc (rad/s) - Đo tốc độ xoay quanh các trục
        Serial.println(">>> CON QUAY HỒI CHUYỂN (GYROSCOPE) <<<");
        Serial.printf("  X: %6.2f rad/s | Y: %6.2f rad/s | Z: %6.2f rad/s\n", 
                      mySensor.getGyroX(), mySensor.getGyroY(), mySensor.getGyroZ());

        // 3. Dữ liệu Từ trường (Gauss) - Đo từ trường Trái đất để xác định hướng (La bàn)
        Serial.println(">>> LA BÀN TỪ TRƯỜNG (MAGNETOMETER) <<<");
        Serial.printf("  X: %6.2f G     | Y: %6.2f G     | Z: %6.2f G\n", 
                      mySensor.getMagX(), mySensor.getMagY(), mySensor.getMagZ());
        
        Serial.println("==================================================\n");
    }
}
