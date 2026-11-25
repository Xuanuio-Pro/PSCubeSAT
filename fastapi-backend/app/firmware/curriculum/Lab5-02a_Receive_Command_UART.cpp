// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-02a_Receive_Command_UART/blob/f911a747dccdbf5e4d8fb0b23a52abb66c2c2f2a/src/main.cpp
/**
 * VÍ DỤ 5-2a: NHẬN DỮ LIỆU TẦM XA TỪ LORA (UART THUẦN)
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    Serial1.begin(9600, SERIAL_8N1, LORA_RX_PIN, LORA_TX_PIN);
    Serial1.setTimeout(100); // Gói thiếu ký tự xuống dòng không chặn vòng lặp tới 1 giây

    pinMode(LORA_M0_PIN, OUTPUT);
    pinMode(LORA_M1_PIN, OUTPUT);
    pinMode(LORA_AUX_PIN, INPUT);
    digitalWrite(LORA_M0_PIN, LOW);
    digitalWrite(LORA_M1_PIN, LOW);

    cdh.println("[BOOT] OBC san sang, dang cho lenh tu tram mat dat qua LoRa (UART1)");
}

void loop() {
    if (Serial1.available() > 0) {
        String data = Serial1.readStringUntil('\n');
        data.trim();
        cdh.println("RX: " + data);
    }
}
