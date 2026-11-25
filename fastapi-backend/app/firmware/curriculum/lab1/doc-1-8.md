# Doc 1.8: Quy chuẩn Lập trình C++ Định thời Non-blocking với millis() & Thuật toán Chống Tràn số

### 1. Tại sao Tuyệt đối CẤM sử dụng `delay()` trong Phần mềm Bay Vệ tinh?

Hàm `delay(ms)` là một hàm **chặn luồng thực thi (Blocking Function)**:

- Khi vi điều khiển gọi lệnh `delay(1000)`, CPU sẽ bị "giam lỏng" trong một vòng lặp rỗng đếm xung suốt $1000\text{ ms}$.
- Trong khoảng thời gian $1$ giây đó, CPU hoàn toàn không thể làm gì khác: không thể đọc dữ liệu cảm biến, không thể kiểm tra gói tin gửi đến từ cổng Serial, không thể phục vụ yêu cầu từ trạm mặt đất và không thể phát hiện các điều kiện sự cố khẩn cấp.
- Nguy hiểm hơn, nếu thời gian `delay()` quá dài vượt quá chu kỳ làm việc của Bộ định thời Watchdog Timer Watchdog Timer, WDT sẽ phát hiện CPU bị đóng băng và tự động khởi động lại toàn bộ vệ tinh!

### 2. Kỹ thuật Định thời An toàn bằng `millis()` (Non-blocking Timing)

Thay vì sử dụng `delay()`, phần mềm bay chuyên nghiệp luôn áp dụng kỹ thuật định thời bất đồng bộ dựa trên bộ đếm thời gian hệ thống `millis()`:

- Hàm `millis()` trả về số mili-giây trôi qua kể từ thời điểm ESP32 được cấp điện khởi động, sử dụng biến kiểu số nguyên không dấu 32-bit (`unsigned long`).
- **Nguyên lý Hoạt động:** Ta ghi nhận mốc thời gian của lần thực hiện gần nhất (`previousMillis`). Trong mỗi vòng lặp `loop()`, ta lấy thời gian hiện tại (`currentMillis`) trừ đi `previousMillis`. Chỉ khi khoảng chênh lệch này lớn hơn hoặc bằng chu kỳ mong muốn (`INTERVAL`), ta mới thực hiện công việc và cập nhật lại mốc `previousMillis`:

```cpp
unsigned long previousMillis = 0;
const unsigned long INTERVAL = 1000; // Chu kỳ 1000 ms (1 giây)

void loop() {
    unsigned long currentMillis = millis();
  
    // Kiểm tra khoảng thời gian trôi qua theo cơ chế non-blocking
    if (currentMillis - previousMillis >= INTERVAL) {
        previousMillis = currentMillis;
      
        // Thực thi tác vụ bay: Đọc cảm biến & Gửi Telemetry
        readSensorsAndSendTelemetry();
    }
  
    // CPU rảnh tay thực thi ngay lập tức các tác vụ quan trọng khác
    handleSerialCommands();
    server.handleClient();
}
```

### 3. Phân tích Toán học về Hiện tượng Tràn số (Rollover Protection)

Biến `unsigned long` trong chuẩn C++ có độ rộng 32-bit, biểu diễn các giá trị từ $0$ đến $2^{32} - 1 = 4.294.967.295$:

- Sau khoảng thời gian:

$$T_{\text{overflow}} = \frac{4294967295\text{ ms}}{1000 \times 60 \times 60 \times 24} \approx 49.71\text{ days}$$

  giá trị của hàm `millis()` sẽ bị tràn số và tự động quay vòng trở về giá trị $0$.
- **Tính toán Đúng đắn Tuyệt đối (Luôn Dùng Phép Trừ):**
  Nhờ quy tắc toán học số bù 2 (Two's Complement Arithmetic) của hệ thống số nguyên không dấu trong phần cứng vi xử lý, biểu thức:

$$\text{currentMillis} - \text{previousMillis} \ge \text{INTERVAL}$$

  luôn luôn cho ra kết quả khoảng thời gian dương chính xác ngay cả trong khoảnh khắc chuyển tiếp qua mốc tràn số!
  *Ví dụ:* Giả sử `previousMillis = 4,294,967,200` (trước khi tràn 95 ms) và sau đó `currentMillis = 50` (đã tràn về 50 ms).
  Phép trừ số học không dấu 32-bit:

$$50 - 4294967200 = 146\text{ ms}$$

  Hệ thống tính toán ra chính xác tuyệt đối 146 ms trôi qua mà không gặp bất kỳ lỗi logic nào!
