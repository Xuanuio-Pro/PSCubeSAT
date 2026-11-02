// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART/blob/47d62d81e407d9fd0cbd336912ab9a65c1505687/src/main.cpp
/**
 * VÍ DỤ 5-1a: GỬI DỮ LIỆU TẦM XA BẰNG MODULE LORA (UART THUẦN)
 */
#include <Arduino.h>

// Chân giao tiếp với module LoRa E32
#define LORA_RX 26
#define LORA_TX 25
#define LORA_M0 32
#define LORA_M1 33
#define LORA_AUX 27 // GPIO35 is input-only on ESP32 and cannot drive M1.

void setup() {
    Serial.begin(115200);
    Serial1.begin(9600, SERIAL_8N1, LORA_RX, LORA_TX);
    Serial1.setTimeout(100);
    pinMode(LORA_AUX, INPUT);
    Serial.println("[RAW] Requires matching radio channel and transparent mode at both ends; GPIO RX26/TX25/M0=32/M1=33/AUX27.");
    
    // Cấu hình chân Mode (M0=0, M1=0: Chế độ hoạt động bình thường Transparent Mode)
    pinMode(LORA_M0, OUTPUT);
    pinMode(LORA_M1, OUTPUT);
    digitalWrite(LORA_M0, LOW);
    digitalWrite(LORA_M1, LOW);

    Serial.println("\n[RAW] LoRa UART đã sẵn sàng. Định kỳ phát sóng vô tuyến...");
}

void loop() {
    String msg = "HELLO_FROM_CUBESAT_RAW_LORA: " + String(millis());
    Serial.println("[TX] " + msg);
    
    // Đẩy trực tiếp chuỗi vào UART1 (LoRa) để phát sóng đi
    const uint32_t started = millis();
    while (digitalRead(LORA_AUX) == LOW && millis() - started < 1000) delay(1);
    if (digitalRead(LORA_AUX) == HIGH) Serial1.println(msg);
    else Serial.println("[WARNING] LoRa AUX busy; TX skipped, no reception confirmed.");
    
    delay(3000);
}
