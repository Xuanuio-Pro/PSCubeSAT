#ifndef SENSOR_H
#define SENSOR_H

#include <math.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_QMC5883P.h>

class PTIT_Sensor {
public:
    void init(bool initBMP = true, bool initMPU = true, bool initQMC = true);
    void update();
    bool hasBMP() const { return bmpReady; }
    bool hasMPU() const { return mpuReady; }
    bool hasQMC() const { return qmcReady; }
    float getTemperature();
    float getPressure();
    float getAccX();
    float getAccY();
    float getAccZ();
    float getGyroX();
    float getGyroY();
    float getGyroZ();
    float getMagX();
    float getMagY();
    float getMagZ();

private:
    Adafruit_BMP280 bmp;
    Adafruit_MPU6050 mpu;
    Adafruit_QMC5883P qmc;

    bool bmpReady = false, mpuReady = false, qmcReady = false;
    bool rawMPU6500 = false;
    uint8_t mpuAddress = 0x68;
    uint32_t lastSample = 0, lastEnvironment = 0;
    uint32_t mpuReadErrors = 0, qmcReadErrors = 0, lastErrorReport = 0;
    // Pressure remains hPa for compatibility with the published API.
    float t = NAN, p = NAN;
    float ax = NAN, ay = NAN, az = NAN;
    float gx = NAN, gy = NAN, gz = NAN;
    float mx = NAN, my = NAN, mz = NAN;
};

#endif
