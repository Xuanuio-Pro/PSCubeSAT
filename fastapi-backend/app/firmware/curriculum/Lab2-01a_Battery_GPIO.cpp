// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab2-01a_Battery_GPIO/blob/33da095f82a2a714c1f1d908be1d3d3b69dbeddc/src/main.cpp
/**
 * VÍ DỤ 2-1a: KIỂM TRA PHÂN HỆ NGUỒN BẰNG GPIO THUẦN (ADC)
 */
#include <Arduino.h>

#define BATTERY_PIN 34 // Pin ADC đo điện áp
#define V_REF 3.3f
#define R1 1200.0 // 1.2k ohm
#define R2 1200.0 // 1.2k ohm

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[RAW] Đọc điện áp Pin bằng ADC...");
    pinMode(BATTERY_PIN, INPUT);
    analogReadResolution(12);
    analogSetPinAttenuation(BATTERY_PIN, ADC_11db);
}

void loop() {
    int adc = analogRead(BATTERY_PIN);
    float v_pin = analogReadMilliVolts(BATTERY_PIN) / 1000.0f; // Calibrated ADC voltage; divider ratio still requires measured R1/R2.
    float v_bat = v_pin * ((R1 + R2) / R2);
    
    Serial.printf("[RAW] ADC: %d -> Điện áp thực: %.2fV\n", adc, v_bat);
    delay(2000);
}
