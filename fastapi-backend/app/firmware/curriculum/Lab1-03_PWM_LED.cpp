// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-03_PWM_LED/blob/f6944917fa03d0e4f20edd66f87357f5665b3a83/src/main.cpp
/**
 * VÍ DỤ 1-03: ĐIỀU CHẾ ĐỘ RỘNG XUNG LEDC PWM (BREATHING LED)
 */
#include <Arduino.h>

const int LED_PIN = 2;
const int PWM_CHANNEL = 0;
const int PWM_FREQ = 5000;
const int PWM_RESOLUTION = 8;

void setup() {
    ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
    ledcAttachPin(LED_PIN, PWM_CHANNEL);
}

void loop() {
    // Tăng dần độ sáng (Fade In)
    for (int duty = 0; duty <= 255; duty++) {
        ledcWrite(PWM_CHANNEL, duty);
        delay(8);
    }
    delay(200);

    // Giảm dần độ sáng (Fade Out)
    for (int duty = 255; duty >= 0; duty--) {
        ledcWrite(PWM_CHANNEL, duty);
        delay(8);
    }
    delay(500);
}
