# Doc 5.2: Công nghệ Trải phổ LoRa CSS & Module Truyền Thông Ebyte E32-433T20D

### 1. Công nghệ Trải phổ LoRa (Long Range Chirp Spread Spectrum - CSS)
Module **Ebyte E32-433T20D** sử dụng chip thu phát bán dẫn SX1278 của hãng Semtech ứng dụng kỹ thuật điều chế trải phổ CSS:
- Thay vì truyền tín hiệu trên một tần số cố định, năng lượng sóng được quét biến thiên liên tục theo tần số (xung Chirp).
- Khả năng giải mã tín hiệu nằm sâu dưới mức nhiễu nền (dưới Noise Floor tới -20 dB), mang lại độ nhạy thu vô song (lên tới -148 dBm) với công suất phát chỉ 100 mW (+20 dBm).
- **Các Tham số Cấu hình:**
  - **Hệ số Trải phổ (Spreading Factor - SF7 đến SF12):** SF càng lớn, tầm xa càng tăng nhưng tốc độ truyền dữ liệu (Data Rate) càng giảm.
  - **Băng thông (Bandwidth - BW):** Thường chọn 125 kHz cho kênh UHF.

### 2. Sơ đồ Chân & Các Chế độ Hoạt động của Module Ebyte E32
Module E32 giao tiếp với vi điều khiển OBC thông qua cổng UART1 chuẩn và hai chân điều khiển chế độ `M0`, `M1`:

- **Sơ đồ đấu nối phần cứng chuẩn hóa theo thư viện `PTITCube.h` (Lớp `PTIT_COM`):**

| Tín hiệu E32 LoRa | Đường Nối OBC (ESP32) | Hướng | Vai trò Kỹ thuật |
| :--- | :--- | :--- | :--- |
| **TXD** | **RXD (Cổng UART1)** | Input (ESP32) | Đường nhận dữ liệu từ LoRa vào UART1 của OBC |
| **RXD** | **TXD (Cổng UART1)** | Output (ESP32) | Đường xuất dữ liệu từ UART1 của OBC sang LoRa |
| **AUX** | **Chân AUX** | Input (ESP32) | Báo trạng thái bận/rảnh (`HIGH` = Rảnh, `LOW` = Bận) |
| **M0** | **Chân M0** | Output (ESP32) | Chân chọn Mode 0 (Mức `LOW` ở chế độ hoạt động bình thường) |
| **M1** | **Chân M1** | Output (ESP32) | Chân chọn Mode 1 (Mức `LOW` ở chế độ hoạt động bình thường) |
| **VCC / GND** | **3.3V / GND** | Nguồn | Cấp nguồn vận hành danh định 3.3V từ bus nguồn vệ tinh |

> [!IMPORTANT]
> **Lưu ý Chuẩn Hóa Chân LoRa & An Toàn ESP32:**
> Toàn bộ các chân kết nối module LoRa E32 bắt buộc phải tuân thủ nghiêm ngặt theo thư viện `PTITCube.h`. Các chân điều khiển ngõ ra `M0`/`M1` bắt buộc phải là chân hỗ trợ Output, không được sử dụng các chân chỉ có chiều vào (Input-Only).

| Chế độ Hoạt động | Chân M0 | Chân M1 | Chức năng Kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Mode 0 (Normal)** | `LOW` | `LOW` | Kênh truyền nhận dữ liệu trong suốt bình thường qua cổng UART |
| **Mode 1 (Wake-up)**| `HIGH` | `LOW` | Tự động chèn thêm mã Preamble dài để đánh thức máy thu đối phương |
| **Mode 2 (Power Save)**| `LOW`| `HIGH`| Chế độ tiết kiệm điện năng, chỉ thức dậy khi phát hiện sóng đánh thức |
| **Mode 3 (Sleep/Config)**| `HIGH`| `HIGH`| Chế độ ngủ sâu; dùng để đọc/ghi thanh ghi cấu hình tần số và tốc độ baud |

- **Chân Trạng thái `AUX` (Auxiliary Indicator):**
  - Chân ngõ ra báo trạng thái bận của module:
    - Mức `LOW`: Module đang bận truyền dữ liệu ra ăng-ten hoặc bộ đệm FIFO nội bộ đang nạp dữ liệu.
    - Mức `HIGH`: Module rảnh rỗi, sẵn sàng nhận dữ liệu mới từ vi điều khiển.
  - Phần mềm bay bắt buộc phải kiểm tra `digitalRead(AUX_PIN) == HIGH` trước khi gửi byte tiếp theo qua UART.

### 3. Cấu Hình Tham Số Hoạt Động Bằng Trang Web Cấu Hình PTITCube RF Configurator
Nhằm tối ưu hóa quy trình cấu hình trên mọi nền tảng hệ điều hành (Windows, macOS, Linux) mà không cần cài đặt bất kỳ phần mềm máy tính trung gian nào, toàn bộ quá trình đọc và ghi tham số cho các module thu phát LoRa dòng E32 (Ebyte) và AS32 (Ashining) được thực hiện trực tiếp trên trình duyệt thông qua **Trang Web Cấu Hình PTITCube RF Configurator** (truy cập tại: `https://ptitcube.github.io/RF-Setting-Web/`).

#### a. Công nghệ Giao Tiếp Web Serial API
- Trang web ứng dụng tiêu chuẩn công nghệ **Web Serial API** trên các trình duyệt web hiện đại (Google Chrome, Microsoft Edge, Opera), cho phép trang web kết nối trực tiếp hai chiều với cổng COM ảo của mạch nạp USB-to-UART.
- Người dùng chỉ cần cắm mạch nạp USB nối với module LoRa, chọn cổng kết nối trên trình duyệt và thiết lập tốc độ truyền thông cấu hình danh định của module ở Mode 3 là **9600 bps** (8N1).

#### b. Yêu Cầu Kết Nối Phần Cứng Khi Cấu Hình
- **Chân Chọn Chế Độ:** Module LoRa bắt buộc phải được chuyển sang **Mode 3 (Sleep / Config Mode)**:
  - Chân `M0` nối lên mức **HIGH** (3.3V).
  - Chân `M1` nối lên mức **HIGH** (3.3V).
- **Đường Truyền UART:**
  - `TXD` của module LoRa nối vào chân `RXD` của mạch nạp USB-to-UART.
  - `RXD` của module LoRa nối vào chân `TXD` của mạch nạp USB-to-UART.
  - Cấp nguồn 3.3V hoặc 5V và nối chung Mass (`GND`).

#### c. Cấu Trúc Khung Lệnh Cấu Hình 6-Byte
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

#### d. Các Tính Năng Nổi Bật Trên Trang Web Cấu Hình
1. **Quick Presets (Cấu Hình Mẫu Nhanh):** Cung cấp sẵn các bộ thông số tối ưu cho từng kịch bản vệ tinh chỉ với một cú nhấp chuột:
   - *CubeSat Telemetry Profile:* Tối ưu cân bằng giữa tầm xa và tốc độ phát viễn trắc.
   - *Long Range Mission:* Tối đa hóa độ nhạy thu để vượt qua cự ly truyền thông vũ trụ xa nhất.
   - *High-Speed Payload:* Tăng tốc độ truyền tải gói tin để tải dữ liệu tệp ảnh.
2. **Interactive Hardware Visualizer:** Hiển thị sơ đồ đồ họa trực quan trạng thái gạt chân jumper `M0`, `M1` và các chân nối dây trên kit thật, giúp hạn chế tối đa nhầm lẫn phần cứng.
3. **Packet Tester (Kiểm Tra Gói Tin Thực Nghiệm):** Hỗ trợ gửi/nhận dữ liệu kiểm thử trực tiếp trên web theo cả dạng văn bản (ASCII) và chuỗi Hex.
4. **Arduino C++ Code Generator:** Tự động sinh mã nguồn khởi tạo thư viện C++ tương thích với mã cấu hình vừa tạo để sao chép thẳng vào dự án PlatformIO / Arduino IDE.
