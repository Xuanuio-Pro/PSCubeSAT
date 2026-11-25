// Build-only compatibility fixture. Do not flash without checking hardware pin assignments.
#include <Arduino.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
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
PTIT_Queue<int> events(4);

void tick() {
    sensor.update();
    gps.update();
    lora.update();
    String telemetry = String(eps.getBatteryVoltage());
    cdh.publishData("sensors/test/telemetry", telemetry.c_str());
    storage.logData(telemetry.c_str());
    camera.capture();
    if (PTIT_CDH::lock(PTIT_BUS_UART2)) { PTIT_MUX::selectGPS(); PTIT_CDH::unlock(PTIT_BUS_UART2); }
    String nmea;
    if (gps.readSentence(nmea) && PTIT_GPS::verifyChecksum(nmea.c_str())) events.send(1);
    wdtFeed();
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
    Serial.println(sensor.getRoll() + sensor.getAltitude() + (cdh.wasWatchdogReset() ? 1 : 0));
    scheduler.start();
    Serial.println(PTIT_Utils::extractCommand("ping"));
}
void loop() { delay(1000); }
