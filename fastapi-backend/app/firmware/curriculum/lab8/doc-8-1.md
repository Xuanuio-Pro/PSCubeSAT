# Doc 8.1: Kỹ thuật hệ thống và vòng đời dự án

### 1. Kỹ thuật hệ thống không gian
Kỹ thuật Hệ thống là phương pháp luận kỹ thuật và quản trị đa ngành được NASA, ESA và các cơ quan hàng không vũ trụ hàng đầu thế giới sử dụng để hiện thực hóa các sứ mệnh không gian phức tạp:
- Khác với kỹ thuật truyền thống tập trung vào từng phân hệ riêng lẻ, Kỹ thuật Hệ thống nhìn nhận vệ tinh như một thực thể thống nhất.
- Đảm bảo sự cân bằng tối ưu giữa các ràng buộc cạnh tranh khốc liệt: Khối lượng, Kích thước, Điện năng tiêu thụ, Chi phí và Thời gian triển khai.

### 2. Các giai đoạn của dự án không gian
Chu trình phát triển sứ mệnh vệ tinh gồm nhiều giai đoạn và cột mốc đánh giá kỹ thuật:

![Vòng đời dự án vũ trụ chuẩn NASA/ESA](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab8_project_lifecycle.png)

- **Pre-Phase A:** Xác định mục tiêu khoa học, đánh giá tính khả thi và đề xuất kiến trúc.
- **Phase A:** Hoàn thiện yêu cầu hệ thống; kết thúc bằng các mốc **MDR / SRR**.
- **Phase B:** Phân rã yêu cầu, xác định giao diện (ICD) và ngân sách; kết thúc bằng **PDR**.
- **Phase C:** Hoàn thiện bản vẽ CAD, sơ đồ mạch, phần mềm và mẫu kỹ thuật; kết thúc bằng **CDR**.
- **Phase D:** Lắp ráp mẫu bay, thử nghiệm môi trường, nghiệm thu **AR** và đánh giá sẵn sàng phóng **FRR**.
- **Phase E:** Vận hành vệ tinh, thu thập dữ liệu và xử lý sự cố.
- **Phase F:** Kết thúc sứ mệnh, hạ quỹ đạo và xử lý vệ tinh theo quy định về rác thải không gian.

### 3. Ma trận kiểm định MECE
Nguyên tắc: "Không trùng lặp, Không bỏ sót" - Mọi thông số kỹ thuật của vệ tinh đều phải được phân bổ phương pháp kiểm chứng tương ứng trong 4 phương pháp chuẩn mực:
1. **Thử nghiệm:** Đo phản hồi của hệ thống trong môi trường như buồng rung hoặc buồng TVAC.
2. **Phân tích:** Dùng mô hình và phần mềm để tính ngân sách tuyến, truyền nhiệt hoặc ứng suất.
3. **Kiểm tra:** Quan sát và đo kích thước, độ sạch, chất lượng lắp ráp.
4. **Trình diễn:** Xác nhận chức năng hoạt động như yêu cầu, chẳng hạn cơ cấu bung ăng-ten hoặc đèn LED.
