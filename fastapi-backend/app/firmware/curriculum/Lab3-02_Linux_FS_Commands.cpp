// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab3-02_Linux_FS_Commands/blob/18283df4f3b0cabda8ae99f3086621a477fa1fb0/src/main.cpp
/**
 * VÍ DỤ 2: QUẢN LÝ THẺ NHỚ BẰNG LỆNH KIỂU LINUX
 * 
 * Mô tả:
 * Ví dụ này mô phỏng cách nhận lệnh từ một cổng Serial (ví dụ Ground Station)
 * và chuyển nó cho Storage module xử lý như một file system của Linux.
 *
 * Các lệnh hỗ trợ: pwd, cd, ls, mkdir, rm, touch
 */

#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>

PTIT_Storage storage;

// Check directory type before the legacy library's cd/ls command reports OK.
String checkedStorageCommand(PTIT_Storage& disk, const String& input) {
    if (!disk.isReady()) return "ERR: SD not ready";
    String command = input; command.trim();
    const int separator = command.indexOf(' ');
    String verb = separator < 0 ? command : command.substring(0, separator);
    verb.toLowerCase();
    String argument = separator < 0 ? "" : command.substring(separator + 1);
    argument.trim();
    if ((verb == "cd" || verb == "ls") && !(verb == "cd" && argument == "..")) {
        String path = argument.length() ? argument : (verb == "cd" ? "/" : disk.handleCommand("pwd"));
        if (path == ".") path = disk.handleCommand("pwd");
        if (!path.startsWith("/")) {
            const String cwd = disk.handleCommand("pwd");
            path = cwd + (cwd.endsWith("/") ? "" : "/") + path;
        }
        File directory = SD.open(path.c_str());
        if (!directory || !directory.isDirectory()) return "ERR: Not a directory: " + path;
    }
    return disk.handleCommand(input);
}

void setup() {
    Serial.begin(115200);
    while (!Serial) { delay(10); }

    Serial.println("\n[EXAMPLE] Khởi động hệ thống lưu trữ...");
    storage.init();
    
    if (storage.isReady()) {
        Serial.println("[EXAMPLE] SD Card đã sẵn sàng!");
        Serial.println("Bạn có thể gõ các lệnh sau vào ô Serial Monitor (kèm Enter/NL):");
        Serial.println("  pwd      - Xem thư mục hiện tại");
        Serial.println("  ls       - Liệt kê file và thư mục");
        Serial.println("  mkdir x  - Tạo thư mục tên x");
        Serial.println("  cd x     - Chuyển vào thư mục x");
        Serial.println("  touch x  - Tạo file x");
        Serial.println("  rm x     - Xóa file hoặc thư mục x");
    } else {
        Serial.println("[EXAMPLE] LỖI: Không tìm thấy thẻ SD.");
    }
}

void loop() {
    static String command;
    static bool discard = false;
    for (int budget = 0; budget < 64 && Serial.available(); ++budget) {
        const char c = Serial.read();
        if (c == '\n') {
            if (!discard) {
                command.trim();
                if (command.length()) {
                    Serial.println("User> " + command);
                    const String response = checkedStorageCommand(storage, command);
                    Serial.println(response.length() ? response : "ERR: Unknown command");
                }
            } else Serial.println("ERR: Command exceeds 128 bytes");
            command = ""; discard = false;
        } else if (c != '\r' && !discard) {
            if (command.length() < 128) command += c;
            else { command = ""; discard = true; }
        }
    }
    delay(5);
}
