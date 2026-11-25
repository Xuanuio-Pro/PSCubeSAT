#ifndef SENSOR_H
#define SENSOR_H

#include <math.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_QMC5883P.h>

class PTIT_Sensor {
public:
    void init(bool initBMP = true, bool initMPU = true, bool initQMC = true);
    void update();
    float getTemperature();
    float getPressure();
    float getAltitude();
    float getAccX();
    float getAccY();
    float getAccZ();
    float getGyroX();
    float getGyroY();
    float getGyroZ();
    float getMagX();
    float getMagY();
    float getMagZ();
    float getRoll();
    float getPitch();
    float getHeading();

private:
    Adafruit_BMP280 bmp;
    Adafruit_QMC5883P qmc;

    uint8_t mpuAddress = 0x68;
    bool bmpReady = false;
    bool mpuReady = false;
    bool qmcReady = false;

    // Platform patch: NaN = no valid reading (sensor absent or last read failed), never a stale value.
    float t = NAN, p = NAN;
    float ax = NAN, ay = NAN, az = NAN;
    float gx = NAN, gy = NAN, gz = NAN;
    float mx = NAN, my = NAN, mz = NAN;
    uint32_t lastSample = 0;

    bool initMPUDevice(uint8_t addr);
};

#endif
