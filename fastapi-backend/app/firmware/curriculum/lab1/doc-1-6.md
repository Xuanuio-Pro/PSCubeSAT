# Doc 1.6: Giao tiếp UART

### 1. Nguyên lý truyền dữ liệu

**UART** truyền dữ liệu nối tiếp giữa hai thiết bị mà không cần chung đường xung nhịp. Hai bên cần dùng cùng tốc độ truyền và căn thời điểm theo cạnh tín hiệu.

- Dùng hai đường tín hiệu:
  - `TX`: truyền dữ liệu.
  - `RX`: nhận dữ liệu. Nối chéo hai thiết bị: `TX_A` → `RX_B`, `RX_A` → `TX_B`.

![Sơ đồ kết nối UART hai chiều](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_uart_connection.png)

![Sơ đồ khung truyền UART 8-N-1](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_uart_timing_sequence.png)

### 2. Khung truyền SERIAL_8N1

Khung **SERIAL_8N1** gồm:

- 8 bit dữ liệu, tương ứng 1 byte.
- Không có bit kiểm tra chẵn lẻ.
- 1 bit bắt đầu và 1 bit dừng.

Mỗi byte cần truyền 10 bit. Ở tốc độ 115200 bps, thời gian truyền là:

$$T_{\text{bit}} = \frac{1}{115200} \approx 8.68\,\mu\text{s} \implies T_{\text{byte}} = 10 \times 8.68\,\mu\text{s} \approx 86.8\,\mu\text{s}$$

Tốc độ dữ liệu tối đa xấp xỉ 11520 byte/s, tương đương 11.25 KB/s.

### 3. Ba cổng UART trên ESP32

ESP32 có ba cổng UART: `UART0`, `UART1` và `UART2`. Ma trận GPIO cho phép gán tín hiệu TX/RX cho các chân phù hợp trên NodeMCU-32S:

![Vị trí ba cổng UART trên ESP32 NodeMCU-32S](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab1.1_esp32.png)

1. **UART0 (`Serial`, TX: `GPIO1`, RX: `GPIO3`):** Nối với chip USB-UART CP2102 hoặc CH340, dùng để nạp mã và xem nhật ký ở 115200 bps.
2. **UART1 (`Serial1`):** Chân mặc định `GPIO9` và `GPIO10` dùng chung với bộ nhớ Flash. Khi khởi tạo, gán UART1 sang chân GPIO khác bằng `Serial1.begin(baud, SERIAL_8N1, RX_PIN, TX_PIN)`. Ví dụ: kết nối LoRa E32.
3. **UART2 (`Serial2`, TX: `GPIO17`, RX: `GPIO16`):** Dùng với GNSS L76X ở 9600 bps và camera OV2640 ở 115200 bps thông qua IC 74HC4066.

| Cổng | Đối tượng | Chân | Kết nối và ứng dụng |
| :--- | :--- | :--- | :--- |
| **UART0** | `Serial` | TX `GPIO1`<br>RX `GPIO3` | USB-UART; nạp chương trình, xem nhật ký và nhận lệnh CLI. |
| **UART1** | `Serial1` / `HardwareSerial(1)` | Gán qua ma trận GPIO; không dùng `GPIO9/10`. | Kết nối LoRa E32 (433 MHz). |
| **UART2** | `Serial2` / `HardwareSerial(2)` | TX `GPIO17`<br>RX `GPIO16` | Nhận NMEA từ GNSS L76X và ảnh JPEG từ OV2640 qua `74HC4066`; độc lập với nạp USB. |
