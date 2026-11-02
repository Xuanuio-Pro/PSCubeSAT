// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-01_Blink_LED/blob/64e8a794e1190ef48c54410b46449a2fc4c7eeb7/src/main.cpp
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
