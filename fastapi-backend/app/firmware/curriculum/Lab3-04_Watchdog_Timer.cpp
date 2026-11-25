// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-04_Watchdog_Timer/blob/33b70a439788244e84543784414fae617764c10c/src/main.cpp
/**
 * VÍ DỤ 3-04: GIÁM SÁT HỆ THỐNG VỚI WATCHDOG TIMER & TỰ PHỤC HỒI
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;

#define LED_PIN         2
#define BUTTON_PIN      4
#define WDT_TIMEOUT_SEC 3

static volatile bool simulateFault = false;

void heartbeatTask(void* pvParameters) {
    cdh.wdtAdd();
    bool ledState = false;

    for (;;) {
        if (!simulateFault) {
            cdh.wdtFeed();
            ledState = !ledState;
            digitalWrite(LED_PIN, ledState);
        } else {
            cdh.println("WDT: Treo he thong! Ngung feed WDT -> Tu dong khoi dong lai sau 3s...");
            digitalWrite(LED_PIN, HIGH);
            while (1) delay(100);
        }
        cdh.delayMs(500);
    }
}

void faultMonitorTask(void* pvParameters) {
    // Chỉ tính là nhấn nút khi GPIO 4 chuyển từ HIGH (nhả) xuống LOW. Trên chồng bo vệ tinh GPIO 4 là chân
    // bật Buck của EPS và luôn ở mức LOW; nếu đọc mức thay vì cạnh, bo sẽ tự "treo" và reset liên tục.
    bool released = digitalRead(BUTTON_PIN) == HIGH;
    for (;;) {
        const bool pressed = digitalRead(BUTTON_PIN) == LOW;
        if (pressed && released) {
            simulateFault = true;
        }
        if (!pressed) released = true;
        if (cdh.available() > 0) {
            String cmd = cdh.readStringUntil('\n');
            cmd.trim();
            if (cmd.equalsIgnoreCase("fault") || cmd.equalsIgnoreCase("freeze") || cmd.equalsIgnoreCase("f")) {
                simulateFault = true;
            }
        }
        cdh.delayMs(100);
    }
}

void setup() {
    cdh.begin();

    pinMode(LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    cdh.printf("BOOT: Nguyen nhan khoi dong: %s\n", 
               cdh.wasWatchdogReset() ? "Task Watchdog Reset (TWDT da tu phuc hoi)" : "Normal Power-on/Reset");
    if (digitalRead(BUTTON_PIN) == LOW) {
        cdh.println("BOOT: GPIO 4 dang o muc LOW (chan Buck tren bo ve tinh): nut nhan khong dung duoc, go 'f' de mo phong treo.");
    }

    cdh.wdtInit(WDT_TIMEOUT_SEC);

    cdh.createTask(heartbeatTask,    "HeartbeatWDT", 2048, 2);
    cdh.createTask(faultMonitorTask, "FaultMonitor", 2048, 1);
}

void loop() {
}
