#include "MUX.h"
#include "../EPS/EPS.h"

namespace {
// GPS NEO runs at 9600; the ESP32-CAM protocol on its UART2 at 115200.
constexpr uint32_t GPS_BAUD = 9600;
constexpr uint32_t CAM_BAUD = 115200;

// One HardwareSerial instance per UART2 peripheral: change the baud in place instead of
// re-running begin() (which reinstalls the driver and drops buffered bytes) on every switch.
void uart2Baud(uint32_t baud) {
    if (Serial2.baudRate() == 0) {
        Serial2.begin(baud, SERIAL_8N1, UART2_RX_PIN, UART2_TX_PIN);
    } else if (Serial2.baudRate() != baud) {
        Serial2.flush();
        Serial2.updateBaudRate(baud);
    }
}
}

uint8_t PTIT_MUX::_gpsPin = MUX_GPS_PIN;
uint8_t PTIT_MUX::_camPin = MUX_CAM_PIN;
bool PTIT_MUX::_isCameraActive = false;

void PTIT_MUX::init(uint8_t gpsSelectPin, uint8_t camSelectPin) {
    PTIT_EPS::setBuckState(true);

    _gpsPin = gpsSelectPin;
    _camPin = camSelectPin;

    if (_gpsPin != 255 && _camPin != 255) {
        pinMode(_gpsPin, OUTPUT);
        pinMode(_camPin, OUTPUT);

        // Break-Before-Make: Tắt cả hai kênh trước
        digitalWrite(_camPin, LOW);
        digitalWrite(_gpsPin, LOW);
        delayMicroseconds(50);

        // Mặc định an toàn: Trả quyền ưu tiên bus UART2 cho GPS
        digitalWrite(_gpsPin, HIGH);
    }
    // Without a MUX (pins 255) UART2 is wired to one device; PTIT_Camera::init and
    // PTIT_GPS::init then call selectCamera()/selectGPS() to set that device's baud.
    _isCameraActive = false;
    uart2Baud(GPS_BAUD);
}

void PTIT_MUX::selectGPS() {
    if (_gpsPin != 255 && _camPin != 255) {
        // Break-Before-Make: TẮT Camera trước
        digitalWrite(_camPin, LOW);
        delayMicroseconds(50);
        // BẬT GPS sau
        digitalWrite(_gpsPin, HIGH);
    }
    uart2Baud(GPS_BAUD);
    _isCameraActive = false;
}

void PTIT_MUX::selectCamera() {
    if (_gpsPin != 255 && _camPin != 255) {
        // Break-Before-Make: TẮT GPS trước
        digitalWrite(_gpsPin, LOW);
        delayMicroseconds(50);
        // BẬT Camera sau
        digitalWrite(_camPin, HIGH);
        delay(100);
    }
    uart2Baud(CAM_BAUD);
    _isCameraActive = true;
}

bool PTIT_MUX::isGPSSelected() {
    return !_isCameraActive;
}

bool PTIT_MUX::isCameraSelected() {
    return _isCameraActive;
}
