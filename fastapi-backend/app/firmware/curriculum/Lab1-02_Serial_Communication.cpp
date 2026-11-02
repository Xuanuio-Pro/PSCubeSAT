// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-02_Serial_Communication/blob/2b69ba784225bee0d1a984f23695766161e6a57b/src/main.cpp
#include <Arduino.h>
void setup() {
    Serial.begin(115200);
}
void loop() {
    static String input;
    static bool discard = false;
    static uint32_t greetedAt = 0;
    if (millis() - greetedAt >= 1000) {
        greetedAt = millis(); Serial.println("Hello HEPTA-SAT / CubeSat!");
    }
    for (int budget = 0; budget < 64 && Serial.available(); ++budget) {
        const char c = Serial.read();
        if (c == '\n') {
            if (discard) Serial.println("ERR: Serial input exceeds 128 bytes");
            else if (input.length()) Serial.println("Echo: " + input);
            input = ""; discard = false;
        } else if (c != '\r' && !discard) {
            if (input.length() < 128) input += c;
            else { input = ""; discard = true; }
        }
    }
    delay(2);
}
