// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab2-01a_Battery_I2C/blob/d3bd230a5bf4462f1fcbb5870ba005413e7443c8/src/main.cpp
/**
 * VÍ DỤ 2-1a: GIAO TIẾP VỚI IC ĐO DUNG LƯỢNG PIN MAX17048 QUA I2C THUẦN (WIRE.H)
 */
#include <Arduino.h>
#include <PTITCube.h>
#include <Wire.h>

PTIT_EPS eps;

#define MAX17048_ADDR  0x36
#define REG_VCELL      0x02
#define REG_SOC        0x04
#define REG_CRATE      0x16

uint16_t readRegister16(uint8_t reg) {
    Wire.beginTransmission(MAX17048_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) return 0;

    if (Wire.requestFrom((uint8_t)MAX17048_ADDR, (uint8_t)2) == 2) {
        uint8_t msb = Wire.read();
        uint8_t lsb = Wire.read();
        return ((uint16_t)msb << 8) | lsb;
    }
    return 0;
}

void setup() {
    Serial.begin(115200);

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    Wire.begin();
}

void loop() {
    // Đọc điện áp (VCELL: 78.125 uV / LSB)
    uint16_t rawVcell = readRegister16(REG_VCELL);
    float voltage = (float)rawVcell * 0.000078125f;

    // Đọc dung lượng (SOC: 1/256 %)
    uint16_t rawSoc = readRegister16(REG_SOC);
    float soc = (float)rawSoc / 256.0f;
    if (soc > 100.0f) soc = 100.0f;
    if (soc < 0.0f) soc = 0.0f;

    // Đọc tốc độ sạc/xả (CRATE: 0.208 %/h)
    int16_t rawCrate = (int16_t)readRegister16(REG_CRATE);
    float crate = (float)rawCrate * 0.208f;

    Serial.printf("V: %.3f V | SOC: %.1f %% | Rate: %+.2f %%/h\n", voltage, soc, crate);

    delay(2000);
}
