#include <Arduino.h>

// Lab 1: GPIO2 LED, non-blocking blink, and newline-delimited JSON at 115200.
// ESP32-S3: use the native USB port (USB CDC), and an external LED on GPIO2.
// ESP32: use the USB-UART port; many DOIT boards have an onboard GPIO2 LED.
constexpr uint8_t LED_PIN = 2;
constexpr uint32_t BLINK_INTERVAL_MS = 500;
bool ledOn = false;
bool blinking = true;
uint32_t lastBlink = 0;
uint32_t lastReport = 0;
uint32_t sequence = 0;
char command[64];
size_t commandLength = 0;
bool commandOverflow = false;

void setLed(bool on) {
    ledOn = on;
    digitalWrite(LED_PIN, on ? HIGH : LOW);
}

void report(const char* event) {
    Serial.printf("{\"type\":\"lab1\",\"lab_id\":1,\"event\":\"%s\","
                  "\"seq\":%lu,\"uptime_ms\":%lu,\"led_pin\":%u,"
                  "\"led_on\":%s,\"blinking\":%s}\n",
                  event, static_cast<unsigned long>(sequence++),
                  static_cast<unsigned long>(millis()), LED_PIN,
                  ledOn ? "true" : "false", blinking ? "true" : "false");
}

void handleCommand() {
    if (strcmp(command, "ping") == 0) {
        report("pong");
    } else if (strcmp(command, "status") == 0) {
        report("status");
    } else if (strcmp(command, "led on") == 0 || strcmp(command, "led off") == 0) {
        blinking = false;
        setLed(strcmp(command, "led on") == 0);
        report("led_set");
    } else if (strcmp(command, "blink") == 0) {
        blinking = true;
        lastBlink = millis();
        report("blink_enabled");
    } else if (commandLength > 0) {
        report("unknown_command");
    }
}

void setup() {
    pinMode(LED_PIN, OUTPUT);
    setLed(false);
    Serial.begin(115200);
    // Do not wait for Serial: the program must also run without a connected PC.
    report("boot");
}

void loop() {
    const uint32_t now = millis();
    while (Serial.available() > 0) {
        const char ch = static_cast<char>(Serial.read());
        if (ch == '\r') continue;
        if (ch == '\n') {
            command[commandLength] = '\0';
            if (commandOverflow) report("command_too_long");
            else handleCommand();
            commandLength = 0;
            commandOverflow = false;
        } else if (commandLength < sizeof(command) - 1 && !commandOverflow) {
            command[commandLength++] = ch;
        } else {
            commandOverflow = true;
        }
    }
    if (blinking && now - lastBlink >= BLINK_INTERVAL_MS) {
        lastBlink = now;
        setLed(!ledOn);
    }
    if (now - lastReport >= 1000) {
        lastReport = now;
        report("heartbeat");
    }
    delay(1);
}
