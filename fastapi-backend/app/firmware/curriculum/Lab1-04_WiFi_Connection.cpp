// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-04_WiFi_Connection/blob/04fde642b98cecefca70c7b5da4d8e72d8f5e046/src/main.cpp
#include <Arduino.h>
#include <WiFi.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(ssid, password);

    const uint32_t started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[ERROR] WiFi connection timed out. Set ssid/password and retry; no network connection confirmed.");
        return;
    }
    Serial.println("WiFi connected.");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
}

void loop() {
    static bool wasConnected = false;
    static uint32_t retriedAt = 0;
    const bool connected = WiFi.status() == WL_CONNECTED;
    if (connected && !wasConnected) { Serial.println("WiFi connected."); Serial.println(WiFi.localIP()); }
    if (!connected && wasConnected) Serial.println("[WARNING] WiFi disconnected; retrying.");
    if (!connected && millis() - retriedAt >= 30000) { retriedAt = millis(); WiFi.reconnect(); }
    wasConnected = connected;
    delay(100);
}
