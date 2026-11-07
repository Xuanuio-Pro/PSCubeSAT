# Hướng dẫn Mô tả & Sử dụng Tính năng Ngân hàng Câu hỏi Lab Test

Tài liệu này mô tả chi tiết chức năng **soạn thảo, nhập đề mẫu và quản lý ngân hàng câu hỏi Lab Test** dành cho Giảng viên (`teacher`) và Quản trị viên (`admin`) trên nền tảng học tập CubeSAT LMS.

---

## 1. Tổng quan tính năng

Mỗi bài **Lab Test** (`labtest-0` đến `labtest-8`, nằm ở cuối mỗi Lab từ Lab 0 đến Lab 8) sử dụng một **Ngân hàng câu hỏi gồm đúng 20 câu đã duyệt**. Khi sinh viên bắt đầu làm bài kiểm tra cuối Lab, hệ thống sẽ:
- Rút ngẫu nhiên **5/20 câu hỏi** từ ngân hàng đã xuất bản của Lab đó.
- Trộn thứ tự phương án trả lời theo quy tắc của từng loại câu hỏi.
- Không gửi đáp án đúng hay lời giải thích xuống trình duyệt khi lượt làm bài đang diễn ra (`active`).
- Tự động chấm điểm trên server ngay khi sinh viên nộp bài hoặc khi hết thời gian làm bài.

Giảng viên có thể:
1. **Thêm/sửa câu hỏi và đáp án trực tiếp ngay tại mục Lab Test** trên trang Cấu hình chương trình học (`/classes/{classId}/curriculum`) mà không cần chuyển trang.
2. Mở trang **Quản lý ngân hàng câu hỏi & thống kê toàn màn hình** (`/classes/{classId}/labs/{labId}/question-bank`).
3. Soạn câu hỏi thuộc **4 dạng câu hỏi chuẩn đề thi** (Trắc nghiệm 1 đáp án, Trắc nghiệm nhiều đáp án, Đúng/Sai 4 mệnh đề có quy tắc trộn, Trả lời ngắn).
4. Tải **đề mẫu tham khảo** (`.txt`, `.xlsx`, `.csv`, `.json`) và nhập nhanh hàng loạt từ file hoặc dán trực tiếp văn bản đề mẫu.

---

## 2. Vị trí truy cập trên giao diện

### Cách A: Soạn ngay tại trang Cấu hình chương trình học (Khuyên dùng)
1. Đăng nhập bằng tài khoản **Giảng viên (`teacher`)** hoặc **Quản trị viên (`admin`)**.
2. Vào lớp học -> chọn **Cấu hình chương trình** (`/classes/{classId}/curriculum`).
3. Cuộn tới phần **Lab test — Kiểm tra cuối Lab X** (`labtest-0`, `labtest-1`, …).
4. Tại khối bài học Lab Test, bấm nút:
   - **Soạn / thêm câu hỏi & đáp án tại đây**: Mở khung quản lý ngân hàng câu hỏi ngay bên dưới bài Lab Test đó.
   - Các nút tải nhanh mẫu tham khảo: **Tải đề mẫu 4 phần (.txt)**, **Tải mẫu Excel (.xlsx)**, **Tải bảng đáp án mẫu (.csv)**.

### Cách B: Mở trang Ngân hàng câu hỏi toàn màn hình
- Từ mục Lab Test trên trang Cấu hình chương trình học, bấm **Mở trang ngân hàng & thống kê toàn màn hình** (đường dẫn `/classes/{classId}/labs/{labId}/question-bank`).
- Ngoài chức năng soạn/nhập câu hỏi như Cách A, trang toàn màn hình còn có thêm:
  - **Cấp thêm lượt thi** cho sinh viên cụ thể (kèm lý do audit).
  - **Thống kê tỷ lệ trả lời đúng** theo từng phiên bản câu hỏi.

---

## 3. Chi tiết 4 dạng câu hỏi hỗ trợ

Hệ thống hỗ trợ đầy đủ 4 phần câu hỏi theo mẫu đề kiểm tra chuẩn:

| Phần | Mã loại (`question_type`) | Tên hiển thị | Cấu trúc phương án | Định dạng đáp án đúng (`correct_choice_id`) |
| :--- | :--- | :--- | :--- | :--- |
| **Phần I** | `single_choice` | Trắc nghiệm 1 đáp án (A, B, C, D) | 4 phương án `a`, `b`, `c`, `d` | `a`, `b`, `c` hoặc `d` (không phân biệt hoa/thường) |
| **Phần II** | `multiple_choice` | Trắc nghiệm nhiều đáp án | 4 phương án `a`, `b`, `c`, `d` | Nhiều mã phân tách bởi dấu `\|` hoặc `,` (VD: `A\|B\|D` -> chuẩn hóa thành `a\|b\|d`) |
| **Phần III** | `true_false` | Trắc nghiệm Đúng / Sai (4 mệnh đề) | 4 mệnh đề `a)`, `b)`, `c)`, `d)` | Chuỗi 4 ký tự `Đ`/`S` (VD: `ĐSSĐ`) hoặc `a:Đ\|b:S\|c:S\|d:Đ` |
| **Phần IV** | `short_answer` | Trả lời ngắn (số / cụm từ ngắn) | Không có phương án lựa chọn (`choices = []`) | Chuỗi số hoặc văn bản ngắn, tối đa 40 ký tự (VD: `10`, `31`, `-1.5`, `12,5`) |

### Quy tắc trộn mệnh đề đặc biệt ở Phần III (Trắc nghiệm Đúng / Sai)
Khi soạn các mệnh đề `a)`, `b)`, `c)`, `d)` của câu hỏi **Đúng / Sai (`true_false`)**, giảng viên có thể đặt tiền tố `[thứ_tự, mức_độ]` ở đầu nội dung mệnh đề (ví dụ: `[1, NB] Mệnh đề 1`, `[0, TH] Mệnh đề tự do`, `[2, VD] Mệnh đề 2`):
- **Thứ tự `= 0`** (ví dụ `[0, NB]`): Mệnh đề tự do, có thể được xếp vào **bất kỳ vị trí nào** khi phát đề cho sinh viên.
- **Thứ tự `> 0` bằng nhau** (ví dụ cùng là `[1, NB]`): Các mệnh đề có cùng số thứ tự sẽ **luôn đứng liền kề nhau** và được hoán vị ngẫu nhiên với nhau trong nhóm đó.
- **Thứ tự `> 0` khác nhau** (ví dụ `[1, NB]` và `[2, VD]`): Nhóm mệnh đề có số thứ tự nhỏ hơn sẽ **luôn đứng trước** nhóm mệnh đề có số thứ tự lớn hơn.
- **Bảo mật hiển thị**: Tiền tố `[số, mức_độ]` chỉ dùng ở server để điều khiển thuật toán trộn và **tự động được ẩn đi** khi hiển thị đề cho sinh viên.

---

## 4. Hướng dẫn sử dụng cho Giảng viên

### 4.1. Cách 1: Thêm hoặc sửa từng câu hỏi trên biểu mẫu (Form)
1. Mở khung Ngân hàng câu hỏi của Lab cần soạn -> bấm nút **+ Câu hỏi mới** (hoặc bấm **Sửa** ở một câu hỏi trong danh sách).
2. Chọn **Loại câu hỏi**:
   - *Phần I — Trắc nghiệm 1 đáp án*: Nhập 4 phương án A, B, C, D và chọn 1 đáp án đúng.
   - *Phần II — Trắc nghiệm nhiều đáp án*: Nhập 4 phương án A, B, C, D và tích chọn các ô `Đúng` tương ứng (tối thiểu 1 ô).
   - *Phần III — Trắc nghiệm Đúng / Sai*: Nhập 4 mệnh đề `a)`, `b)`, `c)`, `d)` (có thể kèm tiền tố `[0, NB]`, `[1, TH]`, …) và chọn `Đúng (Đ)` hoặc `Sai (S)` cho từng mệnh đề.
   - *Phần IV — Trả lời ngắn*: Nhập nội dung câu hỏi và điền đáp án chuẩn vào ô **Đáp án trả lời ngắn** (ví dụ `10` hoặc `-1.5`).
3. Điền đầy đủ thông tin sư phạm bắt buộc:
   - **Mục tiêu học tập (`objective`)**: Ví dụ `Đo điện áp pin EPS`.
   - **Nguồn bài học (`source_reference`)**: Phải bắt đầu bằng một trong các tiền tố hợp lệ: `document:`, `video:`, `practice:`, `lab:` (ví dụ: `document: Lab 0`).
   - **Độ khó (`difficulty`)**: `Dễ (easy)`, `Trung bình (medium)`, hoặc `Khó (hard)`.
   - **Giải thích đáp án (`explanation`)**: Hiển thị cho sinh viên sau khi được phép công bố đáp án.
4. Bấm **Thêm câu hỏi** (hoặc **Cập nhật câu đang chọn**).

---

### 4.2. Cách 2: Dán nhanh văn bản đề mẫu 4 phần (Text / Word)
Giảng viên có thể soạn đề trên Word/Notepad theo bố cục 4 phần của đề mẫu rồi dán thẳng vào hệ thống:
1. Trong mục **Nhập đề mẫu / Nhập từ file**, bấm **Nạp đề mẫu 4 phần vào ô dưới** để xem ngay cấu trúc mẫu, hoặc dán nội dung đề từ Word vào ô văn bản.
2. Cấu trúc văn bản được hệ thống tự động nhận diện:
   ```text
   PHẦN I. Câu trắc nghiệm một phương án lựa chọn.
   Câu 1. Nội dung câu hỏi 1?
   A. Phương án A
   B. Phương án B
   C. Phương án C
   *D. Phương án D (dấu * ở đầu đánh dấu đáp án đúng)

   PHẦN II. Câu trắc nghiệm nhiều phương án lựa chọn.
   Câu 2. Nội dung câu hỏi nhiều lựa chọn?
   *A. Phương án A đúng
   *B. Phương án B đúng
   C. Phương án C sai
   *D. Phương án D đúng

   PHẦN III. Câu trắc nghiệm đúng sai.
   Câu 3. Nội dung câu hỏi Đúng/Sai:
   *a) [1, NB] Mệnh đề a đúng (có dấu * ở đầu là Đúng)
   b) [1, NB] Mệnh đề b sai (không có dấu * ở đầu là Sai)
   c) [2, TH] Mệnh đề c sai
   *d) [0, VD] Mệnh đề d đúng

   PHẦN IV. Câu trắc nghiệm trả lời ngắn.
   Câu 4. Nội dung câu hỏi trả lời ngắn?
   Đáp án: 10
   ```
   *(Ngoài dấu `*` ở đầu phương án, giảng viên cũng có thể ghi dòng `Đáp án: D`, `Đáp án: A, B, D` hoặc `Đáp án: ĐSSĐ` ngay bên dưới câu hỏi).*
3. Bấm **Nhập từ văn bản đề mẫu**. Toàn bộ câu hỏi sẽ được kiểm tra hợp lệ và thêm vào ngân hàng ở trạng thái `Nháp (draft)`.

---

### 4.3. Cách 3: Nhập hàng loạt từ file Excel (`.xlsx`), CSV (`.csv`), Text (`.txt`) hoặc JSON (`.json`)
1. Tải file mẫu về máy:
   - Mẫu Excel chuẩn 4 dạng câu hỏi: [`/templates/question-bank.xlsx`](../public/templates/question-bank.xlsx)
   - Mẫu CSV: [`/templates/question-bank.csv`](../public/templates/question-bank.csv)
   - Mẫu văn bản đề 4 phần: [`/templates/labtest-sample-exam.txt`](../public/templates/labtest-sample-exam.txt)
   - Mẫu JSON: [`/templates/question-bank.json`](../public/templates/question-bank.json)
2. Điền danh sách câu hỏi vào file Excel/CSV theo các cột:
   - `question_type`: `single_choice`, `multiple_choice`, `true_false`, hoặc `short_answer` (nếu để trống mặc định là `single_choice`).
   - `prompt`: Nội dung câu hỏi (tối thiểu 10 ký tự).
   - `choice_1_id` .. `choice_4_id`: `a`, `b`, `c`, `d` (để trống đối với `short_answer`).
   - `choice_1_text` .. `choice_4_text`: Nội dung 4 phương án hoặc 4 mệnh đề (để trống đối với `short_answer`).
   - `correct_choice_id`:
     - `single_choice`: `a` / `b` / `c` / `d`
     - `multiple_choice`: `A|B|D` hoặc `a,c`
     - `true_false`: `ĐSSĐ` hoặc `a:Đ|b:S|c:S|d:Đ`
     - `short_answer`: `10`, `31`, `-1.5`, …
   - `explanation`, `objective`, `difficulty` (`easy`/`medium`/`hard`), `source_reference` (`document: ...`).
3. Chọn file tại ô **Chọn tệp** -> bấm **Nhập file đã chọn**.
   - **Lưu ý tính nguyên tử (Atomic Import)**: Nếu bất kỳ dòng nào trong file bị lỗi định dạng hoặc trùng lặp nội dung quá 88% với câu hỏi đã có, hệ thống sẽ báo lỗi chi tiết dòng đó và không ghi một phần dữ liệu lỗi vào ngân hàng.

---

### 4.4. Quy trình Duyệt câu hỏi & Xuất bản đề thi
1. **Duyệt câu hỏi**:
   - Câu hỏi mới tạo hoặc mới import sẽ ở trạng thái `Nháp (draft)`.
   - Giảng viên có thể bấm **Duyệt** từng câu hoặc bấm nút **Duyệt tất cả câu nháp (N)** để duyệt nhanh toàn bộ câu nháp.
2. **Kiểm tra điều kiện 20 câu**:
   - Thanh trạng thái hiển thị số câu đã duyệt: `Đã duyệt X/20 câu (Cần thêm Y câu đã duyệt để xuất bản)`.
   - Ngân hàng phải có **đúng 20 câu ở trạng thái `Đã duyệt (approved)`** thì mới được xuất bản.
3. **Xuất bản đề thi**:
   - Khi đủ `20/20` câu đã duyệt, bấm **Xuất bản đề thi**.
   - Sau khi xuất bản, trạng thái ngân hàng chuyển sang `Đã xuất bản (published)`, và giảng viên có thể tích **Bật bài học** cho bài `Lab test` trên trang Cấu hình chương trình học rồi bấm **Xuất bản chương trình**.
4. **Chỉnh sửa sau khi đã xuất bản (Tạo phiên bản sửa đổi - Fork)**:
   - Để bảo toàn lịch sử điểm và đề thi của các lượt làm bài trước đó, ngân hàng đã xuất bản không sửa trực tiếp tại chỗ.
   - Khi cần sửa câu hỏi, giảng viên nhập **Lý do tạo phiên bản sửa đổi** (tối thiểu 5 ký tự, tùy chọn chọn câu hỏi cần thu hồi) và bấm **Tạo phiên bản sửa**. Hệ thống sẽ tạo phiên bản ngân hàng mới ở trạng thái `draft` để giảng viên chỉnh sửa và xuất bản lại.

---

## 5. Danh sách các file mẫu tham khảo

Tất cả các file mẫu tĩnh được đặt trong thư mục [`public/templates/`](../public/templates/) và có thể tải trực tiếp từ giao diện giảng viên:

| File mẫu | Đường dẫn tải trên web | Mô tả |
| :--- | :--- | :--- |
| `labtest-sample-exam.txt` | `/templates/labtest-sample-exam.txt` | Đề mẫu 4 phần (Phần I, II, III có `[0,1,2, NB/TH/VD]`, Phần IV) tương ứng với `question_test_doc.docx` |
| `question-bank.xlsx` | `/templates/question-bank.xlsx` | File Excel mẫu có sẵn 4 dòng đại diện cho 4 dạng câu hỏi |
| `answer-sheet-sample.csv` | `/templates/answer-sheet-sample.csv` | Bảng đáp án mẫu 4 phần tương ứng với `answers_test.xlsx` |
| `question-bank.csv` | `/templates/question-bank.csv` | File CSV mẫu cho nhập ngân hàng câu hỏi |
| `question-bank.json` | `/templates/question-bank.json` | File JSON mẫu cho nhập ngân hàng câu hỏi |
| `question-bank-guide.md` | `/templates/question-bank-guide.md` | Tài liệu tóm tắt quy cách cột và định dạng khi nhập file |

---

## 6. Giao diện làm bài & Quy tắc chấm điểm phía Sinh viên

Khi sinh viên mở bài Lab Test đã mở khóa ([`QuizPanel.jsx`](../src/components/classes/QuizPanel.jsx)):
- **Phần I (`single_choice`)**: Hiển thị các nút chọn 1 phương án (radio).
- **Phần II (`multiple_choice`)**: Hiển thị các ô tích chọn nhiều phương án (checkbox); sinh viên phải chọn đúng tập hợp các phương án đúng (`a|b|d`) để được tính điểm câu đó.
- **Phần III (`true_false`)**: Hiển thị bảng 4 mệnh đề `a)`, `b)`, `c)`, `d)` với 2 nút `Đúng (Đ)` / `Sai (S)` cho từng mệnh đề; sinh viên chọn đúng cả 4 mệnh đề (`a:Đ|b:S|c:S|d:Đ`) để được tính điểm câu đó.
- **Phần IV (`short_answer`)**: Hiển thị ô nhập văn bản/số ngắn; hệ thống chuẩn hóa khoảng trắng và dấu thập phân (`,` và `.` cho số thực, ví dụ `-1,5` và `-1.5` đều khớp `-1.5`) trước khi so khớp trên server.
- **Lưu tự động & hỗ trợ mất mạng tạm thời**: Mọi thao tác chọn/nhập của sinh viên đều được lưu nháp vào `localStorage` theo phạm vi `(userId, classId, attemptId, tab)` kèm `idempotency_key` để tự động đồng bộ lại khi có mạng.

---

## 7. Đặc tả API liên quan (Backend)

Tất cả endpoint ngân hàng câu hỏi đều kiểm tra quyền `teacher` (hoặc `admin`) và tư cách thành viên lớp còn hiệu lực trên DB ở mỗi request:

- `GET /api/classes/{class_id}/labs/{lab_id}/question-bank`: Lấy thông tin ngân hàng câu hỏi, danh sách câu hỏi và `QuizPolicy` của Lab (tự động khởi tạo nếu lớp chưa có ngân hàng cho Lab đó).
- `POST /api/classes/{class_id}/labs/{lab_id}/question-bank/questions`: Thêm 1 câu hỏi mới (`expected_revision`, `question`).
- `PUT /api/classes/{class_id}/labs/{lab_id}/question-bank/questions/{question_version_id}`: Cập nhật câu hỏi đang ở bản `draft`.
- `POST /api/classes/{class_id}/labs/{lab_id}/question-bank/questions/{question_version_id}/review`: Duyệt (`approved`) hoặc từ chối (`rejected`) câu hỏi.
- `POST /api/classes/{class_id}/labs/{lab_id}/question-bank/import`: Nhập hàng loạt câu hỏi với body:
  ```json
  {
    "expected_revision": 0,
    "format": "text | xlsx | csv | json",
    "content": "<nội dung văn bản hoặc chuỗi base64 của file .xlsx>"
  }
  ```
- `POST /api/classes/{class_id}/labs/{lab_id}/question-bank/publish`: Xuất bản ngân hàng câu hỏi (yêu cầu đúng 20 câu `approved`).
- `POST /api/classes/{class_id}/labs/{lab_id}/question-bank/fork`: Tạo phiên bản ngân hàng câu hỏi mới từ bản đã xuất bản.
