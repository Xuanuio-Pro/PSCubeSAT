// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-02b_Receive_Command_Library/blob/c2698bb27c0740f85a6626d5d7b939a7af971707/src/main.cpp
/**
 * VÍ DỤ 5-2b: VỆ TINH NHẬN LỆNH ĐIỀU KHIỂN QUA THƯ VIỆN PTITCUBE
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
    cdh.println("[BOOT] OBC san sang, dang cho lenh tu tram mat dat qua LoRa");
}

void loop() {
    String cmd = myLoRa.update();
    if (cmd.length() > 0) {
        cdh.println("RX: " + cmd);
    }
    delay(10);
}
