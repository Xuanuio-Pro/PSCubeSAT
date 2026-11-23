# Nội dung Lab 1 (khung rỗng)

Mỗi mục của Lab 1 có một file riêng để bổ sung nội dung sau. Bổ sung xong, chạy `npm run curriculum:export`
rồi `npm run curriculum:seed` (hoặc khởi động lại backend để seed phiên bản mới).

| Mục (ID bài) | File | Nội dung cần điền |
|---|---|---|
| Video 1.1 / 1.2 / 1.3 (`video-1-1`, `video-1-2`, `video-1-5`) | `video-1-1.json`, `video-1-2.json`, `video-1-3.json` | `url`, `duration_seconds` |
| Doc 1.1, 1.2 (`document-1-1`, `document-1-2`) | `doc-1-1.md`, `doc-1-2.md` | Markdown tài liệu |
| Doc 1.3 - 1.8 (`doc-1-3` ... `doc-1-8`) | `doc-1-3.md` ... `doc-1-8.md` | Markdown tài liệu |

Bài thực hành `Lab1-01` ... `Lab1-11` dùng mã `.cpp` ở thư mục cha, không đổi. Các mục `quiz-1-1` ... `quiz-1-13`
và `labtest-1` khi khởi tạo lớp tự nạp câu mẫu từ server (ưu tiên file riêng trong `lab1/` nếu có, mặc định lấy từ
`../default-question-bank.csv`: 3 câu xoay vòng cho mỗi quiz, 10 câu cho Lab Test); đáp án chỉ lưu ở server.
