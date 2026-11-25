// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-02_Linux_FS_Commands/blob/fb0fd9c193f5097ac534da557923663e25babf21/src/main.cpp
/**
 * VÍ DỤ 3-02: QUẢN LÝ THẺ NHỚ BẰNG LỆNH KIỂU LINUX
 *
 * Lệnh: pwd, cd, ls, cat, touch, echo, mkdir, rmdir, rm, df, help
 */
#include <Arduino.h>
#include <PTITCube.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_Storage storage;

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    storage.init();

    if (!storage.isReady()) {
        cdh.println("Storage: SD not ready");
    }
}

void loop() {
    static String cmd;
    static bool discard = false;
    // Đọc tối đa 64 ký tự mỗi vòng; lệnh dài quá 128 byte bị bỏ thay vì làm tràn bộ nhớ.
    for (int budget = 0; budget < 64 && cdh.available(); ++budget) {
        const char c = cdh.read();
        if (c == '\n') {
            cmd.trim();
            if (discard) {
                cdh.println("ERR: Command exceeds 128 bytes");
            } else if (cmd.length() > 0) {
                cdh.println("> " + cmd);
                String response = storage.handleCommand(cmd);
                // Thư viện trả chuỗi rỗng khi lệnh thành công (giống shell Linux).
                cdh.println(response.length() > 0 ? response : "OK");
            }
            cmd = ""; discard = false;
        } else if (c != '\r' && !discard) {
            if (cmd.length() < 128) cmd += c;
            else { cmd = ""; discard = true; }
        }
    }
    delay(5);
}
