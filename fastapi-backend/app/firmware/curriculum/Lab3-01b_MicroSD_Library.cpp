// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-01b_MicroSD_Library/blob/4155f6ad0276306c34b0c89b89ccffc5e6ac1049/src/main.cpp
/**
 * VÍ DỤ 3-1b: LƯU TRỮ LOG VÀO THẺ NHỚ VỚI THƯ VIỆN PTITCUBE
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_Storage myDisk;

// logData() không báo kết quả; appendFile() ghi cùng file /datalog.txt và trả về true khi ghi đủ.
bool saveLine(const char* text) {
    const String line = String(text) + "\n";
    const bool saved = myDisk.appendFile("/datalog.txt", line.c_str());
    cdh.println(saved ? "[SD] log saved" : "[SD] log write failed/not ready");
    return saved;
}

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    myDisk.init();
    saveLine("BOOT: PTITCUBE C&DH");
}

void loop() {
    static int counter = 0;

    char buf[64];
    snprintf(buf, sizeof(buf), "Hello World #%d", counter++);
    cdh.println(buf);

    saveLine(buf);
    delay(3000);
}
