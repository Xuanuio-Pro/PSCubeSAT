// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-06_Web_Server_LED/blob/c85d704a4f0133af5316d5b826da091dda50be8a/src/main.cpp
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);
bool serverStarted = false;
const int LED_PIN = 2; // LED tích hợp trên ESP32

void handleRoot() {
    String html = "<html><body>";
    html += "<h1>CubeSat LED Control</h1>";
    html += "<p><a href=\"/on\"><button style=\"padding:10px 20px; font-size:20px;\">Turn ON</button></a></p>";
    html += "<p><a href=\"/off\"><button style=\"padding:10px 20px; font-size:20px;\">Turn OFF</button></a></p>";
    html += "</body></html>";
    server.send(200, "text/html", html);
}

void handleLedOn() {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("LED ON");
    server.send(200, "text/html", "<h2>LED is ON</h2><p><a href=\"/\">Back</a></p>");
}

void handleLedOff() {
    digitalWrite(LED_PIN, LOW);
    Serial.println("LED OFF");
    server.send(200, "text/html", "<h2>LED is OFF</h2><p><a href=\"/\">Back</a></p>");
}

void startServer() {
    server.on("/", handleRoot);
    server.on("/on", handleLedOn);
    server.on("/off", handleLedOff);
    server.begin();
    serverStarted = true;
    Serial.println("HTTP server started");
    Serial.println(WiFi.localIP());
}

void setup() {
    Serial.begin(115200);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(ssid, password);
    const uint32_t started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
        delay(500);
        Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[ERROR] WiFi connection timed out. Set ssid/password and retry; no network connection confirmed.");
        return;
    }
    Serial.println("WiFi connected.");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());

    startServer();
}

void loop() {
    static uint32_t retriedAt = 0;
    if (WiFi.status() == WL_CONNECTED) {
        if (!serverStarted) startServer();
        server.handleClient();
    } else if (millis() - retriedAt >= 30000) {
        retriedAt = millis(); WiFi.reconnect();
    }
    delay(2);
}
