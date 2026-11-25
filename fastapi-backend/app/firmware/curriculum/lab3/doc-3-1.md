# Doc 3.1: SPI và hệ thống tệp FAT32 trên microSD

### 1. Lưu trữ dữ liệu trên vệ tinh
Phân hệ xử lý dữ liệu và lệnh (C&DH) quản lý thông tin trên CubeSat. Trong mỗi vòng quỹ đạo 95 phút, vệ tinh chỉ liên lạc với trạm mặt đất khoảng 8–12 phút. Thời gian còn lại, phân hệ C&DH phải:
- **Lưu trữ dữ liệu viễn trắc liên tục:** Ghi lại toàn bộ hành trình điện áp, dòng điện, nhiệt độ, tư thế quán tính và tọa độ vào thẻ nhớ MicroSD.
- **Lưu trữ dữ liệu sứ mệnh:** Lưu ảnh và số liệu quan trắc để gửi về trạm mặt đất.
- **Ghi nhật ký sự kiện:** Lưu thời điểm cảnh báo, lỗi vi xử lý và các lần phục hồi hệ thống.

![Sơ đồ nối bus SPI hai chiều](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab3_spi_connection.png)

### 2. Giao thức SPI
Chuẩn **SPI** truyền dữ liệu đồng bộ qua bốn dây, cho phép gửi và nhận đồng thời:
- **SCLK / SCK:** Xung nhịp do thiết bị chủ tạo; tốc độ có thể đạt 20–40 MHz.
- **MOSI:** Dữ liệu từ thiết bị chủ đến thiết bị phụ.
- **MISO:** Dữ liệu từ thiết bị phụ về thiết bị chủ.
- **CS / SS:** Chọn thiết bị phụ, tích cực ở mức `LOW`. Mỗi thiết bị cần một chân CS riêng.
- **Bốn chế độ SPI:** Được xác định bởi CPOL (cực tính xung) và CPHA (pha xung):
  - **Mode 0 (CPOL=0, CPHA=0):** Xung nhịp ở mức `LOW` khi rảnh; lấy mẫu ở cạnh lên và đổi dữ liệu ở cạnh xuống. MicroSD dùng chế độ này.
  - **Mode 1 (CPOL=0, CPHA=1):** Xung nhịp rảnh ở mức `LOW`. Dữ liệu được dịch chuyển ở cạnh lên và lấy mẫu ở cạnh xuống.
  - **Mode 2 (CPOL=1, CPHA=0):** Xung nhịp rảnh ở mức `HIGH`. Dữ liệu được lấy mẫu ở cạnh xuống và dịch chuyển ở cạnh lên.
  - **Mode 3 (CPOL=1, CPHA=1):** Xung nhịp rảnh ở mức `HIGH`. Dữ liệu được dịch chuyển ở cạnh xuống và lấy mẫu ở cạnh lên.

### 3. Thẻ nhớ và hệ thống tệp FAT32
- **Ghi dữ liệu:** Bộ nhớ flash NAND của MicroSD ghi theo các cung từ 512 byte. Thư viện gom các cung từ thành cụm lưu trữ.
- **Đệm RAM:** Lệnh `file.print()` hoặc `file.write()` ghi dữ liệu vào bộ đệm 512 byte của ESP32. Khi bộ đệm đầy, dữ liệu được gửi qua SPI.
- **Tầm quan trọng Cốt tử của hàm `file.flush()` và `file.close()`:**
  - Nếu nguồn sụt áp hoặc Watchdog Timer khởi động lại hệ thống trước khi bộ đệm được ghi, dữ liệu chưa lưu sẽ mất.
  - Nếu bảng phân bổ tệp FAT chưa cập nhật kích thước mới, tệp có thể bị hỏng.
  - **Quy tắc:** Gọi `file.flush()` sau mỗi chu kỳ ghi để đẩy dữ liệu trong bộ đệm xuống thẻ.
