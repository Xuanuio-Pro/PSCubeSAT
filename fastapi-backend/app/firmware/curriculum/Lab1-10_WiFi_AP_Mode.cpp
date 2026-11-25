// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab1-09_WiFi_AP_Mode/blob/7622a1c4a05969988884ab19845c8536a3d8f7ed/src/main.cpp
#include <Arduino.h>
#include <WiFi.h>

const char* ssid = "CUBESAT_AP";
const char* password = "password123"; // Mật khẩu (ít nhất 8 ký tự)

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.print("Configuring access point...");

    // Khởi tạo AP Mode
    WiFi.mode(WIFI_AP);
    if (!WiFi.softAP(ssid, password)) { Serial.println("[ERROR] WiFi AP initialization failed"); return; }
    IPAddress myIP = WiFi.softAPIP();
    
    Serial.println("AP IP address: ");
    Serial.println(myIP);
}

void loop() {
    Serial.print("Số lượng thiết bị đang kết nối: ");
    Serial.println(WiFi.softAPgetStationNum());
    delay(2000);
}
