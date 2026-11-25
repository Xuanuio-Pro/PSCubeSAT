// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-01_Blink_LED/blob/9b75c19a8b126f0df53a98776739a65f286b9a96/src/main.cpp
#include <Arduino.h>
const int LED_PIN = 2;

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
}
void loop() {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("LED ON");
    delay(1000);
    digitalWrite(LED_PIN, LOW);
    Serial.println("LED OFF");
    delay(1000);
}
