# Nhật ký quyết định

## 25/11/2026 — Gộp PR #7 của Trung với code của Xuân (nhánh integration/xuan-trung)

- Cấu trúc giáo trình lấy theo Trung: bài thực hành gộp nhóm có `exercises` và mã mới (Lab1-04_Button … Lab1-11_Web_Server_LED, Lab4-05_Camera_Multiplexer, Lab4-06_Read_All_Sensors, Lab5-03_Ground_Station_Demo, Lab3-04_Watchdog_Timer). Mọi xung đột dữ liệu giáo trình giải quyết theo bên Trung.
- Giữ lại từ phía Xuân: nội dung firmware đã sửa (Lab3-04 bắt cạnh GPIO 4, Lab4-02a cấu hình dải đo...), override MUX/CDH, panel `lab1Io`, dashboard, cloud device. Test/telemetry/visualization của Xuân được đổi sang mã bài mới.
- `catalog.json`: Lab4-05_Camera_Multiplexer và Lab4-06_Read_All_Sensors dùng bản ghi build đã xác minh khớp đúng hash file hiện tại; bỏ mục mồ côi `Lab5-01_Send_Telemetry` (không còn file, không bài nào dùng).
- Chưa chạy `alembic upgrade/downgrade` trên DB sạch: tài khoản DB dev không có quyền tạo database. Cần chạy trên môi trường có quyền trước khi vào `develop`.

## 24/11/2026 — Phân phối toàn bộ 35 tài liệu Doc từ `docs.zip` & nâng cấp hiển thị KaTeX / Mermaid

- **Hoàn thiện 35 tệp tài liệu phía server (`fastapi-backend/app/firmware/curriculum/lab{0..8}/doc-*.md`):**
  - Tách 9 tệp `lab{0..8}-*.md` trong `docs.zip` thành 35 tệp Markdown riêng cho từng bài `document`, loại bỏ toàn bộ khối `### ❓ Câu Hỏi Củng Cố Kiến Thức` (vì ngay sau mỗi Doc đã có bài `quiz` chấm trên server) và phần `## 💻 Hướng Dẫn Thực Hành` ở cuối tệp.
  - Ánh xạ **theo chủ đề bài học** ở 2 điểm lệch so với file gốc:
    - **Lab 1** (zip có 6 mục Doc, giáo trình có 8 bài Doc): ánh xạ `1.1` → `doc-1-1.md`, `1.2` → `doc-1-2.md`, `1.3` (74HC595) → `doc-1-5.md`, `1.4` (UART) → `doc-1-6.md`, `1.5` (Wi-Fi/HTTP) → `doc-1-7.md`, `1.6` (`millis()`) → `doc-1-8.md`; biên tập `doc-1-3.md` (GPIO & LEDC PWM) và `doc-1-4.md` (Nút nhấn, Pull-up & Debounce) từ hướng dẫn Breakout PCB và Bài 1.1/1.3/1.4 trong `lab1-obc.md` cùng lý thuyết chuẩn.
    - **Lab 4 (`doc-4-7.md`):** mục `Doc 4.7` trong zip không có thân bài nên kết hợp tiêu đề Doc 4.7 với kiến trúc thu thập đa cảm biến khép kín & sơ đồ ghép kênh 74HC4066.
    - **Lab 5:** tách `Doc 5.3` phần LoRa CSS / E32 / RF Configurator vào `doc-5-2.md` (`document-5-lora`), và ghép `Doc 5.2` (Đóng gói, CRC-16, CCSDS) với phần Kiến trúc Trạm Mặt Đất vào `doc-5-3.md` (`document-5-2`).
  - Xuất lại `seed.json` và đồng bộ nhánh `legacy` trong `scripts/export-curriculum.mjs` + `LabLayout.jsx` để đường `/lab` (kể cả Lab 0 `document`) và `/classes` dùng chung bộ 35 tài liệu chuẩn.
- **Nâng cấp `DocViewer.jsx`:** bổ sung `remark-math` + `rehype-katex` hiển thị công thức toán, lazy-load `mermaid` vẽ sơ đồ luồng/kiến trúc (`securityLevel: 'strict'`, fallback code block nếu lỗi) và render các khối cảnh báo `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`.
- **Ghi đè đồng bộ cho các lớp hiện có (`--reset-doc-overrides`):** bổ sung cờ tùy chọn `--reset-doc-overrides` trong `curriculum_seed.py --sync-classes` (`reset_doc_overrides` ở `upgrade_class_to_course_version`), tạo `ClassCourseVersion` `version + 1` sạch sẽ theo immutability triggers và xóa khóa `params["markdown"]` cũ trên các bài `document` (trừ `summary-*`) để toàn bộ lớp hiện có dùng tài liệu mới ngay lập tức mà vẫn giữ nguyên `enabled`, `required`, tiến độ, bài nộp và ngân hàng câu hỏi.

## 24/11/2026 — Nạp bộ câu hỏi mặc định CubeSAT (60 Quiz + 9 Lab Test) & rút đề ngẫu nhiên 5 / 20 câu

- **Kho ngân hàng câu hỏi CubeSAT chỉ nằm ở phía server (`fastapi-backend/app/firmware/curriculum/lab{0..8}/`):**
  - Nhập toàn bộ 43 tệp câu hỏi CSV từ bộ `quizzes.zip` (Lab 0–8 Doc & Practice) thành **60 tệp CSV theo từng bài `quiz`** (tối thiểu 5 câu/bài; các bài thực hành tách theo `source_reference` / từ khóa chuyên đề của từng Lab, và `quiz-doc-4-6` sử dụng nhóm câu hỏi I2C/Multiplexer trong Lab 4 do chưa có file `Doc4.6` riêng) và **9 tệp `labtest-{0..8}.csv`** tổng hợp loại trùng toàn bộ câu hỏi của từng Lab (`200–223` câu/Lab Test), tổng cộng **4.013 câu hỏi** chuẩn CubeSAT. Thay thế `default-question-bank.csv` (10 câu mẫu tin học cũ) bằng 10 câu fallback từ Lab 0 Doc 0.1. Đáp án và giải thích hoàn toàn không nằm trong `seed.json` hay bundle frontend (`AGENTS.md` quy tắc 5).
- **Rút đề ngẫu nhiên theo cấu hình (`num_questions`):**
  - Đổi mặc định chính sách ở `sample_questions.py` và `quizzes.py`: bài `quiz` mặc định rút ngẫu nhiên **5 câu** (`pass_score = 4`, `10 phút`, không giới hạn lượt), bài `labtest` mặc định rút ngẫu nhiên **20 câu** (`pass_score = 16`, `20 phút`, `5 lượt/đợt`, chờ `30 phút`); nếu ngân hàng có ít câu đã duyệt hơn `num_questions`, server rút hết số câu hiện có và hạ `pass_score = min(pass_score, draw)`. Giảng viên có thể tùy chỉnh `num_questions` trên cả `PolicyForm` và cấu hình chương trình lớp (`ALLOWED_PARAMS["quiz" | "labtest"]`). Nâng trần bản nháp mỗi phiên bản ngân hàng từ `200` lên `500` để nạp trọn bộ ngân hàng Lab Test (`~223` câu).
- **Chuẩn hóa kiểm tra đáp án công thức & trùng câu hỏi:**
  - `QuestionInput.valid_choices` đổi sang so sánh bằng NFKC + gộp khoảng trắng + `casefold()` thay vì `normalized()` (vốn xóa dấu `+`, `-`, `*`, `/`), tránh báo lỗi giả cho các lựa chọn công thức toán học như `+50°C` vs `-50°C` hoặc `(NIR - Red)` vs `(NIR * Red)`.
  - `validate_distinct` dùng tập khóa `normalized(prompt)` (O(N)) thay cho ngưỡng `SequenceMatcher >= 0.9` nhằm tránh chặn các cặp câu hỏi kỹ thuật hợp lệ khác tham số (`CPOL = 0` vs `CPHA = 0`, `OBC` vs `C&DH`, `cao nhất` vs `thấp nhất`) và tăng tốc seed/publish ngân hàng Lab Test >200 câu.
- **Làm mới an toàn cho tất cả các lớp hiện có (`refresh_default_banks_for_class`):**
  - Tích hợp vào `sync_classes_to_latest_course` (`--sync-classes`): với mỗi lớp đang có, giữ nguyên toàn bộ câu hỏi do giảng viên tự soạn; chỉ thay các câu từ ngân hàng tin học cũ (`is_legacy_generic_prompt`) hoặc ngân hàng trống bằng bộ câu CubeSAT mới bằng cách tạo phiên bản ngân hàng `version + 1` (không sửa đè bản `published` để tôn trọng PostgreSQL immutability triggers và giữ nguyên lịch sử `QuizAttempt`), tự xuất bản lại nếu trước đó đang `published`, và cập nhật các `QuizPolicy` còn giữ nguyên mặc định cũ `(3, 2, 10)` / `(10, 8, 15)` / `(5, 4, 10)` sang `(5, 4, 10)` / `(20, 16, 20)`. Chạy lặp lại `--sync-classes` là idempotent.
- **Ôn tập chấm ở máy chủ cho đường `/lab` và `/labN/questions`:**
  - Bổ sung `GET /api/curriculum/legacy/labs/{lab_id}/questions`, `GET .../quiz/{lesson_id}` (rút ngẫu nhiên 5/20 câu đã xóa sạch `correct_choice_id` và giải thích), và `POST .../quiz/{lesson_id}/grade` (chấm cả 4 dạng câu hỏi ở server rồi mới trả giải thích), toàn bộ đều chặn bằng `legacy_restricted` (`403 MEMBERSHIP_REQUIRED` cho sinh viên lớp pilot). Frontend dùng `LegacyQuizPanel.jsx` trên `LabLayout` và `LabQuestionsPage`.

## 23/11/2026 — Gộp 11 nhóm thực hành nhiều bài con (179 → 164 bài học)

- **Gộp đúng theo mục cấp 1 của README (26 bài con → 11 bài thực hành cha):**
  - Hợp nhất 11 mục thực hành có nhiều sketch con thành 11 bài `practice` cha trong `src/data/curriculum.js` và `seed.json`, đưa tổng số bài toàn khóa Lab 0–8 từ 179 về **164 bài** (`[10, 31, 12, 23, 35, 15, 12, 14, 12]`): `practice-1-led` (3 bài), `practice-1-button` (2), `practice-1-uart` (2), `practice-1-wifi` (3), `practice-2-max17048` (2), `practice-3-sd` (2), `practice-4-bmp280` (2), `practice-4-imu` (2), `practice-4-nmea-raw` (2), `practice-4-camera` (2), `practice-5-lora` (4).
  - Chuẩn hóa tiêu đề hiển thị sidebar của 13 bài thực hành đơn khớp tên đề mục README (như `Thực hành Component 74HC595 & LED 7 Đoạn`, `Thực hành Component Tiết Kiệm Điện`, …) trong khi giữ nguyên ID kỹ thuật (`Lab1-06_7_Segment_LED`, `Lab2-02_Power_Saving`, …) và toàn bộ 39 bài thực hành phần cứng. Sửa luôn lỗi tiền tố `Lab1-10` / `Lab1-11` trong `Lab1ConnectionNotice.jsx`.
- **Tab bài con bên trong bài học & giữ nguyên draft/tải mẫu/nạp:**
  - Cả `/classes/.../learn` (`ClassLearningPage`) và `/labN` (`LabLayout`) dùng chung `PracticeExerciseTabs` để chuyển qua lại từng bài con; mỗi bài con giữ nguyên khóa nháp `localStorage` C++/Blockly riêng, tải file `.ino` riêng, biên dịch/flash và bộ giải mã trực quan `TelemetryContext`. Liên kết sâu `?lesson=<childId>` tự chuyển về bài cha và mở đúng tab con tương ứng.
  - Phía server (`curriculum_access.py`, `/api/curriculum/exercises`), truy cập `.ino` hoặc compile bằng ID bài con đi qua kiểm quyền bật bài & tiên quyết của bài cha.
- **Nộp gộp một lượt & quy tắc nâng cấp an toàn:**
  - Khi sinh viên nộp bài trên bài thực hành gộp, client tự động gộp mã C++ đã lưu của tất cả các bài con theo tiêu đề `// === <exercise_id> ===` vào một `PracticeSubmission` để giảng viên chấm một lần.
  - Khi nâng cấp lớp từ giáo trình 179 bài cũ lên 164 bài (`upgrade_class_to_course_version`), `LessonProgress` của nhóm gộp chỉ chuyển `completed` khi **tất cả** bài con đã `completed`/`waived`; nếu mới xong một phần thì chuyển `in_progress` và giữ lịch sử bài nộp kèm tiêu đề bài con.
  - `npm run db:seed` mặc định chạy `app.services.curriculum_seed --quiet --sync-classes` với `enable_all_lessons=False` (có thêm cờ tùy chọn `--enable-all-lessons`) để tự động nâng cấp mọi lớp còn ở phiên bản giáo trình cũ khi khởi động/triển khai mà vẫn giữ nguyên lựa chọn bật/tắt bài của giảng viên trên các lớp đã ở bản mới nhất; lớp tạo mới mặc định dùng `latest_published_course_version` (164 bài gộp).

## 23/11/2026 — Chuẩn hóa toàn bộ khung Lab 0–8 theo README (179 bài) & đưa 44 Quiz Lab 2–8 lên `/classes`

- **Khung rỗng Lab 0–8 (179 bài học khớp 100% README):**
  - Bổ sung thư mục khung rỗng phía server `fastapi-backend/app/firmware/curriculum/lab2/` … `lab8/` (các file `video-*.json` để `url: ""` và `doc-*.md` rỗng để fallback về mô tả ngắn trong `lesson-reading.js` cho tới khi giảng viên điền nội dung thật) và cập nhật `LAB_FILES` trong `scripts/export-curriculum.mjs`.
  - Đưa toàn bộ **44 bài Câu hỏi kiểm tra (`quiz-doc-*`, `quiz-practice-*`) của Lab 2–8** vào `seed.json` và `/classes` như bài `quiz` thật do server chấm điểm (tổng **60 bài `quiz` + 9 bài `labtest`** trên toàn 9 Lab: `10, 37, 13, 24, 39, 18, 12, 14, 12` = **179 bài**). Vẫn giữ `checkpointId` trên đối tượng nguồn để giao diện legacy hoạt động không hồi quy; bỏ bước tự sắp xếp lại theo nhóm ở `export-curriculum.mjs` để giữ đúng thứ tự README (bao gồm việc đưa nhóm `Video 4.5` → `Doc 4.6 (74HC4066)` → `Lab4-05_Camera_Multiplexer` lên trước `Doc 4.7` → `Lab4-06_Read_All_Sensors` ở Lab 4).
  - Lớp tạo mới và lớp đồng bộ mặc định bật 100% cả 9 Lab và 179/179 bài học (`course_configuration.defaults`); các bài `quiz` và `labtest` tự nạp sẵn 3/10 câu mẫu từ `default-question-bank.csv` (trừ câu trả lời không bao giờ nằm trong bundle hay `seed.json`) để xuất bản được ngay, giảng viên toàn quyền bật/tắt hoặc sửa từng bài sau.
- **Thống nhất 12 ID kỹ thuật bài thực hành khớp tên README (`0023_readme_id_alignment`):**
  - Đổi tên ID kỹ thuật + file `.cpp` + `catalog.json` cho 8 bài Lab 1 (`Lab1-04_Button`…`Lab1-11_Web_Server_LED`), `Lab3-04_Watchdog_Timer`, 2 bài Lab 4 đảo số/vị trí (`Lab4-05_Camera_Multiplexer`, `Lab4-06_Read_All_Sensors`) và `Lab5-03_Ground_Station_Demo` — trong khi giữ nguyên `upstream_url` / `repositoryUrl` trỏ về các kho GitHub thật để tránh liên kết hỏng và giữ nguyên nội dung/hash `.cpp` đã kiểm chứng biên dịch.
  - Migration `0023_readme_id_alignment` chuyển khóa `lesson_progress` trong `lab_progress` (có `downgrade` đầy đủ theo thứ tự đảo ngược tránh va chạm); `PRACTICE_ID_RENAMES` trong `course_configuration.py` chuyển tiếp cấu hình và `LessonProgress`/`PracticeSubmission` khi nâng cấp lớp; `LEGACY_EXERCISES` trong `project-files.js` giữ đọc lại được bản nháp trình duyệt đã lưu theo bất kỳ ID cũ nào.

## 23/11/2026 — Đồng bộ số bài tối đa giữa các lớp & cập nhật Lab 1 (37 bài)

- **Mặc định bật 100% số bài mỗi lab (`course_configuration.defaults`):** mọi bài học của từng lab (bao gồm cả các bài `video` chưa gắn URL, với `required=false` cho video) mặc định `enabled=true` để lớp mới tạo tự động có đủ số bài bật tối đa giống nhau; giảng viên vẫn có thể bật/tắt riêng từng bài sau đó.
- **Nâng cấp phiên bản giáo trình cho các lớp hiện có (`upgrade_class_to_course_version` & `--sync-classes`):** không sửa đè các bản ghi `class_course_versions`, `class_lesson_settings`, `prerequisites`, `question_banks` đã xuất bản (tôn trọng immutability triggers); tạo `version + 1` ở trạng thái `draft`, nhân bản/giữ nguyên ngân hàng câu hỏi đã soạn, nạp câu hỏi mẫu cho bài mới phát sinh, sao chép `lesson_progress` / `practice_submissions` / `completion_overrides` theo `lesson_id`, rồi tự xuất bản lại nếu lớp trước đó đang ở trạng thái `published`. Bổ sung nút "Cập nhật lên giáo trình mới nhất" (`POST /api/classes/{class_id}/upgrade-course-version`) để tránh lệch phiên bản về sau.
- **Chuẩn hóa danh sách & tên hiển thị Lab 1 (37 bài):** cập nhật mục tiêu, nhóm nội dung và tiêu đề/mô tả Lab 1 theo đề cương chuẩn; giữ nguyên ID kỹ thuật cũ của 8 bài thực hành (`Lab1-03_Button`…`Lab1-10_Web_Server_LED`) để bảo toàn tiến độ/bản nháp trình duyệt và khớp repo upstream, trong khi nhãn và tiêu đề hiển thị đánh số liên tiếp `Lab1-04_Button`…`Lab1-11_Web_Server_LED`. Khắc phục mapping `'doc-1-3'`/`'doc-1-4'` trong `export-curriculum.mjs` và xuất lại `seed.json`.

## 22/11/2026 — Không giới hạn lượt Quiz và đợt 5 lượt / chờ 30 phút cho Lab Test

- **Mặc định mới:** bài `quiz` không giới hạn số lượt làm (`max_attempts = NULL`, `cooldown_minutes = 0`) để sinh viên có thể làm lại ngay đến khi đạt mà không bị kẹt tiến trình sang bài tiếp theo; bài `labtest` giới hạn **5 lượt mỗi đợt** và **chờ 30 phút** (`max_attempts = 5`, `cooldown_minutes = 30`) khi hết đợt chưa đạt.
- **Công bố đáp án khi có thời gian chờ:** với chính sách `after_pass` / `after_attempts`, nếu bài có `cooldown_minutes > 0` (hoặc không giới hạn lượt), đáp án và giải thích **không** công bố khi hết đợt mà chưa đạt (tránh lộ đáp án trước khi làm lại); chỉ công bố khi sinh viên đạt điểm (và khóa làm lại), khi đóng bài (`after_close`) hoặc khi giảng viên đặt `cooldown_minutes = 0`.
- **Cơ chế tính thời gian chờ & cấp thêm lượt:** thời gian chờ tính theo đồng hồ server từ mốc kết thúc lượt cuối của đợt (`expires_at` nếu hết giờ, ngược lại `submitted_at`). Hết thời gian chờ tự mở đợt `max_attempts` lượt mới (lặp lại đến khi đạt). Giảng viên cấp thêm lượt (`attempt-grants`) trong lúc chờ sẽ mở khóa ngay cho đúng số lượt được cấp; nếu dùng hết vẫn chưa đạt thì bắt đầu chu kỳ chờ mới.
- **Tùy chỉnh của giảng viên & mở kẹt dữ liệu cũ:** giảng viên có thể bật/tắt không giới hạn lượt và chỉnh `cooldown_minutes` (`0..1440`) ở cả Cấu hình chương trình và Chính sách bài test. Migration `0022_quiz_attempts_and_cooldown` cập nhật các `quiz_policies` còn ở mặc định cũ (`max_attempts = 3`) sang mặc định mới mà không ghi đè cấu hình đã tùy chỉnh; với sinh viên chưa đạt từng bị ghi `revealed_at` do luật 3 lượt cũ trên bài nay chuyển sang không giới hạn/có thời gian chờ, hệ thống bỏ qua cờ khóa đó để sinh viên làm lại mà vẫn giữ nguyên bản ghi `quiz_attempts` cũ.

## 21/11/2026 — Nạp sẵn câu hỏi mẫu cho Quiz (3 câu) và Lab Test (10 câu) khi cấu hình lớp

- **Nguồn câu hỏi mẫu chỉ ở server:** đặt tệp gốc `fastapi-backend/app/firmware/curriculum/default-question-bank.csv` (10 câu từ mẫu CSV chuẩn, không đưa vào `seed.json` hay bundle frontend). Khi cần thay đề mẫu cho từng lab/bài sau này, chỉ cần đặt file phía server theo thứ tự ưu tiên: `lab{N}/{lesson_id}.csv|json` → `lab{N}/{quiz|labtest}.csv|json` → `default-question-bank.csv`. File khung rỗng (như `{"questions": []}`) tự rơi xuống mức tiếp theo.
- **Xoay vòng cho quiz và 10 câu cho Lab Test:** trong fallback (hoặc file `lab{N}/quiz.*`), mỗi bài `quiz` theo thứ tự trong lab nhận 3 câu xoay vòng `(quiz_index * 3) % N` (không trùng trong một bài); mỗi `labtest` nhận đủ 10 câu.
- **Trạng thái khởi tạo & mặc định lớp mới:** `seed_banks` (khóa hàng lớp chống race) khởi tạo ngân hàng ở `draft` với các câu mẫu ở `approved` (gắn `reviewer` là giảng viên/quản trị viên tạo), giúp giảng viên thêm/sửa/xóa câu ngay mà không cần fork. Chính sách mặc định: quiz 3 câu (đạt 2/3, 10 phút, 3 lượt), Lab Test 10 câu (đạt 8/10, 15 phút, 3 lượt). Các bài `quiz` và `labtest` của lớp mới mặc định `enabled=true`, `required=true`.
- **Tự xuất bản cùng cấu hình lớp & chặn câu nháp:** khi xuất bản cấu hình chương trình lớp, mọi bài `quiz`/`labtest` đang bật thuộc lab đang bật nếu có ngân hàng `draft` với `>= 1` câu đã duyệt và `0` câu nháp sẽ được tự động xuất bản trong cùng transaction (`bank.publish`). Nếu còn câu nháp chưa duyệt, xuất bản bị chặn với mã `QUIZ_DRAFT_UNAPPROVED` để giảng viên không bỏ sót câu mới thêm. Thêm `POST .../question-bank/load-samples` (nạp bổ sung câu mẫu chưa có, không ghi đè/trùng câu hiện có) và nút "Nạp câu hỏi mẫu" trên UI.
- **Migration `0021_default_sample_quiz_banks`:** nạp 1 lần vào các ngân hàng `draft` đang trống (0 câu) của lớp cũ và cập nhật policy `labtest-*` chưa tùy chỉnh (5/4/10 phút → 10/8/15 phút); không đụng tới ngân hàng đã có câu, ngân hàng đã xuất bản hay `class_lesson_settings` cũ. `downgrade` giữ nguyên dữ liệu để không làm mất nội dung soạn thảo.

## 19/11/2026 — Áp giao diện mới của Quân (`quanna1402:fix/frontend-v1`)

- Commit của Quân gộp 282 file trên nền `main` cũ. Phần thay đổi thực, tính so với `develop` (`2adb3ab`), được áp bằng 3-way merge. Chỉ lấy đúng phạm vi: trang loading, sidebar các lab, giao diện Lab 0 (nền, thẻ có tab nổi, icon, font) và các asset đi kèm.
- Không lấy: bỏ `require_lms_enabled` ở API quản lý tài khoản (thay đổi phân quyền phía server, không phải UI), `AdminDashboardPage` (giao diện admin chưa sửa), chỉnh `dev.py`/`scripts/python.mjs` theo máy cá nhân, xoá các file thừa của template Vite.
- Có lấy endpoint `POST /api/progress/{lab}/lessons/{lesson}/reset` (kèm test), vì nút "Đã hoàn thành" của giao diện mới dùng để đặt lại bài. Endpoint chỉ đổi tiến độ của chính người gọi về chưa hoàn thành, nằm trong router legacy nên chịu `require_legacy_allowed`. Sinh viên lớp pilot không dùng được, và endpoint không mở khoá thêm bài nào.
- Mở rộng "các phần giống thế": `LabFigView` dựng được mọi loại mục (video, tài liệu, 3D, thực hành, câu hỏi, tổng hợp, Lab Test, lắp ráp, bài đang khoá). Giao diện này dùng cho Lab 0–8 ở đường cũ và cho trang học theo lớp (`ClassLearningPage`). Header kiểu mới bật ở mọi trang học.
- Trang học theo lớp giữ nguyên nghiệp vụ: % tiến độ lấy từ backend, hoàn thành gửi sự kiện có idempotency key và chờ đủ 60 giây, không có nút đặt lại tiến độ.
- Tiến độ trên trang và sidebar chỉ đếm bài tuần tự (không tính câu hỏi/Lab Test), theo `isSequentialLesson`.
- Bổ sung responsive cho màn hình hẹp (≤720px), vì giao diện Lab 0 gốc chỉ thiết kế cho desktop.

## 18/11/2026 — Gộp nhánh cấu trúc lab (Xuân) với quiz theo bài (Trung, PR #4)

- Lab 0 và Lab 1 theo mô hình quiz theo bài của Trung: `quiz-0-1`…`quiz-0-3`, `quiz-1-1`…`quiz-1-13` là bài `quiz` thật trong course model, có ngân hàng câu hỏi riêng và chấm ở server. Các trang checkpoint tự ôn cũ của Lab 0/1 (`quiz-doc-*`, `quiz-practice-*`) bị bỏ. Hai nhánh này chưa từng phát hành nên không có tiến độ nào trỏ vào chúng.
- Lab 2–8 giữ cấu trúc của Xuân. Các trang câu hỏi có `checkpointId` chỉ là trang tự ôn ở giao diện cũ, không xuất vào course model. Lý do: chưa có ngân hàng câu hỏi, và nếu bật chúng thì việc xuất bản cấu hình lớp sẽ bị chặn (`QUIZ_BANK_NOT_READY`).
- Lab 1 giữ bài `Lab1-03_PWM_LED` (đứng sau `Lab1-02`, nhóm "LED") và trang Lab Test của Xuân. Thứ tự và ID doc/video lấy theo Trung (`doc-1-3`…`doc-1-8`, `video-1-5`). Phần đọc theo chủ đề trong `lesson-reading.js` được chuyển sang ID mới.
- Exporter chỉ dùng file nội dung phía server (`firmware/curriculum/lab0|lab1/*.md`) khi file đó có nội dung. Khi file còn rỗng thì dùng phần đọc sẵn có, để tài liệu Lab 0/1 hiện tại không bị trống. Seed có 135 bài: 119 bài cũ cộng 16 bài quiz.
- Migration `0019_merge_reset_and_quiz` gộp hai head `0015_password_reset_tokens` và chuỗi `0015_lesson_type_quiz`…`0018_quiz_reveal_after_pass`, không thay đổi schema. Điểm merge không dùng được `downgrade -1`; muốn lùi thì lùi về từng parent.
- Rollback theo hướng của Trung (19/11/2026): khi đã có bài quiz hoặc ngân hàng quiz theo bài, `0015`/`0016` từ chối downgrade. Alembic chạy toàn bộ lệnh trong một transaction, nên lệnh bị từ chối không thay đổi gì và DB ở nguyên head. Các test PostgreSQL opt-in kiểm tra đúng hành vi này qua `cli_refused`: lệnh lùi phải thất bại, `alembic_version` và dữ liệu không đổi. Riêng `test_backfill_keeps_old_published_path` mô phỏng DB cũ bằng seed không có bài quiz, nên vẫn lùi về `0009_quizzes` được. Muốn lùi một DB thật qua 0015 thì phải xoá các phiên bản giáo trình có bài quiz và ngân hàng quiz theo bài trước.

## 13/11/2026 — Cấp lại mật khẩu khi người dùng quên

- Kế hoạch không mô tả luồng quên mật khẩu và hệ thống chưa có hạ tầng gửi email (SMTP), nên chọn phương án an toàn nhất về quyền: chỉ quản trị viên cấp lại, qua `POST /api/admin/users/{user_id}/reset-password` (role đọc từ DB, theo cờ `LMS_CLASS_MODE` như các API `/api/admin/users` khác).
- Server tự sinh mật khẩu tạm ngẫu nhiên, chỉ trả về một lần cho quản trị viên; không nhận mật khẩu từ client, không ghi mật khẩu vào log hay `audit_logs` (chỉ ghi `user.password_reset`, actor, target).
- Không cấp lại cho chính mình (dùng đổi mật khẩu ở trang Hồ sơ) và không cấp lại cho tài khoản admin khác, tránh chiếm quyền quản trị. Giảng viên không có quyền này.
- Giả định/rủi ro còn lại: JWT đã phát trước đó vẫn hiệu lực đến khi hết hạn (chưa có cơ chế thu hồi toàn bộ phiên theo người dùng); chưa bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp; tự đặt lại qua email là phần mở rộng khi có SMTP.
## 18/11/2026 — Cấu trúc Lab 1 theo khung Lab 0 (LAB1-01)

- Lab 1 có 36 mục: Video 1.1-1.3, Doc 1.1-1.8, 13 mục `quiz` (`quiz-1-1`…`quiz-1-13`) sau từng doc và từng nhóm thực hành, 10 bài thực hành, `summary-1` và `labtest-1`. Doc, tổng hợp và video là khung rỗng ở `fastapi-backend/app/firmware/curriculum/lab1/` (giảng viên bổ sung sau); quiz và Lab Test chỉ là khung (mặc định tắt, câu hỏi do giảng viên soạn).
- Giữ nguyên 10 ID thực hành `Lab1-01`…`Lab1-10` cùng mã nguồn; danh sách yêu cầu có thêm `Lab1-03_PWM_LED` và đánh số lại, nhưng chưa có mã và đổi ID sẽ mất tiến độ nên chưa thêm. PWM được dạy trong Doc 1.3 như kiến thức mở rộng. Bài 74HC595 vẫn là `Lab1-05_7_Segment_LED` (điều khiển trực tiếp 7 chân), Doc 1.5 giải thích cách chuyển sang 74HC595.
- ID mới: `doc-1-3`…`doc-1-8` và `video-1-5` (Video 1.3 về WiFi) để không đổi nghĩa `document-1-3`, `document-1-4`, `video-1-3`, `video-1-4` cũ; các ID cũ này không còn trong phiên bản giáo trình mới. Lớp đã ghim phiên bản cũ không bị ảnh hưởng; nâng lớp lên cấu trúc mới cần script nâng cấp riêng (chưa làm), tiến độ doc/video cũ không chuyển sang ID mới.
- Lab Test của Lab 1 hướng tới 10 câu (giảng viên cấu hình trong ngân hàng, không còn ràng buộc cứng số câu).

## 18/11/2026 — Quiz theo bài và nâng cấp lớp lên Lab 0 mới (LAB0-02)

- Mỗi bài `quiz` có ngân hàng câu hỏi và chính sách riêng, khoá theo `lesson_id` (migration `0016_lesson_quiz_banks`; bank và chính sách cũ được gán `labtest-<lab>`). Giảng viên soạn, duyệt, xuất bản câu hỏi và đặt số câu mỗi lượt (1-20), điểm đạt, thời gian, số lượt ngay trong Cấu hình chương trình. Lab Test giữ nguyên: đúng 20 câu đã duyệt, mỗi lượt rút 5 câu.
- Quiz theo bài chỉ hoàn thành bằng cách đạt điểm (`finalize`), không có nút "Hoàn thành". Bật một bài quiz chưa có ngân hàng đã xuất bản bị chặn khi xuất bản cấu hình (`QUIZ_BANK_NOT_READY`), vì bài quiz không thể hoàn thành sẽ khoá mọi bài sau nó trong lab.
- Lớp đã xuất bản bị ghim vào một phiên bản giáo trình; không có đường nâng cấp trên giao diện. Thêm `fastapi-backend/scripts/upgrade_class_course_version.py`: một giao dịch tạo cấu hình lớp mới, trỏ lại tiến độ, lượt thi, ngân hàng câu hỏi sang phiên bản mới và xuất bản. Mặc định chỉ thay Lab 0 (tạo phiên bản giáo trình lai: Lab 1-8 của lớp giữ nguyên, Lab 0 lấy từ bản mới nhất), vì lớp 1 đang dùng bản giáo trình trước khi cấu trúc lại Lab 1-8 và nhiều ID bài đã đổi tên.
- Bài mới của Lab 0 được chép vào lớp ở trạng thái TẮT để sinh viên đã hoàn thành Lab 0 không mất hoàn thành và Lab 1+ không bị khoá; giảng viên bật sau khi thêm nội dung. Lớp 1 đã được nâng cấp ngày 18/11/2026 trên cơ sở dữ liệu dev (40 dòng tiến độ giữ nguyên), có sao lưu `pg_dump` trước đó.
- Xem trước công khai cho khách vẫn chỉ gồm `components`; không mở thêm bài nào.
- Cập nhật cùng ngày (migration `0017_quiz_all_approved`): bỏ ràng buộc "đúng 20 câu, rút 5" của Lab Test và "số câu mỗi lượt" của quiz. Mỗi lượt làm bài gồm toàn bộ câu đã duyệt (xáo trộn); giảng viên thêm bao nhiêu câu thì sinh viên làm bấy nhiêu. Xuất bản cần ít nhất 1 câu đã duyệt. Điểm đạt được giới hạn không vượt số câu của lượt khi bắt đầu.
- Công bố đáp án mới `after_pass` (migration `0018_quiz_reveal_after_pass`), thành mặc định: lượt nộp đạt điểm tối thiểu thấy giải thích ngay; lượt chưa đạt vẫn ẩn đến khi hết lượt để còn làm lại. Sau khi đáp án đã được công bố thì khóa làm lại. Giải thích hiện ngay dưới từng lựa chọn (khóa theo id lựa chọn, đúng cả khi đề bị xáo thứ tự); trước đây nhãn "Phương án A-D" dùng id gốc nên lệch với thứ tự hiển thị. Chính sách cũ `after_attempts` được chuyển sang `after_pass`; các lượt đã làm giữ chính sách đã chụp.

## 17/11/2026 — Khung rỗng Lab 0 và loại bài mới `quiz` (LAB0-01)

- Lab 0 có 10 mục: Video 0.1 (`overview`), Doc 0.1 (`document`), câu hỏi `quiz-0-1`, Doc 0.2 (`document-0-2`), câu hỏi `quiz-0-2`, Video 0.2 (`video-0-2`), Thực hành 3D (`components`), câu hỏi `quiz-0-3`, Tổng hợp (`summary-0`) và `labtest-0`. Giữ nguyên ID cũ `overview`, `document`, `components` để không mất tiến độ đã lưu.
- Thêm loại bài `quiz` (migration `0015_lesson_type_quiz`) thay vì gắn câu hỏi vào bài cha, vì người dùng muốn mỗi bộ câu hỏi là một mục riêng trên menu. Việc này lệch kế hoạch LMS (4 loại bài), nên ghi lại tại đây. `quiz` mặc định tắt, không bắt buộc, không thể tự hoàn thành bằng sự kiện `complete` từ client, và không có đáp án trong dữ liệu seed.
- Đáp án chỉ lưu ở server: `fastapi-backend/app/firmware/curriculum/lab0/quiz-*.json` và `labtest-0.json` là chỗ dự trữ, exporter không đọc nên không vào `seed.json` hay bundle. Bộ nạp câu hỏi/chấm quiz theo bài chưa làm.
- Xem trước công khai giữ nguyên ranh giới cũ: chỉ `components` có `preview_allowed=true`; khách không thấy các mục mới của Lab 0. Downgrade `0015` từ chối chạy nếu còn bài `quiz`, tránh làm mất dữ liệu.
- Chưa làm: mô hình 3D WebGL, nội dung video/tài liệu/câu hỏi. Các lab 1-8 không đổi.

## 08/11/2026 — Mở rộng soạn đề Lab Test 4 dạng câu hỏi & đề mẫu tham khảo (QUIZ-01/02)

- Hỗ trợ 4 dạng câu hỏi theo cấu trúc đề mẫu: `single_choice` (Phần I: 1 đáp án đúng), `multiple_choice` (Phần II: nhiều đáp án đúng `a|b|d`), `true_false` (Phần III: Đúng/Sai 4 mệnh đề `a:Đ|b:S|c:S|d:Đ`, hỗ trợ tiền tố `[0,1,2,...]` điều khiển thứ tự đảo mệnh đề khi sinh đề), và `short_answer` (Phần IV: trả lời ngắn).
- Cho phép giảng viên mở và soạn câu hỏi/đáp án trực tiếp ngay tại mục Lab Test trên trang Cấu hình chương trình (`ClassCurriculumPage`) hoặc trang Ngân hàng câu hỏi (`QuestionBankPage`), tự động khởi tạo ngân hàng nếu lớp chưa lưu nháp lần đầu.
- Bổ sung bộ đề mẫu tham khảo tải về (`/templates/labtest-sample-exam.txt`, `/templates/question-bank.xlsx`, `/templates/answer-sheet-sample.csv`) và hỗ trợ nhập câu hỏi từ tệp `.xlsx`, `.csv`, `.txt`/`.md`, `.json` hoặc dán trực tiếp văn bản đề mẫu.

## 07/11/2026 — Nhập danh sách sinh viên hàng loạt từ Excel/CSV (CLASS-02)

- Giữ nguyên chức năng thêm từng sinh viên bằng email (`POST /api/classes/{class_id}/members`) và bổ sung `POST /api/classes/{class_id}/members/import` (cùng mẫu tải về `/templates/class-students.xlsx`, `/templates/class-students.csv` và `GET /api/classes/templates/students?format=xlsx|csv`).
- Cấu trúc mẫu gồm cột `email` (bắt buộc) và `full_name` (tùy chọn để giảng viên đối chiếu, không tự ý ghi đè họ tên tài khoản đã đăng ký). Hỗ trợ cả `.xlsx` và `.csv` (tối đa 1 MB, 500 dòng/lần, kiểm tra chống XML entity/zip bomb).
- Xử lý theo từng dòng hợp lệ (theo lựa chọn của người yêu cầu): thêm mới hoặc khôi phục membership `student` cho các email đã có tài khoản `active` (kèm `audit_logs`), giữ nguyên sinh viên đang active, và trả về danh sách chi tiết các dòng bị bỏ qua (`NOT_REGISTERED`, `ACCOUNT_LOCKED`, `IS_TEACHER`, `INVALID_EMAIL`, `DUPLICATE_IN_FILE`, `EMPTY_EMAIL`).

## 26/10/2026 — Dashboard, migration, pilot (Sprint 5)

- Cờ theo lớp (người yêu cầu chọn): `LMS_CLASS_MODE` vẫn là công tắc tổng; mỗi lớp có `lms_mode` = `enabled` | `read_only` | `off`, chỉ Admin đổi, bắt buộc lý do, có audit. Lớp mới và lớp có trước migration 0010 mặc định `enabled` để giữ hành vi đã chạy dưới cờ tổng.
- Đường legacy (`/api/progress`, compile không ngữ cảnh lớp, `/api/curriculum/legacy|exercises|source`, mã mẫu Lab 1) bị chặn theo **từng user**: chỉ SV đang thuộc lớp `enabled`/`read_only` (lớp chưa lưu trữ). User ngoài pilot giữ luồng cũ như trước (kế hoạch 10.5). Đây là thay đổi so với Sprint 2–4, khi cờ tổng bật thì chặn mọi user. Request có `class_id`/`lesson_id` luôn đi đường kiểm quyền lớp.
- Rollback lớp (người yêu cầu chọn): `read_only` chặn mọi request ghi của lớp (`CLASS_READ_ONLY`, GET vẫn đọc được), SV vẫn bị chặn đường legacy và được hướng tới nội dung trải nghiệm. `off` mới đưa SV của lớp về luồng cũ. Worker vẫn chấm lượt thi hết giờ theo đáp án đã lưu trong lúc lớp chỉ-đọc.
- URL cũ `/labN?lesson=`: lớp hợp lệ = SV active, lớp active + `enabled`, có chương trình đã xuất bản bật lab (và bài nếu có `lesson`). Một lớp → vào lớp; nhiều lớp → chọn lớp; không lớp → luồng cũ nếu user ngoài pilot, trải nghiệm nếu là SV pilot.
- SV hoạt động 7/30 ngày = có `progress_event` không phải thao tác của GV (`override`), hoặc bắt đầu lượt Lab Test trong khoảng thời gian. Đăng nhập không được tính. Tỷ lệ hoàn thành lab tính trên SV active của lớp active, lớp không `off`, có lab đó được bật. Điểm Lab Test trung bình = trung bình điểm cao nhất mỗi SV.
- Báo cáo/CSV chỉ cho GV/Admin của lớp. CSV có BOM UTF-8 và chặn công thức (ô bắt đầu `= + - @`). Lịch sử `lab_progress.compiled_at` chỉ hiển thị, không tính hoàn thành; GV công nhận bằng miễn bài có lý do.
- Migration dữ liệu: không bảng mới cho legacy (lab_progress đã là lịch sử). Công cụ `app.services.legacy_migration` chạy chỉ-đọc khi báo cáo/dry-run; nhập lớp pilot dùng lại service tạo lớp/thêm SV (audit, khôi phục membership), chỉ từ danh sách email cụ thể, dừng nếu danh sách có lỗi.
- Kiểm thử tải: Sprint 1 chưa chốt con số, dùng mặc định 300 SV đồng thời trong một lớp, một worker như production. E2E/tải ở mức API, không thêm Playwright/Locust (người yêu cầu chọn).

## 22/10/2026 — Tiến độ và lộ trình (Sprint 3)

- lesson_version = course_version_id + '/' + lesson_id. Membership phân tách lớp; đổi enabled/required/order trong revision cấu hình không xóa kết quả bài. Course version gốc bất biến, đổi course cần migration riêng. Kết quả completed/waived đã có được giữ khi sửa params; submission lưu rubric/policy tại thời điểm nộp để đối soát.
- Chính sách bản đầu: miễn bài có lý do của GV được tính thỏa yêu cầu (allow_waivers=true). Unlock lab chỉ miễn điều kiện truy cập, không tạo hoàn thành. Các override được ghi riêng cùng actor/lý do và audit; không nhập điểm giả. Không import lab_progress legacy thành kết quả LMS.
- Mở khóa thủ công chỉ áp dụng revision cấu hình đã cấp; xuất bản cấu hình mới cần GV cấp lại nếu vẫn phù hợp. Kết quả completed/waived gắn lesson_version vẫn được giữ.
- Prerequisites lưu theo class_id + config version; backfill snapshot đã xuất bản theo đúng dữ liệu cũ, không tự đổi lộ trình lớp đang học. Template mới dùng phân nhánh mục 5.2; GV có thể áp dụng tuần tự hoặc sửa thủ công trong bản nháp.
- Ghi tiến độ chỉ cho membership student active của chính người gọi; GV/Admin xem thử không ghi sự kiện. Nội dung lab khóa chỉ trả metadata và lý do, API mã mẫu/compile/events/submissions cùng kiểm điều kiện. API progress legacy bị chặn khi LMS_CLASS_MODE bật.
- Video native HTML5 đo các đoạn phát; server dùng duration_seconds và watch_ratio đã cấu hình, hợp nhất đoạn không trùng, mỗi đoạn tối đa 60 giây. Không tin duration/%/status gửi từ client. Nguồn iframe không đo được chỉ cho xác nhận khi GV bật confirmation_allowed. Sự kiện trình duyệt là chỉ báo học tập, không phải cơ chế chống gian lận tuyệt đối.
- Bài nộp lưu phiên bản code, rubric, membership và lesson_version. Chỉ bản nộp mới nhất được chấm để thay đổi kết quả; pending_review chưa đạt, yêu cầu sửa quay về in_progress. Nộp lại sau completed/waived không thu hồi thành quả trước đó. Lớp archived chỉ đọc.
- Event/submission/override dùng idempotency key và transaction. Cùng key khác nội dung/ngữ cảnh trả VERSION_CONFLICT. Membership được khóa khi ghi để tuần tự hóa cập nhật; không ghi đè % từ frontend.
- Giữ khóa localStorage cũ; scoped editor chỉ nhập bản cũ khi người dùng chọn nút phục hồi. Không tự đọc legacy key khi mở bài học. UI tiếp tục skill frontend-design: màu/font hiện có, sơ đồ lab với khóa/lý do, thanh tiến độ và dashboard bảng SV × lab; không thêm trang trí không phục vụ việc học.

## 22/10/2026 — Giáo trình và cấu hình theo lớp (Sprint 2)

- ID lab 0–8 và ID lesson hiện có được giữ nguyên; khóa DB gồm course_version_id + ID để lưu nhiều phiên bản mà không đổi định danh bài. Seed tạo snapshot xuất bản, kiểm hash nguồn và từ chối ghi đè snapshot đã đổi; nội dung thiếu là TODO, không tự tạo hướng dẫn kỹ thuật hay câu hỏi.
- Lớp có các revision cấu hình; chỉ revision published mới được SV đọc, draft là bản làm việc riêng. Mỗi revision gắn một course version đã published. GV chọn course version khi lưu nháp đầu tiên; không tự gán giáo trình cho lớp. Không cho chuyển course version sau lần xuất bản đầu (chuyển phiên bản lớp đang học cần quy trình migration riêng).
- Settings API nhận toàn bộ labs/lessons và expected_version để chống ghi đè. Params chỉ cho phép trường được định nghĩa theo loại bài; không nhận đáp án/giải thích/câu hỏi test. Video/document có thể được GV bổ sung qua params của lớp; không sửa course version gốc. Lab có enabled/prerequisites trong snapshot để kiểm phụ thuộc và chu trình.
- Seed giữ 84 ID cũ (81 mục Lab 1–8 và 3 mục Lab 0), thêm 9 slot labtest chưa có ngân hàng và để disabled/optional mặc định. Summary giữ ID, đổi type=document, title=Tổng kết; components giữ ID, đổi practice tùy chọn. Video URL trống/URL mẫu Lab 0 không được coi là sẵn sàng. Labtest chưa triển khai thi được chặn nếu đặt required.
- Preview là đường API riêng, chỉ trả preview_allowed từ snapshot course đã xuất bản; không cấp quyền quản trị lớp. Thành viên removed vẫn bị chặn trên đường theo lớp, không tự fallback sang preview. Preview GV dùng cấu hình draft và không gửi bất kỳ event tiến độ/compile.
- Gỡ nội dung tĩnh khỏi toàn bộ import graph browser (kể cả flag tắt) và cung cấp legacy qua API khi flag tắt. Flag bật thì /labN chuyển sang lớp/preview, API legacy bị chặn; không dựa vào biến build frontend để bảo vệ học liệu. JS seed vẫn nằm trong repo nhưng không được đóng gói vào assets production.
- Khi bật flag, compile yêu cầu class_id + lesson_id đã bật trong bản published, kiểm membership; compile không ghi completed_at. Preview không được compile. Cờ tắt vẫn hỗ trợ công cụ cũ; compiled_at chỉ là lịch sử build, không tạo hoàn thành mới. Không xóa kết quả legacy đã có. Đây là thay đổi cần thiết để đường cũ không vượt quyền lớp và tuân thủ Compile ≠ hoàn thành.
- UI tiếp tục dùng skill frontend-design đã đọc: màu và font của Sprint 1, danh sách lab có thể mở rộng, hàng bài với bật/tắt/bắt buộc, form tham số theo loại, lỗi đặt cạnh bài và xác nhận tác động trước xuất bản. Khung xem thử ghi rõ “Xem như sinh viên”, không có nút ghi tiến độ.

## 22/10/2026 — Phạm vi Sprint 1

- Chỉ triển khai tài khoản và quản trị lớp. Theo chỉ đạo trực tiếp, giữ nguyên progress/compiler/curriculum, kể cả quy tắc compile legacy. Lớp Sprint 1 chưa gán giáo trình hoặc có khóa tiến trình; không công bố đây là pilot khóa học hoàn chỉnh.
- `LMS_CLASS_MODE=false` mặc định, kiểm tra phía server cho API mới; GET `/api/lms/config` trả cờ cho frontend đã đăng nhập. Khóa tài khoản áp dụng cho mọi API đăng nhập bất kể flag. Không dùng cờ frontend độc lập để cấp quyền.
- Admin quản lý được mọi lớp. GV cần đồng thời role hệ thống teacher và membership teacher active của lớp. Thu hồi teacher về user vô hiệu quyền quản trị ngay; membership được giữ để bảo toàn dữ liệu, chỉ Admin có thể phục hồi năng lực quản trị.
- Admin tạo lớp phải chỉ định GV active; GV tự tạo lớp thì tự làm GV lớp. Thêm/xóa member trong Sprint 1 chỉ quản lý SV; không cho đổi membership teacher qua endpoint thêm SV.
- GET lớp chỉ hiện lớp có quyền; SV chỉ xem lớp active/archived, không xem draft hoặc danh sách email SV khác. GV không thuộc lớp nhận 403. DELETE lớp là lưu trữ, không xóa dữ liệu; lớp archived chỉ đọc, không sửa metadata/thành viên. Không khôi phục archived trong bản đầu.
- PATCH `/api/admin/users` nhận user_id và role/status cần đổi; không cấp admin qua API, không sửa tài khoản admin bằng API này để tránh khóa quản trị viên cuối cùng. Hỗ trợ PATCH theo ID cũng dùng chung nghiệp vụ. Thay đổi và audit commit cùng transaction, không ghi password/token vào audit.
- Mã lớp chuẩn hóa uppercase/strip; email thành viên lower/strip. Thêm lặp là no-op; phục hồi dùng đúng bản ghi membership cũ, cập nhật added_by/added_at và xóa removed_at. Audit giữ dấu vết thay đổi.
- Migration rollback giữ bảng/cột/enum đã thêm để bảo toàn dữ liệu; downgrade chỉ lùi revision. Upgrade sau rollback kiểm tra đối tượng đã tồn tại. Không chạy binary cũ không hiểu role teacher; dùng feature flag tắt module để rollback chức năng. Sẽ kiểm chứng dữ liệu mới còn nguyên qua downgrade/upgrade trên DB thử.
- UI dùng màu hiện có: nền #f8fafc, bề mặt #ffffff, chữ #0f172a, navy #0a4174, đường viền #e2e8f0; font Inter. Bố cục căn trái, thanh điều hướng quản lý, bảng danh sách có bộ lọc và form rõ nhãn. Không thêm dashboard số liệu chưa có trong scope. Trạng thái lỗi/rỗng và bàn phím/mobile được xử lý cùng luồng chính.

# 2026-10-22 — Lab Test: snapshot, quyền và trải nghiệm

- Ngân hàng theo lớp/lab, xuất bản bất biến; bản sửa sao chép ID logic của câu và ID lựa chọn. Thu hồi câu ngừng cấp đề mới đến khi xuất bản bản sửa, không tự đổi điểm lịch sử; báo số lượt bị ảnh hưởng để GV quyết định cấp lượt/override có lý do.
- Thi ở cuối lab: hoàn thành hoặc được miễn các bài bắt buộc khác trước khi bắt đầu. Một lượt active theo membership + phiên bản bài; mọi start/save/submit khóa lớp rồi membership/lượt thi, có unique index bảo vệ thêm ở DB.
- Đồng hồ server, hết giờ chấm đáp án đã lưu kể cả membership vừa bị thu hồi (worker nội bộ); API vẫn từ chối người đã mất quyền. Reveal mặc định sau khi hết lượt; đã xem đáp án không được cấp/start thêm lượt trên cùng bài test.
- Policy chụp lúc bắt đầu. Cấu hình lớp đã xuất bản có thể ghi đè thời gian/điểm đạt/số lượt; thay đổi không sửa lượt đang thi. Score rule highest; pass không bị mất khi lần sau điểm thấp hơn.
- AI chỉ nhận snapshot tài liệu document được GV chọn trong lab, không đọc user/điểm vào payload. Reserve chi phí trước mỗi lần gọi, kể cả retry thất bại; giới hạn theo ước tính tối đa/call do quản trị cấu hình, không thay thế hạn mức hóa đơn của nhà cung cấp. Worker gián đoạn không tự gọi lại để tránh tính phí hai lần.
- UI giữ hệ thiết kế hiện có: navy #0a4174 cho thao tác, #0f172a chữ, #ffffff nội dung, #f8fafc nền phụ, #e2e8f0 đường phân chia, #b91c1c lỗi. Inter cho nhãn/nội dung, căn trái; câu hỏi có chiều rộng đọc vừa phải. GV dùng danh sách câu + form biên tập, SV dùng các lựa chọn lớn và thanh thời gian/trạng thái lưu luôn rõ. Không thêm hình trang trí hay animation vào màn hình thi.
- Phác thảo: GV `[Lab / trạng thái / số đã duyệt] [danh sách câu | nội dung + duyệt]`; SV `[thời gian | đã lưu] [câu + 4 lựa chọn] [nộp bài]`. Đã đối chiếu với luồng học CubeSAT: ưu tiên nguồn tham chiếu, duyệt và trạng thái lưu hơn các thẻ thống kê chung chung.

# 2026-11-11 — Cấu trúc lại Lab1, 3, 4, 6, 7 theo tổ chức PTITCube

- Làm theo cấu trúc repo hiện tại của PTITCube. Lab 6 giữ lại chỉ với lắp ráp cơ khí vì không còn bài code nào trên GitHub; số Lab vẫn là 0–8.
- Các repo "ví dụ cha" (Lab2-01, Lab3-01, Lab4-01 đến 04, Lab5-01/02) được thêm thành bài thực hành riêng, đứng đầu nhóm bài a/b tương ứng.
- Đổi ID bài cũ sang ID mới bằng migration `0013_curriculum_restructure` (có downgrade). Tiến độ và bản nháp của `Lab2-01a_Battery_GPIO` chuyển sang `Lab2-01a_Battery_I2C`; nội dung bài vẫn là đo ADC.
- Compiler vẫn ghim PTITCube-Library `218d2b6` kèm overrides. Thư viện upstream đã tiến tới `41f19ba` (EPS dùng MAX17048). Các sketch upstream đã đổi nhiều và cần thư viện mới được giữ ở bản local đã kiểm chứng, ghi rõ trong `notes` của `catalog.json`. Nâng thư viện và rebase overrides là việc riêng, chưa làm.
- Bài mới từ upstream không thêm log Serial; panel trực quan chỉ hiện dữ liệu sketch tự in.
- Video bài mới của Lab 1 để trống (TODO GV); tài liệu Doc 1.3 tóm lược từ README upstream.
- Cập nhật cùng ngày: nhóm xác nhận kit vẫn đo pin bằng ADC qua cầu chia áp. Giữ PTITCube-Library `218d2b6` (không nâng lên `41f19ba`/MAX17048); `Lab2-01a_Battery_I2C` dùng lại bản ADC đã kiểm chứng, chỉ đổi ID theo tên repo.

# 2026-11-13 — Xác thực Google, nút xem mật khẩu và luồng cấp lại mật khẩu

- **Clock skew cho Google Sign-In (`_GOOGLE_CLOCK_SKEW_SECONDS = 60`):** `verify_google_credential` truyền `clock_skew_in_seconds=60` vào `id_token.verify_oauth2_token` (Google ID token sống 3600s) vì đồng hồ máy chủ/máy local lệch nhẹ vài giây sau giờ UTC của Google sẽ gây lỗi `InvalidValue("Token used too early")`, khiến người dùng thấy thông báo nhầm là token hết hạn. Mọi lỗi xác thực vẫn được từ chối 401 và chỉ log loại lỗi/lý do đã lọc, không log raw credential.
- **Mở khóa quản trị tài khoản & cấp lại mật khẩu khỏi `LMS_CLASS_MODE`:** `/api/admin/users`, `PATCH /api/admin/users*`, `/api/admin/users/{id}/reset-password` và `/api/admin/users/{id}/reset-link` luôn hoạt động khi `LMS_CLASS_MODE=false` để Admin quản lý khóa/mở tài khoản và xử lý quên mật khẩu ở mọi chế độ vận hành; quyền `admin` vẫn kiểm tra từ DB ở mỗi request. Các API lớp học (`/api/classes*`, `/api/admin/classes/*`) tiếp tục phụ thuộc `LMS_CLASS_MODE`.
- **Luồng cấp lại mật khẩu kết hợp Email (SMTP) + Hàng chờ Admin:**
  - `POST /api/auth/forgot-password` luôn trả HTTP 200 với thông điệp trung tính (không lộ email có tồn tại hay không).
  - Khi cấu hình `SMTP_HOST`, server tạo token ngẫu nhiên 1 lần (lưu hash SHA-256 trong `password_reset_tokens`, TTL mặc định 30 phút, dựng URL từ `FRONTEND_URL`/`ALLOWED_ORIGINS` đã kiểm duyệt) và gửi qua email; nếu SMTP lỗi hoặc chưa cấu hình, yêu cầu tự chuyển sang trạng thái `pending` để Admin cấp liên kết tự đặt lại 1 lần hoặc mật khẩu tạm tại `/admin/users`.
  - Token đặt lại chỉ dùng 1 lần (`WITH FOR UPDATE`), tự hết hạn, đặt lại sẽ xóa khóa brute-force theo cả `email` và cặp `email:ip`, thu hồi các yêu cầu cũ và chỉ ghi hành động vào `audit_logs` (không lưu token/mật khẩu). Migration `0015_password_reset_tokens` dùng `IF NOT EXISTS` và giữ bảng khi `downgrade` để bảo toàn lịch sử thu hồi token.

# 2026-11-17 — Đồng bộ bài thực hành với PTITCube (thư viện v1.1.0) và trang câu hỏi cuối Lab

- Kiểm tra lại: 44 bài hiện có đều biên dịch qua với compiler v6, nhưng cả 48 repo Lab và PTITCube-Library đã có commit mới (thư viện v1.1.0, `57cf1c3`). Theo yêu cầu "đồng bộ đầy đủ": merge 3 chiều (bản ghim cũ / bản local đã vá / upstream mới) cho từng sketch, giữ các bản vá an toàn local (giới hạn input Serial, kiểm tra số byte ghi SD, JPEG SOI/EOI, tên ảnh không ghi đè, `hasFix()` thay cho tọa độ 0,0, chân LoRa theo `PTIT_COM`).
- Lấy upstream khi upstream viết lại theo README: Lab2-01a (MAX17048 qua Wire), Lab2-02 (power gating GPIO 4), Lab3-03, Lab3-04 (TWDT thuần — bỏ bài phát hiện rơi/quá nhiệt và `scripts/test-firmware-logic.py`), Lab4-02a (burst 14 byte), Lab4-03b (NMEA + checksum), Lab4-04a (lưu ảnh vào SD), Lab7-01.
- Sửa lỗi upstream: đơn vị từ trường Lab4-02/02b (Gauss in nhãn uT), Lab4-01 chia áp suất hai lần, Lab4-05/4-03c coi "có vệ tinh" là có fix, chân M1=GPIO35 (chỉ vào) ở Lab5-01a/02a, `PTIT_CDH` không biên dịch trên ESP32-S3, camera không MUX kẹt ở 9600 baud.
- Thêm 3 bài: `Lab1-03_PWM_LED`, `Lab3-05_Event_Driven_Queue`, `Lab4-03c_GPS_PTITCube`. Không thêm `Lab3-04_Watchdog_Timer` vì trùng nội dung `Lab3-04_Watchdog_And_Event` (README ghi "hoặc"). ID cũ giữ nguyên; nhãn Lab 1 đánh số lại 01–11 theo README.
- Compiler: overrides rebase lên v1.1.0, revision v7; lệnh chụp ảnh đổi `CAPTURE` → `p` (camera-slave local nhận cả hai).
- **Xung đột cần nhóm chốt:** mục 2026-11-11 ghi kit đo pin bằng ADC và cố ý không dùng MAX17048. Thư viện v1.1.0 và README mới dùng MAX17048. Nếu kit thực tế không có MAX17048, Lab2-01a/01b/02 và EPS trong Lab7 sẽ không đọc được pin — khi đó cần override `PTIT_EPS` về ADC và giữ sketch ADC cho Lab2-01a.
- Trang câu hỏi cuối Lab (`/labN/questions`): khung trống theo các mục "❓ Câu hỏi kiểm tra" của README, dữ liệu tại `src/data/lab-questions.js`. File này nằm trong bundle nên chỉ được chứa đề và lựa chọn; đáp án/giải thích phải ở ngân hàng Lab Test phía server (quy tắc 5). Trang không ghi tiến độ và đi qua cùng cổng `LabEntry` như `/labN`.

# 2026-11-17 (bổ sung) — Đội phần cứng chốt 5 điểm sau đồng bộ v1.1.0

Nguồn: "Báo cáo phản hồi và xác nhận đồng bộ phần cứng PTITCube v1.1.0" (17/11/2026). Thay thế ghi chú "kit đo pin bằng ADC" của mục 2026-11-11.

- **Pin (phương án A):** EPS chỉ dùng MAX17048 qua I2C 0x36, không còn ADC GPIO 34. Giữ thư viện v1.1.0 và các sketch Lab2-01/01a/01b/02 hiện tại; sửa chú thích "ADC" còn sót ở Lab2-01 và mô tả Lab 2 trong `labs.js`. Xung đột ghi ở mục trên coi như đã đóng.
- **Camera:** UART0 (GPIO 1/3) của ESP32-CAM chỉ để nạp code/debug PC; giao thức với OBC chạy trên UART2 (TX GPIO 14, RX GPIO 15, 115200), lệnh `p`. `firmware/camera-slave` chuyển giao thức sang UART2, log debug vẫn in ở UART0; vẫn nhận `CAPTURE` cho sketch cũ.
- **LoRa E32:** RX26/TX25 (UART1), AUX27, M0=32, M1=33 theo `PTITCube.h` — trùng bản đã sửa ở Lab5-01a/02a, không đổi thêm.
- **GPIO 4:** Lab 1 chạy trên PCB thí nghiệm rời, không nối với chân Buck của EPS. Thêm lưu ý vào Doc 1.1.
- **GPIO 12:** xác nhận khởi động/nạp ổn định với MUX 74HC4066 (mức LOW lúc boot nhờ pull-down nội của MTDI). Không đổi code.
- Upstream (PTITCube-Library, Lab2-01, Lab5-01a/02a) chưa có commit mới sau `57cf1c3`; không cần đồng bộ lại.

# 2026-11-17 — Tái cấu trúc trình tự bài học theo README PTITCube/.github

- Mỗi Lab 0–8 theo đúng thứ tự README: Video → Doc → Câu hỏi kiểm tra Doc → … → Thực hành → Câu hỏi kiểm tra Thực hành → Tổng hợp → **Lab Test**. Lab 0 có đủ Video 0.1/0.2, Doc 0.1/0.2, khám phá mô hình 3D và 3 phần câu hỏi.
- Trang câu hỏi (`quiz-<checkpoint>`) và trang `labtest-N` là khung trống: nội dung lấy từ `src/data/lab-questions.js` (chỉ đề và lựa chọn, không đáp án). Chúng **không** chặn bài tiếp theo, không nằm trong mẫu số tiến độ và không thể "Hoàn thành bài học" qua `/api/progress/.../complete` (`LESSON_NOT_SELF_COMPLETABLE`), vì kết quả phải do server chấm (quy tắc 5, 6). Nếu không loại ra, sinh viên sẽ kẹt ở trang chưa có câu hỏi.
- Kế hoạch LMS chỉ cho 4 loại bài và "không tạo loại bài thứ năm": `quiz` chỉ tồn tại ở chế độ học cũ (`seed.legacy`); mô hình khóa học (`seed.labs`) bỏ qua `quiz` và vẫn tự thêm `labtest-N`. Bài lắp ráp Lab 6 (`assembly-6`) là `practice` với `mode: "assembly"`, không có mã mẫu, không bắt buộc mặc định.
- ID: giữ nguyên mọi ID bài thực hành và ID bài cũ khi chủ đề khớp README (đổi nhãn số, ví dụ `document-1-4` → Doc 1.7, `document-4-2` → Doc 4.4, `document-5-2` → Doc 5.3, `document-8-2` → Doc 8.3, `video-1-4` → Video 1.3, `video-4-5` → Video 4.5 về xung đột UART). Doc có chủ đề mới dùng ID mới (`document-1-button`, `-74hc595`, `-uart`, `-millis`, `document-3-cli`, `document-4-imu`, `-gnss`, `-camera`, `-sensors`, `document-5-lora`, `document-6-2`, `-6-3`, `document-7-1`, `-7-3`, `document-8-widgets`, `document-0-2`, `video-0-2`).
- Bỏ khỏi danh sách: `video-1-3` (video GPIO, README không còn, chưa có URL) và `document-3-2` (nội dung Task/scheduler gộp vào Doc 3.3). Tiến độ đã lưu của hai ID này vẫn còn trong `lab_progress.lesson_progress`, không bị xóa.
- Giữ các bài thực hành "ví dụ cha" (Lab2-01, Lab3-01, Lab4-01…04, Lab5-01/02) dù README không liệt kê, để không mất bài đã biên dịch kiểm chứng và tiến độ/bản nháp của sinh viên; đặt chúng đầu nhóm a/b tương ứng.
- Sinh viên đang học dở: các Doc mới chèn vào giữa lab trở thành bài chưa hoàn thành, nên phải đọc chúng trước khi tiếp tục; lab đã hoàn thành (`completed_at`) không bị ảnh hưởng. Mô hình khóa học có phiên bản mới (hash nguồn đổi); lớp đang dùng phiên bản cũ không đổi cho đến khi GV chọn phiên bản mới.

## 2026-11-18 — Bỏ bài thực hành "cha", gọn khung thực hành và gợi ý code
- Quyết định: khi một bài có bản a/b (Lab2-01, Lab3-01, Lab4-01..04, Lab5-01/02) thì bỏ bài cha khỏi danh sách bài học, trang câu hỏi và seed; chỉ còn 39 bài thực hành (lớp học: 29 bài từ Lab 2). Mã nguồn và mục catalog của bài cha được giữ để bản nháp trình duyệt cũ và đường dẫn cũ vẫn biên dịch được; `lab_progress` không bị đổi.
- Lab3-01a/b chỉ hiển thị Serial Monitor (không bảng SD, không "Kết quả thực hành").
- Lab3-02: bảng "Kết quả lệnh" ghép mỗi lệnh `User> ...` với phản hồi (OK/ERR/pwd), không chỉ lệnh lỗi. Chỉ đọc log Serial, không suy ra thao tác thành công nếu thiết bị không phản hồi.
- Gợi ý code Monaco chỉ gồm hàm và biến (hàm Arduino, API PTITCube v1.1.0, khai báo trong chính file); tắt gợi ý từ khóa, snippet, từ lấy từ chú thích/chuỗi.
- Blockly: các stack gốc chồng nhau được tự dời xuống theo chiều cao thật; bố cục không chồng của sinh viên được giữ nguyên.
- Rủi ro: sinh viên đang ở giữa bài cha sẽ không còn thấy bài đó trong danh sách; tiến độ cũ vẫn nằm trong DB.

## 2026-11-18 — Sửa Lab 4: IMU 4.2a, GPS 4.3c, Serial Monitor, tên bài 4.4b
- Lab4-02a: `(Wire.read() << 8) | Wire.read()` có thứ tự đánh giá không xác định trong C++, nên byte thấp có thể bị đọc trước và số liệu IMU sai. Sửa bằng `readInt16()` đọc byte cao rồi byte thấp; cập nhật sha/verified_build trong `catalog.json`. Định dạng log giữ nguyên như 4.2b nên viewer 3D không đổi.
- Lab4-03c: bộ giải mã ghép thêm các dòng riêng "Vĩ độ … Bắc/Nam", "Kinh độ … Đông/Tây", "Cao độ (altitude)" thành vị trí có dấu, để bản đồ vẫn có điểm khi thiếu dòng "Tọa độ (Vĩ độ, Kinh độ)". Chưa tái hiện được lỗi trên bo thật; cần log Serial thật nếu bản đồ vẫn trống.
- Serial Monitor: gom dòng nhận được và cập nhật giao diện mỗi 80 ms (bộ giải mã vẫn nhận từng dòng ngay); thêm Tạm dừng/Tiếp tục, Sao chép, tự cuộn theo vị trí cuộn và nút "↓ Cuối". Áp dụng cho mọi bài.
- Lab4-04b đổi tên: "Chụp ảnh bằng thư viện PTIT_Camera, lưu thẻ SD và gửi ảnh về trình duyệt qua Serial". ID không đổi.
- Hiển thị ảnh camera qua MQTT: hoãn, kế hoạch riêng ở `Docs/MQTT_PLAN_2026-11-18.md`.

## 2026-11-19 — Chính sách mật khẩu mạnh khi đặt mật khẩu mới
- Quyết định: mật khẩu mới phải có tối thiểu 8 ký tự, ít nhất 1 chữ cái in hoa và 1 ký tự đặc biệt (không phải chữ, số hay khoảng trắng); giữ giới hạn 72 byte UTF-8. Áp dụng ở server (`validate_new_password` trong `app/schemas/auth.py`) cho đăng ký, đăng ký admin đầu tiên, đổi mật khẩu và đặt lại mật khẩu; frontend dùng `src/utils/passwordPolicy.js` để báo trước và hiển thị yêu cầu.
- Không áp dụng cho đăng nhập: tài khoản cũ có mật khẩu yếu vẫn đăng nhập được, chỉ phải theo quy tắc mới khi đổi hoặc đặt lại. Không buộc đổi mật khẩu hàng loạt.
- Không thêm yêu cầu chữ số hay danh sách mật khẩu phổ biến (ngoài phạm vi). `scripts/create_admin.py` (CLI) không đi qua schema nên chưa áp dụng.

## 2026-11-19 — Quên mật khẩu tự phục vụ qua email
- Quyết định: dùng luồng email có sẵn (link một lần, TTL `PASSWORD_RESET_TOKEN_TTL_MINUTES`, mặc định 30 phút) làm đường chính; bật bằng cách điền `SMTP_*` và `FRONTEND_URL` trong `fastapi-backend/.env` (mẫu ở `.env.example`) rồi khởi động lại backend. Không điền thì giữ hành vi cũ: yêu cầu chuyển về admin tại `/admin/users`.
- Gửi mail lỗi vẫn rơi về hàng chờ admin; thông báo chung nay nói rõ khả năng đó và vẫn giống hệt với email không tồn tại để không lộ thông tin tài khoản.
- Rủi ro: Gmail cá nhân có hạn mức thư/ngày; `FRONTEND_URL` sai sẽ làm link trong email trỏ sai. Chưa kiểm thử gửi thư thật vì chưa có thông tin SMTP.

## 2026-11-20 — Xác minh email khi đăng ký
- Quyết định: khi SMTP đã cấu hình, đăng ký tạo tài khoản chưa xác minh (`users.email_verified_at` rỗng), gửi liên kết một lần (hash trong `email_verification_tokens`, hết hạn sau `EMAIL_VERIFICATION_TTL_HOURS`, mặc định 24 giờ) và không cấp token. Đăng nhập bằng email/mật khẩu bị chặn bằng mã `EMAIL_NOT_VERIFIED` (HTTP 403) cho đến khi xác minh; chỉ báo sau khi mật khẩu đúng nên không lộ tài khoản. Mã này là mã mới ngoài danh sách dùng chung trong AGENTS.md.
- Khi SMTP chưa cấu hình, đăng ký coi tài khoản là đã xác minh và cấp token như trước. Quy tắc chặn chỉ áp dụng khi SMTP bật, nên tắt SMTP không làm khóa người dùng đang chờ xác minh.
- Tài khoản hiện có được backfill `email_verified_at = created_at` (migration `0020_email_verification`); đăng nhập Google, admin đầu tiên và hoàn tất đặt lại mật khẩu qua email cũng đánh dấu đã xác minh.
- Gửi lại thư xác minh: phản hồi luôn giống nhau với email lạ; mỗi lần gửi thu hồi liên kết cũ; có giới hạn tần suất theo IP.
- Downgrade xóa cột và bảng token (chỉ mất trạng thái xác minh mới; upgrade lại backfill tất cả là đã xác minh).
- Test: `app/tests/conftest.py` ép `smtp_host` rỗng cho mọi test để `.env` cục bộ không làm đổi luồng hay gửi thư thật.

## 2026-11-20 — Xóa tài khoản (admin)
- Quyết định: `DELETE /api/admin/users/{id}` xóa mềm (`deleted_at`, trạng thái khóa), không xóa dòng dữ liệu, vì các khóa ngoại RESTRICT (lớp, thành viên, audit, thiết bị) và quy tắc không phá dữ liệu cũ. Phiên đăng nhập hiện có mất hiệu lực ngay, tài khoản bị gỡ khỏi mọi lớp (membership chuyển `removed`), yêu cầu đặt lại mật khẩu đang mở bị thu hồi, ghi `audit_logs` (`user.delete`, không lưu email).
- Chỉ admin; không xóa chính mình, không xóa tài khoản admin; giảng viên còn phụ trách lớp chưa lưu trữ bị từ chối (409, trả danh sách mã lớp) để lớp không mồ côi. Tiến độ học tập, bài làm và báo cáo của tài khoản vẫn được giữ.
- Email của tài khoản đã xóa vẫn bị giữ (chỉ mục duy nhất), nên chưa đăng ký lại được bằng email đó. Giải phóng email hoặc khôi phục tài khoản là việc riêng nếu cần.

## 2026-11-20 — Không cấp thêm quyền Admin qua giao diện hoặc API
- Quyết định: bỏ nút "Cấp quyền Admin" ở `/admin/users` và chặn ở server: `AdminUserPatch.role` chỉ nhận `teacher` hoặc `user`, gửi `admin` bị từ chối 422. Các tài khoản admin đã tạo giữ nguyên (đăng nhập, Khóa/Mở khóa, bảo vệ admin cuối cùng không đổi).
- Admin mới chỉ tạo được qua `POST /api/admin/signup` (khi hệ thống chưa có admin) hoặc `scripts/create_admin.py`. Hạ quyền admin vẫn không có trên giao diện.

## 2026-11-25 — Đồng bộ tài liệu từ PTITCube-Docs (commit `aa19e97`)
- Quyết định: chép nội dung `LabN_DocN.M.md` của repo PTITCube-Docs vào `fastapi-backend/app/firmware/curriculum/labN/doc-N-M.md`, ghép theo chủ đề, không theo số. Giữ nguyên ID bài, nhãn và số doc trên web; tiêu đề H1 đổi sang dạng `# Doc X.Y: <tiêu đề mới>` theo nhãn của web.
- Lệch số: Lab 1 repo bỏ Doc GPIO/PWM và Doc nút nhấn nên Doc 1.3–1.6 của repo vào `doc-1-5`…`doc-1-8`; `doc-1-3`, `doc-1-4` giữ bản cũ. Lab 5 repo đảo thứ tự: repo 5.3 (LoRa) → `doc-5-2`, repo 5.2 (CRC/CCSDS) → `doc-5-3`.
- `doc-4-7` giữ bản cũ vì Doc 4.7 trong repo chỉ còn danh sách bài thực hành.
- Bỏ khi chép: mục "Câu hỏi củng cố/đánh giá" (trùng bài quiz chấm ở server), mục H2 "💻 Hướng dẫn thực hành" (có mã lời giải đầy đủ) và phần nhúng doc lắp ráp (link tương đối `./LabX_DocY.md` không dùng được trên web). Mục khám phá 3D trong Doc 0.2 được giữ.
- Chưa thêm 6 doc lắp ráp/kết nối mới (1.7, 2.3, 3.5, 4.8, 5.4, 6.4): còn chỗ trống "Vị trí chèn hình", và thêm bài vào giữa lộ trình sẽ đổi chuỗi mở khóa của lớp đang học. Sẽ thêm khi có hình và vị trí bài được chốt.
- Cấu trúc khóa học giữ nguyên (9 lab, 164 bài). `seed.json` có `source_hash` mới; chạy `npm run db:seed` để tạo phiên bản khóa học mới. Lớp nào đã sửa markdown riêng cho bài doc thì giữ bản sửa đó, trừ khi seed chạy với cờ xóa override.

## 2026-11-26 — Admin cấp liên kết đặt lại mật khẩu thì gửi email cho người dùng
- Quyết định: khi đã cấu hình SMTP, `POST /api/admin/users/{id}/reset-link` gửi liên kết đặt lại tới email của tài khoản đó, trả thêm `email_sent`. Luồng tự phục vụ qua `/forgot-password` giữ nguyên.
- Gửi lỗi không chặn admin: liên kết vẫn trả về một lần để gửi thủ công (`email_sent=false`), log chỉ ghi email đã che.
- Thư chỉ gửi tới email đã đăng ký của tài khoản, không nhận địa chỉ từ client; tài khoản admin vẫn không cấp được liên kết qua đường này.
