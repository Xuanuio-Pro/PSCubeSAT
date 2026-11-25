# Doc 2.1: EPS, pin Li-Po và MAX17048

### 1. Vai trò của hệ thống nguồn
EPS lưu trữ và phân phối điện cho các hệ thống trên CubeSat. Nhiệm vụ chính:
- **Lưu trữ:** Cấp điện cho vệ tinh khi đi qua vùng tối của Trái Đất.
- **Sạc pin:** Điều phối dòng sạc từ các tấm pin quang điện và bảo vệ pin khỏi quá nạp, quá nhiệt.
- **Chuyển đổi điện áp:** Cấp các đường nguồn 3.3 V và 5.0 V cho tải.
- **Giám sát:** Đo điện áp, dòng điện và dung lượng còn lại (SOC), để OBC quản lý tải khi pin yếu.
- **Ngắt an toàn:** Giữ vệ tinh mất nguồn trong quá trình phóng cho đến khi được đẩy khỏi ống phóng.

![Kiến trúc hệ thống nguồn điện EPS](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab2_eps_architecture.png)

### 2. Đặc tính pin Li-Po
Kit PTITCube dùng pin **Li-Po** dạng túi:
- Điện áp danh định: 3.7 V mỗi cell.
- Điện áp sạc đầy: 4.20 V ± 0.05 V. Không sạc quá 4.25 V để tránh làm pin phồng hoặc hỏng.
- Ngưỡng ngắt xả: 3.00 V. Xả dưới 2.7 V có thể làm hỏng pin vĩnh viễn.
- Điện áp giảm nhanh ở 10% đầu và cuối dung lượng, nhưng ít đổi trong khoảng 80% giữa. Vì vậy, không thể ước lượng chính xác dung lượng chỉ từ điện áp tĩnh.

### 3. Sạc pin bằng CC/CV
Khối nạp nguồn sử dụng vi mạch điều khiển sạc tuyến tính chuyên dụng **TP4056A** kết hợp mạch bảo vệ pin **DW01A + MOSFET kép 8205A** thực hiện chu trình sạc hai giai đoạn hoàn hảo:
1. **Dòng không đổi (CC):**
   - Khi pin có điện áp từ 3.0V đến dưới 4.2V, mạch bơm một dòng điện sạc không đổi tối đa $I_\text{chg}$ vào pin.
   - Dòng sạc được thiết lập thông qua điện trở gắn ở chân `PROG` ($R_\text{prog}$) theo công thức của nhà sản xuất:

$$I_\text{chg} = \frac{1200\text{ V}}{R_\text{prog}}$$

     Ví dụ: Với điện trở $R_\text{prog} = 1.2\text{ k}\Omega$, dòng nạp tối đa là $I_\text{chg} = 1000\text{ mA} = 1.0\text{ A}$.
2. **Áp không đổi (CV):**
   - Khi điện áp pin đạt chính xác ngưỡng 4.20V, mạch tự động chuyển sang chế độ áp không đổi, giữ điện áp ở mức 4.20V và để dòng điện giảm dần theo hàm mũ.
   - Khi dòng điện giảm xuống dưới $1/10$ dòng sạc định mức ($C/10 \approx 100\text{ mA}$), TP4056 ngắt sạc; đèn sạc tắt và đèn báo đầy bật sáng.

![Sơ đồ mô-đun sạc và bảo vệ pin Li-Po TP4056A](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab2.1_Tp4056.png)

| Chân / thành phần | Kết nối hoặc chức năng |
| :--- | :--- |
| `IN+` / `IN-` | Nguồn sạc DC 4.5–8.0 V, tối đa 1.2 A. |
| `B+` / `B-` | Cực pin Li-Po 3.7 V; sạc đầy 4.2 V, dòng sạc tối đa 1 A. |
| `OUT+` / `OUT-` | Cấp nguồn cho tải, tối đa 3 A; tự ngắt khi pin cạn hoặc ngắn mạch. |
| TP4056A | Điều khiển sạc CC/CV và hai đèn trạng thái. |
| DW01A, 8205A | Bảo vệ pin khỏi quá nạp, quá xả, quá dòng và ngắn mạch. |

### 4. Mạch Buck và Boost
Để cấp nguồn cho các phân hệ, bo mạch EPS tích hợp hai mạch ổn áp chuyển mạch (Switching Regulators) với hiệu suất vượt trội so với ổn áp tuyến tính LDO:
- **DC-DC Buck Converter (Hạ áp $V_\text{bat} \to 3.3\text{V}$):** Cung cấp dòng điện liên tục lên tới 2 A cho OBC, bộ nhớ Flash và các cảm biến. Hiệu suất chuyển đổi đạt $\sim 92\%$, giảm thiểu tối đa tổn hao nhiệt sinh ra bên trong lòng vệ tinh.
- **DC-DC Boost Converter (Nâng áp $V_\text{bat} \to 5.0\text{V}$):** Khi điện áp pin xả xuống 3.4V, mạch Boost vẫn duy trì điện áp 5.0V ổn định cấp nguồn cho tầng khuếch đại công suất phát sóng của module LoRa và module Camera.

### 5. Giám sát pin bằng MAX17048
Trên bo EPS, chip **MAX17048** của hãng Maxim Integrated đo đạc liên tục dung lượng pin với độ chính xác cao:
- **Địa chỉ I2C Cố định:** `0x36` (dạng 7-bit).
- **ModelGauge:** Ước lượng dung lượng pin (SOC) theo nhiệt độ và tốc độ xả mà không cần điện trở đo dòng mắc nối tiếp.
- **Các Thanh ghi Trọng yếu:**
  - Thanh ghi Điện áp Cell (`VCELL` - Địa chỉ `0x02` và `0x03`): Giá trị 16-bit. Độ phân giải là $78.125\text{ }\mu\text{V}$ trên mỗi bit (tương đương $1.25\text{ mV} / 16\text{ LSB}$).

$$V_\text{cell}\text{ (V)} = \text{RegValue} \times 0.000078125\text{ V}$$

  - Thanh ghi Tỷ lệ Dung lượng (`SOC` - Địa chỉ `0x04` và `0x05`): Giá trị 16-bit. Byte cao thể hiện phần nguyên phần trăm (0 - 100%), byte thấp thể hiện phần thập phân với độ phân giải $1/256\% \approx 0.0039\%$.

![Sơ đồ chân và cổng kết nối bo mạch giám sát pin MAX17048](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab2.1_MAX17048.png)

| Chân | Kết nối hoặc chức năng |
| :--- | :--- |
| `VIN` | Cấp nguồn 3–5 V; mức logic tương thích ESP32 3.3 V. |
| `GND` | Nối chung mass với pin và OBC. |
| `SCL`, `SDA` | Nối lần lượt `GPIO22` và `GPIO21` của ESP32. |
| `INT` | Ngõ ra tích cực `LOW`, báo khi điện áp hoặc SOC xuống dưới ngưỡng. |
| `QStart` | Khởi động lại quá trình ước lượng dung lượng. |
| Hai cổng JST-PH | Nối pin, tải hoặc bộ sạc; hai cổng đấu song song. |
| Hai cổng STEMMA QT | Mở rộng bus I2C; có đèn báo nguồn. |
