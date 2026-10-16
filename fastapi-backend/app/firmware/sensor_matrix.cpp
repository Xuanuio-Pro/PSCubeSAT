// Hardware regression: disabled/absent sensors must not crash or report fake zeros.
#include <Arduino.h>
#include <PTITCube.h>
#include <Wire.h>
PTIT_Sensor sensor;
uint8_t phase = 0;
uint32_t started = 0, printed = 0;
void startPhase() {
    sensor.init(phase & 1, phase & 2, phase & 4);
    started = millis();
    Serial.printf("MATRIX_BEGIN mask=%u bmp=%d mpu=%d qmc=%d\n", phase,
                  sensor.hasBMP(), sensor.hasMPU(), sensor.hasQMC());
}
void setup() {
    Serial.begin(115200);
    delay(500);
    Wire.begin(21, 22);
    Wire.setTimeOut(50);
    for (uint8_t address = 1; address < 127; ++address) {
        Wire.beginTransmission(address);
        if (Wire.endTransmission() == 0) {
            Serial.printf("I2C_FOUND 0x%02X\n", address);
            if (address == 0x68 || address == 0x69) {
                Wire.beginTransmission(address); Wire.write(0x75);
                if (Wire.endTransmission(false) == 0 && Wire.requestFrom(address, (uint8_t)1) == 1)
                    Serial.printf("MPU_WHO_AM_I 0x%02X\n", Wire.read());
            }
        }
        delay(1);
    }
    startPhase();
}
void loop() {
    sensor.update();
    if (millis() - printed >= 1000) {
        printed = millis();
        Serial.printf("MATRIX_SAMPLE mask=%u uptime=%lu temp_C=%.2f pressure_hPa=%.2f ax=%.2f ay=%.2f az=%.2f gx=%.3f gy=%.3f gz=%.3f mag_G=%.3f\n",
                      phase, (unsigned long)millis(), sensor.getTemperature(), sensor.getPressure(),
                      sensor.getAccX(), sensor.getAccY(), sensor.getAccZ(), sensor.getGyroX(), sensor.getGyroY(), sensor.getGyroZ(), sensor.getMagX());
    }
    if (phase < 7 && millis() - started >= 5000) {
        phase++;
        startPhase();
    }
    delay(20);
}
