// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-03a_GPS_UART/blob/82a83e06cd4a9645c8f93f076ff189f05bdd7688/src/main.cpp
/**
 * LAB 4 - VÍ DỤ 03a: ĐỌC DỮ LIỆU ĐỊNH VỊ NMEA THÔ BẰNG UART THUẦN
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;

#define GPS_BAUD    9600
#define GPS_RX      16
#define GPS_TX      17

#define MUX_GPS_PIN 12
#define MUX_CAM_PIN 14

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    // Cấu hình chân MUX 74HC4066: Chọn kênh GPS
    pinMode(MUX_GPS_PIN, OUTPUT);
    pinMode(MUX_CAM_PIN, OUTPUT);
    digitalWrite(MUX_CAM_PIN, LOW);
    delayMicroseconds(50);
    digitalWrite(MUX_GPS_PIN, HIGH);

    Serial2.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
}

void loop() {
    // Đọc trọn vẹn câu tin NMEA từ GPS và giãn cách log 2 giây để người học dễ đọc
    static char buffer[128];
    static uint8_t idx = 0;

    while (Serial2.available() > 0) {
        char c = (char)Serial2.read();
        if (c == '$') {
            idx = 0;
            buffer[idx++] = c;
        } else if (c == '\n' || c == '\r') {
            if (idx > 0 && buffer[0] == '$') {
                buffer[idx] = '\0';
                cdh.println(buffer);
                idx = 0;
                delay(2000); // Độ trễ 2 giây để quan sát rõ từng bản tin NMEA
                break;
            }
        } else {
            if (idx < sizeof(buffer) - 1) {
                buffer[idx++] = c;
            }
        }
    }
}
