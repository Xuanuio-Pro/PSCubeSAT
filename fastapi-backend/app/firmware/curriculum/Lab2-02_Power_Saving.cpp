// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab2-02_Power_Saving/blob/8684607d6a3d5fee460299ff2d6066fcb3107d10/src/main.cpp
/**
 * VÍ DỤ 2-2: QUẢN LÝ TIẾT KIỆM NĂNG LƯỢNG - POWER SAVING MODE DỰA VÀO ĐIỆN ÁP / PHẦN TRĂM PIN
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_EPS eps;

// Ngưỡng kích hoạt chế độ tiết kiệm năng lượng
const float LOW_VOLTAGE_THRESHOLD = 3.70f;  // Dưới 3.70V
const float LOW_SOC_THRESHOLD     = 25.0f;  // Hoặc dưới 25% dung lượng

void setup() {
    Serial.begin(115200);
    eps.init();
}

void loop() {
    eps.update();

    bool connected = eps.isConnected();
    float vcell    = connected ? eps.getBatteryVoltage() : 0.0f;
    float soc      = connected ? eps.getBatteryPercent() : 0.0f;

    // Kích hoạt Power Saving Mode nếu chưa bật/ngắt nguồn (!connected) hoặc điện áp/dung lượng thấp
    bool isLowPower = !connected || (vcell < LOW_VOLTAGE_THRESHOLD) || (soc < LOW_SOC_THRESHOLD);

    if (isLowPower) {
        // Chế độ tiết kiệm năng lượng: TẮT mạch hạ áp để ngắt tải phụ, kéo dài thời gian ngủ
        eps.setBuckState(false);
        Serial.printf("EPS: Power Saving Mode (V: %.2fV, SOC: %.1f%%)\n", vcell, soc);
        delay(5000);
    } else {
        // Chế độ hoạt động bình thường: BẬT mạch hạ áp cấp nguồn cho toàn bộ hệ thống
        eps.setBuckState(true);
        Serial.printf("EPS: Normal Mode (V: %.2fV, SOC: %.1f%%)\n", vcell, soc);
        delay(1500);
    }
}
