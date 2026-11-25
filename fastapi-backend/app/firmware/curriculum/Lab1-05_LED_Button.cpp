// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-05_LED_Button/blob/6c97a8be30ba35e2aa4fda3a7ac7579d011b4d73/src/main.cpp
/**
 * VÍ DỤ 1-05: NÚT NHẤN ĐIỀU KHIỂN ĐÈN LED (LED BUTTON)
 */
#include <Arduino.h>

const int BUTTON_PIN = 4;
const int LED_PIN = 2;

int ledState = LOW;
int lastButtonState = HIGH;

void setup() {
    Serial.begin(115200);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, ledState);
}

void loop() {
    int buttonState = digitalRead(BUTTON_PIN);

    // Phát hiện cạnh xuống (nhấn nút)
    if (lastButtonState == HIGH && buttonState == LOW) {
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);
        Serial.println(ledState == HIGH ? "LED: ON" : "LED: OFF");
        delay(200); // Debounce
    }

    lastButtonState = buttonState;
}
