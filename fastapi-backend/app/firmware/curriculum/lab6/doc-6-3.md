# Doc 6.3: Tiêu Chuẩn Ngăn Xếp PC/104, Chốt Khóa Ren & Cân Bằng Trọng Tâm CoM

### 1. Kiến trúc Ngăn xếp Bo Mạch Chuẩn PC/104
Bên trong lòng khối lập phương 1U, các tầng bo mạch điện tử (OBC, EPS, Cảm biến, COM) được xếp chồng lên nhau theo chuẩn kết cấu công nghiệp **PC/104**:
- **Kích thước Bo mạch Chuẩn:** 90.17 × 95.89 mm với 4 lỗ bắt bu lông ở 4 góc đối xứng.
- **Trụ Ren Cách Tầng (Standoffs):** Các tầng bo mạch được cách ly khoảng cách bằng các trụ lục giác kim loại bằng đồng hoặc nhôm (chiều cao tiêu chuẩn 15.0 mm).
- **Thanh Ren Chịu Lực Xâu Suốt (Threaded Rods):** Sử dụng 4 thanh ren bằng thép không gỉ Inox M3 xâu xuyên suốt từ tấm đáy lên tấm nóc của khung, kẹp chặt toàn bộ khối bo mạch thành một khối vững chắc nguyên khối (Monolithic Block), phân tán đều ứng suất rung động của tên lửa đẩy.

### 2. Bu lông Inox A2-70, Keo Khóa Ren Loctite 222 & Bu lông Thông Hơi
- **Cấp bền Bu lông Inox A2-70:** Chế tạo bằng thép không gỉ austenit AISI 304, giới hạn bền kéo tối thiểu 700 MPa.
- **Keo Khóa Ren Chuyên dụng Không gian Loctite 222 (Tím / Low Strength):** Rung động tần số cao của tên lửa dễ làm nới lỏng các vòng ren cơ khí. Tất cả các mối ghép ren bắt buộc phải được tra keo khóa kỵ khí Loctite 222. Keo tự đông cứng khi không có không khí giữa các khe ren kim loại, khóa chặt bu lông không bị xoay lỏng nhưng vẫn cho phép kỹ sư tháo mở bằng dụng cụ cầm tay khi cần sửa chữa trong phòng lab.
- **Bu lông Thông Hơi (Drilled-core Vented Screws):**
  - Khi vặn một bu lông thông thường vào một lỗ ren kín đáy (Blind Hole), một lượng không khí khí quyển bị nén chặt ở đáy lỗ ren.
  - Khi đưa vệ tinh vào buồng thử nghiệm chân không nhiệt (TVAC), lượng khí nén này sẽ rò rỉ cực kỳ chậm chạp qua các khe hở vi mô của đường ren ra ngoài (hiện tượng **Rò rỉ ảo - Virtual Leak**), khiến buồng thử nghiệm không bao giờ đạt được mức chân không mong muốn và làm sai lệch kết quả đo.
  - Bu lông thông hơi được khoan một lỗ rỗng siêu nhỏ xuyên suốt tâm dọc trục bu lông, cho phép toàn bộ không khí ở đáy lỗ ren thoát ra ngay lập tức khi buồng hút chân không.

```mermaid
flowchart LR
    VENT["Lỗ Khoan Xuyên Tâm Dọc Trục Bu lông (Vented Hole)"]
    BLIND["Đáy Lỗ Ren Kín (Blind Hole) Bị Kẹt Khí"]
    
    BLIND -->|Khí Thoát Tự Do Qua Tâm Ốc| VENT
    VENT -->|"Triệt tiêu Hoàn toàn Hiện tượng Rò rỉ Ảo (Virtual Leak)"| VACUUM["Không gian Chân không Siêu cao TVAC"]
```

### 3. Bảng Cân Đối Khối Lượng (Mass Budget) & Cân Bằng Trọng Tâm (Center of Mass - CoM)
- **Bảng Cân đối Khối lượng (Mass Budget):** Tổng khối lượng của một CubeSat 1U bị khống chế nghiêm ngặt không được vượt quá 1.330 kg (hoặc 2.000 kg). Trong giai đoạn thiết kế, kỹ sư phải duy trì một biên độ khối lượng dự phòng (**Mass Margin** ≥ 15 - 20%) để bù đắp cho sự tăng khối lượng thực tế của dây dẫn, màng bọc và keo dán trong quá trình lắp ráp.
- **Quy chuẩn Trọng tâm CoM Khắt khe:**
  - Tiêu chuẩn CalPoly quy định: Vị trí trọng tâm thực tế của CubeSat 1U không được phép lệch quá **±2.0 cm (±20 mm)** so với tâm hình học lý thuyết của khối lập phương trên cả 3 trục $X, Y, Z$:
$$|X_\text{cm}| \le 20\text{ mm}, \quad |Y_\text{cm}| \le 20\text{ mm}, \quad |Z_\text{cm}| \le 20\text{ mm}$$
  - Nếu trọng tâm bị lệch quá giới hạn, khi lò xo P-POD đẩy vào mặt đáy vệ tinh, lực đẩy không đi qua trọng tâm sẽ tạo ra một mô-men ngẫu lực (Tip-off Torque) cực lớn, khiến vệ tinh bị quay lộn vòng hỗn loạn với vận tốc góc hàng trăm độ trên giây ngay khi vừa rời ống phóng, gây tê liệt hệ thống ăng-ten và pin mặt trời.
