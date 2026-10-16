#include "Camera.h"
#include <SD.h>
#include <SPI.h>
#include <stdlib.h>
#include <esp_task_wdt.h>

namespace {
constexpr uint8_t SD_CS_PIN = 13;
constexpr uint8_t SD_SCK_PIN = 18;
constexpr uint8_t SD_MISO_PIN = 19;
constexpr uint8_t SD_MOSI_PIN = 23;
}

PTIT_Camera::PTIT_Camera() : gpsSelectPin(12), camSelectPin(14), sdReady(false) {
}

bool PTIT_Camera::initializeSd() {
    // Nếu thẻ nhớ đã khởi tạo thành công trước đó, không cần khởi tạo lại
    if (sdReady) return true;
    
    Serial.println("[Camera] Khoi tao MicroSD qua SPI...");
    SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
    if (!SD.begin(SD_CS_PIN, SPI, 8000000)) {
        Serial.println("[Camera] MicroSD mount failed");
        sdReady = false;
        return false;
    }

    sdReady = true;
    Serial.println("[Camera] MicroSD ready for image storage");
    return true;
}

bool PTIT_Camera::init(uint8_t gpsSelectPin, uint8_t camSelectPin) {
    this->gpsSelectPin = gpsSelectPin;
    this->camSelectPin = camSelectPin;

    if (gpsSelectPin != 255 && camSelectPin != 255) {
        pinMode(this->gpsSelectPin, OUTPUT);
        pinMode(this->camSelectPin, OUTPUT);
        digitalWrite(this->gpsSelectPin, LOW);
        digitalWrite(this->camSelectPin, HIGH); // Mặc định mở kênh Camera
    }

    Serial.println("[Camera] Khởi tạo giao tiếp Master-Slave với ESP32-CAM (UART2)...");
    Serial2.begin(115200, SERIAL_8N1, 16, 17); // Mở cổng Serial2 để giao tiếp với ESP32-CAM

    return initializeSd();
}

void PTIT_Camera::selectGPS() {
    if (gpsSelectPin != 255 && camSelectPin != 255) {
        digitalWrite(gpsSelectPin, HIGH);
        digitalWrite(camSelectPin, LOW);
        // Trả lại cấu hình UART cho GPS
        if (Serial2.baudRate() != 9600) { Serial2.flush(); Serial2.updateBaudRate(9600); }
    }
}

void PTIT_Camera::selectCamera() {
    if (gpsSelectPin != 255 && camSelectPin != 255) {
        digitalWrite(gpsSelectPin, LOW);
        digitalWrite(camSelectPin, HIGH);
        // Đặt lại cấu hình UART cho Camera
        if (Serial2.baudRate() != 115200) { Serial2.flush(); Serial2.updateBaudRate(115200); }
    }
}

bool PTIT_Camera::isReady() const {
    // Storage readiness only. Camera health is known from the CAPTURE response.
    return sdReady;
}

bool PTIT_Camera::capture() {
    return captureToFile("/photos/capture.jpg");
}

bool PTIT_Camera::captureToFile(const char* path) {
    if (!sdReady && !initializeSd()) {
        Serial.println("[Camera] Lỗi: Thẻ nhớ SD chưa sẵn sàng.");
        return false;
    }

    // Đảm bảo kênh MUX đang trỏ vào Camera và cổng Serial2 đang mở ở baudrate 115200
    selectCamera();

    // Dọn dẹp bộ nhớ đệm
    while(Serial2.available()) Serial2.read();

    // 1. Gửi lệnh CAPTURE
    Serial.println("[Camera] Đang gửi lệnh chụp ảnh tới ESP32-CAM...");
    Serial2.print("CAPTURE\n");
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
                if (end == response.c_str() + 5 || *end != '\0' || imageSize < 4 || imageSize > 512 * 1024) {
                    Serial.println("[Camera] Invalid SIZE (expected 4..524288 bytes)");
                    return false;
                }
                sizeReceived = true;
                break;
            }
            if (response.startsWith("ERROR:")) {
                Serial.println("[Camera] ESP32-CAM: " + response);
                if (response == "ERROR:CAPTURE") Serial.println("[Camera] Slave returned no frame; check slave CAMERA_INIT, sensor cable, power and PSRAM.");
                return false;
            }
        }
        delay(1);
    }

    if (!sizeReceived || imageSize <= 0) {
        Serial.println("[Camera] Lỗi: Không nhận được phản hồi kích thước từ ESP32-CAM.");
        return false;
    }

    Serial.printf("[Camera] ESP32-CAM phản hồi kích thước ảnh: %ld bytes\n", imageSize);

    // 3. Tạo thư mục nếu chưa có
    String filePath = path;
    int lastSlash = filePath.lastIndexOf('/');
    if (lastSlash > 0) {
        String dirPath = filePath.substring(0, lastSlash);
        if (!SD.exists(dirPath.c_str())) {
            if (!SD.mkdir(dirPath.c_str())) {
                Serial.println("[Camera] Lỗi: Không thể tạo thư mục " + dirPath);
                return false;
            }
        }
    }

    // 4. Mở file để ghi
    String partialPath = String(path) + ".part";
    File file = SD.open(partialPath.c_str(), FILE_WRITE);
    if (!file) {
        Serial.println("[Camera] Lỗi: Không thể tạo file " + String(path));
        return false;
    }

    // 5. Báo cho ESP32-CAM biết OBC đã sẵn sàng nhận dữ liệu
    Serial2.print("OK\n");
    Serial2.flush();
    Serial.println("[Camera] Đang tải dữ liệu ảnh từ ESP32-CAM...");

    // 6. Nhận dữ liệu raw từ UART và ghi trực tiếp vào thẻ nhớ
    long receivedBytes = 0;
    startTime = millis();
    uint8_t buf[256];
    const unsigned long transferStarted = millis();
    unsigned long watchdogFed = millis();
    uint8_t first[2] = {}, last[2] = {};
    bool writeOK = true;

    while (receivedBytes < imageSize && (millis() - startTime < 15000) && (millis() - transferStarted < 65000)) {
        if ((uint32_t)(millis() - watchdogFed) >= 1000) {
            watchdogFed = millis();
            if (esp_task_wdt_status(nullptr) == ESP_OK) esp_task_wdt_reset();
        }
        if (Serial2.available()) {
            int bytesToRead = Serial2.available();
            if (bytesToRead > sizeof(buf)) bytesToRead = sizeof(buf);
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
        }
        delay(1);
    }

    file.close();

    // 7. Hoàn tất
    if (writeOK && receivedBytes == imageSize && first[0] == 0xFF && first[1] == 0xD8 && last[0] == 0xFF && last[1] == 0xD9) {
        if ((SD.exists(path) && !SD.remove(path)) || !SD.rename(partialPath.c_str(), path)) {
            Serial.println("[Camera] SD rename failed; complete JPEG remains in .part file");
            Serial2.println("DONE");
            return false;
        }
        Serial.println("[Camera] Lưu ảnh thành công: " + String(path));
        Serial2.println("DONE"); // Báo ESP32-CAM kết thúc
        return true;
    } else {
        SD.remove(partialPath.c_str());
        Serial2.println("DONE");
        Serial.printf("[Camera] Capture invalid: bytes=%ld/%ld write_ok=%d (timeout, SD write or JPEG framing)\n", receivedBytes, imageSize, writeOK);
        return false;
    }
}
