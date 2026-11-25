# Doc 7.2: Kiến trúc phần mềm bay và máy trạng thái

### 1. Các lớp phần mềm bay
Để hệ thống phần mềm có tính module hóa cao, dễ kiểm thử và độc lập phần cứng, phần mềm bay được tổ chức theo 5 tầng phân cấp:
1. **Tầng trừu tượng phần cứng (HAL):** Cung cấp giao diện cho GPIO, ADC, PWM, UART, I2C và SPI.
2. **Tầng trình điều khiển:** Điều khiển các IC như BMP280, MPU6500, MAX17048, LoRa E32 và MicroSD.
3. **Tầng hệ điều hành:** FreeRTOS quản lý tác vụ, hàng đợi, bộ định thời và khóa Mutex.
4. **Tầng dịch vụ:** Xử lý lệnh, đóng khung dữ liệu, ghi thẻ nhớ và giám sát hệ thống.
5. **Tầng ứng dụng:** Máy trạng thái sứ mệnh (FSM) điều khiển chế độ hoạt động của vệ tinh.

### 2. Máy trạng thái sứ mệnh
Phần mềm bay được điều khiển bởi máy trạng thái hữu hạn (FSM):

![Máy trạng thái nhiệm vụ bay CubeSat FSM](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab7_mission_fsm.png)

### 3. Sáu trạng thái bay
- **`STATE_BOOT`:**
  - Khởi động hệ thống, kiểm tra ngoại vi, khôi phục tham số từ NVS.
  - Chờ **30 phút im lặng vô tuyến** theo quy định của ITU trước khi bung ăng-ten và phát sóng.
- **`STATE_DETUMBLE`:**
  - Giảm tốc độ xoay hỗn loạn sinh ra khi rời ống phóng xuống dưới 5°/s bằng thuật toán điều khiển từ tính B-dot và thanh giảm chấn trễ từ.
- **`STATE_NORMAL_OPS`:**
  - Vận hành quỹ đạo tiêu chuẩn: Định kỳ thu thập dữ liệu cảm biến (10Hz), ghi nhật ký thẻ nhớ SD (1Hz), phát gói tin Beacon (mỗi 30-60s) và lắng nghe lệnh viễn lệnh từ trạm mặt đất.
- **`STATE_PAYLOAD_EXEC`:**
  - Kích hoạt tải trọng camera chụp ảnh viễn thám Trái Đất, nén JPEG và phân mảnh tệp dữ liệu. Chỉ cho phép kích hoạt khi dung lượng pin $\text{SOC} > 60\%$ và nhiệt độ nằm trong dải an toàn.
- **`STATE_POWER_SAVE`:**
  - Khi pin yếu ($V_\text{bat} < 3.55\text{ V}$, $\text{SOC} < 25\%$), hệ thống tắt camera và GPS, giãn chu kỳ phát beacon lên 120 giây, giảm xung CPU xuống 80 MHz.
- **`STATE_SAFE_MODE`:**
  - Chế độ phòng thủ sống còn khi xảy ra sự cố nghiêm trọng (pin chạm đáy $< 3.4\text{V}$ hoặc cảm biến báo lỗi liên tục), chỉ duy trì nguồn tối thiểu cho bộ thu lệnh vô tuyến để chờ lệnh giải cứu từ mặt đất.
