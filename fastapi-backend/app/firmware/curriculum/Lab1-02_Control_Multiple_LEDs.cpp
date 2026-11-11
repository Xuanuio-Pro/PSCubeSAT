// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-02_Control_Multiple_LEDs/blob/b86299e5e8e81424e5ecdab635aaf54f153e8291/src/main.cpp
/**
 * VÍ DỤ 1-02: ĐIỀU KHIỂN NHIỀU ĐÈN LED (MULTIPLE LEDS)
 * 
 * Mô tả:
 * - Cấu hình nhiều chân GPIO làm OUTPUT để điều khiển đồng thời nhiều đèn LED.
 * - Tạo hiệu ứng nhấp nháy tuần tự (chạy đèn LED) và in trạng thái ra Serial Monitor.
 */
#include <Arduino.h>

const int LED_PINS[] = {2, 4, 5};
const int NUM_LEDS = sizeof(LED_PINS) / sizeof(LED_PINS[0]);

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test Điều khiển nhiều LED...");
    
    for (int i = 0; i < NUM_LEDS; i++) {
        pinMode(LED_PINS[i], OUTPUT);
        digitalWrite(LED_PINS[i], LOW);
    }
}

void loop() {
    // Bật tắt tuần tự từng LED
    for (int i = 0; i < NUM_LEDS; i++) {
        digitalWrite(LED_PINS[i], HIGH);
        Serial.printf("[LED] Bật LED chân GPIO %d\n", LED_PINS[i]);
        delay(300);
        digitalWrite(LED_PINS[i], LOW);
    }
}
