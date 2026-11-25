# Doc 7.3: Sổ Tay Vận Hành Bay (FOM) & Mô Phỏng Quỹ Đạo LEO 95 Phút

### 1. Sổ Tay Vận Hành Bay (Flight Operations Manual - FOM)
Sổ tay FOM là tài liệu quy chuẩn tác chiến dành cho kíp trực điều hành Trạm mặt đất:
- **Quy trình Kiểm tra Trước Phiên Liên lạc (Pre-Pass Checklist):** Kiểm tra hướng ăng-ten, hiệu chuẩn tần số SDR, tải tệp phần tử quỹ đạo TLE mới nhất từ Space-Track.org để tính toán thời điểm đón sóng (AOS - Acquisition of Signal) và mất sóng (LOS - Loss of Signal).
- **Giao thức Thông qua Trạm Mặt đất (Ground Pass Protocol):**
  1. *Giai đoạn Bắt sóng (AOS):* Vệ tinh mọc trên chân trời, trạm bắt tín hiệu Beacon đầu tiên, gửi lệnh xác thực `CMD_PING`.
  2. *Giai đoạn Trút Dữ liệu (Telemetry Dump):* Gửi lệnh `CMD_DUMP_LOG`, vệ tinh truyền tải nhanh các khối dữ liệu cảm biến tích lũy trong vòng quỹ đạo trước đó.
  3. *Giai đoạn Thực thi Nhiệm vụ:* Gửi các lệnh cấu hình hoặc yêu cầu chụp ảnh.
  4. *Giai đoạn Mất sóng (LOS):* Vệ tinh lặn xuống chân trời, trạm đóng phiên và lưu trữ nhật ký phiên liên lạc.

### 2. Mô phỏng Chu kỳ Quỹ đạo LEO 95 Phút
Bộ kit PTITCube hỗ trợ chế độ mô phỏng quỹ đạo thực tế để rèn luyện kỹ năng vận hành:
- **Pha Ban ngày Đón nắng (Sunlight - 60 phút):** Tấm pin mặt trời nhận ánh sáng, dòng nạp TP4056 đạt +500 mA, pin sạc tăng dần từ 3.7V → 4.15V, vệ tinh thoải mái thực hiện các tác vụ chụp ảnh và truyền thông công suất cao.
- **Pha Vùng tối Trái Đất (Eclipse - 35 phút):** Vệ tinh chìm vào bóng tối Trái Đất, dòng sạc mặt trời về 0 mA. Toàn bộ năng lượng vận hành được rút từ khối pin Li-Po, điện áp pin xả dần. Học viên phải lập trình quản lý năng lượng thông minh để vệ tinh không bị cạn pin trước khi chu kỳ ban ngày tiếp theo bắt đầu.
