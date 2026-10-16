#include "Sensor.h"
#include <Arduino.h>
#include <Wire.h>

namespace {
bool readMPU(uint8_t address, uint8_t reg, uint8_t* data, uint8_t size) {
    Wire.beginTransmission(address); Wire.write(reg);
    // The register pointer persists across STOP; avoid ESP32 deferred repeated-start transactions.
    if (Wire.endTransmission(true) != 0) return false;
    if (Wire.requestFrom(address, size) != size) return false;
    for (uint8_t i = 0; i < size; ++i) data[i] = Wire.read();
    return true;
}
bool writeMPU(uint8_t address, uint8_t reg, uint8_t value) {
    Wire.beginTransmission(address); Wire.write(reg); Wire.write(value);
    return Wire.endTransmission() == 0;
}
int16_t signedWord(const uint8_t* data) {
    return (int16_t)(((uint16_t)data[0] << 8) | data[1]);
}
}

void PTIT_Sensor::init(bool initBMP, bool initMPU, bool initQMC) {
    Serial.println("[Sensor] Initializing Sensors...");
    bmpReady = mpuReady = qmcReady = rawMPU6500 = false;
    t = p = ax = ay = az = gx = gy = gz = mx = my = mz = NAN;
    lastSample = lastEnvironment = lastErrorReport = 0;
    mpuReadErrors = qmcReadErrors = 0;
    Wire.begin(21, 22);
    Wire.setTimeOut(50);
    if (initBMP) {
        bmpReady = bmp.begin(0x76) || bmp.begin(0x77);
        Serial.println(bmpReady ? "BMP280 found!" : "[Sensor] BMP280 unavailable; readings are NaN");
    }
    if (initMPU) {
        for (uint8_t address : { (uint8_t)0x68, (uint8_t)0x69 }) {
            uint8_t who = 0;
            if (!readMPU(address, 0x75, &who, 1)) continue;
            mpuAddress = address;
            if (who == 0x70) {
                // MPU6500 register map: +/-8g (4096 LSB/g), +/-500 deg/s (65.5 LSB/deg/s).
                mpuReady = writeMPU(address, 0x6B, 0x01) && writeMPU(address, 0x6C, 0x00);
                delay(100);
                mpuReady = mpuReady && writeMPU(address, 0x1C, 0x10) && writeMPU(address, 0x1B, 0x08);
                uint8_t accelConfig = 0, gyroConfig = 0;
                mpuReady = mpuReady && readMPU(address, 0x1C, &accelConfig, 1) &&
                    readMPU(address, 0x1B, &gyroConfig, 1) && accelConfig == 0x10 && gyroConfig == 0x08;
                rawMPU6500 = mpuReady;
                if (mpuReady) Serial.println("MPU6500 found! (8g, 500deg/s)");
            } else if (who == 0x68) {
                mpuReady = mpu.begin(address);
                if (mpuReady) {
                    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
                    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
                    Serial.println("MPU6050 found!");
                }
            }
            if (mpuReady) break;
        }
        if (!mpuReady) Serial.println("[Sensor] MPU6050/6500 unavailable or unsupported; readings are NaN");
    }
    if (initQMC) {
        qmcReady = qmc.begin();
        if (qmcReady) {
            qmc.setMode(QMC5883P_MODE_CONTINUOUS);
            qmc.setRange(QMC5883P_RANGE_2G);
            qmc.setODR(QMC5883P_ODR_50HZ);
            qmc.setOSR(QMC5883P_OSR_8);
            qmc.setDSR(QMC5883P_DSR_1);
            qmc.setSetResetMode(QMC5883P_SETRESET_ON);
            Serial.println("QMC5883P found!");
        } else {
            Serial.println("[Sensor] QMC5883P unavailable; readings are NaN");
        }
    }
}

void PTIT_Sensor::update() {
    const uint32_t now = millis();
    if (lastSample && (uint32_t)(now - lastSample) < 20) return; // max 50 Hz
    lastSample = now;
    if (bmpReady && (!lastEnvironment || (uint32_t)(now - lastEnvironment) >= 100)) {
        lastEnvironment = now;
        t = bmp.readTemperature();
        p = bmp.readPressure() / 100.0f; // hPa (existing public API).
    }
    if (mpuReady && rawMPU6500) {
        uint8_t data[14];
        if (readMPU(mpuAddress, 0x3B, data, sizeof(data))) {
            constexpr float accelScale = 9.80665f / 4096.0f;
            constexpr float gyroScale = 0.017453292519943295f / 65.5f;
            ax = signedWord(data) * accelScale;
            ay = signedWord(data + 2) * accelScale;
            az = signedWord(data + 4) * accelScale;
            gx = signedWord(data + 8) * gyroScale;
            gy = signedWord(data + 10) * gyroScale;
            gz = signedWord(data + 12) * gyroScale;
        } else { ax = ay = az = gx = gy = gz = NAN; ++mpuReadErrors; }
    } else if (mpuReady) {
        sensors_event_t a, g, temp;
        if (mpu.getEvent(&a, &g, &temp)) {
            ax = a.acceleration.x; ay = a.acceleration.y; az = a.acceleration.z;
            gx = g.gyro.x; gy = g.gyro.y; gz = g.gyro.z;
        } else { ax = ay = az = gx = gy = gz = NAN; ++mpuReadErrors; }
    }
    if (qmcReady) {
        int16_t qx, qy, qz;
        // Range is configured once to 2G: avoid reading the range register on every sample.
        if (qmc.getRawMagnetic(&qx, &qy, &qz)) {
            mx = qx / 15000.0f; my = qy / 15000.0f; mz = qz / 15000.0f;
        } else { mx = my = mz = NAN; ++qmcReadErrors; }
    }
    if ((mpuReadErrors || qmcReadErrors) && (uint32_t)(now - lastErrorReport) >= 5000) {
        lastErrorReport = now;
        Serial.printf("[Sensor] read failures since init: MPU=%lu QMC=%lu\n", (unsigned long)mpuReadErrors, (unsigned long)qmcReadErrors);
    }
}

float PTIT_Sensor::getTemperature() { return t; }
float PTIT_Sensor::getPressure() { return p; }

float PTIT_Sensor::getAccX() { return ax; }
float PTIT_Sensor::getAccY() { return ay; }
float PTIT_Sensor::getAccZ() { return az; }

float PTIT_Sensor::getGyroX() { return gx; }
float PTIT_Sensor::getGyroY() { return gy; }
float PTIT_Sensor::getGyroZ() { return gz; }

float PTIT_Sensor::getMagX() { return mx; }
float PTIT_Sensor::getMagY() { return my; }
float PTIT_Sensor::getMagZ() { return mz; }
