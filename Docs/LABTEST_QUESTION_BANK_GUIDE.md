# Hướng dẫn Mô tả & Sử dụng Tính năng Ngân hàng Câu hỏi Lab Test

Tài liệu này mô tả chi tiết chức năng **thêm câu hỏi từ file (File câu hỏi tách riêng với File đáp án)** tại trang Cấu hình chương trình học và **soạn thảo/quản lý ngân hàng câu hỏi trên trang riêng** dành cho Giảng viên (`teacher`) và Quản trị viên (`admin`) trên nền tảng học tập CubeSAT LMS.

---

## 1. Tổng quan thiết kế

Mỗi bài **Lab Test** (`labtest-0` đến `labtest-8`, nằm ở cuối mỗi Lab từ Lab 0 đến Lab 8) sử dụng một **Ngân hàng câu hỏi gồm đúng 20 câu đã duyệt**. Khi sinh viên làm bài kiểm tra cuối Lab, hệ thống sẽ:
- Rút ngẫu nhiên **5/20 câu hỏi** từ ngân hàng đã xuất bản của Lab đó.
- Trộn thứ tự phương án trả lời theo quy tắc của từng loại câu hỏi.
- Không gửi đáp án đúng hay lời giải thích xuống trình duyệt khi lượt làm bài đang diễn ra (`active`).
- Tự động chấm điểm trên server ngay khi sinh viên nộp bài hoặc khi hết thời gian làm bài.

Giao diện của giảng viên được phân tách rõ ràng làm 2 khu vực:
1. **Tại mục Lab Test trên trang Cấu hình chương trình học (`/classes/{classId}/curriculum`) — Gọn nhẹ, chỉ thêm bằng File**:
   - Chỉ hiển thị trạng thái ngân hàng câu hỏi (`Đã duyệt X/20 câu`), đường dẫn tải **Mẫu File câu hỏi** & **Mẫu File đáp án** tách riêng, và 2 ô tải file:
     1. **File câu hỏi** (`.docx`, `.txt`, `.xlsx`, `.csv`)
     2. **File đáp án tách riêng** (`.xlsx`, `.csv`, `.txt`, `.docx`)
   - Muốn tự soạn thảo hoặc chỉnh sửa từng câu hỏi thủ công, giảng viên bấm nút **Mở trang riêng để soạn câu hỏi**.
2. **Tại trang riêng Ngân hàng câu hỏi (`/classes/{classId}/labs/{labId}/questions`) — Đầy đủ công cụ soạn thảo**:
   - Cho phép thêm mới, chỉnh sửa, duyệt/thu hồi từng câu hỏi thuộc 4 dạng câu hỏi, nhập từ 2 file tách riêng, cấu hình chính sách bài thi, cấp thêm lượt thi và xem thống kê tỷ lệ trả lời đúng.

---

## 2. Cấu trúc File Câu hỏi & File Đáp án tách riêng

Hệ thống tách biệt hoàn toàn **File câu hỏi** (chỉ chứa nội dung câu hỏi và các lựa chọn) với **File đáp án** (chứa đáp án đúng và lời giải cho từng câu):

### 2.1. Mẫu File Câu hỏi (`/templates/question-template.docx` hoặc `.txt`)
Chỉ chứa nội dung đề bài của 4 phần, **không** cần chứa đáp án:
```text
PHẦN I. Câu trắc nghiệm một đáp án đúng
Câu 1. Mệnh đề toán học nào sau đây là mệnh đề sai?
A. Số 2 là số nguyên.	B. Số 2 là số hữu tỉ.
C. Số 2 là số hữu tỉ dương.	D. Số 2 không là số nguyên tố.

PHẦN II. Câu trắc nghiệm nhiều đáp án đúng
Câu 1. Trong các số sau, số nào là số hữu tỉ?
A. 3/4	B. -5	C. √2	D. 0,25

PHẦN III. Câu trắc nghiệm đúng sai.
Câu 1. Một cuộc thi bắn cung có 20 người tham gia...
a) [1,NB] Số người bắn trượt mục tiêu trong lần đầu tiên là 2.
b) [1,NB] Số người bắn trượt mục tiêu trong lần bắn thứ hai là 6.
c) [0, TH] Số người bắn trượt mục tiêu trong lần bắn thứ nhất và thứ hai nhiều nhất là 8.
d) [2, TH] Số người bắn trúng mục tiêu trong cả ba lần bắn ít nhất là 3.

PHẦN IV. Câu trắc nghiệm trả lời ngắn.
Câu 1. Cho hình chữ nhật ABCD có AB = 6, AD = 8. Độ dài của vectơ AB + AD bằng bao nhiêu?
```

### 2.2. Mẫu File Đáp án tách riêng (`/templates/answer-template.xlsx` hoặc `.csv`)
Chứa đáp án tương ứng với từng câu hỏi trong File câu hỏi (hỗ trợ đối chiếu theo **số thứ tự câu hỏi liên tiếp `1..N`** như mẫu `answers_test.xlsx` hoặc đối chiếu theo **`Phần` + `Câu`**):

| Câu hỏi | 0001 (Đáp án) | Phần | Câu trong phần | Lời giải |
| :---: | :---: | :---: | :---: | :--- |
| `1` | `D` | `I` | `1` | Số 2 là số nguyên tố chẵn duy nhất nên D sai. |
| `2` | `A\|B\|D` | `II` | `1` | 3/4, -5 và 0,25 đều là số hữu tỉ. |
| `3` | `A\|B\|D` | `II` | `2` | Hai góc so le trong bằng nhau, đồng vị bằng nhau. |
| `4` | `A\|C` | `II` | `3` | Hai đại lượng tỉ lệ nghịch có tích không đổi. |
| `5` | `ĐSSĐ` | `III` | `1` | Lần 1 trượt 2 (Đ), lần 2 trượt 5 (S), tổng trượt <=7 (S), cả 3 lần trúng >=3 (Đ). |
| `6` | `ĐSSS` | `III` | `2` | Ý a đúng theo quy tắc hình bình hành. |
| `7` | `10` | `IV` | `1` | Độ dài vectơ tổng bằng đường chéo AC = 10. |
| `8` | `31` | `IV` | `2` | Áp dụng định lý sin trong tam giác ABC được AB xấp xỉ 31m. |

---

## 3. Chi tiết 4 dạng câu hỏi & quy tắc trộn mệnh đề

| Phần | Mã loại (`question_type`) | Tên hiển thị | Cấu trúc phương án | Định dạng đáp án trong File đáp án |
| :--- | :--- | :--- | :--- | :--- |
| **Phần I** | `single_choice` | Trắc nghiệm 1 đáp án (A, B, C, D) | 4 phương án `A`, `B`, `C`, `D` | `A`, `B`, `C` hoặc `D` |
| **Phần II** | `multiple_choice` | Trắc nghiệm nhiều đáp án | 4 phương án `A`, `B`, `C`, `D` | Các đáp án đúng ngăn cách bởi dấu `\|` hoặc `,` (VD: `A\|B\|D`) |
| **Phần III** | `true_false` | Trắc nghiệm Đúng / Sai (4 mệnh đề) | 4 mệnh đề `a)`, `b)`, `c)`, `d)` | 4 ký tự `Đ`/`S` hoặc `T`/`F` liên tiếp (VD: `ĐSSĐ`) hoặc `a:Đ\|b:S\|c:S\|d:Đ` |
| **Phần IV** | `short_answer` | Trả lời ngắn (số / cụm từ ngắn) | Không có phương án lựa chọn | Số hoặc chuỗi ngắn (VD: `10`, `31`, `-1.5`, `12,5`) |

### Quy tắc trộn mệnh đề ở Phần III (`true_false`) theo tiền tố `[0, 1, 2, ...]`
Khi soạn các mệnh đề `a)`, `b)`, `c)`, `d)` của câu Đúng/Sai trong File câu hỏi, giảng viên có thể đặt tiền tố `[thứ_tự, mức_độ]` ở đầu mệnh đề (ví dụ `[1, NB]`, `[0, TH]`, `[2, VD]`):
- **Số thứ tự `= 0`**: Được xếp ở **bất kỳ vị trí nào** khi phát đề cho sinh viên.
- **Số thứ tự `> 0` bằng nhau**: Luôn **đứng gần nhau** và được hoán vị ngẫu nhiên với nhau trong nhóm.
- **Số thứ tự `> 0` nhỏ hơn**: Luôn **đứng trước** số thứ tự lớn hơn.
- Tiền tố `[số, mức_độ]` tự động được ẩn đi khi hiển thị đề thi cho sinh viên.

---

## 4. Hướng dẫn thao tác từng bước cho Giảng viên

### Bước 1: Tải file mẫu tham khảo
Tại phần **Lab test** trên trang Cấu hình chương trình học (`/classes/{classId}/curriculum`), tải về 2 file mẫu tách riêng:
- **Mẫu File câu hỏi**: [question-template.docx](../public/templates/question-template.docx) hoặc [question-template.txt](../public/templates/question-template.txt)
- **Mẫu File đáp án**: [answer-template.xlsx](../public/templates/answer-template.xlsx) hoặc [answer-template.csv](../public/templates/answer-template.csv)

### Bước 2: Thêm file câu hỏi & file đáp án tại mục Lab Test
1. Chọn **1. File câu hỏi** (`.docx`, `.txt`, `.xlsx`, `.csv`).
2. Chọn **2. File đáp án tách riêng** (`.xlsx`, `.csv`, `.txt`, `.docx`).
3. Bấm **Thêm file câu hỏi**. Hệ thống sẽ ghép câu hỏi với đáp án tương ứng, kiểm tra hợp lệ toàn bộ và lưu vào ngân hàng ở trạng thái `Nháp`.
4. Bấm **Duyệt tất cả câu nháp** và khi đủ `20/20` câu đã duyệt thì bấm **Xuất bản 20 câu đã duyệt**.

### Bước 3: Mở trang riêng khi cần tự soạn hoặc sửa từng câu hỏi
- Nếu muốn gõ từng câu hỏi thủ công, sửa nội dung câu hỏi đã nhập, thu hồi câu hỏi hoặc cấu hình chính sách bài thi, bấm nút **Mở trang riêng để soạn câu hỏi** (`/classes/{classId}/labs/{labId}/questions`).

---

## 5. Danh sách các file mẫu trong `public/templates/`

| File mẫu | Đường dẫn tải trên web | Vai trò |
| :--- | :--- | :--- |
| `question-template.docx` | `/templates/question-template.docx` | **File câu hỏi mẫu (Word)** — chỉ chứa đề câu hỏi Phần I–IV |
| `question-template.txt` | `/templates/question-template.txt` | **File câu hỏi mẫu (Text)** — chỉ chứa đề câu hỏi Phần I–IV |
| `answer-template.xlsx` | `/templates/answer-template.xlsx` | **File đáp án mẫu (Excel)** — tách riêng với file câu hỏi |
| `answer-template.csv` | `/templates/answer-template.csv` | **File đáp án mẫu (CSV)** — tách riêng với file câu hỏi |
| `question-bank.xlsx` | `/templates/question-bank.xlsx` | File Excel gộp (dành cho import bảng 1 file nếu cần) |
| `question-bank-guide.md` | `/templates/question-bank-guide.md` | Hướng dẫn quy cách cột và định dạng file |
