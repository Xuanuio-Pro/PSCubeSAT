# Doc 6.3: PC/104, khóa ren và cân bằng trọng tâm

### 1. Ngăn xếp bo mạch PC/104
Bên trong lòng khối lập phương 1U, các tầng bo mạch điện tử (OBC, EPS, Cảm biến, COM) được xếp chồng lên nhau theo chuẩn kết cấu công nghiệp **PC/104**:
- **Kích thước Bo mạch Chuẩn:** 90.17 × 95.89 mm với 4 lỗ bắt bu lông ở 4 góc đối xứng.
- **Trụ cách tầng:** Dùng trụ lục giác bằng đồng hoặc nhôm, cao 15 mm.
- **Thanh ren:** Luồn bốn thanh M3 bằng thép không gỉ từ đáy lên nóc để cố định cụm bo và phân tán rung động.

### 2. Bu lông, keo khóa ren và bu lông thông hơi
- **Cấp bền Bu lông Inox A2-70:** Chế tạo bằng thép không gỉ austenit AISI 304, giới hạn bền kéo tối thiểu 700 MPa.
- **Keo Khóa Ren Chuyên dụng Không gian Loctite 222 (Tím / Low Strength):** Rung động tần số cao của tên lửa dễ làm nới lỏng các vòng ren cơ khí. Tất cả các mối ghép ren bắt buộc phải được tra keo khóa kỵ khí Loctite 222. Keo tự đông cứng khi không có không khí giữa các khe ren kim loại, khóa chặt bu lông không bị xoay lỏng nhưng vẫn cho phép kỹ sư tháo mở bằng dụng cụ cầm tay khi cần sửa chữa trong phòng lab.
- **Bu lông Thông Hơi (Drilled-core Vented Screws):**
  - Khi vặn bu lông vào lỗ ren kín đáy, không khí bị giữ lại trong lỗ.
  - Khi thử nghiệm trong buồng chân không nhiệt (TVAC), khí thoát chậm qua khe ren, gây rò rỉ ảo và làm sai lệch kết quả đo.
  - Bu lông thông hơi được khoan một lỗ rỗng siêu nhỏ xuyên suốt tâm dọc trục bu lông, cho phép toàn bộ không khí ở đáy lỗ ren thoát ra ngay lập tức khi buồng hút chân không.

![Thiết kế bu-lông thông hơi chống rò rỉ ảo](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab6_vented_screw.png)

### 3. Khối lượng và trọng tâm
- **Khối lượng:** Tổng khối lượng CubeSat 1U không được vượt quá 1.330 kg (hoặc 2.000 kg). Dự phòng ít nhất 15–20% cho dây dẫn, màng bọc và keo dán phát sinh khi lắp ráp.
- **Quy chuẩn Trọng tâm CoM Khắt khe:**
  - Theo tiêu chuẩn CalPoly, trọng tâm CubeSat 1U không được lệch quá **±20 mm** so với tâm hình học trên ba trục $X, Y, Z$:

$$|X_\text{cm}| \le 20\text{ mm}, \quad |Y_\text{cm}| \le 20\text{ mm}, \quad |Z_\text{cm}| \le 20\text{ mm}$$

  - Nếu trọng tâm bị lệch quá giới hạn, khi lò xo P-POD đẩy vào mặt đáy vệ tinh, lực đẩy không đi qua trọng tâm sẽ tạo ra một mô-men ngẫu lực (Tip-off Torque) cực lớn, khiến vệ tinh bị quay lộn vòng hỗn loạn với vận tốc góc hàng trăm độ trên giây ngay khi vừa rời ống phóng, gây tê liệt hệ thống ăng-ten và pin mặt trời.
