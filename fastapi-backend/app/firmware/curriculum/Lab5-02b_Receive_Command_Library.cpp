// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab5-02b_Receive_Command_Library/blob/5f98479e4d47cbf22bf2a5764687b75fbf35b54d/src/main.cpp
/**
 * VÍ DỤ: VỆ TINH NHẬN LỆNH ĐIỀU KHIỂN (COMMAND) QUA LORA
 * 
 * Mô tả:
 * Board mạch CubeSat sẽ luôn trong trạng thái chờ nhận lệnh (Uplink) 
 * từ Trạm mặt đất (được điều khiển bằng USB-TTL trên máy tính).
 * 
 * LƯU Ý: USB-TTL ở mặt đất phải được cài Kênh (Channel) và Chế độ truyền
 * giống hệt như CubeSat mới có thể giao tiếp được!
 */

#include <Arduino.h>
#include <PTITCube.h>

PTIT_COM myLoRa;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[VỆ TINH] Khởi tạo module LoRa chờ nhận lệnh...");
    myLoRa.init();

    // Phải cấu hình giống hệt USB-TTL ở trạm mặt đất (Dùng số thập phân)
    // Ví dụ: Kênh 23
    myLoRa.setChannel(23); 
    myLoRa.setTransmissionMode(0); 
    
    Serial.println("[VỆ TINH] Đang lắng nghe lệnh từ trạm mặt đất...");
}

void loop() {
    // Hàm update() sẽ kiểm tra UART liên tục.
    // Nếu bắt được lệnh từ trạm mặt đất, nó sẽ tự động in ra màn hình.
    // (Trong thực tế, bạn có thể phân tích chuỗi này để ra lệnh bung dù, tắt nguồn...)
    myLoRa.update();

    // Thêm một độ trễ siêu nhỏ để tránh watchdog timer bị kích hoạt
    delay(10);
}
