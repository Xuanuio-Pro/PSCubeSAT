# Doc 8.1: Kỹ Thuật Hệ Thống Không Gian (Systems Engineering) & Vòng Đời Dự Án NASA/ESA

### 1. Phương pháp luận Kỹ thuật Hệ thống Không gian (Systems Engineering)
Kỹ thuật Hệ thống là phương pháp luận kỹ thuật và quản trị đa ngành được NASA, ESA và các cơ quan hàng không vũ trụ hàng đầu thế giới sử dụng để hiện thực hóa các sứ mệnh không gian phức tạp:
- Khác với kỹ thuật truyền thống tập trung vào từng phân hệ riêng lẻ, Kỹ thuật Hệ thống nhìn nhận vệ tinh như một thực thể thống nhất.
- Đảm bảo sự cân bằng tối ưu giữa các ràng buộc cạnh tranh khốc liệt: Khối lượng, Kích thước, Điện năng tiêu thụ, Chi phí và Thời gian triển khai.

### 2. Vòng đời Dự án Không gian theo Pha (NASA/ESA Project Lifecycle)
Chu trình phát triển một sứ mệnh vệ tinh được phân chia thành các pha kế tiếp với các cột mốc đánh giá kỹ thuật khắt khe (Gate Reviews):

```mermaid
flowchart LR
    A["Pre-Phase A
Nghiên cứu Khái niệm"] --> B["Phase A
Phát triển Khái niệm
(MDR / SRR)"]
    B --> C["Phase B
Thiết kế Sơ bộ
(PDR)"]
    C --> D["Phase C
Thiết kế Chi tiết & Chế tạo
(CDR)"]
    D --> E["Phase D
Tích hợp & Thử nghiệm AIT
(AR / FRR)"]
    E --> F["Phase E
Vận hành Sứ mệnh"]
    F --> G["Phase F
Giải thể Sứ mệnh"]
```

- **Pre-Phase A (Nghiên cứu Khái niệm - Concept Studies):** Xác định mục tiêu khoa học, nghiên cứu tính khả thi kỹ thuật và đề xuất các phương án kiến trúc sơ khởi.
- **Phase A (Phát triển Khái niệm - Concept & Technology Development):** Chốt lại các yêu cầu sứ mệnh cấp hệ thống, kết thúc bằng cột mốc đánh giá **MDR / SRR (Mission Definition Review / System Requirements Review)**.
- **Phase B (Thiết kế Sơ bộ - Preliminary Design):** Phân rã yêu cầu xuống các phân hệ, xác định giao diện (ICD) và ngân sách kỹ thuật, kết thúc bằng cột mốc **PDR (Preliminary Design Review)**.
- **Phase C (Thiết kế Chi tiết & Chế tạo - Final Design & Fabrication):** Hoàn thiện bản vẽ CAD 3D, sơ đồ mạch, đóng băng phần mềm (Code Freeze), chế tạo mẫu thử nghiệm kỹ thuật (EM), kết thúc bằng cột mốc sống còn **CDR (Critical Design Review)**.
- **Phase D (Tích hợp Hệ thống & Thử nghiệm - System Assembly, Integration & Test - AIT):** Lắp ráp mẫu bay (FM), vượt qua các bài kiểm định môi trường (Rung động, TVAC, EMC), nghiệm thu **AR (Acceptance Review)** và đánh giá sẵn sàng phóng **FRR (Flight Readiness Review)**.
- **Phase E (Vận hành Sứ mệnh - Operations & Sustainment):** Điều hành bay trên quỹ đạo, thu thập dữ liệu khoa học và xử lý sự cố.
- **Phase F (Giải thể Sứ mệnh - Decommissioning & Disposal):** Xả cạn năng lượng pin, hạ quỹ đạo và hủy vệ tinh an toàn trong khí quyển theo công ước quốc tế về giảm thiểu rác thải không gian.

### 3. Ma Trận Kiểm Định Toàn Diện MECE (Mutually Exclusive, Collectively Exhaustive)
Nguyên tắc: "Không trùng lặp, Không bỏ sót" - Mọi thông số kỹ thuật của vệ tinh đều phải được phân bổ phương pháp kiểm chứng tương ứng trong 4 phương pháp chuẩn mực:
1. **Thử nghiệm (Test):** Kích thích hệ thống trong môi trường kiểm nghiệm (buồng rung, buồng TVAC) để thu thập số liệu đo định lượng chính xác.
2. **Phân tích (Analysis):** Sử dụng các mô hình toán học và phần mềm mô phỏng (tính toán Link Budget, mô phỏng truyền nhiệt, phân tích ứng suất kết cấu FEA).
3. **Kiểm tra Đo đạc (Inspection):** Quan sát trực quan, dùng kính hiển vi hoặc máy đo tọa độ quang học/tiếp xúc CMM để xác nhận kích thước hình học, độ sạch và tay nghề lắp ráp.
4. **Thực diễn Chức năng (Demonstration):** Quan sát định tính xem một chức năng có hoạt động đúng kỳ vọng hay không (cơ cấu bung mở ăng-ten, đèn LED chỉ thị sáng).
