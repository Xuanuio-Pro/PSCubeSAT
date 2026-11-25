# Doc 1.3: Nguyên lý Điều khiển GPIO & Điều chế Độ rộng Xung LEDC PWM

> [!IMPORTANT]
> **Cơ Chế Phần Cứng Thực Hành Lab 1: Bo Mạch Thí Nghiệm Rời (Standalone Educational Breakout PCB)**
>
> - Nhằm đảm bảo an toàn thiết bị và bảo vệ các bo mạch chuẩn vệ tinh trong giai đoạn học viên mới làm quen với lập trình nhúng, **các bài thực hành Lab 1 (từ Bài 1.1 đến Bài 1.11) được tiến hành hoàn toàn trên Bo Mạch Thí Nghiệm Rời (Breakout Demo PCB)** kết nối với ESP32 qua dây cắm jumper, **KHÔNG kết nối vào các PCB chính của chồng bo CubeSat (như bo EPS, bo Sensor, bo Truyền thông COM)**.
> - **Sơ đồ đấu nối phần cứng thực hành Lab 1 (trên PCB rời):**
>   - **LED đơn (Chỉ thị):** Chân Anode nối qua điện trở hạn dòng về `GPIO 2`, Cathode nối GND.
>   - **Nút nhấn (Tact Switch):** Một chân nối về `GPIO 4`, một chân nối GND (sử dụng trở kéo nội `INPUT_PULLUP`). *Lưu ý: Tín hiệu nút nhấn này nằm độc lập trên PCB rời, hoàn toàn không kết nối tới đường điều khiển hạ áp của bo nguồn EPS.*
>   - **Khối IC 74HC595 & LED 7 đoạn:** Chân dữ liệu $DS$ nối `GPIO 13`, chân chốt $ST\_CP$ nối `GPIO 14`, chân xung nhịp $SH\_CP$ nối `GPIO 15`, nguồn cấp $VCC$ nối 3.3V và $GND$.
> - Toàn bộ cấu trúc chồng bo CubeSat chuẩn công nghiệp (PC/104 Bus) sẽ được học viên tiếp cận và tích hợp từng bước trong các Lab chuyên sâu tiếp theo (từ Lab 2 đến Lab 8).

### 1. Nguyên lý LED và Điện trở Hạn dòng
- LED là diode phát quang, chỉ dẫn dòng theo chiều thuận (Anode → Cathode) và **luôn cần điện trở hạn dòng** để bảo vệ chip GPIO của ESP32:

$$R = \frac{V_{cc} - V_f}{I}$$

- Ví dụ với nguồn logic ESP32 $V_{cc} = 3.3\text{ V}$, điện áp rơi trên LED $V_f \approx 2.0\text{ V}$ và dòng an toàn $I = 10\text{ mA}$: $R = (3.3 - 2.0) / 0.01 = 130\ \Omega$ (thực tế chọn $220\ \Omega - 330\ \Omega$).
- Ngõ ra GPIO kiểu *Push-Pull* lái chủ động cả mức `HIGH` ($3.3\text{ V}$) và `LOW` ($0\text{ V}$) qua `pinMode(pin, OUTPUT)` và `digitalWrite(pin, state)`. Khi điều khiển chuỗi nhiều LED, gom các chân vào mảng và duyệt bằng vòng lặp.

### 2. Điều chế Độ rộng Xung PWM với Bộ Ngoại vi LEDC
- **PWM (Pulse Width Modulation)** điều chỉnh công suất/độ sáng trung bình bằng tỉ lệ thời gian mức cao (*Duty Cycle*) ở tần số đóng ngắt cao (vài kHz để mắt người không thấy nhấp nháy).
- Bộ **LEDC** phần cứng của ESP32 cung cấp 16 kênh PWM độc lập: `ledcSetup(channel, freq, resolution)` đặt tần số và độ phân giải (ví dụ 8-bit cho giá trị $0 - 255$), `ledcAttachPin(pin, channel)` ánh xạ ra chân GPIO, và `ledcWrite(channel, duty)` cập nhật độ sáng mượt mà.

### 3. Minh họa Cấu hình Cơ bản trên Breakout PCB

### Bài 1.1: Blink LED Cơ bản (Hello World của Kỹ thuật Nhúng)

- **Mục tiêu:** Cấu hình chân GPIO làm `OUTPUT` và điều khiển bật/tắt LED theo chu kỳ.

```cpp
const int LED_PIN = 2;

void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
}
```

### Bài 1.4: Điều khiển Độ sáng LED bằng Điều chế Độ rộng Xung PWM (LEDC)

- **Mục tiêu:** Cấu hình khối phần cứng LEDC PWM của ESP32 để điều chỉnh mức điện áp hiệu dụng ngõ ra.

```cpp
const int LED_PIN = 2;
const int PWM_CH = 0;
const int PWM_FREQ = 5000; // Tần số 5 kHz
const int PWM_RES = 8;     // Độ phân giải 8-bit (0 - 255)

void setup() {
    ledcSetup(PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(LED_PIN, PWM_CH);
}

void loop() {
    // Tăng dần độ sáng (Fade In)
    for (int duty = 0; duty <= 255; duty++) {
        ledcWrite(PWM_CH, duty);
        delay(5);
    }
    // Giảm dần độ sáng (Fade Out)
    for (int duty = 255; duty >= 0; duty--) {
        ledcWrite(PWM_CH, duty);
        delay(5);
    }
}
```
