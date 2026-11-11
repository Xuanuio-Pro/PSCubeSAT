// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-05_7_Segment_LED/blob/00a02bdb462ba0d6ad3582bc420317b07d964d8a/src/main.cpp
/**
 * VÍ DỤ 1-05: HIỂN THỊ SỐ TRÊN LED 7 ĐOẠN (7-SEGMENT LED DISPLAY)
 * 
 * Mô tả:
 * - Điều khiển 7 thanh LED (A, B, C, D, E, F, G) để tạo thành các chữ số 0 - 9.
 * - Sử dụng mảng mã nhị phân để quét số đếm tự động mỗi 1 giây.
 * - Hỗ trợ cả 2 loại LED: Cathode chung (Common Cathode) và Anode chung (Common Anode).
 */
#include <Arduino.h>

// Định nghĩa các chân nối với từng thanh LED (A, B, C, D, E, F, G)
const int SEG_PINS[7] = {15, 2, 4, 16, 17, 5, 18}; // A, B, C, D, E, F, G

// Đặt là false nếu là Cathode chung (GND chung, mức HIGH là sáng)
// Đặt là true nếu là Anode chung (VCC chung, mức LOW là sáng)
const bool IS_COMMON_ANODE = false;

// Bảng mã hiển thị số từ 0 - 9 (thứ tự bit từ MSB đến LSB: 0, G, F, E, D, C, B, A)
const byte DIGIT_PATTERNS[10] = {
    0b00111111, // 0: A B C D E F
    0b00000110, // 1: B C
    0b01011011, // 2: A B D E G
    0b01001111, // 3: A B C D G
    0b01100110, // 4: B C F G
    0b01101101, // 5: A C D F G
    0b01111101, // 6: A C D E F G
    0b00000111, // 7: A B C
    0b01111111, // 8: A B C D E F G
    0b01101111  // 9: A B C D F G
};

void displayDigit(int num) {
    if (num < 0 || num > 9) return;
    byte pattern = DIGIT_PATTERNS[num];

    for (int i = 0; i < 7; i++) {
        // Lấy trạng thái của từng đoạn từ bit 0 (đoạn A) đến bit 6 (đoạn G)
        int bitVal = (pattern >> i) & 0x01;
        int pinState = IS_COMMON_ANODE ? !bitVal : bitVal;
        digitalWrite(SEG_PINS[i], pinState);
    }
}

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Bắt đầu bài test LED 7 đoạn (7-Segment Display)...");

    // Khởi tạo các chân đoạn LED làm OUTPUT
    for (int i = 0; i < 7; i++) {
        pinMode(SEG_PINS[i], OUTPUT);
    }

    Serial.println("Bắt đầu đếm số từ 0 đến 9...");
}

void loop() {
    for (int count = 0; count <= 9; count++) {
        Serial.printf("[7-SEG] Hiển thị số: %d\n", count);
        displayDigit(count);
        delay(1000);
    }
}
