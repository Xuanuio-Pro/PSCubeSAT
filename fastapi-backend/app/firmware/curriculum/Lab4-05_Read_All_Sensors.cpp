// Source: https://github.com/PTITCube/Lab4-05_Read_All_Sensors (local corrected example)
/**
 * VÍ DỤ 1: KIỂM TRA PHÂN HỆ CẢM BIẾN (SENSOR MODULE)
 * 
 * Mô tả:
 * Ví dụ này minh họa cách khởi tạo và lấy dữ liệu chi tiết từ 3 cảm biến chính 
 * trên board vệ tinh CubeSat thông qua chuẩn giao tiếp I2C.
 * 
 * Các cảm biến được kiểm tra:
 * 1. BMP280: Đo nhiệt độ và áp suất khí quyển.
 * 2. MPU6050/MPU6500: Gia tốc kế và con quay hồi chuyển 6 trục.
 * 3. QMC5883P (check actual sensor model): Cảm biến la bàn từ trường.
 */

#include <Arduino.h>
#include <PTITCube.h>

// 1. KHAI BÁO ĐỐI TƯỢNG ĐÀNG HOÀNG
PTIT_Sensor mySensor;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test Phân hệ Cảm biến (Sensors)...");
    
    // Gọi hàm từ đối tượng
    mySensor.init();

    Serial.println("[EXAMPLE] Đã nạp xong cấu hình. Đang bắt đầu vòng lặp đọc dữ liệu...\n");
}

void loop() {
    mySensor.update();

    Serial.println("=================================================");
    Serial.println("        DỮ LIỆU CẢM BIẾN MÔI TRƯỜNG & TƯ THẾ       ");
    Serial.println("=================================================");

    Serial.println(">>> 1. BMP280 (Nhiệt độ & Áp suất)");
    Serial.print("    - Nhiệt độ      : "); Serial.print(mySensor.getTemperature(), 2); Serial.println(" °C");
    Serial.print("    - Áp suất       : "); Serial.print(mySensor.getPressure(), 2); Serial.println(" hPa");

    Serial.println(">>> 2. MPU6050/MPU6500 (Gia tốc & Góc quay 6 trục)");
    Serial.print("    - Gia tốc (m/s^2) : X="); Serial.print(mySensor.getAccX(), 3); 
    Serial.print("  Y="); Serial.print(mySensor.getAccY(), 3); 
    Serial.print("  Z="); Serial.println(mySensor.getAccZ(), 3);
    
    Serial.print("    - Góc quay (rad/s): X="); Serial.print(mySensor.getGyroX(), 3); 
    Serial.print("  Y="); Serial.print(mySensor.getGyroY(), 3); 
    Serial.print("  Z="); Serial.println(mySensor.getGyroZ(), 3);

    Serial.println(">>> 3. QMC5883P (La bàn từ trường 3 trục)");
    Serial.print("    - Từ trường (Gauss): X="); Serial.print(mySensor.getMagX(), 3); 
    Serial.print("  Y="); Serial.print(mySensor.getMagY(), 3); 
    Serial.print("  Z="); Serial.println(mySensor.getMagZ(), 3);
    
    Serial.println("=================================================\n");
    delay(2000);
}
