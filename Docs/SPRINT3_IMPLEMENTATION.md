# Sprint 3 — Tiến độ, lộ trình và bài nộp

Ngày: 22/10/2026. Phạm vi: mục 5 và 7.3 của kế hoạch, trên nền tài khoản/lớp và giáo trình của Sprint 1–2.

## Kết quả

- Lộ trình mặc định phân nhánh: 0 → 1/2; 1 → 3/4/5; 2 AND 3 AND 4 → 6; 5 AND 6 → 7; 7 → 8. GV có nút áp dụng mẫu tuần tự/phân nhánh và chỉnh tiên quyết trong bản nháp. Validator chặn chu trình, lab tắt và ID ngoài phiên bản.
- Backend tính tiến độ từ bài enabled + required. `pending_review` chưa đạt; `waived` có lý do được tính thỏa yêu cầu theo chính sách bản đầu. Mở khóa dựa trên trạng thái từng yêu cầu, không dựa vào % làm tròn. Mẫu số thay đổi theo cấu hình published, không xóa kết quả cũ.
- Video HTML5 gửi đoạn phát liên tục, bỏ khoảng tua; backend hợp nhất các đoạn chồng nhau và so với thời lượng/ngưỡng đã cấu hình (mặc định 90%). Mở trang chỉ bắt đầu bài. Nguồn không đo được chỉ cho xác nhận nếu GV bật; lưu vị trí để xem tiếp.
- Document mở thành `in_progress`, nút “Đánh dấu đã đọc” mới hoàn thành. Thực hành lưu từng phiên bản mã nguồn/rubric; GV duyệt bản mới nhất mới hoàn thành. Yêu cầu sửa quay về `in_progress`; compile không tạo hoàn thành.
- Trang lộ trình có khóa/lý do, tiến độ và “Tiếp tục học”; ưu tiên bài bắt buộc đủ điều kiện nếu bài vừa học đã xong. Sidebar có dấu đạt và chờ chấm. Dashboard GV có ma trận SV × lab, bài chờ chấm, rubric/code/nhận xét và miễn bài/mở khóa có lý do.
- Cả API nội dung, source, compile, events và submissions kiểm tra điều kiện. Nội dung đang khóa chỉ trả metadata/lý do; API progress legacy bị chặn khi flag bật. Preview GV/Admin không ghi tiến độ.
- Bản nháp C++/Blockly có namespace user/class/lesson. Không tự lấy bản legacy; người dùng phải bấm khôi phục. Khôi phục giữ khóa cũ, tải bản sao hiện tại trước khi thay thế.

## File triển khai

| Nhóm | File chính |
|---|---|
| Schema/migration | `fastapi-backend/app/models/learning.py`, `models/tables.py`, `alembic/versions/0008_learning_progress.py` |
| Quy tắc thuần | `fastapi-backend/app/services/learning_rules.py` |
| Transaction và quyền nội dung | `services/learning_progress.py`, `services/course_configuration.py`, `services/curriculum_access.py` |
| API | `schemas/learning.py`, `routers/learning.py`, `routers/curriculum.py`, `routers/progress.py`, `application.py` |
| UI | `src/pages/LearningPathPage.jsx`, `ClassProgressPage.jsx`, `ClassLearningPage.jsx`, `ClassCurriculumPage.jsx`, `ClassDetailPage.jsx` |
| Player/editor/điều hướng | `src/components/common/VideoPlayer.jsx`, `editor/IDEPanel.jsx`, `editor/BlocklyEditor.jsx`, `classes/use-lms-resource.js`, `classes/classes.css`, `src/App.jsx`, `contexts/auth-session.js` |
| Kiểm thử | `app/tests/test_learning.py`, `test_learning_postgres.py`; cập nhật fixture curriculum và kỳ vọng revision migration của các test cũ |
| Quyết định | `Docs/DECISIONS.md`, phần Sprint 3 |

Compiler đã nhận context lớp/bài và ngừng tạo hoàn thành từ Sprint 2; Sprint 3 thêm kiểm tra lộ trình vào service dùng chung. Các ID bài thực hành, bảng `lab_progress` và khóa lưu cũ được giữ.

## Migration và dữ liệu

Migration `0008_learning_progress` thêm `prerequisites`, `lesson_progress`, `progress_events`, `completion_overrides`, `practice_submissions`. Prerequisites gắn class + config revision; backfill đúng snapshot cũ, không tự đổi thành sơ đồ mới. PostgreSQL từ chối sửa/xóa/thêm quan hệ của cấu hình đã published.

Tiến độ unique theo membership + lesson_version; lesson_version dùng course_version_id/lesson_id. Bài nộp unique theo progress + revision; lưu code và rubric tại lúc nộp. Event có key unique, payload hash và response để trả lại chính xác khi retry. Transaction khóa lớp rồi membership khi ghi, nên sự kiện và nộp bài đồng thời không mất cập nhật hoặc tăng revision hai lần.

Downgrade chỉ lùi revision, giữ bảng/dữ liệu/guard. Đã kiểm chứng downgrade -1 → upgrade head giữ tiến độ, hai phiên bản bài nộp và snapshot. Rollback chức năng dùng feature flag; không chạy binary cũ không hiểu schema/role mới. Không áp dụng migration vào DB ứng dụng thật trong lượt này.

## API

Tất cả đường dưới đây có tiền tố `/api/classes/{class_id}` và yêu cầu đăng nhập + flag:

| Method/path | Quyền và kết quả |
|---|---|
| GET `/learning-path` | SV: của mình; GV: mẫu hoặc chọn `membership_id` trong lớp. Labs có access, reason, missing_prerequisites, completed/required_count, percent và trạng thái bài |
| GET `/progress` | SV: bản thân; GV/Admin của lớp: thành viên, ma trận tiến độ và các bản mới nhất đang chờ chấm |
| POST `/lessons/{lesson_id}/events` | SV active của chính mình. Nhận idempotency_key, kind và start/end/position cho video; không nhận percent/status |
| POST `/lessons/{lesson_id}/submissions` | SV active, bài thực hành đã mở và có rubric. Nhận idempotency_key + code; trả 201 bản nộp/revision |
| GET `/lessons/{lesson_id}/submissions` | SV chỉ lịch sử của mình; GV xem trong lớp, theo phiên bản bài |
| GET `/submissions/{submission_id}` | Đọc bài nộp sở hữu hoặc thuộc lớp quản lý, gồm code và rubric snapshot |
| POST `/submissions/{submission_id}/review` | GV/Admin quản lý lớp: verdict approved/changes_requested + feedback. Bản cũ sau khi SV nộp mới trả VERSION_CONFLICT |
| POST `/completion-overrides` | GV/Admin: membership_id, action waive/unlock, lesson_id hoặc lab_id, reason + idempotency_key; ghi actor/audit |

Kinds: `opened`, `document_read`, `video_segment`, `video_confirmed`. Đoạn video tối đa 60 giây, số hữu hạn và trong thời lượng cấu hình. Cùng key khác payload/ngữ cảnh trả 409 VERSION_CONFLICT. Xử lý key và ghi tiến độ/bài nộp cùng transaction. Lớp archived chỉ đọc; removed/locked bị chặn dù token cũ còn hạn.

Ví dụ sự kiện:

```json
{"idempotency_key":"<UUID>","kind":"video_segment","start":10.2,"end":15.4,"position":15.4}
```

Video params mới: `duration_seconds`, `tracking_mode` (`native` hoặc `confirmation`), `confirmation_allowed`; tiếp tục dùng `watch_ratio`. Thời lượng/ngưỡng do GV xuất bản; client không tự chọn tiêu chí. Nguồn native phải là định dạng trình duyệt phát được; URL iframe cần chế độ xác nhận hoặc đổi sang nguồn đo được.

## Kiểm chứng

Các lệnh chạy từ root, Python dùng môi trường `stemcube` qua PSCUBESAT_PYTHON:

```powershell
$env:PSCUBESAT_PYTHON='C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe'
npm run check
npm run build
$env:PSCUBESAT_TEST_POSTGRES='1'
Set-Location fastapi-backend
node ../scripts/python.mjs -m pytest app/tests -q
```

Test PostgreSQL tự tạo/xóa DB `pscubesat_test_<UUID>`, gọi Alembic CLI thật: upgrade head trên DB sạch; downgrade -1; upgrade head; đối chiếu schema với ORM. Có ca nâng từ 0007 với quan hệ published cũ và xác nhận backfill giữ nguyên.

Test nghiệp vụ bao gồm AND của Lab 6; Lab 0 mở đồng thời 1/2; pending chưa mở khóa; compile không tạo đạt; video mở trang/union/tua/90%/manual policy; tài liệu mở/đã đọc; key lặp hoặc xung đột; cùng SV hai lớp độc lập; tắt bài tính lại %; miễn bài và phạm vi unlock; thu hồi thành viên, preview và archived.

Trên PostgreSQL, sáu request document cùng key trả cùng response và chỉ một event/progress; bốn request nộp cùng key tạo một revision. Nộp revision tiếp theo khiến bản cũ không thể chấm; downgrade/upgrade giữ nguyên kết quả và code.

Trình duyệt đã thử với fixture SQLite riêng và video HTML5 12 giây: mở chưa đạt; phát đạt ngưỡng mới có dấu ✓; bấm đã đọc mở Lab 1/2; nộp mã thấy “Chờ chấm” và Lab 3 còn khóa; GV đọc code/rubric rồi duyệt thì ma trận Lab 1 lên 100%, danh sách chờ chấm về 0 và Lab 3/4/5 mở. Ảnh fixture: `scratch/sprint3-dashboard-preview.png`. Dữ liệu thử không nằm trong DB ứng dụng.

Kết quả cuối:

- `npm run check`: đạt lint, TypeScript, schema, 115 test Node và backend discovery 139 test (14 skip vì PostgreSQL/Docker opt-in chưa bật trong lệnh này).
- `npm run build`: đạt; guard không cho bundle module giáo trình riêng tư vào frontend.
- Pytest với `PSCUBESAT_TEST_POSTGRES=1`: **137 passed, 2 skipped** trong 144,60 giây; hai bài skip là Docker compiler. Bao gồm Alembic CLI upgrade DB sạch, downgrade/upgrade giữ dữ liệu, schema khớp ORM và test đồng thời trên PostgreSQL thật.
- Ruff check/format các file Python bổ sung/sửa và `git diff --check`: đạt.
- Log: `scratch/sprint3-check-final.log`, `sprint3-build.log`, `sprint3-pytest-final.log`; kiểm thử quy tắc/API riêng: `sprint3-final-learning.log` (10 passed).

## Giả định và giới hạn

- Waived tính thỏa yêu cầu theo chính sách bản đầu; chưa có tùy chọn lớp loại waived khỏi điều kiện. Unlock chỉ có hiệu lực revision đã cấp; completed/waived theo lesson_version được giữ khi cấu hình đổi.
- Theo dõi video là chỉ báo học tập từ trình duyệt; không phải chống gian lận tuyệt đối. Iframe chưa tích hợp SDK nguồn video, chỉ hỗ trợ xác nhận nếu GV cho phép.
- Không nhập tiến độ legacy thành tiến độ học mới. Không reset thành quả đã đạt khi nộp lại; chỉ bản mới nhất đang chờ được chấm.
- Lab test/ngân hàng câu hỏi và engine thi thuộc sprint kế tiếp; slot test chưa thể đặt bắt buộc. Học liệu TODO cần GV bổ sung/duyệt.
- Ghi được tuần tự hóa theo lớp để ưu tiên đúng dữ liệu; tối ưu tải lớp lớn là công việc tiếp theo nếu số liệu vận hành yêu cầu.
- Build vẫn có cảnh báo chunk lớn của thư viện editor/trực quan. Hai test compiler Docker cần môi trường opt-in riêng; chưa xác minh flash trên phần cứng thật trong lượt này.
