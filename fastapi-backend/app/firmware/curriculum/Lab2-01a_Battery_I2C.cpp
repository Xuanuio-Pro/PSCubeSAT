// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab2-01a_Battery_I2C/blob/d547ed3aadfddf91112323b60337a830e5feacbe/src/main.cpp
/**
 * VÍ DỤ 2-1a: GIAO TIẾP VỚI IC ĐO DUNG LƯỢNG PIN MAX17048 QUA I2C THUẦN (WIRE.H)
 * 
 * Mục tiêu:
 * - Hiểu nguyên lý hoạt động của IC Fuel Gauge chuyên dụng MAX17048 trên phân hệ nguồn (EPS).
 * - Học cách đọc thanh ghi 16-bit qua giao thức I2C bằng thư viện Wire chuẩn của Arduino:
 *     + Địa chỉ I2C của MAX17048: 0x36
 *     + Thanh ghi VCELL (0x02): Đo điện áp cell pin (độ phân giải 78.125 uV / LSB)
 *     + Thanh ghi SOC (0x04): Đo tỷ lệ phần trăm dung lượng pin (độ phân giải 1/256 %)
 *     + Thanh ghi CRATE (0x16): Tốc độ sạc/xả pin (%/h)
 * 
 * Kết nối phần cứng:
 * - MAX17048 SDA -> ESP32 GPIO 21
 * - MAX17048 SCL -> ESP32 GPIO 22
 * - MAX17048 VDD / CELL -> Nguồn pin Li-ion (3.0V - 4.2V)
 * - MAX17048 GND -> GND chung
 */

#include <Arduino.h>
#include <Wire.h>

#define MAX17048_ADDR       0x36
#define REG_VCELL           0x02
#define REG_SOC             0x04
#define REG_MODE            0x06
#define REG_VER             0x08
#define REG_CRATE           0x16

// Hàm đọc thanh ghi 16-bit từ MAX17048
uint16_t readRegister16(uint8_t reg) {
    Wire.beginTransmission(MAX17048_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) { // Gửi repeated START
        return 0;
    }

    if (Wire.requestFrom((uint8_t)MAX17048_ADDR, (uint8_t)2) == 2) {
        uint8_t msb = Wire.read();
        uint8_t lsb = Wire.read();
        return ((uint16_t)msb << 8) | lsb;
    }
    return 0;
}

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n========================================================");
    Serial.println("[EXAMPLE 2-1a] ĐO ĐIỆN ÁP & PHẦN TRĂM PIN VỚI MAX17048 (I2C)");
    Serial.println("========================================================");

    // Khởi tạo bus I2C (mặc định SDA=GPIO21, SCL=GPIO22 trên ESP32)
    Wire.begin();

    // Kiểm tra sự hiện diện của IC MAX17048 trên bus I2C
    Wire.beginTransmission(MAX17048_ADDR);
    byte error = Wire.endTransmission();

    if (error == 0) {
        Serial.printf("[EPS] Tìm thấy MAX17048 tại địa chỉ I2C: 0x%02X\n", MAX17048_ADDR);
        uint16_t version = readRegister16(REG_VER);
        Serial.printf("[EPS] Phiên bản phần cứng (IC Version): 0x%04X\n\n", version);
    } else {
        Serial.printf("[EPS] LỖI: Không tìm thấy MAX17048 tại địa chỉ 0x%02X (Mã lỗi: %d)!\n", MAX17048_ADDR, error);
        Serial.println("[EPS] Vui lòng kiểm tra lại dây nối SDA (GPIO 21), SCL (GPIO 22) và nguồn cấp.");
    }
}

void loop() {
    // 1. Đọc điện áp cell pin (VCELL register 0x02)
    // Mỗi LSB tương đương 78.125 uV (0.000078125 V)
    uint16_t rawVcell = readRegister16(REG_VCELL);
    float voltage = (float)rawVcell * 0.000078125f;

    // 2. Đọc State of Charge (SOC register 0x04)
    // Byte cao là phần nguyên, byte thấp là phần thập phân (1/256 %)
    uint16_t rawSoc = readRegister16(REG_SOC);
    float soc = (float)rawSoc / 256.0f;
    if (soc > 100.0f) soc = 100.0f;
    if (soc < 0.0f) soc = 0.0f;

    // 3. Đọc tốc độ sạc / xả (CRATE register 0x16)
    // Giá trị bù 2 (signed 16-bit), mỗi LSB = 0.208 %/giờ
    int16_t rawCrate = (int16_t)readRegister16(REG_CRATE);
    float crate = (float)rawCrate * 0.208f;

    // In thông tin telemetry nguồn ra Serial
    Serial.printf("[Uptime: %lus] Điện áp: %.3f V | Dung lượng: %.1f %% | Tốc độ: %+.2f %%/h\n",
                  millis() / 1000, voltage, soc, crate);

    // Cảnh báo trạng thái pin
    if (voltage < 3.2f && voltage > 1.0f) {
        Serial.println(" ---> [CẢNH BÁO] Pin yếu (< 3.2V)! Cần kích hoạt chế độ tiết kiệm năng lượng.");
    } else if (soc >= 98.0f) {
        Serial.println(" ---> [THÔNG TIN] Pin đã sạc đầy.");
    }

    delay(2000);
}
