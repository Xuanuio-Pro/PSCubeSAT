// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-03_Multitasking_Scheduler/blob/f955449cf41996800f7c128091f0176918fe01b0/src/main.cpp
/**
 * VÍ DỤ 3-03: ĐA NHIỆM VỚI FREERTOS SCHEDULER & MUTEX
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_Scheduler scheduler;

#define LED_PIN 2

void heartbeatTask() {
    static bool state = false;
    state = !state;
    digitalWrite(LED_PIN, state);
}

void telemetryTask() {
    static uint16_t id = 0;
    float voltage = 3.7f + (float)random(-20, 20) / 100.0f;
    float temp    = 24.5f + (float)random(-10, 30) / 10.0f;

    if (scheduler.lock(PTIT_BUS_SERIAL, 100)) {
        cdh.printf("TELEM: #%04u | V: %.2fV | T: %.1fC | Uptime: %lus\n",
                   id++, voltage, temp, millis() / 1000);
        scheduler.unlock(PTIT_BUS_SERIAL);
    }
}

void diagnosticTask() {
    if (scheduler.lock(PTIT_BUS_SERIAL, 100)) {
        cdh.printf("DIAG: Free Heap: %u bytes | CPU: %u MHz\n",
                   ESP.getFreeHeap(), ESP.getCpuFreqMHz());
        scheduler.unlock(PTIT_BUS_SERIAL);
    }
}

void setup() {
    cdh.begin();

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    scheduler.addTask("Heartbeat",  heartbeatTask,  500,  1, 1);
    scheduler.addTask("Telemetry",  telemetryTask,  2000, 1, 1);
    scheduler.addTask("Diagnostic", diagnosticTask, 5000, 0, 0);

    scheduler.start();
}

void loop() {
    delay(1000);
}
