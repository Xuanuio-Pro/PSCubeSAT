// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-01b_Send_Telemetry_Library/blob/a67e1dafbdb4466391cc694870135bb55743a26a/src/main.cpp
/**
 * VÍ DỤ 5-1b: VỆ TINH GỬI DỮ LIỆU TELEMETRY QUA THƯ VIỆN PTITCUBE
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_COM myLoRa;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    myLoRa.init();
}

void loop() {
    static int counter = 0;
    counter++;

    String payload = "PACKET #" + String(counter) + " - CUBESAT TELEMETRY";
    cdh.println("TX: " + payload);

    myLoRa.sendMessage(payload);
    delay(2000);
}
