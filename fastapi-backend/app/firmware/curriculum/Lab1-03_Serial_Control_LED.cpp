// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-03_Serial_Control_LED/blob/4530ac2a68fb610793773d5122b154504502d8f0/src/main.cpp
#include <Arduino.h>

const int LED_PIN = 2;

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    
    Serial.println("Gõ '1' để bật LED, '0' để tắt LED");
}

void loop() {
    if (Serial.available() > 0) {
        char command = Serial.read();
        
        if (command == '1') {
            digitalWrite(LED_PIN, HIGH);
            Serial.println("LED ON");
        } 
        else if (command == '0') {
            digitalWrite(LED_PIN, LOW);
            Serial.println("LED OFF");
        }
    }
}