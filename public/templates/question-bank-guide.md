# Hướng dẫn soạn đề và nhập ngân hàng Lab Test

Hệ thống hỗ trợ **4 dạng câu hỏi** theo cấu trúc đề mẫu:

1. **Phần I — Trắc nghiệm một đáp án đúng (`single_choice`)**:
   - 4 phương án `A`, `B`, `C`, `D` (ID nội bộ `a`, `b`, `c`, `d`).
   - Đáp án đúng (`correct_choice_id`): 1 phương án, ví dụ `a` hoặc `D`.

2. **Phần II — Trắc nghiệm nhiều đáp án đúng (`multiple_choice`)**:
   - 4 phương án `A`, `B`, `C`, `D`.
   - Đáp án đúng (`correct_choice_id`): các phương án đúng ngăn cách bởi dấu `|`, ví dụ `A|B|D` hoặc `A|C`.

3. **Phần III — Trắc nghiệm Đúng / Sai (`true_false`)**:
   - 4 mệnh đề `a)`, `b)`, `c)`, `d)`.
   - Đáp án đúng (`correct_choice_id`): nhập chuỗi 4 ký tự `Đ`/`S` (hoặc `T`/`F`) theo thứ tự a-b-c-d (ví dụ `ĐSSĐ`), hoặc ghi rõ `a:Đ|b:S|c:S|d:Đ`.
   - **Quy tắc tiền tố `[0, 1, 2, ...]` để điều khiển thứ tự đảo mệnh đề**:
     - Giáo viên có thể thêm tiền tố `[số, mức độ]` ở đầu mỗi mệnh đề, ví dụ `[1, NB]`, `[0, TH]`, `[2, VD]`. Nếu không dùng có thể bỏ qua.
     - Số thứ tự `= 0` được đảo tới bất kỳ vị trí nào.
     - Các mệnh đề có số thứ tự bằng nhau (`> 0`) luôn đứng cạnh nhau và được đảo ngẫu nhiên trong nhóm.
     - Mệnh đề có số thứ tự nhỏ hơn (`> 0`) luôn đứng trước mệnh đề có số thứ tự lớn hơn.

4. **Phần IV — Trắc nghiệm trả lời ngắn (`short_answer`)**:
   - Học sinh điền kết quả số hoặc chuỗi ngắn (ví dụ `10`, `31`, `-1.5`, `12,5`).
   - Hệ thống tự chuẩn hóa dấu phẩy/chấm thập phân (`12,5` và `12.5` được tính như nhau).

## Các định dạng tệp hỗ trợ nhập (`Import`)
- **Đề mẫu văn bản (`.txt`, `.md`)**: Soạn theo mẫu 4 phần kèm bảng đáp án cuối đề sau dòng `---HẾT---`, hoặc mẫu đề rút gọn đánh dấu `*A.` / `_A._` và `Đáp án:`.
- **Excel (`.xlsx`) / CSV (`.csv`)**: Có cột `question_type` (`single_choice`, `multiple_choice`, `true_false`, `short_answer`), `prompt`, `choice_1_text`..`choice_4_text`, `correct_choice_id`, `explanation`, `objective`, `difficulty`, `source_reference`.
- **JSON (`.json`)**: Mảng `questions` theo schema chuẩn.
- Ngân hàng câu hỏi cần đủ **20 câu đã duyệt (`approved`)** để xuất bản; mỗi lượt thi của sinh viên rút ngẫu nhiên **5 câu**.
