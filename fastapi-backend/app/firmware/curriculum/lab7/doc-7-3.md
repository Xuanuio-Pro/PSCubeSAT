# Doc 7.3: Vận hành bay và quỹ đạo LEO

![Chu kỳ quỹ đạo LEO 95 phút và cửa sổ liên lạc Trạm Mặt đất](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab7_leo_orbit_pass.png)

### 1. Sổ tay vận hành bay
Sổ tay FOM là tài liệu quy chuẩn tác chiến dành cho kíp trực điều hành Trạm mặt đất:
- **Trước phiên liên lạc:** Kiểm tra hướng ăng-ten, hiệu chuẩn tần số SDR và tải phần tử quỹ đạo TLE mới nhất từ Space-Track.org để tính thời điểm bắt đầu (AOS) và kết thúc (LOS) liên lạc.
- **Quy trình liên lạc:**
  1. *Bắt sóng (AOS):* Khi vệ tinh xuất hiện ở chân trời, trạm nhận beacon đầu tiên và gửi lệnh xác thực `CMD_PING`.
  2. *Trút dữ liệu:* Gửi lệnh `CMD_DUMP_LOG`; vệ tinh truyền dữ liệu cảm biến đã lưu trong vòng quỹ đạo trước.
  3. *Giai đoạn Thực thi Nhiệm vụ:* Gửi các lệnh cấu hình hoặc yêu cầu chụp ảnh.
  4. *Mất sóng (LOS):* Khi vệ tinh khuất dưới chân trời, trạm đóng phiên và lưu nhật ký liên lạc.

### 2. Mô phỏng chu kỳ quỹ đạo 95 phút
Bộ kit PTITCube hỗ trợ chế độ mô phỏng quỹ đạo thực tế để rèn luyện kỹ năng vận hành:
- **Pha có nắng (60 phút):** Tấm pin cấp dòng sạc đến 500 mA; điện áp pin tăng từ 3.7 V lên 4.15 V. Vệ tinh có thể chụp ảnh và truyền dữ liệu.
- **Pha vùng tối (35 phút):** Dòng sạc bằng 0 mA; vệ tinh dùng pin Li-Po. Quản lý năng lượng để pin không cạn trước pha có nắng tiếp theo.
