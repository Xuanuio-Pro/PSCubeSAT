# Nội dung Lab 0 (khung rỗng)

Mỗi mục của Lab 0 có một file riêng để bổ sung nội dung sau. Bổ sung xong, chạy `npm run curriculum:export`
rồi `npm run curriculum:seed` (hoặc khởi động lại backend để seed phiên bản mới).

| Mục (ID bài) | File | Nội dung cần điền |
|---|---|---|
| Video 0.1 (`overview`) | `video-0-1.json` | `url`, `duration_seconds`, `tracking_mode` |
| Doc 0.1 (`document`) | `doc-0-1.md` | Markdown tài liệu |
| Doc 0.2 (`document-0-2`) | `doc-0-2.md` | Markdown tài liệu |
| Video 0.2 (`video-0-2`) | `video-0-2.json` | như Video 0.1 |
| Thực hành 3D (`components`) | `practice-explorer.json` | `instructions`, `model_url`, `parts` |
| Tổng hợp Lab 0 (`summary-0`) | `summary-0.md` | Markdown tổng hợp |
| Câu hỏi Doc 0.1 / Doc 0.2 / Thực hành | `quiz-0-1.json`, `quiz-0-2.json`, `quiz-0-3.json` | `questions` kèm đáp án |
| Ngân hàng Lab Test (`labtest-0`) | `labtest-0.json` | 20 câu đã duyệt kèm đáp án |

## Quy tắc đáp án

- File `quiz-*.json` và `labtest-0.json` **chỉ nằm ở server**. Exporter không đọc chúng, nên đáp án
  không bao giờ vào `seed.json`, bundle frontend hay response khi đang làm bài (AGENTS.md, quy tắc 5).
- Khi khởi tạo ngân hàng cho lớp mới (hoặc bấm "Nạp câu hỏi mẫu"), backend tìm câu mẫu theo thứ tự:
  `lab{N}/{lesson_id}.csv|json` → `lab{N}/quiz.csv|json` / `labtest.csv|json` → `default-question-bank.csv`
  (3 câu xoay vòng cho mỗi quiz, 10 câu cho Lab Test). File JSON rỗng sẽ tự rơi xuống file mặc định.
- Ngưỡng mặc định: quiz 3 câu (đạt 2/3, 10 phút), Lab Test 10 câu (đạt 8/10, 15 phút); có thể chỉnh trên giao diện lớp.
