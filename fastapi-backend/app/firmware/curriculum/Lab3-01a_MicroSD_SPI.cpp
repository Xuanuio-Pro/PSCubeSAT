// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-01a_MicroSD_SPI/blob/3da6ecdf36f98cb735bc0b5c979bedc3e3d6c9e8/src/main.cpp
/**
 * VÍ DỤ 3-1a: GIAO TIẾP THẺ NHỚ BẰNG SPI THUẦN (SD.h)
 */
#include <Arduino.h>
#include <SD.h>
#include <SPI.h>

#define SD_CS_PIN 13 // PTIT ESP32 OBC wiring; change explicitly for another board.

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[RAW] Khởi tạo thẻ nhớ MicroSD bằng thư viện SD gốc...");
    
    // Khởi tạo SPI cho thẻ nhớ
    SPI.begin(18, 19, 23, SD_CS_PIN);
    if (!SD.begin(SD_CS_PIN, SPI, 8000000)) {
        Serial.println("[ERROR] Lỗi! Không tìm thấy thẻ nhớ hoặc chân cắm sai.");
        return;
    }
    
    Serial.println("[RAW] Khởi tạo thành công! Kiểm tra file...");
    
    File file = SD.open("/test.txt", FILE_APPEND);
    if (file) {
        const size_t written = file.println("Hello CubeSat from RAW SPI!");
        file.close();
        Serial.println(written == strlen("Hello CubeSat from RAW SPI!\r\n") ? "[RAW] Đã ghi nội dung thử nghiệm vào /test.txt" : "[ERROR] SD short write /test.txt");
    } else {
        Serial.println("[ERROR] Không thể mở file /test.txt để ghi.");
    }
}

void loop() {
    // Không làm gì
}
