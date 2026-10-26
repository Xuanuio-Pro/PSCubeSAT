# Hướng dẫn sử dụng nền tảng học CubeSAT

Dành cho Quản trị viên (Admin), Giảng viên (GV) và Sinh viên (SV) trong đợt pilot. Đăng nhập tại trang **Đăng nhập**; tài khoản tự đăng ký luôn là người dùng thường, chỉ Admin cấp quyền GV.

## Quản trị viên

**Cấp quyền giảng viên, khóa tài khoản** — menu **Lớp học → Tài khoản**. Tìm theo tên/email, chọn vai trò *Giảng viên* hoặc trạng thái *Đã khóa* rồi xác nhận. Khóa tài khoản có hiệu lực ngay, kể cả với phiên đang mở.

**Tổng quan** — menu **Tổng quan**:

- Số tài khoản theo vai trò và trạng thái, số lớp đang mở.
- *SV hoạt động 7/30 ngày*: SV có thao tác học (mở/đọc/xem bài, nộp thực hành, làm Lab Test). Chỉ đăng nhập thì không tính.
- Tỷ lệ hoàn thành và điểm Lab Test trung bình (điểm cao nhất của mỗi SV) theo từng lab.

**Chế độ lớp pilot** — cuối trang Tổng quan, mỗi lớp có một chế độ:

| Chế độ | Ý nghĩa |
|---|---|
| Đang bật học theo lớp | SV học, nộp bài, làm Lab Test trong lớp; nội dung mở theo tiến trình |
| Chỉ đọc — tạm dừng ghi | Dùng khi có sự cố. Không ai ghi được dữ liệu của lớp; SV vẫn xem lộ trình, kết quả và nội dung trải nghiệm. Bật lại là học tiếp, không mất dữ liệu |
| Tắt — SV dùng luồng cũ | SV của lớp học theo các trang Lab 0–8 cũ; dữ liệu lớp được giữ |

Mỗi lần đổi chế độ phải nhập lý do; thay đổi được ghi nhật ký.

## Giảng viên

1. **Tạo lớp** — **Lớp học → Tạo lớp**: mã lớp, tên, học kỳ. Để *Bản nháp* khi chưa muốn SV thấy lớp.
2. **Thêm SV** — trong trang lớp, mục *Thêm sinh viên*, nhập email SV (SV phải đăng ký tài khoản trước). Xóa SV sẽ chặn truy cập ngay; kết quả cũ vẫn được giữ.
3. **Cấu hình chương trình** — bật/tắt, đặt bắt buộc từng bài, chỉnh tham số (link video, tài liệu, rubric thực hành, thời gian/số lượt Lab Test) và điều kiện mở lab. Lưu nháp, bấm **Kiểm tra trước xuất bản** rồi **Xác nhận xuất bản**; SV chỉ thấy bản đã xuất bản. Hệ thống từ chối cấu hình có chu trình, lab không còn bài bắt buộc, hoặc Lab Test bắt buộc chưa có ngân hàng.
4. **Ngân hàng Lab Test** — từ trang cấu hình, mở *Soạn ngân hàng và quản lý Lab Test* của từng lab:
   - Thêm câu trực tiếp hoặc nhập tệp JSON/CSV theo mẫu ở mục **Nhập ngân hàng** (tải mẫu và hướng dẫn ngay trên trang). Câu nhập vào luôn là nháp.
   - Mở từng câu, kiểm tra nội dung rồi **Duyệt bản đã lưu**. Đủ đúng 20 câu đã duyệt thì **Xuất bản 20 câu đã duyệt**.
   - Mỗi đề gồm 5 câu ngẫu nhiên; mặc định 10 phút, đạt 4/5, 3 lượt, lấy điểm cao nhất. Đổi trong *Chính sách bài test*.
   - Câu sai sau khi xuất bản: **Tạo phiên bản sửa** và chọn câu cần thu hồi. Kết quả cũ không bị sửa; trang báo số lượt thi bị ảnh hưởng để bạn quyết định cấp thêm lượt.
5. **Chấm thực hành, miễn trừ** — **Tiến độ và chấm bài**: mở bài chờ chấm, đọc mã và rubric, *Duyệt hoàn thành* hoặc *Yêu cầu sửa* kèm nhận xét. *Miễn một bài* / *Mở khóa một lab* cho từng SV, bắt buộc ghi lý do.
6. **Cấp thêm lượt thi** — trong trang ngân hàng của lab, mục *Cấp thêm lượt thi*, chọn SV, số lượt và lý do.
7. **Báo cáo lớp** — trong trang lớp, mở **Báo cáo lớp**: tiến độ từng SV, số lab đạt, điểm cao nhất từng Lab Test, số lượt, bài chờ duyệt, lần hoạt động gần nhất. **Xuất CSV** để mở bằng Excel.
   - Cột *Lịch sử biên dịch cũ* lấy từ hệ thống trước pilot, **không** được tính là hoàn thành. Nếu SV đã làm tương đương, dùng *Miễn một bài* kèm lý do.

## Sinh viên

1. **Vào lớp** — **Lớp học → Lớp của tôi**, chọn lớp. **Lộ trình học tập** cho biết lab nào đang mở, lab nào khóa và còn thiếu gì; **Tiếp tục học** mở bài nên học tiếp.
2. **Học bài**
   - *Video*: xem đủ thời lượng yêu cầu (tua qua không được tính). Mở trang không tự hoàn thành.
   - *Tài liệu*: đọc xong bấm **Đánh dấu đã đọc**.
   - *Thực hành*: viết code C++/Blockly, biên dịch và nạp như trước, rồi **Nộp phiên bản mã nguồn**. Biên dịch thành công **không** có nghĩa là hoàn thành; bài hoàn thành khi GV duyệt.
3. **Lab Test** — mở khi đã xong các bài bắt buộc khác của lab.
   - Đồng hồ tính từ lúc bấm **Bắt đầu làm bài** theo giờ server. Tải lại trang vẫn giữ nguyên đề và lựa chọn.
   - Lựa chọn được lưu tự động. Mất mạng thì lựa chọn được giữ trên máy và gửi lại khi có mạng; đừng đóng trình duyệt trước khi thấy “Đã lưu trên server”.
   - Hết giờ, bài được chấm theo các lựa chọn đã lưu. Đạt thì lab hoàn thành và lab kế tiếp mở ngay.
   - Đáp án và giải thích chỉ hiện khi GV cho phép (mặc định sau khi dùng hết lượt).
4. **Link cũ `/lab1?lesson=...`** — nếu bạn học Lab đó trong một lớp, trang tự chuyển vào lớp; học trong nhiều lớp thì chọn lớp. Tiến độ mỗi lớp tính riêng.
5. **Lớp đang tạm dừng ghi** — trang lớp hiện thông báo. Bạn vẫn xem được kết quả; trong thời gian này có thể học phần **Trải nghiệm**. Tiếp tục khi GV/Admin bật lại lớp.
