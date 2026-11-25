// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-05_Event_Driven_Queue/blob/97039845e1f3b1baabb5957a5185388380932a73/src/main.cpp
/**
 * VÍ DỤ 3-05: KIẾN TRÚC HƯỚNG SỰ KIỆN (EVENT-DRIVEN) VỚI FREERTOS QUEUE
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;

#define LED_PIN    2
#define BUTTON_PIN 4

enum EventType {
    EVENT_BUTTON,
    EVENT_TEMP_ALERT,
    EVENT_COMMAND
};

struct SystemEvent {
    EventType type;
    uint32_t timestamp;
    int32_t value;
};

PTIT_Queue<SystemEvent> eventQueue;

static volatile uint32_t lastPressMs = 0;

void IRAM_ATTR buttonISR() {
    // Chống dội phím 250 ms: một lần nhấn chỉ sinh một sự kiện.
    uint32_t now = millis();
    if (now - lastPressMs < 250) return;
    lastPressMs = now;
    SystemEvent evt = { EVENT_BUTTON, now, 0 };
    eventQueue.sendFromISR(&evt);
}

void sensorTask(void* pvParameters) {
    for (;;) {
        cdh.delayMs(1000);
        int temp = random(20, 35);
        if (temp > 30) {
            SystemEvent evt = { EVENT_TEMP_ALERT, millis(), temp };
            eventQueue.send(&evt);
        }
    }
}

void serialTask(void* pvParameters) {
    for (;;) {
        if (cdh.available() > 0) {
            String str = cdh.readStringUntil('\n');
            str.trim();
            if (str.length() > 0) {
                SystemEvent evt = { EVENT_COMMAND, millis(), str[0] };
                eventQueue.send(&evt);
            }
        }
        cdh.delayMs(50);
    }
}

void dispatcherTask(void* pvParameters) {
    SystemEvent evt;
    bool ledState = false;

    for (;;) {
        if (eventQueue.receive(&evt)) {
            switch (evt.type) {
                case EVENT_BUTTON:
                    ledState = !ledState;
                    digitalWrite(LED_PIN, ledState);
                    cdh.printf("Event: Button (t=%lums) -> LED: %s\n", evt.timestamp, ledState ? "ON" : "OFF");
                    break;
                case EVENT_TEMP_ALERT:
                    cdh.printf("Event: Temp Alert: %d C (t=%lums)\n", evt.value, evt.timestamp);
                    break;
                case EVENT_COMMAND:
                    cdh.printf("Event: Cmd: '%c' (t=%lums)\n", (char)evt.value, evt.timestamp);
                    break;
            }
        }
    }
}

void setup() {
    cdh.begin();

    pinMode(LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);

    eventQueue.init(10);

    cdh.createTask(dispatcherTask, "Dispatcher", 3072, 3);
    cdh.createTask(sensorTask,     "Sensor",     2048, 1);
    cdh.createTask(serialTask,     "Serial",     2048, 2);
}

void loop() {
}
