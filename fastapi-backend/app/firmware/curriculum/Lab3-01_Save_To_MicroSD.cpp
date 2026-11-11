// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-01_Save_To_MicroSD/blob/1c018c97417f4e0bf18beecdff927ddf1e82b40c/src/main.cpp
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
    myDisk.logData("=============================");
    myDisk.logData("SYSTEM BOOT: CUBESAT V1");
    myDisk.logData("=============================");
}

void loop() {
    static int counter = 0;
    
    String data = "Hello world #" + String(counter) + " - Uptime: " + String(millis()) + "ms";
    Serial.println(data);
    
    myDisk.logData(data.c_str());
    
    counter++;
    delay(3000);
}
