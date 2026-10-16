// Source: https://github.com/PTITCube/Lab4-01_Detect_Environment (local corrected example)
/**
 * VÍ DỤ 4-1: ĐỌC CẢM BIẾN MÔI TRƯỜNG (BMP280)
 * 
 * Mô tả:
 * Ví dụ này minh họa cách giao tiếp với cảm biến áp suất và nhiệt độ BMP280 
 * thông qua chuẩn giao tiếp I2C bằng thư viện PTITCube.
 */

#include <Arduino.h>
#include <PTITCube.h>

// Khởi tạo đối tượng cảm biến
PTIT_Sensor mySensor;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test Cảm biến Môi trường (BMP280)...");
    
    // Hàm init() sẽ tự động kết nối với BMP280, MPU6050 và QMC5883 qua I2C
    mySensor.init(true, false, false);
}

void loop() {
    // Phải gọi update() liên tục để cập nhật giá trị mới nhất từ các cảm biến
    mySensor.update();

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 2000) {
        lastPrint = millis();
        
        Serial.println("-------------------------------------------------");
        float temp = mySensor.getTemperature();
        float pres = mySensor.getPressure();

        Serial.print("Nhiệt độ (Temperature) : ");
        Serial.print(temp);
        Serial.println(" *C");
        
        Serial.print("Áp suất (Pressure)     : ");
        Serial.print(pres); // PTIT_Sensor::getPressure() already returns hPa
        Serial.println(" hPa");
    }
}
