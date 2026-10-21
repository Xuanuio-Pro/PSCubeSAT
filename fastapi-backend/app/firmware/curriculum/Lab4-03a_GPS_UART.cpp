// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-03a_GPS_UART/blob/a8751c38b6285f69a0b750088297ee8ab1a87edd/src/main.cpp
/**
 * VÍ DỤ 4-3a: ĐỌC DỮ LIỆU ĐỊNH VỊ (GPS NMEA) BẰNG UART THUẦN
 */
#include <Arduino.h>

// GPS thường sử dụng Serial2 trên ESP32, với tốc độ Baud 9600
#define GPS_RX 16
#define GPS_TX 17
#define GPS_BAUD 9600

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[RAW] Đọc dữ liệu NMEA trực tiếp từ module GPS qua UART2...");
    
    // Khởi tạo Serial2 cho GPS
    pinMode(12, OUTPUT); pinMode(14, OUTPUT);
    digitalWrite(12, HIGH); digitalWrite(14, LOW); // Select GPS on PTIT OBC MUX.
    Serial2.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
}

void loop() {
    // Đọc byte thô từ GPS và in thẳng ra Serial màn hình
    while (Serial2.available() > 0) {
        char c = Serial2.read();
        Serial.print(c);
    }
    delay(1);
}
