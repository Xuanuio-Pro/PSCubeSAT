// Build-only compatibility fixture. Do not flash without checking hardware pin assignments.
#include <Arduino.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_QMC5883P.h>
#include <PTITCube.h>

PTIT_Sensor sensor;
PTIT_GPS gps;
PTIT_COM lora;
PTIT_EPS eps;
PTIT_Storage storage;
PTIT_Camera camera;
PTIT_CDH cdh;
PTIT_Scheduler scheduler;

void tick() {
    sensor.update();
    gps.update();
    lora.update();
    String telemetry = String(eps.getBatteryVoltage());
    cdh.publishData("sensors/test/telemetry", telemetry.c_str());
    storage.logData(telemetry.c_str());
    camera.capture();
}
void setup() {
    Serial.begin(115200);
    JsonDocument data;
    data["library"] = "PTITCube";
    serializeJson(data, Serial);
    sensor.init();
    gps.init();
    lora.init();
    eps.init();
    storage.init();
    camera.init();
    cdh.init();
    scheduler.addTask("sensors", tick, 200, 1, 3);
    scheduler.enableWatchdog(30);
    scheduler.start();
    Serial.println(PTIT_Utils::extractCommand("ping"));
}
void loop() { delay(1000); }
