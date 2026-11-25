// Reviewed classroom source for the ESP32 OBC hardware profile.
// Upstream: https://github.com/PTITCube/Lab4-04a_Camera_UART/blob/aa8c3f80a8749f4cbcf43c150639ee5422079578/src/main.cpp
/**
 * VÍ DỤ 4-4a: CHỤP ẢNH QUA UART & LƯU THẺ NHỚ MICROSD
 *
 * Giao thức bắt tay UART2 giữa OBC và ESP32-CAM:
 *    OBC                          ESP32-CAM
 *     | --- "capture\n" -------->    |  (OBC yêu cầu chụp)
 *     | <--- "SIZE:<bytes>\n" ---    |  (CAM chụp xong và báo kích thước JPEG)
 *     | --- "OK\n" ------------->    |  (OBC sẵn sàng nhận luồng dữ liệu)
 *     | <--- [Binary JPEG Stream] -  |  (CAM truyền byte nhị phân ảnh, OBC ghi thẳng vào SD)
 *     | --- "DONE\n" ----------->    |  (OBC báo kết thúc)
 */
#include <Arduino.h>
#include <PTITCube.h>
#include <SD.h>
#include <base64.h>

PTIT_CDH cdh;
PTIT_EPS eps;
PTIT_Storage storage;

// Chân Camera và IC chuyển mạch 74HC4066
#define CAM_RX_PIN  16
#define CAM_TX_PIN  17
#define CAM_BAUD    115200

#define MUX_GPS_PIN 12
#define MUX_CAM_PIN 14

static int photoCounter = 0;

void selectCamera() {
    digitalWrite(MUX_GPS_PIN, LOW);
    delayMicroseconds(50);
    digitalWrite(MUX_CAM_PIN, HIGH);
}

void selectGPS() {
    digitalWrite(MUX_CAM_PIN, LOW);
    delayMicroseconds(50);
    digitalWrite(MUX_GPS_PIN, HIGH);
}

// Gửi ảnh đã lưu trên thẻ SD về trình duyệt qua Serial theo từng khối base64 (Camera Viewer).
// Giao thức: IMG_BEGIN:<số byte> -> nhiều dòng IMG_CHUNK:<base64 của 384 byte> -> IMG_END
static bool sendImageOverSerial(const char* path) {
    File file = SD.open(path, FILE_READ);
    if (!file) { cdh.println("ERROR:IMG_OPEN"); return false; }
    const size_t size = file.size();
    if (size == 0 || size > 262144) {
        file.close();
        cdh.printf("ERROR:IMG_SIZE:%u\n", (unsigned)size);
        return false;
    }
    cdh.printf("IMG_BEGIN:%u\n", (unsigned)size);
    uint8_t chunk[384];
    size_t sent = 0;
    while (sent < size) {
        const size_t count = file.read(chunk, sizeof(chunk));
        if (count == 0) break;
        cdh.print("IMG_CHUNK:");
        cdh.println(base64::encode(chunk, count));
        sent += count;
        delay(2);
    }
    file.close();
    if (sent != size) { cdh.println("ERROR:IMG_READ"); return false; }
    cdh.println("IMG_END");
    return true;
}

// Chụp trên kênh Camera; captureImage() luôn trả MUX về GPS sau khi gọi hàm này.
static bool captureOnCameraChannel() {
    while (Serial2.available()) Serial2.read();

    Serial2.print("capture\n");
    Serial2.flush();

    unsigned long start = millis();
    long imageSize = 0;
    while (millis() - start < 5000) {
        if (Serial2.available()) {
            String line = Serial2.readStringUntil('\n');
            line.trim();
            if (line.startsWith("SIZE:")) {
                imageSize = line.substring(5).toInt();
                break;
            }
            if (line.startsWith("ERROR:")) {
                cdh.printf("Camera: ESP32-CAM bao loi: %s\n", line.c_str());
                return false;
            }
        }
        delay(1);
    }

    if (imageSize <= 0) {
        cdh.println("Camera: Timeout hoac khong nhan duoc SIZE.");
        return false;
    }
    // Từ chối kích thước bất thường thay vì xác nhận OK cho luồng không lưu được.
    if (imageSize < 4 || imageSize > 512L * 1024L) {
        cdh.printf("Camera: SIZE khong hop le (%ld bytes).\n", imageSize);
        return false;
    }

    // Không ghi đè ảnh cũ: bỏ qua các tên file đã tồn tại trên thẻ nhớ.
    char path[32];
    do {
        snprintf(path, sizeof(path), "/photos/uart_img_%d.jpg", photoCounter++);
    } while (SD.exists(path));
    File file = SD.open(path, FILE_WRITE);
    if (!file) {
        cdh.printf("Camera: Khong the tao file %s.\n", path);
        return false;
    }

    Serial2.print("OK\n");
    Serial2.flush();

    uint8_t buf[256];
    long received = 0;
    bool writeOK = true;
    uint8_t first[2] = {0, 0}, last[2] = {0, 0};
    unsigned long lastProgress = millis();
    start = millis();

    while (received < imageSize && (millis() - start < 15000)) {
        if (Serial2.available()) {
            int want = min((int)Serial2.available(), (int)sizeof(buf));
            if (want > imageSize - received) want = imageSize - received;
            int n = Serial2.readBytes(buf, want);
            if (n > 0) {
                if (file.write(buf, n) != (size_t)n) { writeOK = false; break; }
                for (int i = 0; i < n; ++i) {
                    if (received + i < 2) first[received + i] = buf[i];
                    last[0] = last[1]; last[1] = buf[i];
                }
                received += n;
                start = millis();
            }
        }
        if (millis() - lastProgress >= 500) {
            lastProgress = millis();
            cdh.printf("Camera: Da nhan %ld / %ld bytes\n", received, imageSize);
        }
    }
    file.close();

    // Luôn báo DONE để ESP32-CAM không phải chờ, kể cả khi nhận lỗi.
    Serial2.print("DONE\n");
    Serial2.flush();
    delay(20);

    // JPEG hợp lệ phải đủ byte, ghi đủ và bắt đầu bằng 0xFFD8 (SOI), kết thúc bằng 0xFFD9 (EOI).
    const bool validJpeg = first[0] == 0xFF && first[1] == 0xD8 && last[0] == 0xFF && last[1] == 0xD9;
    if (!writeOK) {
        cdh.printf("Camera: Ghi the nho that bai; file %s khong day du.\n", path);
        return false;
    }
    if (received != imageSize) {
        cdh.printf("Camera: Loi truyen nhan (%ld/%ld bytes)\n", received, imageSize);
        return false;
    }
    if (!validJpeg) {
        cdh.printf("Camera: Du lieu %ld bytes khong phai JPEG hop le (SOI/EOI).\n", received);
        return false;
    }
    cdh.printf("Camera: Saved %s (%ld bytes)\n", path, received);
    sendImageOverSerial(path);
    return true;
}

bool captureImage() {
    if (!storage.isReady()) {
        cdh.println("Camera: The nho chua san sang.");
        return false;
    }
    selectCamera();
    const bool success = captureOnCameraChannel();
    selectGPS();
    return success;
}

void setup() {
    cdh.begin();

    // Kích hoạt hạ áp cấp nguồn ngoại vi trên PCB vệ tinh qua thư viện EPS
    eps.setBuckState(true);

    storage.init();
    if (storage.isReady() && !SD.exists("/photos")) {
        SD.mkdir("/photos");
    }

    pinMode(MUX_GPS_PIN, OUTPUT);
    pinMode(MUX_CAM_PIN, OUTPUT);
    selectGPS();

    Serial2.begin(CAM_BAUD, SERIAL_8N1, CAM_RX_PIN, CAM_TX_PIN);
    cdh.println("Camera: San sang. Go 'capture' de chup anh.");
}

void loop() {
    static String cmd;
    // Lệnh dài quá 32 ký tự bị bỏ, không làm tràn bộ nhớ.
    while (cdh.available()) {
        const char c = cdh.read();
        if (c != '\n') {
            if (c != '\r' && cmd.length() < 32) cmd += c;
            continue;
        }
        cmd.trim();
        if (cmd.equalsIgnoreCase("capture") || cmd.equalsIgnoreCase("photo") || cmd.equalsIgnoreCase("p")) {
            captureImage();
        } else if (cmd.length() > 0) {
            cdh.printf("Camera: Lenh '%s' khong hop le. Go 'capture' de chup anh.\n", cmd.c_str());
        }
        cmd = "";
    }
}
