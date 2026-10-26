# Sprint 4 — Lab Test và ngân hàng câu hỏi

Ngày: 22/10/2026, kiểm chứng lại 26/10/2026. Phạm vi: mục 6 của kế hoạch, trên nền lớp, giáo trình và tiến độ của Sprint 1–3.

## Kết quả

- Ngân hàng theo lớp + lab + version, trạng thái `draft|published`. Câu hỏi lưu theo `question_versions` (4 lựa chọn có ID ổn định, 1 đáp án, giải thích, mục tiêu, độ khó, tham chiếu nguồn, `draft|approved|retired`, người duyệt). Bản đã xuất bản không sửa tại chỗ.
- Soạn: CRUD câu, import JSON/CSV theo mẫu, kiểm tra định dạng, lựa chọn trùng, thiếu/sai đáp án và câu gần trùng (tỉ lệ giống ≥ 0,9). Lỗi import không lặp lại nội dung tệp. Sửa nội dung đưa câu về nháp, phải duyệt lại.
- Xuất bản chỉ khi có đúng 20 câu approved có người duyệt; ngược lại trả `BANK_NOT_READY`.
- Sinh câu nháp bằng AI qua interface `QuestionGenerator` (bản đầu: `OpenAICompatibleGenerator`). Nguồn chỉ là document của lab được GV chọn; không có dữ liệu SV/điểm. Job nền có trạng thái `queued|running|succeeded|failed`, tối đa 3 lần gọi, giữ hạn mức chi phí trước mỗi lần gọi theo ngày (UTC). Thiếu cấu hình → `ai_available=false`, form ẩn, import thủ công vẫn chạy. Kết quả luôn là draft.
- Lượt thi: kiểm tra membership, lộ trình, các bài bắt buộc khác của lab, số lượt (gồm lượt cấp thêm) và thời điểm đóng. Đã có lượt active thì trả lại lượt đó. Rút 5/20 câu bằng `secrets.SystemRandom`, xáo câu và lựa chọn, lưu snapshot câu/thứ tự/đáp án/policy. Unique index một lượt active theo membership + lesson_version.
- Lưu tạm có `expected_revision` và idempotency key; nộp idempotent; đồng hồ server, hết giờ chấm theo đáp án đã lưu (kể cả do worker nền khi SV không quay lại). Đạt → `lesson_progress` của labtest `completed`, lộ trình tự mở lab kế tiếp. Điểm cao nhất được dùng; đạt rồi không bị mất.
- Response khi làm bài không có đáp án/giải thích. Công bố theo `reveal_policy`: `after_attempts` (mặc định), `after_close`, `immediate`, `never`. Đã công bố thì không cấp/bắt đầu thêm lượt.
- GV cấp thêm lượt có lý do (audit). Thu hồi câu sai tạo phiên bản ngân hàng mới, ngừng cấp đề mới đến khi xuất bản bản sửa, báo số lượt bị ảnh hưởng; lịch sử thi giữ nguyên.
- Frontend: trang soạn/duyệt ngân hàng, chính sách, job AI, cấp lượt và thống kê tỷ lệ đúng theo phiên bản câu; màn hình thi với đồng hồ, lưu tạm, khôi phục từ `localStorage` khi mất mạng (chỉ lưu lựa chọn), xử lý xung đột hai tab, chặn double-submit; kết quả trong cùng panel.
- Mẫu import: `public/templates/question-bank.json`, `.csv`, `question-bank-guide.md`. Lưu cấu hình giáo trình tự tạo ngân hàng nháp rỗng + policy mặc định cho Lab 0–8; không seed câu hỏi chuyên môn nào.

## File triển khai

| Nhóm | File chính |
|---|---|
| Schema/migration | `fastapi-backend/app/models/quiz.py`, `alembic/versions/0009_quizzes.py` |
| Ngân hàng/thi/AI | `services/question_banks.py`, `services/quizzes.py`, `services/question_generation.py` |
| API | `schemas/quiz.py`, `routers/quizzes.py`, `application.py`, `lifespan.py` (worker `quiz-worker`), `core/config.py` |
| Tích hợp cấu hình | `services/course_configuration.py` (`bank_ready`, ghi đè thời gian/điểm đạt/số lượt) |
| UI | `src/pages/QuestionBankPage.jsx`, `components/classes/QuizPanel.jsx`, `quiz-storage.js`, `quiz.css`, `ClassLearningPage.jsx`, `ClassCurriculumPage.jsx`, `App.jsx` |
| Kiểm thử | `app/tests/test_quizzes.py`, `test_quizzes_postgres.py`, `test_question_generation.py`, `tests/quiz-storage.test.js` |
| Quyết định | `Docs/DECISIONS.md`, mục “Lab Test: snapshot, quyền và trải nghiệm” |

## Migration

`0009_quizzes` thêm `question_banks`, `question_versions`, `quiz_policies`, `quiz_attempts`, `quiz_attempt_items`, `quiz_answers`, `quiz_requests`, `quiz_attempt_grants`, `question_generation_jobs`, `question_generation_budgets`. Downgrade chỉ lùi revision, giữ bảng/dữ liệu/guard; upgrade lại idempotent. Không áp dụng vào DB ứng dụng thật trong lượt này.

## API

Yêu cầu đăng nhập + `LMS_CLASS_MODE`. GV = teacher của lớp (hoặc Admin); SV = student active.

| Method/path | Quyền và kết quả |
|---|---|
| GET `/api/classes/{id}/labs/{lab}/question-bank` | GV: ngân hàng mới nhất, câu, policy, `ai_available` |
| POST/PUT/DELETE `.../question-bank/questions[/{qid}]` | GV, bản nháp, `expected_revision` |
| POST `.../questions/{qid}/review` | GV: `approved`/`draft`/`retired` |
| POST `.../question-bank/import` | GV: `format` json/csv + `content`; lỗi một dòng thì không nhập gì |
| POST `.../question-bank/publish` | GV: đúng 20 approved, ngược lại `BANK_NOT_READY` |
| POST `.../question-bank/fork` | GV: lý do + câu cần thu hồi (tùy chọn); trả `affected_attempts` |
| GET/POST `.../question-bank/generation-jobs`, POST `.../{job}/retry` | GV; chỉ khi đã cấu hình AI |
| PUT `/api/classes/{id}/labs/{lab}/quiz-policy` | GV: thời gian, điểm đạt, số lượt, reveal, thời điểm đóng |
| POST/GET `/api/classes/{id}/labs/{lab}/attempts` | SV: bắt đầu/trả lượt active; lịch sử của mình |
| PUT `/api/attempts/{id}/answers` | SV chủ lượt: lưu tạm |
| POST `/api/attempts/{id}/submit`, GET `/result` | SV chủ lượt: chấm/kết quả, idempotent |
| POST `.../attempt-grants` | GV: cấp thêm lượt có lý do + idempotency key |
| GET `.../quiz-statistics` | GV: tỷ lệ đúng theo phiên bản câu, chỉ lượt đã chấm |

Mã lỗi: `BANK_NOT_READY`, `ATTEMPT_LIMIT_REACHED`, `ATTEMPT_EXPIRED`, `PREREQUISITE_NOT_MET`, `VERSION_CONFLICT`, `CONFIG_INVALID`, `MEMBERSHIP_REQUIRED`, `FORBIDDEN_ROLE`.

Biến môi trường server (để trống key thì ẩn tính năng): `QUIZ_AI_PROVIDER=openai_compatible`, `QUIZ_AI_KEY`, `QUIZ_AI_MODEL`, `QUIZ_AI_ENDPOINT`, `QUIZ_AI_MAX_CALL_USD`, `QUIZ_AI_DAILY_USD`.

## Kiểm chứng (26/10/2026)

```powershell
$env:PSCUBESAT_PYTHON='C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe'
npm run dev:db
npm run check
npm run build
$env:PSCUBESAT_TEST_POSTGRES='1'
Set-Location fastapi-backend
node ../scripts/python.mjs -m pytest app/tests -q
```

- `npm run check`: đạt — lint, typecheck, schema, 118 test Node, 152 test backend (15 skip do PostgreSQL/Docker opt-in).
- `npm run build`: đạt; vẫn có cảnh báo chunk lớn của thư viện editor/3D như trước.
- Pytest với PostgreSQL thật: **150 passed, 2 skipped** (2 skip là compiler Docker). Gồm Alembic CLI upgrade DB sạch, `downgrade -1` → `upgrade head` giữ dữ liệu, schema khớp ORM.
- Ruff check + format các file quiz: đạt.

Các ca chính đã có test: không publish khi < 20 approved; 5 câu không trùng; đáp án không có trong response lúc làm bài (đáp án chỉ lưu trong DB, frontend không chứa dữ liệu câu hỏi; chưa có test tự quét bundle); refresh trả cùng đề; start/submit lặp và đồng thời trên PostgreSQL không tạo thêm lượt hay cộng tiến độ hai lần; hết giờ, nộp muộn, hết lượt; sửa/thu hồi ngân hàng không đổi lượt cũ; cuối lab → test → đạt → mở lab kế tiếp; AI chỉ gửi tài liệu đã chọn, retry/hạn mức, không ghi đè khi ngân hàng đổi giữa chừng.

## Giả định và giới hạn

- Ngân hàng rỗng: 180 câu cho Lab 0–8 cần GV soạn/duyệt; chưa có lab nào thi được cho đến khi xuất bản đủ 20 câu.
- Hạn mức chi phí AI là ước tính tối đa/lần gọi do vận hành cấu hình, không thay thế hạn mức hóa đơn của nhà cung cấp. Worker gián đoạn đánh dấu job thất bại, không tự gọi lại.
- Kiểm tra gần trùng dựa trên so khớp chuỗi, không phát hiện câu cùng nghĩa khác chữ.
- Chưa có quy trình tự động chấm lại điểm khi thu hồi câu; GV xử lý bằng cấp lượt/override có lý do.
- Chưa thử AI provider thật (không có key trong môi trường kiểm thử); đường gọi provider được kiểm bằng generator giả.
