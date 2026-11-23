// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-05_Read_All_Sensors/blob/4a18b32a35ab56da6042ed86ddda7435beb69f8a/src/main.cpp
// Source: https://github.com/PTITCube/Lab4-05_Read_All_Sensors (local corrected example)
/**
 * VÍ DỤ 4-5: ĐỌC TỔNG HỢP TẤT CẢ CẢM BIẾN & ĐỊNH VỊ GPS
 * 
 * Mô tả:
 * Ví dụ này minh họa cách khởi tạo và lấy dữ liệu chi tiết từ toàn bộ hệ thống
 * cảm biến trên vệ tinh CubeSat:
 * 1. BMP280: Đo nhiệt độ và áp suất khí quyển (I2C).
 * 2. MPU6500: Gia tốc kế và con quay hồi chuyển 6 trục (I2C).
 * 3. QMC5883L/P: Cảm biến la bàn từ trường 3 trục (I2C).
 * 4. GPS (NEO-xM): Định vị tọa độ vệ tinh, độ cao, tốc độ và thời gian UTC (UART).
 */

#include <Arduino.h>

#include <PTITCube.h>

PTIT_CDH cdh;

// Khai báo đối tượng cảm biến và GPS
PTIT_Sensor mySensor;
PTIT_GPS myGPS;

void setup() {
    cdh.begin(115200);
    while (!cdh) { delay(10); }

    cdh.println("\n[EXAMPLE] Bắt đầu bài test Toàn bộ Cảm biến & Định vị GPS...");
    
    // Khởi tạo các cảm biến I2C (BMP280, MPU6500, QMC5883)
    mySensor.init();

    // Khởi tạo module GPS qua UART2
    myGPS.init();

    cdh.println("[EXAMPLE] Đã nạp xong cấu hình. Đang bắt đầu vòng lặp đọc dữ liệu...\n");
}

void loop() {
    // Luôn gọi update liên tục trong vòng lặp để cập nhật dữ liệu cảm biến và nhận gói tin NMEA từ GPS
    mySensor.update();
    myGPS.update();

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint >= 2000) {
        lastPrint = millis();

                cdh.println("       DỮ LIỆU CẢM BIẾN TOÀN DIỆN & TỌA ĐỘ GPS   ");
        
        // 1. BMP280
        cdh.println(">>> 1. BMP280 (Nhiệt độ & Áp suất)");
        cdh.print("    - Nhiệt độ          : "); cdh.print(mySensor.getTemperature(), 2); cdh.println(" °C");
        cdh.print("    - Áp suất           : "); cdh.print(mySensor.getPressure(), 2); cdh.println(" hPa");

        // 2. MPU6500
        cdh.println(">>> 2. MPU6500 (Gia tốc & Con quay hồi chuyển)");
        cdh.print("    - Gia tốc (m/s^2)   : X="); cdh.print(mySensor.getAccX(), 3); 
        cdh.print("  Y="); cdh.print(mySensor.getAccY(), 3); 
        cdh.print("  Z="); cdh.println(mySensor.getAccZ(), 3);
        
        cdh.print("    - Tốc độ góc (rad/s): X="); cdh.print(mySensor.getGyroX(), 3); 
        cdh.print("  Y="); cdh.print(mySensor.getGyroY(), 3); 
        cdh.print("  Z="); cdh.println(mySensor.getGyroZ(), 3);

        // 3. QMC5883L/P
        cdh.println(">>> 3. QMC5883 (La bàn từ trường 3 trục)");
        cdh.print("    - Từ trường (Gauss) : X="); cdh.print(mySensor.getMagX(), 3); 
        cdh.print("  Y="); cdh.print(mySensor.getMagY(), 3); 
        cdh.print("  Z="); cdh.println(mySensor.getMagZ(), 3);

        // 4. GPS
        cdh.println(">>> 4. GPS (Định vị vệ tinh toàn cầu)");
        int sats = myGPS.getSatellites();
        if (myGPS.hasFix()) { // Có vệ tinh chưa chắc đã chốt được tọa độ
            cdh.printf("    - Tọa độ (Lat, Lng) : %f, %f\n", myGPS.getLat(), myGPS.getLng());
            cdh.printf("    - Cao độ (Altitude) : %.2f m\n", myGPS.getAltitude());
            cdh.printf("    - Tốc độ (Speed)    : %.2f km/h\n", myGPS.getSpeed());
            cdh.printf("    - Hướng (Course)    : %.2f độ\n", myGPS.getCourse());
            cdh.printf("    - Số vệ tinh khóa   : %d\n", sats);
            cdh.printf("    - Sai số HDOP       : %.2f\n", myGPS.getHDOP());
            cdh.print ("    - Thời gian chuẩn   : "); cdh.println(myGPS.getTimeString());
        } else {
            cdh.printf("    - Trạng thái        : Chưa chốt vị trí (%d vệ tinh). Hãy đặt anten hướng ra ngoài trời", sats); cdh.println();
        }
        
    
    }
}
