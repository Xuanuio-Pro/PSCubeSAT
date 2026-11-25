// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-01a_MicroSD_SPI/blob/9c5adfb00478d99c3cd7b391805dd96e0b256a5d/src/main.cpp
/**
 * VÍ DỤ 3-1a: GIAO TIẾP THẺ NHỚ BẰNG SPI THUẦN (SD.h)
 */
#include <Arduino.h>
#include <SD.h>
#include <SPI.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;

#define SD_CS_PIN   13
#define SD_SCK_PIN  18
#define SD_MISO_PIN 19
#define SD_MOSI_PIN 23

bool sdReady = false;

// Trả về true chỉ khi toàn bộ dòng (kể cả ký tự xuống dòng) đã được ghi xuống thẻ nhớ.
bool logData(const char* message) {
    if (!sdReady) return false;

    File file = SD.open("/log.txt", FILE_APPEND);
    if (!file) {
        cdh.println("SD: Open /log.txt failed");
        return false;
    }
    const size_t expected = strlen(message) + 2;
    const size_t written = file.println(message);
    file.flush();
    file.close();
    if (written != expected) {
        cdh.printf("SD: Short write: %u/%u bytes\n", (unsigned)written, (unsigned)expected);
        return false;
    }
    return true;
}

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
    if (!SD.begin(SD_CS_PIN, SPI, 8000000)) {
        cdh.println("SD: Mount failed");
        return;
    }
    sdReady = true;
    logData("BOOT: PTITCUBE C&DH");
}

void loop() {
    static int counter = 0;
    char buf[64];
    snprintf(buf, sizeof(buf), "Hello World #%d", counter++);

    cdh.println(buf);
    if (sdReady) cdh.println(logData(buf) ? "SD: Saved to /log.txt" : "SD: Write failed; entry not saved");

    delay(3000);
}
