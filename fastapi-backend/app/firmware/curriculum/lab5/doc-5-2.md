# Doc 5.2: LoRa E32 và trạm mặt đất

### 1. Công nghệ LoRa
Module **Ebyte E32-433T20D** sử dụng chip thu phát bán dẫn SX1278 của hãng Semtech ứng dụng kỹ thuật điều chế trải phổ CSS:
- Thay vì truyền tín hiệu trên một tần số cố định, năng lượng sóng được quét biến thiên liên tục theo tần số (xung Chirp).
- Khả năng giải mã tín hiệu nằm sâu dưới mức nhiễu nền (dưới Noise Floor tới -20 dB), mang lại độ nhạy thu vô song (lên tới -148 dBm) với công suất phát chỉ 100 mW (+20 dBm).
- **Các Tham số Cấu hình:**
  - **Hệ số Trải phổ (Spreading Factor - SF7 đến SF12):** SF càng lớn, tầm xa càng tăng nhưng tốc độ truyền dữ liệu (Data Rate) càng giảm.
  - **Băng thông (Bandwidth - BW):** Thường chọn 125 kHz cho kênh UHF.

![Kiến trúc truyền thông LoRa E32 và Trạm Mặt đất](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab5_lora_ground_station.png)

### 2. Chân và chế độ hoạt động của Ebyte E32
Module E32 giao tiếp với vi điều khiển OBC thông qua cổng UART1 chuẩn và hai chân điều khiển chế độ `M0`, `M1`:

![Module LoRa Ebyte E32-TTL-100 với hàng chân UART và cổng anten SMA](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab5.3_loraE32.png)

*Module E32-TTL-100. Đối chiếu hàng chân bên trái từ trên xuống (M0, M1, RXD, TXD, AUX, VCC, GND) với bảng đấu nối bên dưới. Đầu nối anten nằm ở bên phải.*

- **Sơ đồ đấu nối phần cứng chuẩn hóa :**

| Chân E32 | Nối với ESP32 | Hướng | Chức năng |
| :--- | :--- | :--- | :--- |
| `TXD` | `RXD` (UART1) | Vào | Dữ liệu từ E32 đến OBC. |
| `RXD` | `TXD` (UART1) | Ra | Dữ liệu từ OBC đến E32. |
| `AUX` | Chân AUX | Vào | `HIGH`: rảnh; `LOW`: bận. |
| `M0`, `M1` | Chân M0, M1 | Ra | Chọn chế độ hoạt động. |
| `VCC`, `GND` | 3.3 V, GND | Nguồn | Cấp nguồn cho module. |

| Chế độ | Chân M0 | Chân M1 | Chức năng |
| :--- | :--- | :--- | :--- |
| **Mode 0** | `LOW` | `LOW` | Truyền dữ liệu qua UART. |
| **Mode 1** | `HIGH` | `LOW` | Thêm tiền tố để đánh thức bộ thu. |
| **Mode 2** | `LOW` | `HIGH` | Tiết kiệm điện, chỉ thức dậy khi nhận tín hiệu đánh thức. |
| **Mode 3** | `HIGH` | `HIGH` | Đọc hoặc ghi cấu hình tần số và tốc độ baud. |

- **Chân trạng thái `AUX`:**
  - Chân ngõ ra báo trạng thái bận của module:
    - Mức `LOW`: Module đang bận truyền dữ liệu ra ăng-ten hoặc bộ đệm FIFO nội bộ đang nạp dữ liệu.
    - Mức `HIGH`: Module rảnh rỗi, sẵn sàng nhận dữ liệu mới từ vi điều khiển.
  - Phần mềm bay bắt buộc phải kiểm tra `digitalRead(AUX_PIN) == HIGH` trước khi gửi byte tiếp theo qua UART.

### 3. Cấu hình module bằng PTITCube RF Configurator
Nhằm tối ưu hóa quy trình cấu hình trên mọi nền tảng hệ điều hành (Windows, macOS, Linux) mà không cần cài đặt bất kỳ phần mềm máy tính trung gian nào, toàn bộ quá trình đọc và ghi tham số cho các module thu phát LoRa dòng E32 (Ebyte) và AS32 (Ashining) được thực hiện trực tiếp trên trình duyệt thông qua **Trang Web Cấu Hình PTITCube RF Configurator** (truy cập tại: `https://ptitcube.github.io/RF-Setting-Web/`).

#### a. Giao tiếp qua Web Serial API
- Trang web ứng dụng tiêu chuẩn công nghệ **Web Serial API** trên các trình duyệt web hiện đại (Google Chrome, Microsoft Edge, Opera), cho phép trang web kết nối trực tiếp hai chiều với cổng COM ảo của mạch nạp USB-to-UART.
- Người dùng chỉ cần cắm mạch nạp USB nối với module LoRa, chọn cổng kết nối trên trình duyệt và thiết lập tốc độ truyền thông cấu hình danh định của module ở Mode 3 là **9600 bps** (8N1).

#### b. Kết nối phần cứng khi cấu hình
- **Chân Chọn Chế Độ:** Module LoRa bắt buộc phải được chuyển sang **Mode 3 (Sleep / Config Mode)**:
  - Chân `M0` nối lên mức **HIGH** (3.3V).
  - Chân `M1` nối lên mức **HIGH** (3.3V).
- **Đường Truyền UART:**
  - `TXD` của module LoRa nối vào chân `RXD` của mạch nạp USB-to-UART.
  - `RXD` của module LoRa nối vào chân `TXD` của mạch nạp USB-to-UART.
  - Cấp nguồn 3.3V hoặc 5V và nối chung Mass (`GND`).

#### c. Khung lệnh cấu hình 6 byte
Giao thức giao tiếp cấu hình của module E32 và AS32 sử dụng khung chuẩn 6 byte (`HEAD, ADDH, ADDL, SPED, CHAN, OPTION`):
- **Byte 0 (HEAD - Mã lệnh hoạt động):**
  - `0xC0`: **Lưu Vĩnh Viễn vào EEPROM (Permanent Save):** Các tham số được ghi đè vào bộ nhớ không bay hơi của module, giữ nguyên giá trị ngay cả khi tắt nguồn hoặc reset.
  - `0xC2`: **Lưu Tạm Thời vào RAM (Temporary Save):** Tham số được áp dụng ngay lập tức nhưng chỉ lưu trên bộ nhớ RAM; khi mất điện hoặc reset, module sẽ quay về cấu hình cũ. Phù hợp cho việc kiểm thử nhanh.
  - Lệnh đọc cấu hình hiện tại: Gửi chuỗi 3 byte `0xC1 0xC1 0xC1`. Module sẽ phản hồi khung 6 byte thông số đang áp dụng.
  - Lệnh khôi phục cấu hình mặc định (Reset): Gửi chuỗi 3 byte `0xC4 0xC4 0xC4`.
- **Byte 1 & Byte 2 (ADDH, ADDL - Địa chỉ Module):**
  - Định danh địa chỉ mạng của module từ `0x0000` đến `0xFFFF`.
  - Giá trị `0xFFFF` được quy ước làm địa chỉ **Phát Quảng Bá (Broadcast)**; mọi node máy thu trên cùng kênh tần số đều sẽ tiếp nhận được bản tin.
- **Byte 3 (SPED - Tốc độ UART & Air Data Rate):**
  - Cấu hình tốc độ baud UART (1200 đến 115200 bps), cơ chế kiểm tra chẵn lẻ Parity (8N1, 8O1, 8E1).
  - Cấu hình tốc độ truyền không dây qua sóng vô tuyến (Air Data Rate từ 0.3 kbps đến 19.2 kbps). Air Data Rate càng thấp thì độ nhạy thu càng cao, tầm truyền xa càng lớn.
- **Byte 4 (CHAN - Kênh Tần Số Hoạt Động):**
  - Đối với dòng module 433 MHz, dải kênh CHAN từ `0x00` đến `0x1F` (0 đến 31).
  - Tần số thực tế được tính theo công thức:

$$f_\text{RF} = 410\text{ MHz} + \text{CHAN} \times 1\text{ MHz}$$

    *(Ví dụ: $\text{CHAN} = 23 \implies f_\text{RF} = 433.0\text{ MHz}$)*.
- **Byte 5 (OPTION - Tùy Chọn Hoạt Động):**
  - Chọn chế độ truyền: Truyền trong suốt (Transparent Transmission) hoặc Truyền cố định có định tuyến địa chỉ (Fixed Transmission).
  - Cấu hình công suất phát tối đa (lên tới 20 dBm = 100 mW) và kích hoạt mã sửa lỗi tiến truyền trước (FEC - Forward Error Correction).

#### d. Tính năng của trang cấu hình
1. **Quick Presets (Cấu Hình Mẫu Nhanh):** Cung cấp sẵn các bộ thông số tối ưu cho từng kịch bản vệ tinh chỉ với một cú nhấp chuột:
   - *CubeSat Telemetry Profile:* Tối ưu cân bằng giữa tầm xa và tốc độ phát viễn trắc.
   - *Long Range Mission:* Tối đa hóa độ nhạy thu để vượt qua cự ly truyền thông vũ trụ xa nhất.
   - *High-Speed Payload:* Tăng tốc độ truyền tải gói tin để tải dữ liệu tệp ảnh.
2. **Interactive Hardware Visualizer:** Hiển thị sơ đồ đồ họa trực quan trạng thái gạt chân jumper `M0`, `M1` và các chân nối dây trên kit thật, giúp hạn chế tối đa nhầm lẫn phần cứng.
3. **Packet Tester (Kiểm Tra Gói Tin Thực Nghiệm):** Hỗ trợ gửi/nhận dữ liệu kiểm thử trực tiếp trên web theo cả dạng văn bản (ASCII) và chuỗi Hex.
4. **Arduino C++ Code Generator:** Tự động sinh mã nguồn khởi tạo thư viện C++ tương thích với mã cấu hình vừa tạo để sao chép thẳng vào dự án PlatformIO / Arduino IDE.

### 4. Kiến trúc trạm mặt đất
Một trạm mặt đất thu nhận tín hiệu CubeSat tiêu chuẩn bao gồm:
1. **Ăng-ten Định hướng Thu sóng:** Ăng-ten Yagi-Uda hoặc ăng-ten phân cực tròn xoắn ốc (Helical Antenna) băng tần UHF có độ tăng ích cao ($10 - 14\text{ dBi}$).
2. **Khối Thu Sóng Vô tuyến Định nghĩa bằng Phần mềm (SDR - Software Defined Radio):** Các thiết bị SDR băng rộng (như RTL-SDR, HackRF, LimeSDR) kết nối máy tính qua cổng USB, số hóa toàn bộ phổ tần vô tuyến.
3. **Biểu đồ Thác Nước Phổ Tần (Waterfall Display):** Hiển thị cường độ tín hiệu theo tần số và thời gian, cho phép kỹ sư quan sát trực quan đường vệt tín hiệu của vệ tinh và độ cong dịch tần Doppler khi vệ tinh bay qua.
4. **Cơ cấu Chân đế Xoay 2 Trục (Azimuth / Elevation Rotator):** Tự động điều khiển hướng ăng-ten ngửa lên bầu trời và quay bám sát theo vị trí vệ tinh được tính toán từ tệp dữ liệu quỹ đạo hai dòng **TLE (Two-Line Element)** nhờ phần mềm Orbitron hoặc Gpredict.
