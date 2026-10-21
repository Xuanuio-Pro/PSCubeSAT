// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab2-02_Power_Saving/blob/8a7d40969ec4ab6035014541934807e64a6c98e6/src/main.cpp
/**
 * VÍ DỤ 2-2: CHẾ ĐỘ TIẾT KIỆM NĂNG LƯỢNG (DEEP SLEEP)
 * 
 * Mô tả:
 * Năng lượng là tài nguyên quý giá nhất trên vệ tinh CubeSat. 
 * Ví dụ này minh họa cách sử dụng chế độ Ngủ sâu (Deep Sleep) của vi điều khiển 
 * để giảm thiểu tối đa lượng điện tiêu thụ khi vệ tinh không có tác vụ nào cần xử lý.
 */

#include <Arduino.h>
#include <PTITCube.h>

// Thời gian ngủ (tính bằng micro-giây). 5 giây = 5000000 uS.
#define uS_TO_S_FACTOR 1000000ULL  
#define TIME_TO_SLEEP  5           

PTIT_EPS eps;

void setup() {
    Serial.begin(115200);
    
    // Đợi 1 chút để Serial ổn định sau khi thức dậy
    delay(1000);

    Serial.println("\n================================================");
    Serial.println("[EXAMPLE] HỆ THỐNG VỪA THỨC DẬY TỪ DEEP SLEEP!");
    Serial.println("================================================\n");

    // Khởi tạo Phân hệ Năng lượng (EPS) để kiểm tra dung lượng Pin
    eps.init();
    
    // Đọc điện áp Pin
    float voltage = eps.getBatteryVoltage();
    Serial.printf("[EPS] Điện áp Pin hiện tại: %.2f V\n", voltage);

    // Giả lập hệ thống thực hiện công việc (đọc cảm biến, chụp ảnh, gửi dữ liệu...)
    Serial.println("[SYSTEM] Đang thực hiện các nhiệm vụ thiết yếu...");
    delay(2000); // Giả lập mất 2 giây để làm việc

    // Chuẩn bị đi ngủ
    Serial.println("[SYSTEM] Hoàn tất nhiệm vụ. Chuyển sang chế độ tiết kiệm năng lượng.");
    Serial.printf("[SYSTEM] Cấu hình thời gian ngủ: %d giây...\n", TIME_TO_SLEEP);
    
    // Cài đặt đồng hồ đánh thức (RTC Timer)
    esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);

    Serial.println("[SYSTEM] Đi ngủ thôi! (Zzz...)\n");
    
    // Ép dữ liệu in ra hết trên Serial trước khi tắt nguồn CPU
    Serial.flush(); 
    
    // Kích hoạt chế độ Ngủ sâu
    esp_deep_sleep_start();
    
    // Lưu ý: Đoạn code phía sau hàm esp_deep_sleep_start() sẽ không bao giờ được chạy.
}

void loop() {
    // Không sử dụng vòng lặp loop() khi ứng dụng chạy chế độ Deep Sleep
    // Vì mỗi khi thức dậy, hệ thống sẽ reset và chạy lại hàm setup() từ đầu.
}
