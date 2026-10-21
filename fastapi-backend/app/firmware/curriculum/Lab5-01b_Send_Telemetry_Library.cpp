// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-01b_Send_Telemetry_Library/blob/fec7725019e27d304fbd9745914f9eedd3c04015/src/main.cpp
/**
 * VÍ DỤ: VỆ TINH GỬI DỮ LIỆU (TELEMETRY) QUA LORA
 * 
 * Mô tả:
 * Board mạch CubeSat sẽ định kỳ gửi dữ liệu trạng thái (Telemetry) 
 * xuống Trạm mặt đất. Trạm mặt đất sẽ dùng USB-TTL cắm vào máy tính 
 * để nhận sóng LoRa này.
 */

#include <Arduino.h>
#include <PTITCube.h>

PTIT_COM myLoRa;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[VỆ TINH] Khởi tạo module LoRa phát dữ liệu...");
    myLoRa.init();

    // Cấu hình Kênh và Địa chỉ sử dụng hệ THẬP PHÂN (Decimal) cho dễ hiểu
    // Ví dụ: Kênh 23, Địa chỉ High = 0, Địa chỉ Low = 161
    myLoRa.setChannel(23);
    myLoRa.setAddress(0, 0);
    myLoRa.setTransmissionMode(0); // Chế độ 0 là Transparent (phát tự do)
}

void loop() {
    static int counter = 0;
    counter++;

    String payload = "PACKET #" + String(counter) + " - CUBESAT TELEMETRY DATA";
    
    Serial.print("Đang phát xuống mặt đất: ");
    Serial.println(payload);
    
    myLoRa.sendMessage(payload);

    delay(2000);
}
