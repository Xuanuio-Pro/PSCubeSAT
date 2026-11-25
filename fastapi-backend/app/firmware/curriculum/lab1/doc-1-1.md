# Doc 1.1: ESP32-WROOM-32 và giao tiếp ngoại vi

### 1. Máy tính trên bo mạch

Máy tính trên bo mạch (OBC) điều phối các phân hệ của vệ tinh CubeSat 1U. OBC thực hiện các nhiệm vụ sau:

1. **Khởi động:** Đọc cấu hình từ ROM/Flash, kiểm tra ngoại vi và bắt đầu thời gian im lặng vô tuyến 30 phút sau khi công tắc hành trình phóng nhả.
2. **Thu thập dữ liệu:** Định kỳ đọc thông số EPS (điện áp, dòng sạc/xả, dung lượng pin, nhiệt độ cell), cảm biến (áp suất khí quyển, gia tốc, vận tốc góc, từ trường Trái Đất, tọa độ GPS) và trạng thái kết cấu; đóng gói thành bản tin nhị phân Beacon.
3. **Xử lý lệnh:** Nhận gói tin từ trạm mặt đất qua phân hệ COM, giải mã `Opcode` và `Payload`, xác thực `Security Token`, rồi thực hiện lệnh như chụp ảnh, đổi chu kỳ phát Beacon, bật/tắt cảm biến hoặc nạp lại tham số quỹ đạo.
4. **Lưu trữ:** Ghi dữ liệu cảm biến, ảnh viễn thám và nhật ký bay vào microSD qua SPI, dùng định dạng FAT32.
5. **Giám sát và phục hồi:** Theo dõi nhịp tim, làm mới Watchdog Timer và khởi động lại phần mềm hoặc cấp nguồn lại khi phát hiện bus bị treo do bức xạ.

![Kiến trúc phần cứng OBC ESP32](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_obc_architecture.png)

---

### 2. Thông số ESP32-WROOM-32

Bộ kit PTITCube dùng vi điều khiển **ESP32-WROOM-32** của Espressif Systems. Chip có kiến trúc 32-bit, bộ nhớ tích hợp và hỗ trợ FreeRTOS.

| Khối | Thông số | Ứng dụng |
| :--- | :--- | :--- |
| **Kiến trúc lõi** | Hai lõi Tensilica Xtensa 32-bit LX6 | Có thể tách tác vụ mạng ở Core 0 và thuật toán bay ở Core 1. |
| **Tần số xung nhịp** | 80, 160 hoặc tối đa 240 MHz | Hỗ trợ xử lý ma trận tư thế 3D và ảnh JPEG. |
| **SRAM** | $520\text{ KB}$ ($512\text{ KB}$ khả dụng) | $192\text{ KB}$ IRAM cho mã; $328\text{ KB}$ DRAM cho dữ liệu, DMA và ngăn xếp. |
| **Flash ngoài** | 4 MB hoặc 16 MB, Quad-SPI | Lưu chương trình, bảng phân vùng và SPIFFS/LittleFS. |
| **Bộ đồng xử lý ULP** | FSM tiết kiệm điện | Đọc cảm biến và theo dõi pin khi hai lõi CPU ở chế độ Deep Sleep. |
| **ADC** | 2 bộ SAR 12-bit, tối đa 18 kênh | Đo điện áp và tín hiệu tương tự với độ phân giải $4096$ mức. |
| **Giao tiếp nối tiếp** | 3 UART, 2 I2C, 3 SPI, 2 I2S, 1 CAN | Hỗ trợ các giao thức công nghiệp. |
| **Không dây** | Wi-Fi 802.11 b/g/n 2.4 GHz; Bluetooth 4.2 BR/EDR/BLE | Truyền dữ liệu tầm gần và kết nối Web LMS. |
| **Điện áp hoạt động** | 3.0–3.6 V; khuyến nghị 3.3 V | Tương thích nguồn 3.3 V từ mạch Buck của pin Lithium EPS. |

---

### 3. Sơ đồ chân NodeMCU-32S (38 chân)

Module **ESP32-WROOM-32** thường được gắn trên bo mạch phát triển **NodeMCU-32S 38 chân** để thử nghiệm và tích hợp vào OBC. Ma trận GPIO cho phép gán linh hoạt nhiều tín hiệu ngoại vi; cần tuân thủ chức năng và giới hạn điện áp của từng chân.

![Sơ đồ chân đầy đủ của bo mạch ESP32 NodeMCU-32S](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab1.1_esp32.png)

#### Chức năng các chân NodeMCU-32S

| Nhóm chân | Ký hiệu | Chức năng | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Nguồn & Điều khiển** | **3V3**, **5V0**, **GND** | `3V3`: Đường nguồn ổn áp 3.3V; `5V0`: Nguồn vào/ra 5V từ cổng USB Type-C; `GND`: Mass chung hệ thống. | Nguồn cấp logic cho ESP32 tối đa 3.3V (không cấp 5V vào chân GPIO). |
| **Khởi động lại** | **EN** | Tích cực mức `HIGH`; kéo xuống `LOW` để khởi động lại chip. | Kết hợp với `GPIO0` (`IO0`) qua mạch DTR/RTS để nạp firmware tự động. |
| **Chỉ nhận tín hiệu** | **GPIO36** (`S_VP`), **GPIO39** (`S_VN`), **GPIO34** (`VDET_1`), **GPIO35** (`VDET_2`) | Các kênh ADC 12-bit `ADC1_0`, `ADC1_3`, `ADC1_6`, `ADC1_7`; thuộc vùng RTC. | Không xuất tín hiệu và không có điện trở kéo nội. Dùng đọc cảm biến analog, điện áp hoặc tín hiệu `AUX`. |
| **Cảm ứng, RTC, DAC và ADC** | **GPIO32** (`TOUCH9 / ADC1_4`), **GPIO33** (`TOUCH8 / ADC1_5`), **GPIO25** (`DAC_1`), **GPIO26** (`DAC_2`), **GPIO27** (`TOUCH7 / ADC2_7`) | Hỗ trợ I/O hai chiều, PWM, ngắt ngoài, DAC 8-bit và dao động 32 kHz. | Dùng điều khiển ngoại vi, UART1 qua ma trận GPIO hoặc PWM. `ADC2` không dùng đồng thời với Wi-Fi. |
| **Bus I2C Mặc định (Wire)** | **GPIO21** (`WIRE_SDA`), **GPIO22** (`WIRE_SCL`) | Đường dữ liệu `SDA` và xung nhịp `SCL` mặc định của thư viện `Wire.h`. | Giao tiếp chuẩn I2C với **MAX17048** (`0x36`), **BMP280** (`0x76/0x77`), **MPU6500** (`0x68`) và **GY-271** (`0x0D`). |
| **Cổng UART0** | **GPIO1** (`U0TXD / SERIAL_TX`), **GPIO3** (`U0RXD / SERIAL_RX`) | Nối với chip USB-UART CP2102 hoặc CH340. | Nạp firmware qua Web IDE và xem dữ liệu ở Serial Monitor (115200 bps). Tránh gắn tải gây xung đột mức logic. |
| **Cổng UART2 (Phần cứng)** | **GPIO17** (`TX2`), **GPIO16** (`RX2`) | Kênh truyền/nhận nối tiếp phần cứng độc lập `Serial2`. | Giao tiếp tốc độ cao với module định vị **GNSS L76X** và **Camera OV2640** thông qua IC đa hóa **74HC4066**. |
| **Bus VSPI (SPI mặc định)** | **GPIO23** (`VSPI_MOSI`), **GPIO19** (`VSPI_MISO`), **GPIO18** (`VSPI_SCK`), **GPIO5** (`VSPI_SS`) | Giao tiếp SPI tốc độ cao (tối đa 40 MHz); `GPIO5` kiêm chân strapping `SDIO`. | Kết nối khe microSD để lưu nhật ký bay và ảnh JPEG. |
| **Bus HSPI & JTAG** | **GPIO13** (`HSPI_MOSI / MTCK`), **GPIO12** (`HSPI_MISO / MTDI`), **GPIO14** (`HSPI_SCK / MTMS`), **GPIO15** (`HSPI_SS / MTDO`) | Kênh SPI thứ hai (`HSPI`) đồng thời phục vụ giao diện gỡ lỗi JTAG và ADC2 / Touch. | Trong **Lab 1** (trên bo rời): `GPIO13, 14, 15` dùng điều khiển IC dịch chốt `74HC595`. **Lưu ý:** `GPIO12` và `GPIO15` là chân Strapping nhạy cảm khi khởi động. |
| **Chân Điều khiển & Strapping** | **GPIO0** (`BOOT`), **GPIO2** (`LED`), **GPIO4** (`ADC2_0 / TOUCH0`) | I/O đa năng hỗ trợ PWM, ADC2, Touch. `GPIO2` thường gắn sẵn LED xanh trên bo; `GPIO0` nối nút `IO0/BOOT`. | Trong **Lab 1**: `GPIO2` điều khiển LED đơn, `GPIO4` đọc nút nhấn `INPUT_PULLUP`. Khi tích hợp kit: dùng điều khiển chân chọn `M0/M1`, nút nhấn hoặc tín hiệu chuyển mạch. |
| **Chân Flash Nội (! CẤM DÙNG)** | **GPIO6** (`SCK`), **GPIO7** (`D0`), **GPIO8** (`D1`), **GPIO9** (`D2`), **GPIO10** (`D3`), **GPIO11** (`CMD`) | Đường kết nối nội bộ giữa lõi ESP32 và chip nhớ **SPI Flash 4 MB** bên trong vỏ bọc kim loại. | **TUYỆT ĐỐI KHÔNG SỬ DỤNG** làm GPIO thường (cũng không dùng trực tiếp chân UART1 mặc định `GPIO9/10` mà phải remap qua GPIO Matrix). |

---

### 4. Chân Strapping và lưu ý phần cứng

ESP32 lấy mẫu mức logic trên một số chân GPIO khi tín hiệu reset chuyển từ $0$ lên $1$. Mức này quyết định chế độ khởi động:

![Luồng khởi động và chân Strapping Pin ESP32](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_strapping_flow.png)

| Tên Chân GPIO | Chức năng Strapping | Mức Logic Boot Bình thường | Mức Logic Nạp Firmware | Cảnh báo An toàn Thiết kế |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 0** | Chọn chế độ khởi động | **HIGH (kéo lên 3.3 V)** | **LOW (nối GND)** | Có điện trở kéo lên nội. Nếu bị kéo xuống khi khởi động, ESP32 vào chế độ nạp. |
| **GPIO 2** | Chọn chế độ khởi động và nạp Flash | **LOW hoặc không nối** | **LOW (nối GND)** | Thường nối với LED trên bo. Không kéo chân lên mức cao khi khởi động. |
| **GPIO 12 (MTDI)** | Chọn điện áp cho Flash nội (`VDD_SDIO`) | **LOW (3.3 V)** | **LOW (3.3 V)** | Nếu GPIO 12 bị kéo lên HIGH khi khởi động, chip đặt nguồn Flash ở 1.8 V khiến ESP32 không đọc được bộ nhớ. |
| **GPIO 15 (MTDO)** | Bật/tắt thông báo gỡ lỗi trên UART0 | **HIGH (kéo lên 3.3 V)** | **HIGH (kéo lên 3.3 V)** | Quyết định ROM Bootloader có gửi thông báo qua cổng nối tiếp ở 115200 bps hay không. |

> [!WARNING]
> **Lưu ý khi thiết kế OBC:**
>
> - Không dùng GPIO 6, 7, 8, 9, 10, 11 làm chân GPIO thông thường vì chúng nối trực tiếp với bộ nhớ SPI Flash bên trong module.
> - GPIO 34, 35, 36 (VP) và 39 (VN) chỉ nhận tín hiệu, không có điện trở kéo nội và không thể cấu hình làm ngõ ra `OUTPUT`.
