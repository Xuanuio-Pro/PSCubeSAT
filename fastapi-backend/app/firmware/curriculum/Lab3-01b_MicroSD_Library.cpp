// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-01b_MicroSD_Library/blob/8145856370115be49a0fdeeac732744a0ccd31fe/src/main.cpp
/**
 * VÍ DỤ: LƯU TRỮ LOG VÀO THẺ NHỚ
 * 
 * Mô tả:
 * Sử dụng phân hệ Storage (Giao tiếp SPI với MicroSD) để ghi log.
 */

#include <Arduino.h>
#include <PTITCube.h>

PTIT_Storage myDisk;

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Khởi tạo thẻ nhớ...");
    myDisk.init();
    
    // Ghi thử một dòng Boot vào log
    const bool bootSaved = myDisk.appendFile("/datalog.txt", "=== SYSTEM BOOT: CUBESAT V1 ===\n");
    Serial.println(bootSaved ? "[SD] log saved" : "[SD] log write failed/not ready");
}

void loop() {
    static int counter = 0;
    
    String data = "Log entry #" + String(counter) + " - Uptime: " + String(millis()) + "ms";
    Serial.println(data);
    
    const String line = data + "\n";
    const bool saved = myDisk.appendFile("/datalog.txt", line.c_str());
    Serial.println(saved ? "[SD] log saved" : "[SD] log write failed/not ready");
    
    counter++;
    delay(3000);
}
