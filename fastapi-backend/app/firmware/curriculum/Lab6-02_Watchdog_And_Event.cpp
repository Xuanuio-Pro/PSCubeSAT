// Reviewed ESP32 OBC example. Upstream: PTITCube/Lab6-02_Watchdog_And_Event
#include <Arduino.h>
#include <PTITCube.h>
#include <ArduinoJson.h>
#include <cmath>

#ifndef PTIT_ENABLE_LORA
#define PTIT_ENABLE_LORA 1
#endif

PTIT_Sensor sensor;
PTIT_COM lora;
PTIT_Scheduler scheduler;

// BEGIN PORTABLE ANOMALY RULES
struct FallDetector {
    bool tracking = false;
    uint32_t since = 0;
    bool update(float ax, float ay, float az, uint32_t now) {
        const bool valid = std::isfinite(ax) && std::isfinite(ay) && std::isfinite(az);
        const float magnitude = valid ? std::sqrt(ax * ax + ay * ay + az * az) : 0;
        if (!valid || magnitude >= 1.0f) { tracking = false; return false; }
        if (!tracking) { tracking = true; since = now; }
        return uint32_t(now - since) >= 200;
    }
};
bool isOverheating(float temperature) {
    return std::isfinite(temperature) && temperature > 45.0f;
}
// END PORTABLE ANOMALY RULES

void anomalyDetectionTask() {
    static FallDetector detector;
    static uint32_t lastTelemetry = 0, lastAlert = 0;
    static bool wasEmergency = false;
    if (!PTIT_Scheduler::lock(PTIT_BUS_I2C, 100)) return;
    sensor.update();
    const float t = sensor.getTemperature();
    const float pressure = sensor.getPressure();
    const float ax = sensor.getAccX(), ay = sensor.getAccY(), az = sensor.getAccZ();
    PTIT_Scheduler::unlock(PTIT_BUS_I2C);

    const uint32_t now = millis();
    const bool falling = detector.update(ax, ay, az, now);
    const bool hot = isOverheating(t);
    const bool emergency = hot || falling;
    if (uint32_t(now - lastTelemetry) >= 1000) {
        lastTelemetry = now;
        JsonDocument doc;
        doc["type"] = "telemetry";
        doc["temp"] = t;
        doc["pressure"] = pressure;
        doc["acc_x"] = ax / 9.80665f;
        doc["acc_y"] = ay / 9.80665f;
        doc["acc_z"] = az / 9.80665f;
        doc["uptime_ms"] = now;
        String output;
        serializeJson(doc, output); // Non-finite readings become null, never a healthy zero.
        PTIT_Scheduler::println(output);
    }
    if (emergency && (!wasEmergency || uint32_t(now - lastAlert) >= 2000)) {
        lastAlert = now;
        String message = "EMERGENCY: ";
        if (hot) message += "OVERHEAT (" + String(t, 1) + "C)! ";
        if (falling) message += "FREEFALL DETECTED! ";
        PTIT_Scheduler::println("[SỰ CỐ] " + message);
        if (PTIT_ENABLE_LORA && PTIT_Scheduler::lock(PTIT_BUS_LORA, 200)) {
            lora.sendMessage(message); // Send request; not proof of radio ACK.
            PTIT_Scheduler::unlock(PTIT_BUS_LORA);
        }
    } else if (!emergency && wasEmergency) {
        const bool valid = std::isfinite(t) && std::isfinite(ax) && std::isfinite(ay) && std::isfinite(az);
        PTIT_Scheduler::println(valid ? "[EVENT] No current anomaly in valid measurements." : "[EVENT] Anomaly state unknown: sensor unavailable.");
    }
    wasEmergency = emergency;
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    sensor.init();
    if (PTIT_ENABLE_LORA) lora.init();
    scheduler.addTask("AnomalyScanner", anomalyDetectionTask, 100, 1, 2);
    scheduler.enableWatchdog(10);
    Serial.println("[EXAMPLE] Event-Driven Satellite Mode Started. Three-axis freefall; watchdog requested.");
    scheduler.start();
}

void loop() { delay(1000); }
