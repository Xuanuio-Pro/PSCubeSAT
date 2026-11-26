// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab2-01b_Battery_Library/blob/611e049ce1359ec199f56185f345d125da8eccd4/src/main.cpp
/**
 * VÍ DỤ 2-1b: QUẢN LÝ PHÂN HỆ NGUỒN (EPS) VỚI THƯ VIỆN PTITCUBE (MAX17048)
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_EPS eps;

void setup() {
    Serial.begin(115200);
    eps.init();
}

void loop() {
    eps.update();

    float voltage    = eps.getBatteryVoltage();
    float percent    = eps.getBatteryPercent();
    float chargeRate = eps.getChargeRate();

    Serial.printf("V: %.3f V | SOC: %.1f %% | Rate: %+.2f %%/h\n", voltage, percent, chargeRate);
    delay(2000);
}
