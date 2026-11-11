// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-03_Button/blob/a6784fec344d8dc9956bffc3bb485191446e17e7/src/main.cpp
/**
 * VÍ DỤ 1-03: ĐỌC TÍN HIỆU TỪ NÚT NHẤN (BUTTON INPUT)
 * 
 * Mô tả:
 * - Sử dụng chế độ INPUT_PULLUP (điện trở kéo lên nội bộ của ESP32).
 * - Nút nhấn được nối giữa chân GPIO 4 và chân GND.
 * - Khi nhấn nút: chân GPIO đọc mức LOW (0).
 * - Khi thả nút: chân GPIO đọc mức HIGH (1).
 */
#include <Arduino.h>

const int BUTTON_PIN = 4;
int lastState = HIGH;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test Nút nhấn (Button)...");
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    Serial.println("Hãy nhấn nút nối chân GPIO 4 với GND để kiểm tra.");
}

void loop() {
    int currentState = digitalRead(BUTTON_PIN);

    // Phát hiện sự thay đổi trạng thái của nút nhấn
    if (currentState != lastState) {
        if (currentState == LOW) {
            Serial.println("[BUTTON] >>> Nút nhấn ĐÃ ĐƯỢC NHẤN (PRESSED)!");
        } else {
            Serial.println("[BUTTON] --- Nút nhấn ĐÃ ĐƯỢC THẢ (RELEASED).");
        }
        lastState = currentState;
        delay(50); // Chống dội phím (Debounce)
    }
}
