// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-04_Watchdog_And_Event/blob/932741750f6b079521ba0dbefff0b530a3e628ec/src/main.cpp
/**
 * LAB 3 - VÍ DỤ 04: GIÁM SÁT CHÓ CANH (WATCHDOG TIMER) & TỰ PHỤC HỒI HỆ THỐNG (FDIR)
 * 
 * Mục tiêu:
 * - Kích hoạt Task Watchdog Timer (TWDT) trên ESP32 để bảo vệ hệ thống C&DH của CubeSat.
 * - Hiểu rõ cơ chế nạp lại chó canh ("Feed / Kick Watchdog") trong tác vụ định kỳ.
 * - Mô phỏng sự cố treo vi xử lý (Fault Injection) bằng Nút nhấn (GPIO 4) hoặc lệnh cdh ('h'/'f').
 * - Quan sát Watchdog kích hoạt khởi động lại phần cứng và kiểm tra nguyên nhân reset (Reset Reason).
 * 
 * Linh kiện sử dụng (hoàn toàn từ Lab 1):
 * - ESP32 NodeMCU OBC
 * - LED trạng thái (GPIO 2)
 * - Nút nhấn mô phỏng sự cố (GPIO 4 - INPUT_PULLUP)
 * - Cổng cdh Monitor (115200 baud)
 */

#include <Arduino.h>

#include <PTITCube.h>
#include <esp_task_wdt.h>

PTIT_CDH cdh;

#define LED_PIN         2   // LED nhịp tim (Heartbeat LED)
#define BUTTON_PIN      4   // Nút nhấn kích hoạt sự cố treo (Fault Injection)
#define WDT_TIMEOUT_SEC 3   // Thời gian timeout của Watchdog (3 giây)

// Biến cờ kích hoạt lỗi treo vi xử lý
static volatile bool simulateFault = false;

// Task 1: Tác vụ nhịp tim & nạp Watchdog Timer (Chạy chu kỳ 500ms)
void heartbeatTask(void* pvParameters) {
    // Đăng ký tác vụ này với Task Watchdog Timer (TWDT)
    esp_task_wdt_add(NULL);

    bool ledState = false;

    for (;;) {
        // Nếu không có sự cố mô phỏng -> Đá chó canh (Reset bộ đếm Watchdog về 0)
        if (!simulateFault) {
            esp_task_wdt_reset();
            ledState = !ledState;
            digitalWrite(LED_PIN, ledState ? HIGH : LOW);
            cdh.printf("[OBC HEARTBEAT] Uptime: %lu ms | Đã đá chó canh (Feed WDT) thành công.\n", millis());
        } else {
            // Khi bị mô phỏng sự cố: Cố tình ngưng đá chó canh và rơi vào vòng lặp vô tận (Freeze)
            cdh.println("\n[SỰ CỐ C&DH] >>> Tác vụ bị treo vô hạn (Infinite Loop)! NGỪNG ĐÁ CHÓ CANH... <<<");
            cdh.printf("[SỰ CỐ C&DH] Watchdog sẽ hết hạn và cưỡng bức RESET sau tối đa %d giây!\n", WDT_TIMEOUT_SEC);
            
            // Bật sáng LED liên tục để báo hiệu đang bị treo
            digitalWrite(LED_PIN, HIGH);
            
            while (1) {
                // Treo hoàn toàn ở đây, không bao giờ gọi esp_task_wdt_reset()
                delay(100);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

// Task 2: Tác vụ giám sát nút nhấn & lệnh cdh để kích hoạt lỗi (Chạy chu kỳ 100ms)
void faultMonitorTask(void* pvParameters) {
    for (;;) {
        // 1. Kiểm tra nút nhấn trên chân GPIO 4 (nhấn = LOW)
        if (digitalRead(BUTTON_PIN) == LOW) {
            simulateFault = true;
        }

        // 2. Kiểm tra lệnh gõ từ cdh Monitor ('f' = Fault, 'h' = Hang)
        if (cdh.available() > 0) {
            char cmd = cdh.read();
            if (cmd == 'f' || cmd == 'h' || cmd == 'F' || cmd == 'H') {
                simulateFault = true;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

// Hàm phân tích và in ra nguyên nhân khởi động lại của vi điều khiển
void printResetReason(esp_reset_reason_t reason) {
        cdh.print("[BOOT] Nguyên nhân khởi động lại (Reset Reason): ");
    switch (reason) {
        case ESP_RST_POWERON:
            cdh.println("Cấp nguồn mới (Power-on Reset) - Khởi động bình thường.");
            break;
        case ESP_RST_SW:
            cdh.println("Khởi động lại bằng phần mềm (Software Reset).");
            break;
        case ESP_RST_PANIC:
            cdh.println("Sự cố tràn bộ nhớ hoặc ngoại lệ phần mềm (Exception/Panic Reset).");
            break;
        case ESP_RST_TASK_WDT:
            cdh.println(">>> TASK WATCHDOG TIMER RESET (TWDT) <<<");
            cdh.println("[FDIR] HỆ THỐNG ĐÃ TỰ ĐỘNG PHỤC HỒI THÀNH CÔNG SAU KHI BỊ TREO!");
            // Nháy LED 5 lần để báo hiệu phục hồi thành công từ Watchdog
            for (int i = 0; i < 5; i++) {
                digitalWrite(LED_PIN, HIGH); delay(100);
                digitalWrite(LED_PIN, LOW);  delay(100);
            }
            break;
        case ESP_RST_INT_WDT:
            cdh.println("Hardware Interrupt Watchdog Reset.");
            break;
        default:
            cdh.printf("Mã lỗi: %d\n", reason);
            break;
    }
    }

void setup() {
    cdh.begin(115200);
    while (!cdh) { delay(10); }

    pinMode(LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP); // Nút nhấn kích hoạt sự cố (Lab 1)

        cdh.println("   PTITCUBE - LAB 3: WATCHDOG TIMER & FDIR DEMO   ");
    
    // 1. Kiểm tra nguyên nhân reset trước đó
    esp_reset_reason_t reason = esp_reset_reason();
    printResetReason(reason);

    // 2. Khởi tạo Task Watchdog Timer với timeout 3 giây, panic = true (tự động reboot)
    cdh.printf("[WDT] Đang kích hoạt Task Watchdog Timer (Timeout = %d giây)...\n", WDT_TIMEOUT_SEC);
    esp_task_wdt_init(WDT_TIMEOUT_SEC, true);

    cdh.println("[HƯỚNG DẪN TEST]:");
    cdh.println("[INFO] TWDT dang giam sat (Timeout: 3s). Gui 'f' qua cdh de kich hoat loi treo.");

    // 3. Tạo tác vụ FreeRTOS
    xTaskCreatePinnedToCore(
        heartbeatTask,
        "HeartbeatWDT",
        2048,
        NULL,
        2,
        NULL,
        1
    );

    xTaskCreatePinnedToCore(
        faultMonitorTask,
        "FaultMonitor",
        2048,
        NULL,
        1,
        NULL,
        1
    );
}

void loop() {
    // Để trống. Toàn bộ logic chạy trong các Task FreeRTOS.
}
