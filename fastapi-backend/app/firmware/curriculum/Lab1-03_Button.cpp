// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-04_Button/blob/10294ed026d7224809ffbe9c479eb2d95697753a/src/main.cpp
/**
 * VÍ DỤ 1-04: ĐỌC TÍN HIỆU TỪ NÚT NHẤN (BUTTON INPUT)
 */
#include <Arduino.h>

const int BUTTON_PIN = 4;
int lastState = HIGH;

void setup() {
    Serial.begin(115200);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    int currentState = digitalRead(BUTTON_PIN);

    if (currentState != lastState) {
        Serial.println(currentState == LOW ? "BUTTON: Pressed" : "BUTTON: Released");
        lastState = currentState;
        delay(50); // Debounce
    }
}
