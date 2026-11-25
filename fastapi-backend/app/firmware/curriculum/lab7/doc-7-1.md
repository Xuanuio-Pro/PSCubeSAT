# Doc 7.1: Thách thức khi tích hợp CubeSat 1U

### 1. Tổng quan tích hợp hệ thống
Giai đoạn tích hợp kết nối các phân hệ phần cứng và phần mềm (OBC, EPS, C&DH, cảm biến, COM, khung cơ khí) thành một **hệ thống vệ tinh tự chủ và đồng bộ** để vận hành trong môi trường không gian.

Khi nhồi nhét tất cả các phân hệ vào không gian chật hẹp của khối lập phương 1U (10 × 10 × 11.35 cm), kỹ sư tích hợp phải đối mặt và giải quyết đồng thời 5 thách thức kỹ thuật lớn:

![5 thách thức tích hợp hệ thống CubeSat](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab7_integration_challenges.png)

### 2. Giải pháp cho năm thách thức
1. **Giải quyết Xung đột Bus I2C/SPI:**
   - *Vấn đề:* Bus I2C là tài nguyên dùng chung nối tiếp; nếu hai tác vụ phần mềm cùng truy cập đồng thời sẽ làm vỡ khung truyền tin và treo cứng cảm biến.
   - *Giải pháp:* Dùng khóa **Mutex (`xI2CMutex`)** trong FreeRTOS với cơ chế thừa kế ưu tiên. Tác vụ phải lấy khóa bằng `xSemaphoreTake` trước khi đọc cảm biến và nhả bằng `xSemaphoreGive` sau khi hoàn tất.
2. **Khắc phục Nhiễu Tương thích Điện từ (EMI Nội bộ):**
   - *Vấn đề:* Bộ phát sóng LoRa công suất cao (100 mW) và xung nhịp camera 20 MHz phát xạ điện từ làm giảm độ nhạy máy thu GPS.
   - *Giải pháp:* Nối mass hình sao, bọc các đường RF bằng màng đồng và dùng IC 74HC4066 để ngắt camera khi định vị GPS.
3. **Chống Sụt áp Nguồn (Brownout Mitigation):**
   - *Vấn đề:* Nếu camera nạp điện (250 mA), thẻ nhớ ghi khối (100 mA) và LoRa phát sóng (120 mA) cùng xảy ra trong 1 mili-giây, tổng dòng đỉnh vượt quá 500 mA sẽ làm sụt áp pin xuống dưới 2.7V gây sập nguồn OBC.
   - *Giải pháp:* Giãn cách thời điểm bật các tải công suất cao và dùng tụ lọc Tantalum dung lượng lớn.
4. **Quản lý Cân bằng Nhiệt Toàn diện:**
   - *Vấn đề:* Trong chân không, nhiệt lượng sinh ra từ OBC và mạch phát sóng bị giữ lại bên trong khung.
   - *Giải pháp:* Dùng bề mặt Anodize đen và cầu nhiệt kim loại để truyền nhiệt ra khung, giữ nhiệt độ pin trong khoảng 0–45°C.
5. **Tính Tất định Thời gian thực & Ngăn ngừa Deadlock:**
   - *Vấn đề:* Phần mềm xử lý đồng thời nhiều luồng tín hiệu: đọc cảm biến 10 Hz, ghi thẻ nhớ 1 Hz, phát beacon mỗi 30 giây và nhận lệnh vô tuyến. Thiết kế khóa không hợp lý có thể gây bế tắc.
   - *Giải pháp:* Thiết kế cấu trúc phân cấp khóa tài nguyên cố định và áp dụng kỹ thuật FreeRTOS Queue truyền dữ liệu bất đồng bộ.
