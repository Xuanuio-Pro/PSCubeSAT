# Doc 6.1: Vai Trò Khung Cơ Khí & Tác Động Đa Chiều Lên Các Phân Hệ Khác

### 1. Vai trò Cốt lõi của Phân hệ Cấu trúc Cơ khí (Structure Subsystem)
Trong kỹ thuật vệ tinh CubeSat, Phân hệ Cấu trúc thường bị nhầm lẫn là một "chiếc hộp thụ động" chỉ đơn thuần làm nhiệm vụ chứa linh kiện. Thực tế trong môi trường hàng không vũ trụ, khung cấu trúc là một hệ thống cơ điện tử - nhiệt phức tạp, đảm nhận các chức năng sống còn:
- **Chịu Tải Trọng Phóng Cực Đại (Launch Load Withstanding):** Trong giai đoạn tên lửa cất cánh, khung vệ tinh phải chịu gia tốc tĩnh liên tục lên tới $10 - 15\text{g}$, tải trọng dao động âm thanh (Acoustic Loads) và các rung động ngẫu nhiên (Random Vibration) với gia tốc hiệu dụng lên tới 14 g_rms. Khung phải giữ vững độ bền cơ học, không được biến dạng vĩnh viễn hoặc gãy nứt làm tổn hại khoang hàng tên lửa.
- **Duy trì Giao diện Cơ học Tiêu chuẩn với Ống Phóng P-POD:** Định hình chính xác bao hình kích thước bên ngoài, dẫn hướng vệ tinh trượt êm ái ra khỏi ống phóng mà không bị kẹt dính.
- **Khối Tản Nhiệt Thụ Động Chủ Đạo (Primary Thermal Heat Sink):** Dẫn nhiệt lượng tỏa ra từ các chip công suất bên trong truyền ra các bề mặt ngoài để bức xạ vào vũ trụ.

### 2. Tác động Đa chiều của Khung Cơ khí lên các Phân hệ Khác
Một thay đổi nhỏ trong thiết kế cơ khí sẽ ngay lập tức gây ra hiệu ứng domino ảnh hưởng trực tiếp tới hoạt động của tất cả các phân hệ còn lại:

```mermaid
flowchart TD
    FRAME["🔩 KHUNG CẤU TRÚC CƠ KHÍ CUBESAT"]
    
    FRAME -->|1. Cung cấp Tấm tản nhiệt & Vách nén tế bào pin| EPS["🔋 Phân hệ Năng lượng (EPS)"]
    FRAME -->|2. Lồng Faraday che chắn bức xạ & Tiếp mass tĩnh điện| OBC["🖥️ Phân hệ Xử lý (OBC)"]
    FRAME -->|3. Mặt đất phẳng phản xạ nhân tạo (Ground Plane 50 Ohm)| COM["📡 Phân hệ Truyền thông (COM)"]
    FRAME -->|4. Mặt phẳng tham chiếu cơ học siêu cứng, chống uốn| SENSORS["🔬 Phân hệ Cảm biến (Sensors)"]
    FRAME -->|5. Bề mặt tiếp xúc ray trượt dẫn hướng chịu mài mòn| PPOD["🚀 Ống phóng Tên lửa (P-POD)"]
```

1. **Tác động lên Phân hệ Năng lượng (EPS):**
   - *Tản nhiệt cho Khối Pin:* Pin Li-Po chỉ hoạt động an toàn trong dải nhiệt độ hẹp (0°C - 45°C). Khung cơ khí phải cung cấp các cầu nhiệt kim loại dẫn nhiệt sinh ra khi sạc/xả pin ra vỏ ngoài.
   - *Vách Nén Tế bào Pin (Pouch Cell Containment):* Pin Li-Po dạng túi có xu hướng giãn nở cơ học khi sạc xả trong chân không. Khung cơ khí phải cung cấp một lực nén đồng đều (10 - 20 kPa) lên bề mặt cell pin để chống hiện tượng tách lớp điện cực (Delamination).
   - *Tích hợp Công tắc Tách tầng:* Chân đế của thanh ray cơ khí là vị trí lắp đặt công tắc hành trình (Deployment Switch). Độ nhô và hành trình đàn hồi của công tắc phụ thuộc 100% vào dung sai gia công cơ khí của khung.
2. **Tác động lên Phân hệ Xử lý Trung tâm (OBC):**
   - *Che chắn Bức xạ & Lồng Faraday (EMI/Radiation Shielding):* Vách nhôm của khung dày 1.5 - 2.0 mm đóng vai trò là một lồng Faraday triệt tiêu các xung nhiễu điện từ bên ngoài và làm suy giảm đáng kể liều bức xạ ion hóa tích lũy (TID) tác động vào chip vi xử lý.
   - *Liên kết Mass Khung Vỏ (Chassis Ground Bonding):* Toàn bộ các tấm khung nhôm phải được nối thông điện liên tục về đường mass GND của bo mạch OBC với điện trở cực nhỏ (R < 0.1 Ω) để tiêu tán toàn bộ điện tích tĩnh điện vũ trụ (Spacecraft Plasma Charging), ngăn chặn hiện tượng phóng tia hồ quang tĩnh điện phá hủy vi mạch.
3. **Tác động lên Phân hệ Truyền thông (COM):**
   - *Mặt Đất Phản Xạ Nhân Tạo (Artificial Ground Plane):* Ăng-ten phát sóng LoRa trên CubeSat thường là loại ăng-ten đơn cực một phần tư bước sóng (λ/4 Monopole Antenna). Loại ăng-ten này bắt buộc phải có một mặt phẳng kim loại dẫn điện bên dưới chân ăng-ten để tạo thành một "hình ảnh gương" của cực còn lại, giúp phối hợp trở kháng chuẩn 50 Ω. Bản thân bề mặt khung nhôm chính là mặt phẳng đất phản xạ này; nếu khung tiếp xúc điện kém, sóng phản xạ ngược sẽ làm cháy tầng khuếch đại công suất PA của module LoRa.
4. **Tác động lên Phân hệ Cảm biến & Tải trọng (Sensors & Payload):**
   - *Độ Cứng Vững và Căn Chỉnh Cơ học (Rigidity & Boresight Alignment):* Thấu kính Camera và cảm biến quán tính IMU đòi hỏi một mặt phẳng tham chiếu cơ học siêu cứng. Nếu khung bị uốn cong hoặc vặn xoắn dưới biến thiên nhiệt độ quỹ đạo, trục quang học của Camera sẽ bị lệch góc và cảm biến gia tốc kế/con quay hồi chuyển sẽ đo sai tư thế không gian.
