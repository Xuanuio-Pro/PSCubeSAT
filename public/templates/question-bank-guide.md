# Mẫu nhập ngân hàng Lab Test

Đây là mẫu trống, chưa nhập được cho đến khi GV điền đầy đủ. Không chứa câu hỏi/đáp án chuyên môn.

- JSON: mảng `questions`, mỗi phần tử có đúng các trường trong mẫu. Không thêm status/reviewer.
- CSV: UTF-8, giữ nguyên tên cột; ô chứa dấu phẩy hoặc xuống dòng phải đặt trong dấu nháy kép theo chuẩn CSV.
- Điền câu hỏi (ít nhất 10 ký tự), 4 lựa chọn có nội dung khác nhau. ID `a`, `b`, `c`, `d` là ID ổn định, không phải thứ tự khi thi.
- `correct_choice_id`: một trong bốn ID, chỉ một đáp án đúng.
- `explanation`: giải thích ít nhất 5 ký tự; `objective` và `source_reference` ít nhất 3 ký tự. Tham chiếu nguồn cần tên tài liệu, mục/trang đủ để kiểm chứng.
- `difficulty`: easy, medium hoặc hard.
- Mỗi lần nhập 1–200 câu, tối đa 300 KB; ngân hàng tối đa 200 câu kể cả câu đã thu hồi. Câu gần trùng bị từ chối để GV rà soát.
- Import nguyên tử: một dòng lỗi làm toàn bộ lần nhập thất bại. Mọi câu nhập đều là draft. GV kiểm tra, duyệt riêng từng câu; chỉ đúng 20 câu approved mới xuất bản.
- Sửa câu đã duyệt sẽ trả về draft. Ngân hàng đã xuất bản chỉ sửa qua phiên bản mới; lịch sử đề/điểm không đổi.
- Tạo đủ 20 câu được duyệt cho mỗi Lab 0–8 là công việc chuyên môn của GV (tổng 180 câu).
