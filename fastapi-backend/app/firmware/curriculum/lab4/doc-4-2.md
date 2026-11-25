# Doc 4.2: MPU6500, GY-271 và bộ lọc bù

### 1. Cảm biến MPU6500
- **Nhà sản xuất & Địa chỉ I2C:** InvenSense / TDK. Địa chỉ I2C là `0x68` (chân `ADO = GND`) hoặc `0x69` (chân `ADO = VCC`).
- **Cấu trúc Phần cứng:** Tích hợp một vi cơ điện tử gia tốc kế 3 trục (MEMS 3-axis Accelerometer) và con quay hồi chuyển 3 trục (MEMS 3-axis Gyroscope) trên cùng một đế silicon theo hệ trục tọa độ $X, Y, Z$ in trực tiếp trên bo mạch.
- **Thanh ghi Dữ liệu Thô:** 14 thanh ghi liên tiếp từ `0x3B` đến `0x48` chứa các giá trị số nguyên có dấu 16-bit (`int16_t`):
  - `0x3B - 0x40`: Gia tốc 3 trục $A_x, A_y, A_z$ (độ nhạy cấu hình ±2g, ±4g, ±8g, ±16g).
  - `0x41 - 0x42`: Nhiệt độ nội bộ của chip silicon.
  - `0x43 - 0x48`: Vận tốc góc 3 trục $G_x, G_y, G_z$ (độ nhạy cấu hình ±250, ±500, ±1000, ±2000°/s).

![Sơ đồ chân và trục tọa độ mô-đun IMU MPU6500](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab4.2_MPU6500.png)

#### Chân kết nối MPU6500

| Chân | Kết nối hoặc chức năng |
| :--- | :--- |
| `VCC` | Cấp 3.3 V; một số bo hỗ trợ 3.3–5 V qua IC ổn áp. |
| `GND` | Nối mass chung với OBC. |
| `SCL` | I2C: `GPIO22`; SPI: SCK. |
| `SDA` | I2C: `GPIO21`; SPI: MOSI. |
| `EDA`, `ECL` | Bus I2C phụ của MPU6500. |
| `ADO` / `AD0` | Nối GND để chọn `0x68`, VCC để chọn `0x69`; dùng làm MISO ở chế độ SPI. |
| `INT` | Báo dữ liệu mới hoặc sự kiện vượt ngưỡng. |
| `NCS` | Chọn SPI, tích cực `LOW`; kéo lên `HIGH` để dùng I2C. |
| `FSYNC` | Đồng bộ khung hình; nối GND nếu không dùng. |

### 2. Cảm biến từ trường GY-271
- **Nhà sản xuất & Địa chỉ I2C:** QST / Honeywell. Địa chỉ I2C chuẩn là `0x0D` (QMC5883L / QMC5883P) hoặc `0x1E` (HMC5883L).
- **Cấu trúc Phần cứng:** Tích hợp 3 cảm biến từ điện trở dị hướng (Anisotropic Magnetoresistive - AMR) độ nhạy cao đo cường độ từ trường Trái Đất theo 3 trục trực giao $M_x, M_y, M_z$ (đơn vị Gauss hoặc $\mu\text{T}$) tương ứng với ký hiệu mũi tên trục $X, Y, Z$ trên bo mạch.

![Sơ đồ chân và mặt linh kiện mô-đun từ kế GY-271](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab4.2_GY271.png)

#### Chân kết nối GY-271

| Chân | Kết nối hoặc chức năng |
| :--- | :--- |
| `VCC` | Cấp nguồn 3.3 V; một số bo có IC ổn áp khi dùng nguồn 5 V. |
| `GND` | Nối mass chung. |
| `SCL` | Nối chung bus I2C với MPU6500 và `GPIO22`. |
| `SDA` | Nối chung bus I2C với MPU6500 và `GPIO21`. |
| `DRDY` | Báo khi dữ liệu từ trường mới sẵn sàng. |

- **Thuật toán Tính Góc Hướng La bàn (Heading):**
  Góc hướng la bàn so với cực Bắc từ được tính bằng hàm lượng giác:

$$\text{Heading} = \text{atan2}(M_y, M_x) \cdot \frac{180}{\pi}$$

  Nếu $\text{Heading} < 0^\circ$, hiệu chỉnh: $\text{Heading} = \text{Heading} + 360^\circ$.
- **Hợp nhất Dữ liệu Quán tính 9 Bậc Tự do (9-DOF):** 
  Kết hợp gia tốc kế 3 trục (đo véc-tơ trọng trường), con quay hồi chuyển 3 trục (đo vận tốc góc) từ MPU6500 và từ kế 3 trục (đo véc-tơ từ trường Trái Đất) từ GY-271 cho phép phân hệ ADCS của vệ tinh xác định đầy đủ và ổn định cả 3 góc Euler trong không gian 3 chiều: Roll $\phi$, Pitch $\theta$ và Yaw / Heading $\psi$.
- **Chuẩn hóa Định dạng Log Serial:** Dữ liệu cảm biến được in theo từng cụm 3 trục trên một dòng (`ACCEL: ...`, `GYRO: ...`, `MAG: ...`), loại bỏ hoàn toàn các tiền tố ngoặc vuông `[...]` rườm rà.

### 3. Ước lượng tư thế bằng bộ lọc bù
Để tính toán góc nghiêng (Roll $\phi$, Pitch $\theta$) của vệ tinh, mỗi cảm biến đơn lẻ đều có nhược điểm chí mạng:
- **Gia tốc kế:** Đo véc-tơ gia tốc trọng trường $g$. Cho góc nghiêng chính xác tuyệt vời khi ở trạng thái tĩnh dài hạn, nhưng lại cực kỳ nhạy cảm với các rung động cơ học ngắn hạn và lực quán tính lúc chuyển động (Nhiễu tần số cao).
- **Con quay hồi chuyển:** Đo vận tốc góc $\omega$. Tích phân góc quay $\theta = \int \omega \, dt$ cho phản hồi nhanh nhưng sai số trôi dạt điểm không tích lũy theo thời gian.
- **Bộ lọc bù:** Kết hợp lọc thông cao cho con quay và lọc thông thấp cho gia tốc kế:

$$\theta_t = \alpha \cdot (\theta_{t-1} + \omega \cdot \Delta t) + (1 - \alpha) \cdot \theta_\text{accel}$$

  Trong đó: $\Delta t$ là chu kỳ lấy mẫu, $\alpha$ là trọng số lọc (thường chọn $\alpha = 0.96 - 0.98$). Thuật toán chạy siêu nhanh trên vi điều khiển, triệt tiêu hoàn toàn độ trôi của con quay và lọc sạch nhiễu rung lắc của gia tốc kế.

![Bộ lọc bù hợp nhất dữ liệu IMU](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab4_complementary_filter.png)
