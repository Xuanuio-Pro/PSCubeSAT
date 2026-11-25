// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-04_LED_Button/blob/9e468ea820a1ecb705c5eea451fe26fe368aab5c/src/main.cpp
/**
 * VÍ DỤ 1-05: NÚT NHẤN ĐIỀU KHIỂN ĐÈN LED (LED BUTTON)
 * 
 * Mô tả:
 * - Đọc trạng thái nút nhấn ở chân GPIO 4 (kết nối với GND, chế độ INPUT_PULLUP).
 * - Mỗi lần phát hiện thao tác nhấn nút, hệ thống sẽ đảo trạng thái của đèn LED ở chân GPIO 2.
 * - In trạng thái LED hiện tại ra Serial Monitor.
 */
#include <Arduino.h>

const int BUTTON_PIN = 4;
const int LED_PIN = 2;

int ledState = LOW;
int lastButtonState = HIGH;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test Nút nhấn điều khiển LED...");
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, ledState);

    }

void loop() {
    int buttonState = digitalRead(BUTTON_PIN);

    // Nhận diện cạnh xuống (Khi bắt đầu nhấn nút: từ HIGH xuống LOW)
    if (lastButtonState == HIGH && buttonState == LOW) {
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState);

        if (ledState == HIGH) {
            Serial.println("[BUTTON] Nhấn nút -> ĐÈN LED: BẬT (ON)");
        } else {
            Serial.println("[BUTTON] Nhấn nút -> ĐÈN LED: TẮT (OFF)");
        }
        delay(200); // Tránh dội phím (Debounce delay)
    }

    lastButtonState = buttonState;
}
