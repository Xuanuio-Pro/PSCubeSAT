// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-02a_Receive_Command_UART/blob/9759b69a799ab28a1da18d36da6db8a057ea1f7a/src/main.cpp
/**
 * VÍ DỤ 5-2a: NHẬN DỮ LIỆU TẦM XA TỪ LORA (UART THUẦN)
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
    
    // Cấu hình chân Mode (M0=0, M1=0: Chế độ hoạt động bình thường)
    pinMode(LORA_M0, OUTPUT);
    pinMode(LORA_M1, OUTPUT);
    digitalWrite(LORA_M0, LOW);
    digitalWrite(LORA_M1, LOW);

    Serial.println("\n[RAW] LoRa Receiver đang lắng nghe sóng vô tuyến...");
}

void loop() {
    // Kiểm tra xem có dữ liệu đến từ sóng không gian hay không
    if (Serial1.available() > 0) {
        String data = Serial1.readStringUntil('\n');
        Serial.print("[RX] Nhận được bản tin thô: ");
        Serial.println(data);
    }
    delay(2);
}
