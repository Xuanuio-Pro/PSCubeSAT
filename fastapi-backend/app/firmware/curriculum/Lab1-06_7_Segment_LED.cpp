// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-06_7_Segment_LED/blob/1b4bf0731b36f5a9964eb2b7599ede0146f91fbc/src/main.cpp
/**
 * VÍ DỤ 1-06: HIỂN THỊ SỐ TRÊN LED 7 ĐOẠN (7-SEGMENT DISPLAY)
 */
#include <Arduino.h>

const int SEG_PINS[7] = {15, 2, 4, 16, 17, 5, 18}; // A, B, C, D, E, F, G
const bool IS_COMMON_ANODE = false;

// Bảng mã hiển thị số từ 0 - 9
const byte DIGIT_PATTERNS[10] = {
    0b00111111, // 0
    0b00000110, // 1
    0b01011011, // 2
    0b01001111, // 3
    0b01100110, // 4
    0b01101101, // 5
    0b01111101, // 6
    0b00000111, // 7
    0b01111111, // 8
    0b01101111  // 9
};

void displayDigit(int num) {
    if (num < 0 || num > 9) return;
    byte pattern = DIGIT_PATTERNS[num];

    for (int i = 0; i < 7; i++) {
        int bitVal = (pattern >> i) & 0x01;
        digitalWrite(SEG_PINS[i], IS_COMMON_ANODE ? !bitVal : bitVal);
    }
}

void setup() {
    for (int i = 0; i < 7; i++) {
        pinMode(SEG_PINS[i], OUTPUT);
    }
}

void loop() {
    for (int count = 0; count <= 9; count++) {
        displayDigit(count);
        delay(1000);
    }
}
