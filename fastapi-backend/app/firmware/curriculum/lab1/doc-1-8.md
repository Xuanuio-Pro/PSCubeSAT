# Doc 1.8: Định thời bằng `millis()` và xử lý tràn số

![Định thời không chặn và xử lý tràn số](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_millis_nonblocking.png)

### 1. Vì sao cần tránh `delay()`?

`delay(ms)` chặn chương trình trong khoảng thời gian chỉ định.

- Với `delay(1000)`, CPU chờ trong $1000\text{ ms}$.
- Trong thời gian đó, chương trình không đọc cảm biến, xử lý dữ liệu Serial, phục vụ yêu cầu từ trạm mặt đất hay phát hiện sự cố.
- Nếu thời gian chờ vượt chu kỳ Watchdog Timer, WDT phát hiện CPU bị treo và khởi động lại hệ thống.

### 2. Định thời không chặn bằng `millis()`

Thay `delay()` bằng bộ đếm thời gian `millis()` để chương trình tiếp tục xử lý các tác vụ khác.

- `millis()` trả về số mili-giây từ lúc ESP32 khởi động. Trên ESP32, giá trị dùng kiểu số nguyên không dấu 32-bit (`unsigned long`).
- Lưu thời điểm chạy gần nhất vào `previousMillis`. Trong `loop()`, chỉ chạy tác vụ khi `currentMillis - previousMillis` lớn hơn hoặc bằng `INTERVAL`, sau đó cập nhật mốc thời gian:

```cpp
unsigned long previousMillis = 0;
const unsigned long INTERVAL = 1000; // Chu kỳ 1000 ms (1 giây)

void loop() {
    unsigned long currentMillis = millis();
  
    // Chỉ chạy khi đã đủ chu kỳ
    if (currentMillis - previousMillis >= INTERVAL) {
        previousMillis = currentMillis;
      
        // Đọc cảm biến và gửi dữ liệu
        readSensorsAndSendTelemetry();
    }
  
    // Tiếp tục xử lý các tác vụ khác
    handleSerialCommands();
    server.handleClient();
}
```

### 3. Xử lý tràn số

Trên ESP32, `unsigned long` là số nguyên không dấu 32-bit, có giá trị từ $0$ đến $2^{32} - 1 = 4.294.967.295$:

- Sau khoảng thời gian:

$$T_{\text{overflow}} = \frac{4294967295\text{ ms}}{1000 \times 60 \times 60 \times 24} \approx 49.71\text{ days}$$

  giá trị `millis()` quay vòng về $0$.
- Dùng phép trừ thời điểm hiện tại cho thời điểm trước đó:

$$\text{currentMillis} - \text{previousMillis} \ge \text{INTERVAL}$$

  Phép trừ vẫn cho khoảng thời gian đã trôi qua khi bộ đếm quay vòng. Ví dụ, nếu `previousMillis = 4,294,967,200` và `currentMillis = 50`:

$$50 - 4294967200 = 146\text{ ms}$$

  Kết quả là 146 ms.
