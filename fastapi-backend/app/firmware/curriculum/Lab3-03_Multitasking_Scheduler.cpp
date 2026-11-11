// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-03_Multitasking_Scheduler/blob/a2e62a7e963c5cd814935c4c71d5f2ded6fa2a40/src/main.cpp
/**
 * VÍ DỤ 1: ĐA NHIỆM (MULTITASKING) & BẢO VỆ TÀI NGUYÊN
 * 
 * Mô tả:
 * Ví dụ này minh hoạ cách dùng PTIT_Scheduler (chạy ngầm FreeRTOS)
 * để chia hệ thống thành các luồng độc lập, đồng thời sử dụng Mutex 
 * để ngăn chặn nhiều luồng in ra màn hình Serial cùng lúc làm hỏng text.
 */

#include <Arduino.h>
#include <PTITCube.h>

PTIT_Scheduler scheduler;

// Task 1: Giả lập việc chớp tắt đèn LED (chạy rất nhanh)
void ledTask() {
    static bool state = false;
    digitalWrite(2, state);
    PTIT_Scheduler::println(state ? "LED ON" : "LED OFF");
    state = !state;
    // The log reports the output command, not an electrical readback.
}

// Task 2: Đọc cảm biến giả lập (chạy mỗi 1 giây)
void readSensorTask() {
    // PTIT_BUS_SERIAL là ID mutex dùng chung để khoá truy cập Serial
    if (PTIT_Scheduler::lock(PTIT_BUS_SERIAL, 100)) {
        Serial.println("[Sensor] Đang đọc dữ liệu... Nhiệt độ: 28.5C");
        PTIT_Scheduler::unlock(PTIT_BUS_SERIAL);
    }
}

// Task 3: Gửi dữ liệu giả lập (chạy mỗi 3 giây, tốn nhiều thời gian)
void networkTask() {
    PTIT_Scheduler::println("[Network] BẮT ĐẦU gửi dữ liệu lên máy chủ...");
    // Simulate network latency without holding the Serial mutex during the delay.
    delay(500);
    PTIT_Scheduler::println("[Network] ĐÃ GỬI XONG!");
}

void setup() {
    Serial.begin(115200);
    pinMode(2, OUTPUT);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Đang khởi động Scheduler...");

    // Cấu hình: (Tên, Hàm, Chu kỳ ms, Core, Độ ưu tiên)
    scheduler.addTask("LED",     ledTask,        200,  1, 2);
    scheduler.addTask("Sensor",  readSensorTask, 1000, 1, 2);
    scheduler.addTask("Network", networkTask,    3000, 0, 1); // Chạy trên Core 0!

    // Giao toàn quyền điều khiển lại cho FreeRTOS
    scheduler.start();
}

void loop() {
    delay(1000); // Yield the Arduino loop task while scheduler tasks run.
}
