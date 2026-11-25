#include "Scheduler.h"

// ============================================================================
// STATIC MEMBERS
// ============================================================================
PTIT_Scheduler::TaskInfo PTIT_Scheduler::_tasks[PTIT_MAX_TASKS];
uint8_t PTIT_Scheduler::_taskCount = 0;
bool PTIT_Scheduler::_wdtEnabled = false;
uint32_t PTIT_Scheduler::_wdtTimeout = 30;
bool PTIT_Scheduler::_wdtActive = false;
SemaphoreHandle_t PTIT_Scheduler::_busMutex[PTIT_NUM_BUSES] = { NULL };
static portMUX_TYPE _createMux = portMUX_INITIALIZER_UNLOCKED;

// ============================================================================
// API: Đăng ký task
// ============================================================================
void PTIT_Scheduler::addTask(const char* name, TaskFunction fn, uint32_t intervalMs,
                             uint8_t core, uint8_t priority, uint16_t stackSize) {
    if (_taskCount >= PTIT_MAX_TASKS) {
        Serial.println("Scheduler: LỖI: Đã đạt giới hạn " + String(PTIT_MAX_TASKS) + " task!");
        return;
    }

    TaskInfo& t  = _tasks[_taskCount];
    t.name       = name;
    t.fn         = fn;
    t.intervalMs = intervalMs;
    t.core       = core;
    t.priority   = priority;
    t.stackSize  = stackSize;
    _taskCount++;

    Serial.println("Scheduler: Đã đăng ký task: " + String(name) +
                   " (chu kỳ " + String(intervalMs) + "ms, Core " + String(core) +
                   ", Priority " + String(priority) + ")");
}

// ============================================================================
// API: Bật Watchdog
// ============================================================================
void PTIT_Scheduler::enableWatchdog(uint32_t timeoutSeconds) {
    _wdtEnabled = true;
    _wdtTimeout = timeoutSeconds;
}

// ============================================================================
// TASK WRAPPER: Bọc hàm người dùng với watchdog + vTaskDelay
// ============================================================================
void PTIT_Scheduler::taskWrapper(void* pvParameters) {
    TaskInfo* info = (TaskInfo*)pvParameters;

    if (_wdtActive) {
        PTIT_WDT::add();
    }

    for (;;) {
        if (_wdtActive) {
            PTIT_WDT::feed();
        }

        info->fn();

        vTaskDelay(pdMS_TO_TICKS(info->intervalMs));
    }
}

// ============================================================================
// API: Tạo và chạy tất cả task
// ============================================================================
void PTIT_Scheduler::start() {
    for (int i = 0; i < PTIT_NUM_BUSES; i++) {
        if (_busMutex[i] == NULL) {
            _busMutex[i] = xSemaphoreCreateRecursiveMutex();
        }
    }

    if (_wdtEnabled) {
        PTIT_WDT::init(_wdtTimeout, true);
        _wdtActive = true;
    }

    for (uint8_t i = 0; i < _taskCount; i++) {
        TaskHandle_t handle = NULL;
        xTaskCreatePinnedToCore(
            taskWrapper,
            _tasks[i].name,
            _tasks[i].stackSize,
            &_tasks[i],
            _tasks[i].priority,
            &handle,
            _tasks[i].core
        );
    }
}

// ============================================================================
// TIỆN ÍCH: Thread-safe Serial print
// ============================================================================
void PTIT_Scheduler::print(const String& msg) {
    if (lock(PTIT_BUS_SERIAL, 50)) {
        Serial.print(msg);
        unlock(PTIT_BUS_SERIAL);
    } else {
        Serial.print(msg);
    }
}

void PTIT_Scheduler::println(const String& msg) {
    if (lock(PTIT_BUS_SERIAL, 50)) {
        Serial.println(msg);
        unlock(PTIT_BUS_SERIAL);
    } else {
        Serial.println(msg);
    }
}

// ============================================================================
// TIỆN ÍCH: Lock/Unlock bus tài nguyên chia sẻ
// ============================================================================
bool PTIT_Scheduler::lock(uint8_t bus, uint32_t timeoutMs) {
    if (bus >= PTIT_NUM_BUSES) return false;
    if (_busMutex[bus] == NULL) {
        // Platform patch: recursive mutexes. The library itself locks I2C in Sensor::update()
        // and SPI in logData(); a task that already holds the bus (e.g. Lab7-02) would
        // otherwise wait out the timeout and then touch the bus without the lock.
        SemaphoreHandle_t created = xSemaphoreCreateRecursiveMutex();
        if (created == NULL) return false;
        // Two tasks may race to create the same bus mutex; keep exactly one.
        portENTER_CRITICAL(&_createMux);
        if (_busMutex[bus] == NULL) { _busMutex[bus] = created; created = NULL; }
        portEXIT_CRITICAL(&_createMux);
        if (created != NULL) vSemaphoreDelete(created);
    }
    return (xSemaphoreTakeRecursive(_busMutex[bus], pdMS_TO_TICKS(timeoutMs)) == pdTRUE);
}

void PTIT_Scheduler::unlock(uint8_t bus) {
    if (bus >= PTIT_NUM_BUSES || _busMutex[bus] == NULL) return;
    xSemaphoreGiveRecursive(_busMutex[bus]);
}
