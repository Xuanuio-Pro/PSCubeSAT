# Doc 0.2: Kiến trúc Hệ thống Vệ tinh 1U & 6 Phân hệ Cốt lõi

### 1. Kiến trúc Hệ thống Phân rã theo Khối Chức năng
Một vệ tinh CubeSat là một hệ sinh thái cơ điện tử phức tạp thu nhỏ. Hệ thống được chia tách thành hai nhóm lớn:
1. **Hệ thống Nền tảng (Bus System):** Tập hợp các phân hệ kỹ thuật cơ bản chịu trách nhiệm duy trì sự sống, cung cấp năng lượng, bảo vệ cơ học, xử lý lệnh và duy trì liên lạc với Trái Đất.
2. **Tải trọng Sứ mệnh (Payload):** Thiết bị hoặc cảm biến chuyên dụng phục vụ mục tiêu khoa học, thương mại hoặc thử nghiệm công nghệ cụ thể của chuyến bay (ví dụ: camera chụp ảnh bề mặt, máy thu tín hiệu hàng hải AIS/ADS-B, cảm biến đo bức xạ hoặc mô-đun phát hiện cháy rừng).

```mermaid
flowchart TD
    subgraph CubeSat_Architecture ["🛰️ KIẾN TRÚC PHÂN HỆ VỆ TINH CUBESAT 1U"]
        direction TB
        
        subgraph BUS ["HỆ THỐNG NỀN TẢNG (BUS SYSTEM)"]
            EPS["⚡ Phân hệ Năng lượng (EPS)
Pin quang điện, Pin sạc Li-Po,
Bộ sạc TP4056 & Mạch giám sát MAX17048"]
            
            OBC_CDH["🧠 Phân hệ Máy tính & C&DH
Vi điều khiển lõi kép ESP32,
RTOS Scheduler & Thẻ nhớ MicroSD FAT32"]
            
            COM["📡 Phân hệ Truyền thông (COM)
Module thu phát vô tuyến LoRa 433 MHz,
Anten monopole 1/4 bước sóng"]
            
            STR["🏗️ Phân hệ Cấu trúc Cơ khí (STR)
Khung nhôm Al 6061-T6, ray trượt Anodized,
Cọc đồng PC/104 & Công tắc hành trình"]
            
            ADCS["🧭 Phân hệ Xác định & Điều khiển Tư thế (ADCS)
Cảm biến quán tính 6-DoF MPU6500,
Từ kế 3 trục QMC5883L & Động cơ rung tạo lực"]
        end
        
        subgraph PAYLOAD ["TẢI TRỌNG SỨ MỆNH (PAYLOAD)"]
            CAM["📷 Tải trọng Viễn thám
Camera OV2640 2MP JPEG,
Module định vị toàn cầu GNSS L76X"]
            ENV["🌡️ Cảm biến Môi trường Khí quyển
Cảm biến áp suất khí quyển & nhiệt độ BMP280"]
        end
        
        EPS -->|Đường nguồn 3.3V & 5V ổn áp| OBC_CDH
        EPS -->|Đường nguồn 3.3V & 5V ổn áp| COM
        EPS -->|Đường nguồn 3.3V & 5V ổn áp| ADCS
        EPS -->|Đường nguồn 3.3V & 5V ổn áp| PAYLOAD
        
        OBC_CDH <-->|Bus I2C (SDA / SCL)| EPS
        OBC_CDH <-->|Bus I2C (SDA / SCL)| ADCS
        OBC_CDH <-->|Bus I2C (SDA / SCL)| ENV
        OBC_CDH <-->|Bus UART (TX / RX)| COM
        OBC_CDH <-->|Bus UART (TX / RX)| CAM
        OBC_CDH <-->|Bus SPI (MOSI/MISO/SCK/CS)| OBC_CDH
    end
```

---

### 2. Chi tiết Chức năng & Thông số 6 Phân hệ Cốt lõi

#### 1. Phân hệ Xử lý & Quản lý Dữ liệu Lệnh (OBC / C&DH)
- **Hạt nhân Xử lý:** Sử dụng vi điều khiển 32-bit lõi kép **ESP32-WROOM-32** (kiến trúc Xtensa LX6) với xung nhịp danh định lên tới 240 MHz, bộ nhớ 520 KB SRAM nội bộ và 4 MB SPI Flash lưu trữ chương trình điều khiển.
- **Vai trò:**
  - Thực thi máy trạng thái nhiệm vụ (Mission Finite State Machine - FSM).
  - Thu thập định kỳ dữ liệu viễn trắc sinh tồn (Housekeeping Telemetry).
  - Giải mã và kiểm tra bản quyền các gói tin viễn lệnh (Telecommand) từ trạm mặt đất gửi lên.
  - Quản lý nhật ký dữ liệu bay (Flight Log) trên thẻ nhớ microSD định dạng FAT32 qua giao tiếp SPI tốc độ cao.
  - Giám sát sức khỏe hệ thống và kích hoạt cơ chế tự phục hồi lỗi FDIR khi có sự cố.

#### 2. Phân hệ Năng lượng Điện (EPS - Electrical Power System)
- **Thành phần:**
  - **Nguồn Thu:** 4 bề mặt ngoài của CubeSat gắn các cell pin mặt trời đơn tinh thể (Monocrystalline Solar Cells) với hiệu suất chuyển đổi quang điện khoảng 19 - 22%.
  - **Nguồn Lưu trữ:** 1 pack pin sạc Lithium-Polymer (Li-Po) đơn cell dung lượng $1200 - 2000\text{ mAh}$, điện áp danh định 3.7V (ngắt xả an toàn ở 3.0V, sạc đầy ở 4.2V).
  - **Mạch Quản lý Sạc:** IC sạc chuyên dụng **TP4056** điều khiển thuật toán sạc hai giai đoạn CC/CV (Constant Current / Constant Voltage) với dòng sạc danh định 1000 mA kèm cảm biến nhiệt điện trở NTC giám sát quá nhiệt pin.
  - **Mạch Chuyển đổi Nguồn DC-DC:** Bộ chuyển đổi giảm áp Buck hiệu suất cao (> 90%) hạ điện áp biến thiên của pin (3.0 - 4.2V) xuống đường nguồn ổn định 3.3V (cấp cho MCU, cảm biến I2C) và bộ chuyển đổi tăng áp Boost 5.0V (cấp cho module LoRa, GPS).
  - **Mạch Giám sát Nhiên liệu (Fuel Gauge):** Chip giám sát **MAX17048** đo chính xác điện áp pin và tính toán phần trăm dung lượng còn lại (State of Charge - SOC) theo thuật toán ModelGauge độc quyền qua giao tiếp I2C, không cần điện trở shunt gây tổn hao năng lượng.

#### 3. Phân hệ Cảm biến & Tải trọng Sứ mệnh (Sensors & Payload)
- **Cảm biến Khí quyển BMP280:** Cảm biến áp suất vi cơ điện tử MEMS của Bosch, dải đo áp suất 300 - 1100 hPa, dải nhiệt độ -40°C đến +85°C. OBC sử dụng công thức khí áp chuẩn quốc tế (ICAO Barometric Formula) để suy ra độ cao khí quyển tương đối:
$$h = 44330 \cdot \left[1 - \left(\frac{P}{P_0}\right)^{0.1903}\right]$$
- **Cảm biến Quán tính 6-DoF MPU6500:** Tích hợp 3 trục gia tốc kế (Accelerometer) đo gia tốc thẳng và 3 trục con quay hồi chuyển (Gyroscope) đo vận tốc góc quay quanh 3 trục $X, Y, Z$. Đặt gần trọng tâm vệ tinh để giảm thiểu gia tốc quán tính ký sinh.
- **Cảm biến Từ trường QMC5883L:** Từ kế 3 trục độ nhạy cao đo cường độ từ trường Trái Đất ($B_x, B_y, B_z$), giúp OBC tính toán góc phương vị La bàn (Heading):
$$\text{Heading} = \text{atan2}(B_y, B_x) \cdot \frac{180}{\pi}$$
- **Module Định vị Toàn cầu GNSS L76X:** Bắt sóng đồng thời hệ thống định vị GPS (Mỹ) và GLONASS (Nga), xuất các câu tin chuẩn NMEA 0183 (như bản tin tọa độ phẳng GPRMC và bản tin độ cao geoid GPGGA) qua cổng UART ở tốc độ 9600 bps.
- **Tải trọng Viễn thám Camera OV2640:** Cảm biến ảnh CMOS độ phân giải 2 Megapixel (1600 × 1200 pixel), tích hợp bộ nén ảnh phần cứng chuẩn JPEG giúp giảm dung lượng tệp ảnh xuống còn $20 - 50\text{ KB}$, phù hợp để truyền tải qua kênh vô tuyến băng thông hẹp.

#### 4. Phân hệ Truyền thông Viễn thông (COM - Communication Subsystem)
- **Phần cứng Thu phát:** Module vô tuyến công nghệ trải phổ **LoRa (Long Range) Ebyte E32**, hoạt động ở băng tần UHF 433 MHz (công suất phát cực đại 20 dBm ≈ 100 mW hoặc bản mở rộng 30 dBm ≈ 1 W).
- **Công nghệ Điều chế:** Kỹ thuật trải phổ Chirp Spread Spectrum (CSS) mang lại độ nhạy thu tín hiệu cực kỳ ấn tượng (xuống tới -138 dBm), cho phép giải mã thành công tín hiệu yếu bị chìm sâu dưới ngưỡng sàn nhiễu nhiệt (Noise floor) mà các bộ điều chế FSK/OOK truyền thống hoàn toàn bất lực.
- **Hệ thống Anten:** Anten đơn cực (Monopole) dài $1/4$ bước sóng (λ/4). Với tần số f = 433 MHz:
$$\lambda = \frac{c}{f} = \frac{3 \times 10^8\text{ m/s}}{433 \times 10^6\text{ Hz}} \approx 0.6928\text{ m} = 69.28\text{ cm} \implies L_{\text{anten}} = \frac{\lambda}{4} \approx 17.32\text{ cm}$$
  Anten được chế tạo từ lá thước cuộn thép lò xo đàn hồi (Spring steel tape measure), có thể cuộn tròn gọn ghẽ bên trong khoang thân và tự động bật thẳng bung ra ngoài nhờ lực đàn hồi cơ học sau khi rời khỏi ống phóng.

#### 5. Phân hệ Kết cấu Cơ khí (Structure Subsystem)
- **Vật liệu Chế tạo:** Khung sườn hộp được phay CNC chính xác từ hợp kim nhôm hàng không vũ trụ **Al 6061-T6** (hoặc Al 7075-T6). Nhôm 6061-T6 có tỷ số độ bền trên khối lượng rất cao, khả năng gia công hoàn hảo và tính dẫn nhiệt tốt ($k \approx 167\text{ W/(m}\cdot\text{K)}$) giúp truyền dẫn nhiệt lượng từ các bo mạch bên trong ra vỏ ngoài.
- **Tiêu chuẩn Ngăn xếp Bo mạch (PC/104):** Các bo mạch in phân hệ có kích thước vuông chuẩn 90 × 96 mm, được định vị xếp chồng song song lên nhau thông qua 4 cọc đồng lục giác (Standoffs) chiều cao tiêu chuẩn 16 mm và bắt chặt bằng bu-lông ren Inox không gỉ A2-70.
- **Keo Khóa Ren (Threadlocker):** Rung động âm học khốc liệt khi phóng tên lửa (tần số $20 - 2000\text{ Hz}$, gia tốc lên tới 15 g) dễ làm các ốc vít bị nới lỏng tự tháo. Toàn bộ các mối ghép bu-lông bắt buộc phải được nhỏ keo khóa ren kỵ khí độ thoát khí thấp (như Loctite 222 hoặc Loctite 242).

#### 6. Phân hệ Điều khiển & Ổn định Tư thế (ADCS)
- **Nhiệm vụ:** Sau khi tách khỏi ống phóng, vệ tinh thường bị xoay tròn tự do không kiểm soát (Tumbling) với vận tốc góc có thể lên tới vài chục độ/giây. ADCS chịu trách nhiệm dập tắt chuyển động quay (Detumbling) và định hướng thân vệ tinh về hướng mong muốn (hướng anten về trạm mặt đất hoặc hướng tấm pin về Mặt Trời).
- **Trên Bộ Kit Giáo dục PTITCube:**
  - **Xác định Tư thế:** Thu thập dữ liệu từ cảm biến quán tính 6 trục MPU6500 và từ kế QMC5883L, nạp vào thuật toán bộ lọc bù (Complementary Filter) hoặc thuật toán định hướng Mahony/Madgwick để ước lượng bộ ba góc tư thế Euler: góc lắc ngang (**Roll**), góc ngẩng (**Pitch**) và góc phương vị hướng (**Yaw**).
  - **Cơ cấu Chấp hành Thực nghiệm:** Trang bị động cơ rung lệch tâm (ERM - Eccentric Rotating Mass) và còi chip âm báo. Khi mô phỏng điều khiển tư thế trên lab, OBC kích hoạt xung điều chế độ rộng PWM điều khiển động cơ rung để sinh ra mô-men phản lực cơ học tương ứng, minh họa trực quan nguyên lý ổn định tư thế bằng bánh đà phản lực (Reaction Wheel).
