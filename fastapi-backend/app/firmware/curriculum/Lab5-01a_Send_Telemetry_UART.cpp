// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART/blob/87739806acc3385ab8dc441ff477b9739a104292/src/main.cpp
/**
 * VÍ DỤ 5-1a: GỬI DỮ LIỆU TẦM XA BẰNG MODULE LORA (UART THUẦN)
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

    pinMode(LORA_M0_PIN, OUTPUT);
    pinMode(LORA_M1_PIN, OUTPUT);
    pinMode(LORA_AUX_PIN, INPUT);
    digitalWrite(LORA_M0_PIN, LOW);
    digitalWrite(LORA_M1_PIN, LOW);

}

void loop() {
    static int counter = 0;
    counter++;

    String payload = "PACKET #" + String(counter) + " - CUBESAT TELEMETRY";
    // Chỉ đẩy vào UART1 khi module LoRa rảnh (AUX = HIGH); không báo đã phát khi chưa gửi được.
    const uint32_t started = millis();
    while (digitalRead(LORA_AUX_PIN) == LOW && millis() - started < 1000) delay(1);
    if (digitalRead(LORA_AUX_PIN) == HIGH) {
        cdh.println("TX: " + payload);
        Serial1.println(payload);
    } else {
        cdh.println("LoRa AUX busy; TX skipped: " + payload);
    }
    delay(2000);
}
