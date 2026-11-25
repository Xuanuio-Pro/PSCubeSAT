# Doc 1.4: Nút nhấn Cơ học, Điện trở Pull-up & Giải thuật Lọc Rung Tiếp điểm (Debounce)

### 1. Trạng thái Thả nổi (Floating) & Điện trở Kéo lên Nội bộ (`INPUT_PULLUP`)
- Khi chân ngõ vào cấu hình `INPUT` thuần và công tắc đang hở, chân bị thả nổi (*floating*) dễ nhiễu điện từ dẫn đến đọc ngẫu nhiên `HIGH`/`LOW`.
- Cấu hình `pinMode(SW_PIN, INPUT_PULLUP)` kích hoạt điện trở kéo lên nội bộ của ESP32 (khoảng $45\text{ k}\Omega$). Với nút nhấn nối giữa chân GPIO và `GND` trên bo mạch thí nghiệm rời:
  - **Khi nhả nút:** Chân được kéo lên mức logic `HIGH` ($3.3\text{ V}$).
  - **Khi nhấn nút:** Chân nối trực tiếp xuống `GND`, đọc được mức `LOW` ($0\text{ V}$) (*Active-Low*).

> [!NOTE]
> Tín hiệu nút nhấn trên bo thí nghiệm rời (`GPIO 4`) dùng để học kỹ thuật đọc ngõ vào số và lọc nhiễu tiếp điểm, độc lập hoàn toàn với đường điều khiển hạ áp của bo nguồn EPS.

### 2. Hiện tượng Rung Tiếp điểm (Contact Bounce) & Giải thuật Debounce
- Tiếp điểm kim loại bên trong nút nhấn cơ khí thường bật nảy vài lần trong khoảng $5 - 20\text{ ms}$ lúc vừa đóng hoặc nhả, khiến vi điều khiển hiểu nhầm 1 lần nhấn thành nhiều xung liên tiếp.
- **Chống rung bằng phần mềm (Software Debounce):** Dùng `millis()` ghi nhận thời điểm thay đổi trạng thái; chỉ xác nhận trạng thái mới là hợp lệ khi nó giữ ổn định liên tục qua ngưỡng lọc (thường $20 - 50\text{ ms}$).
- **Bắt cạnh xuống (Falling-Edge Trigger):** Chỉ kích hoạt hành động (như đảo trạng thái LED) tại thời điểm chuyển từ `HIGH` sang `LOW`, không đảo liên tục trong khi nút vẫn đang giữ.

### Bài 1.3: Đọc Công tắc Hành trình Phóng (Digital Input & Điện trở Kéo lên Nội bộ)

- **Mục tiêu:** Cấu hình chân GPIO làm `INPUT_PULLUP` để đọc trạng thái đóng/ngắt của công tắc hành trình phóng mà không cần gắn thêm điện trở ngoài.

```cpp
const int SW_PIN = 4;
const int LED_PIN = 2;

void setup() {
    pinMode(SW_PIN, INPUT_PULLUP);
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    // Khi công tắc mở (vệ tinh ra khỏi ống phóng): chân đọc mức HIGH
    int state = digitalRead(SW_PIN);
    digitalWrite(LED_PIN, (state == HIGH) ? HIGH : LOW);
}
```
