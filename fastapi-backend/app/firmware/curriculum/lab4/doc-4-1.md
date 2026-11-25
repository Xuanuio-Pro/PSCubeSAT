# Doc 4.1: Giao thức I2C và mạng cảm biến

### 1. Vai trò của cảm biến và tải trọng
Phân hệ Cảm biến đóng vai trò là "Giác quan" của vệ tinh CubeSat, cho phép vệ tinh cảm nhận được các thông số vật lý của bản thân và môi trường quỹ đạo:
- **Theo dõi môi trường:** Đo áp suất và nhiệt độ bên trong khung để phát hiện rò khí hoặc quá nhiệt.
- **Xác định tư thế:** Đo vận tốc góc và gia tốc bằng IMU 6 trục để hỗ trợ giảm tốc độ quay.
- **Định vị và thời gian:** Cung cấp tọa độ, độ cao và thời gian UTC cho các phép đo.
- **Chụp ảnh:** Ghi ảnh bề mặt Trái Đất phục vụ nghiên cứu.

### 2. Nguyên lý I2C
Bus **I2C** do hãng Philips (nay là NXP) phát triển là một bus truyền thông nối tiếp đồng bộ 2 dây hai chiều, cực kỳ phổ biến trong các hệ thống vệ tinh nhỏ nhờ khả năng kết nối nhiều IC cảm biến chỉ với hai chân vi điều khiển duy nhất:
- **Hai Đường Tín hiệu:**
  - **SDA:** Đường dữ liệu hai chiều.
  - **SCL:** Xung nhịp đồng bộ do thiết bị chủ phát.
- **Ngõ ra cực thu hở và điện trở kéo lên:**
  - Các thiết bị chỉ kéo đường tín hiệu xuống mức `LOW` hoặc thả nổi.
  - Một cặp điện trở kéo lên ngoài ($R_p$, thông thường từ 2.2 kΩ đến 4.7 kΩ) bắt buộc phải được mắc từ đường SDA và SCL lên nguồn 3.3V.
  - Khi không có thiết bị nào truyền tin, điện trở kéo lên giữ cho đường bus luôn ở mức logic `HIGH`.
  - Cách mắc này cho phép nhiều thiết bị dùng chung bus mà không gây chập khi truyền đồng thời.

![Sơ đồ kết nối bus I2C đa cảm biến và điện trở kéo lên](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_i2c_connection.png)

![Trình tự giao thức đọc thanh ghi I2C](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_i2c_protocol_sequence.png)

### 3. Khung truyền và trạng thái điều khiển
1. **Điều kiện START và STOP:**
   - Trong quá trình truyền dữ liệu bình thường, đường SDA chỉ được phép thay đổi trạng thái khi SCL đang ở mức `LOW`. Khi SCL ở mức `HIGH`, đường SDA bắt buộc phải giữ ổn định.
   - **START Condition:** SDA chuyển trạng thái từ `HIGH` xuống `LOW` trong khi SCL đang ở mức `HIGH`. Báo hiệu đường bus bắt đầu bận.
   - **STOP Condition:** SDA chuyển trạng thái từ `LOW` lên `HIGH` trong khi SCL đang ở mức `HIGH`. Báo hiệu kết thúc phiên truyền tin, trả bus về trạng thái rảnh rỗi.
2. **Địa chỉ Thiết bị 7-bit & Bit R/W:**
   - Byte đầu tiên sau điều kiện START bao gồm 7 bit địa chỉ thiết bị Slave (2⁷ = 128 địa chỉ khả dĩ) và bit thứ 8 là bit chọn chiều dữ liệu:
     - Bit 8 = `0`: Thao tác Ghi dữ liệu từ Master sang Slave.
     - Bit 8 = `1`: Thao tác Đọc dữ liệu từ Slave về Master.
3. **Bit xác nhận ACK và phản hồi NACK:**
   - Trong nhịp xung SCL thứ 9, thiết bị nhận dữ liệu phải phản hồi một bit:
     - **ACK:** Kéo SDA xuống `LOW` để báo đã nhận dữ liệu.
     - **NACK:** Để SDA ở `HIGH` để báo không nhận hoặc kết thúc đọc.
4. **Kéo dãn xung nhịp:**
   - Khi một cảm biến Slave chậm chưa kịp chuẩn bị xong dữ liệu hoặc đang bận chuyển đổi ADC nội bộ, nó có quyền kéo đường SCL xuống mức `LOW`. Master phát hiện đường SCL bị giữ ở mức thấp sẽ tự động tạm dừng đồng hồ xung nhịp cho tới khi Slave nhả SCL lên mức cao mới truyền tiếp.
5. **Đọc khối dữ liệu:**
   - Hầu hết các cảm biến hiện đại (BMP280, MPU6500) đều hỗ trợ con trỏ địa chỉ tự tăng. Master chỉ cần gửi địa chỉ thanh ghi khởi đầu một lần duy nhất, sau đó phát liên tục các xung nhịp đọc; cảm biến sẽ tự động đẩy tuần tự toàn bộ mảng dữ liệu (ví dụ 14 byte từ 0x3B đến 0x48 của MPU6500) mà không cần lặp lại điều kiện START/STOP, giúp tăng tốc độ đọc dữ liệu lên gấp 5 lần.

---

### 4. Cảm biến BMP280
- **Nhà sản xuất & Địa chỉ I2C:** Bosch Sensortec. Địa chỉ I2C cấu hình bằng chân SDO: `0x76` (SDO nối GND) hoặc `0x77` (SDO nối VDD).
- **Dải Đo & Độ phân giải:** Đo áp suất khí quyển từ 300 hPa đến 1100 hPa (tương đương độ cao từ $-500\text{m}$ dưới mực nước biển đến $+9000\text{m}$ trên đỉnh Everest) với độ phân giải siêu cao 0.16 Pa và độ phân giải nhiệt độ 0.01°C.
- **Hệ số hiệu chuẩn nội bộ:**
  - Màng cảm biến áp suất gốm áp điện (Piezoresistive) có đặc tính phi tuyến tính cao theo nhiệt độ. Trong quá trình sản xuất tại nhà máy, mỗi chip BMP280 được đo kiểm riêng lẻ và nạp sẵn 24 byte hằng số hiệu chuẩn vào bộ nhớ ROM không khả biến (từ thanh ghi `0x88` đến `0xA1`: `dig_T1` đến `dig_T3` cho nhiệt độ, `dig_P1` đến `dig_P9` cho áp suất).
  - Thuật toán giải mã bắt buộc phải đọc toàn bộ mảng 24 byte hằng số này và áp dụng công thức bù trừ nhiệt độ bậc cao theo tài liệu chuẩn của Bosch để quy đổi giá trị ADC thô thành giá trị áp suất thực tế.
- **Công thức Tính Độ cao Khí quyển (Barometric Hypsometric Formula):**

$$h = 44330 \times \left[ 1 - \left(\frac{P}{P_0}\right)^{\frac{1}{5.255}} \right]$$

  Trong đó: $h$ là độ cao tính bằng mét, $P$ là áp suất khí quyển đo được, $P_0$ là áp suất chuẩn tại mực nước biển (1013.25 hPa).
