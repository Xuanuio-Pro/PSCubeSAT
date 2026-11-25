# Doc 2.2: Sụt áp, ngắt an toàn và điều khiển nguồn tải

![Sụt áp và điều khiển nguồn tải](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab2_brownout_power_gating.png)

### 1. Ngắt an toàn khi phóng
Vệ tinh cần có ít nhất hai cơ chế ngắt nguồn độc lập trong quá trình phóng:
1. **Chốt RBF:**
   - Một chốt cơ khí cách điện được cắm xuyên qua vỏ vệ tinh, ngắt đường nguồn chính của pin.
   - Trước khi đưa vệ tinh vào ống phóng, kỹ sư rút chốt. Dải cờ đỏ giúp xác nhận chốt đã được tháo.
2. **Công tắc hành trình:**
   - Bố trí ở đầu mút của thanh ray dẫn hướng.
   - Khi vệ tinh được trượt vào trong lòng ống phóng P-POD, cần gạt công tắc bị nén chặt xuống bởi thành ống phóng, giữ tiếp điểm ở trạng thái ngắt mạch điện.
   - Khi cửa P-POD mở và lò xo đẩy vệ tinh bay ra ngoài không gian, cần gạt bật bung ra, đóng tiếp điểm cấp điện toàn bộ hệ thống EPS.

### 2. Sụt áp và bảo vệ ESP32
Khi tải đột ngột cần dòng lớn, nội trở của pin và điện cảm đường mạch có thể làm sụt áp:
- Nếu điện áp cấp cho vi điều khiển sụt xuống dưới ngưỡng an toàn tối thiểu (thường là 2.7V), CPU sẽ thực thi sai tập lệnh, bộ nhớ Flash có thể bị ghi đè dữ liệu rác làm hỏng hệ điều hành.
- **Bộ phát hiện sụt áp (BOD):** ESP32 so sánh điện áp nguồn $V_{\text{dd}}$ với ngưỡng đặt trước và kích hoạt reset khi điện áp xuống thấp.
- **Biện pháp Khắc phục Phần cứng:** Bố trí các tụ điện hóa Tantalum dung lượng lớn ($100\mu\text{F} - 470\mu\text{F}$) có nội trở ESR cực thấp ngay sát chân nguồn của module phát sóng và camera để xả năng lượng bù đắp cho các đỉnh dòng tức thời.

### 3. Điều khiển mạch Buck và tiết kiệm điện
Cấp nguồn liên tục cho tải ngoại vi làm tăng mức tiêu thụ do dòng tĩnh và dòng rò.
- **Đầu ra mạch hạ áp:** Trên bo EPS, mạch Buck cấp nguồn 3.3 V cho tải ngoại vi.
- **Cắt nguồn tải:** Trên bo EPS, tín hiệu điều khiển mạch hạ áp có logic:
  - **Mức 1 (`HIGH`):** Ngắt nguồn vào mạch hạ áp và tắt tải.
  - **Mức 0 (`LOW`):** Bật mạch hạ áp, cấp nguồn 3.3 V cho tải.
  - Thư viện `PTIT_EPS` điều khiển nguồn tải qua `eps.setBuckState(true)` (bật) và `eps.setBuckState(false)` (tắt), không cần biết chân GPIO cụ thể.
  - **Ngưỡng bật chế độ tiết kiệm điện:**
    Hệ thống giám sát điện áp pin $V_\text{cell}$ và dung lượng $\text{SOC}$. Chế độ tiết kiệm điện bật khi:

$$V_\text{cell} < 3.70\text{ V} \quad \text{hoặc} \quad \text{SOC} < 25.0\%$$

    - *Khi pin yếu:* OBC lập tức gọi `eps.setBuckState(false)` để ngắt mạch hạ áp, sa thải toàn bộ phụ tải tiêu thụ và kéo dài chu kỳ ngủ ($5000\text{ ms}$) nhằm bảo toàn năng lượng cho máy tính sinh tồn và nạp lại pin.
    - *Khi pin khỏe ($V_\text{cell} \ge 3.70\text{ V}$ và $\text{SOC} \ge 25.0\%$):* OBC gọi `eps.setBuckState(true)` với chu kỳ $1500\text{ ms}$.
- **Tiết kiệm năng lượng theo chu kỳ bật/tắt:**
  - Giả sử tổng dòng tiêu thụ của khối tải ngoại vi khi hoạt động là 25 mA.
  - Nếu bật liên tục trong 1 chu kỳ quỹ đạo 95 phút, năng lượng tiêu thụ là:

$$E_{\text{continuous}} = 3.3\text{ V} \times 25\text{ mA} \times 1.583\text{ h} \approx 130.6\text{ mWh}$$

  - Nếu chỉ bật 1.5 giây mỗi 6.5 giây (tỉ lệ bật $\approx 23\%$):

$$E_{\text{gating}} \approx 130.6\text{ mWh} \times 0.23 \approx 30.0\text{ mWh}$$

  - Cách này giảm khoảng **77%** điện năng tiêu thụ của tải ngoại vi trong vùng tối quỹ đạo.
