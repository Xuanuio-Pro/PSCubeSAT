#include "Camera.h"
#include "MUX.h"
#include "../EPS/EPS.h"
#include <SD.h>
#include <SPI.h>
#include <stdlib.h>
#include <esp_task_wdt.h>

namespace {
constexpr uint8_t SD_CS_PIN = 13;
constexpr uint8_t SD_SCK_PIN = 18;
constexpr uint8_t SD_MISO_PIN = 19;
constexpr uint8_t SD_MOSI_PIN = 23;
constexpr long MAX_IMAGE_BYTES = 512L * 1024L;
}

PTIT_Camera::PTIT_Camera() : gpsSelectPin(12), camSelectPin(14), sdReady(false) {
}

bool PTIT_Camera::initializeSd() {
    if (sdReady) return true;

    SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
    if (!SD.begin(SD_CS_PIN, SPI, 8000000)) {
        Serial.println("Camera: SD mount failed");
        sdReady = false;
        return false;
    }

    sdReady = true;
    return true;
}

bool PTIT_Camera::init(uint8_t gpsSelectPin, uint8_t camSelectPin) {
    this->gpsSelectPin = gpsSelectPin;
    this->camSelectPin = camSelectPin;

    PTIT_MUX::init(gpsSelectPin, camSelectPin);
    // Without a MUX the camera is wired directly: keep UART2 at the camera baud.
    if (gpsSelectPin == 255 || camSelectPin == 255) PTIT_MUX::selectCamera();
    return initializeSd();
}

void PTIT_Camera::selectGPS() {
    PTIT_MUX::selectGPS();
}

void PTIT_Camera::selectCamera() {
    PTIT_MUX::selectCamera();
}

bool PTIT_Camera::isReady() const {
    // Storage readiness only. Camera health is known from the capture response.
    return sdReady;
}

bool PTIT_Camera::capture() {
    return captureToFile("/photos/capture.jpg");
}

bool PTIT_Camera::captureToFile(const char* path) {
    const bool saved = captureOnCameraChannel(path);
    // Always hand UART2 back to GPS, whether the capture succeeded or failed.
    selectGPS();
    return saved;
}

bool PTIT_Camera::captureOnCameraChannel(const char* path) {
    if (!sdReady && !initializeSd()) {
        Serial.println("Camera: SD not ready");
        return false;
    }

    // Đảm bảo kênh MUX đang trỏ vào Camera và cổng Serial2 chuyển sang 115200
    selectCamera();

    // Dọn dẹp bộ nhớ đệm UART2
    while (Serial2.available()) Serial2.read();

    // 1. Gửi lệnh chụp. 'p' is accepted by both PTITCube ESP32_CAM_Firmware (p/capture/photo)
    // and the platform's camera-slave; slave replies SIZE:<n> -> OK -> JPEG -> DONE.
    Serial2.print("p\n");
    Serial2.flush();

    // 2. Chờ ESP32-CAM phản hồi về SIZE
    String response = "";
    unsigned long startTime = millis();
    bool sizeReceived = false;
    long imageSize = 0;

    while (millis() - startTime < 5000) {
        if (Serial2.available()) {
            response = Serial2.readStringUntil('\n');
            response.trim();
            if (response.startsWith("SIZE:")) {
                char* end = nullptr;
                imageSize = strtol(response.c_str() + 5, &end, 10);
                if (end == response.c_str() + 5 || *end != '\0' || imageSize < 4 || imageSize > MAX_IMAGE_BYTES) {
                    Serial.println("Camera: Invalid SIZE (expected 4..524288 bytes): " + response);
                    return false;
                }
                sizeReceived = true;
                break;
            }
            if (response.startsWith("ERROR:")) {
                Serial.println("Camera: " + response);
                return false;
            }
        }
        delay(1);
    }

    if (!sizeReceived) {
        Serial.println("Camera: Timeout: No response from ESP32-CAM");
        return false;
    }

    // 3. Tạo thư mục nếu chưa có
    String filePath = path;
    int lastSlash = filePath.lastIndexOf('/');
    if (lastSlash > 0) {
        String dirPath = filePath.substring(0, lastSlash);
        if (!SD.exists(dirPath.c_str()) && !SD.mkdir(dirPath.c_str())) {
            Serial.println("Camera: Mkdir failed: " + dirPath);
            return false;
        }
    }

    // 4. Ghi vào file tạm; chỉ đổi tên thành ảnh khi đã nhận đủ một JPEG hợp lệ
    String partialPath = filePath + ".part";
    File file = SD.open(partialPath.c_str(), FILE_WRITE);
    if (!file) {
        Serial.println("Camera: Open file failed: " + filePath);
        return false;
    }

    // 5. Báo cho ESP32-CAM biết OBC đã sẵn sàng nhận dữ liệu
    Serial2.print("OK\n");
    Serial2.flush();

    // 6. Nhận dữ liệu raw từ UART2 và ghi trực tiếp vào thẻ nhớ
    long receivedBytes = 0;
    startTime = millis();
    const unsigned long transferStarted = millis();
    unsigned long watchdogFed = millis();
    uint8_t buf[256];
    uint8_t first[2] = {}, last[2] = {};
    bool writeOK = true;

    while (receivedBytes < imageSize && (millis() - startTime < 15000) && (millis() - transferStarted < 65000)) {
        // Long transfers must not trip a task watchdog the sketch registered.
        if ((uint32_t)(millis() - watchdogFed) >= 1000) {
            watchdogFed = millis();
            if (esp_task_wdt_status(nullptr) == ESP_OK) esp_task_wdt_reset();
        }
        if (Serial2.available()) {
            int bytesToRead = Serial2.available();
            if (bytesToRead > (int)sizeof(buf)) bytesToRead = sizeof(buf);
            if (bytesToRead > imageSize - receivedBytes) bytesToRead = imageSize - receivedBytes;

            int bytesRead = Serial2.readBytes(buf, bytesToRead);
            if (file.write(buf, bytesRead) != (size_t)bytesRead) { writeOK = false; break; }
            for (int i = 0; i < bytesRead; ++i) {
                if (receivedBytes + i < 2) first[receivedBytes + i] = buf[i];
                last[0] = last[1]; last[1] = buf[i];
            }
            receivedBytes += bytesRead;

            // Reset timeout mỗi khi nhận được dữ liệu
            startTime = millis();
        } else {
            delay(1);
        }
    }

    file.close();
    Serial2.println("DONE"); // Báo ESP32-CAM kết thúc, kể cả khi lỗi, để slave không chờ mãi

    // 7. Chỉ báo thành công khi đủ byte, ghi đủ và đúng khung JPEG (FFD8 ... FFD9)
    const bool jpeg = first[0] == 0xFF && first[1] == 0xD8 && last[0] == 0xFF && last[1] == 0xD9;
    if (!writeOK || receivedBytes != imageSize || !jpeg) {
        SD.remove(partialPath.c_str());
        Serial.printf("Camera: Capture invalid: %ld/%ld bytes, write_ok=%d, jpeg=%d\n",
                      receivedBytes, imageSize, writeOK, jpeg);
        return false;
    }
    if ((SD.exists(path) && !SD.remove(path)) || !SD.rename(partialPath.c_str(), path)) {
        Serial.println("Camera: SD rename failed; complete JPEG remains in " + partialPath);
        return false;
    }
    Serial.printf("Camera: Saved %s (%ld bytes)\n", path, imageSize);
    return true;
}
