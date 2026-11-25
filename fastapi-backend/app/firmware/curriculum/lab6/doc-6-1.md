# Doc 6.1: Vai trò khung cơ khí

### 1. Vai trò của phân hệ cấu trúc
Khung CubeSat không chỉ bảo vệ linh kiện mà còn:
- **Chịu tải khi phóng:** Chịu gia tốc tĩnh 10–15 g, rung âm học và rung ngẫu nhiên đến 14 g RMS mà không biến dạng hoặc nứt.
- **Định vị vệ tinh trong ống P-POD:** Giữ đúng kích thước bao ngoài để vệ tinh trượt ra khỏi ống mà không bị kẹt.
- **Tản nhiệt:** Dẫn nhiệt từ linh kiện công suất ra bề mặt khung để bức xạ vào không gian.

![Mô hình khung CubeSat 1U với các vách và thanh ray dẫn hướng ở góc](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/Lab6.1_structure.png)

*Mô hình khung CubeSat 1U.*

### 2. Tác động của khung cơ khí lên các phân hệ
Một thay đổi nhỏ trong thiết kế cơ khí sẽ ngay lập tức gây ra hiệu ứng domino ảnh hưởng trực tiếp tới hoạt động của tất cả các phân hệ còn lại:

![Giao diện liên kết cơ khí cấu trúc 1U](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab6_structure_interfaces.png)

1. **Tác động lên Phân hệ Năng lượng (EPS):**
   - *Tản nhiệt pin:* Pin Li-Po hoạt động an toàn trong khoảng 0–45°C. Cầu nhiệt kim loại dẫn nhiệt từ pin ra khung.
   - *Giữ pin:* Pin Li-Po dạng túi có thể giãn nở khi sạc và xả. Khung cần tạo lực nén đồng đều 10–20 kPa để hạn chế tách lớp điện cực.
   - *Công tắc hành trình:* Vị trí và hành trình công tắc ở chân ray phụ thuộc dung sai gia công khung.
2. **Tác động lên Phân hệ Xử lý Trung tâm (OBC):**
   - *Che chắn nhiễu và bức xạ:* Vách nhôm dày 1.5–2.0 mm giúp giảm nhiễu điện từ và bức xạ ion hóa tác động lên vi xử lý.
   - *Nối mass khung:* Nối các tấm nhôm với mass OBC, bảo đảm điện trở dưới 0.1 Ω để tiêu tán điện tích tĩnh.
3. **Tác động lên Phân hệ Truyền thông (COM):**
   - *Mặt phẳng tiếp địa:* Ăng-ten LoRa đơn cực λ/4 cần mặt phẳng kim loại dẫn điện để phối hợp trở kháng 50 Ω. Khung nhôm có thể đóng vai trò này; tiếp xúc điện kém làm tăng sóng phản xạ và có thể gây hỏng tầng khuếch đại công suất.
4. **Tác động lên cảm biến và tải trọng:**
   - *Độ cứng và căn chỉnh:* Thấu kính camera và IMU cần một mặt phẳng tham chiếu ổn định. Nếu khung cong hoặc xoắn do thay đổi nhiệt độ, trục quang học có thể lệch và cảm biến đo sai tư thế.
