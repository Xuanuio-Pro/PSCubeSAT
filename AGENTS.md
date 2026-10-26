# AGENTS.md — CubeSAT Learning Platform

## Mục tiêu dự án
Phát triển ứng dụng hiện có (React/Vite + FastAPI + PostgreSQL + Alembic, đã có compiler, flash, telemetry)
thành nền tảng học tập theo lớp: Admin quản lý tài khoản, GV quản lý lớp và SV, học theo lộ trình,
mở khóa theo tiến trình, Lab Test 5/20 câu cuối mỗi lab, GV cấu hình 4 loại bài (video, document, practice, labtest).

Nguồn sự thật nghiệp vụ: `Docs/LMS_DEVELOPMENT_PLAN_2026-10-22.md`. Khi code mâu thuẫn với kế hoạch, làm theo
kế hoạch; khi kế hoạch không nói rõ, chọn phương án an toàn nhất về quyền và dữ liệu, ghi lại giả định trong
`Docs/DECISIONS.md` (ngày, quyết định, lý do).

## Bản đồ mã hiện tại
- Backend: `fastapi-backend/app/` — `models/tables.py`, `services/auth.py`, `services/progress.py`,
  `routers/progress.py`, `routers/compiler.py`, `routers/curriculum.py`; migration bằng Alembic.
- Frontend: `src/` — `App.jsx`, `AuthContext`, `components/layout/LabLayout.jsx`, `CourseSidebar`,
  `components/common/VideoPlayer.jsx`, `LabWorkspace`, editor C++/Blockly.
- Giáo trình tĩnh: `src/data/curriculum.js`, `labs.js`, `lesson-reading.js`, `Docs/CURRICULUM.md`.

## Quy tắc bắt buộc
1. **Phân quyền ở server.** Mọi endpoint nội dung, mã mẫu, nộp bài, đề thi, kết quả, báo cáo kiểm tra
   role hệ thống + membership lớp còn hiệu lực, đọc từ DB ở mỗi request (không chỉ tin role trong JWT).
   Ẩn nút ở frontend không thay thế kiểm tra quyền.
2. **Role:** hệ thống `admin | teacher | user`; theo lớp `teacher | student` + trạng thái membership.
   Đăng ký công khai luôn tạo `user`; không endpoint công khai nào nhận role từ client.
3. **Không phá dữ liệu cũ.** Không xóa/đổi nghĩa `lab_progress`, bản nháp trình duyệt, ID bài thực hành hiện có.
   Migration phải có `downgrade` không làm mất dữ liệu mới, hoặc ghi rõ vì sao không downgrade.
4. **Compile ≠ hoàn thành.** Compile thành công không bao giờ được tính là hoàn thành bài hay lab.
5. **Đáp án Lab Test chỉ ở server.** Không đưa đáp án/giải thích vào bundle frontend hay response khi đang làm bài.
6. **Tiến độ do backend tính**, client chỉ gửi sự kiện (có idempotency key); không nhận % hay trạng thái
   hoàn thành từ client.
7. **Không hồi quy** đăng nhập, C++/Blockly, compiler, tải artifact, flash, telemetry.
8. Hệ thống mới bật cho lớp pilot qua feature flag `LMS_CLASS_MODE`; đường cũ không được thành lối vượt khóa
   cho lớp đã bật flag.
9. API lỗi nghiệp vụ trả mã có cấu trúc: `{ "code": "PREREQUISITE_NOT_MET", "message": "...", "details": {...} }`.
   Mã dùng chung: `MEMBERSHIP_REQUIRED`, `FORBIDDEN_ROLE`, `PREREQUISITE_NOT_MET`, `LESSON_DISABLED`,
   `ATTEMPT_LIMIT_REACHED`, `ATTEMPT_EXPIRED`, `BANK_NOT_READY`, `CONFIG_INVALID`, `VERSION_CONFLICT`.
10. Giao diện tiếng Việt; tên bảng, cột, biến, endpoint bằng tiếng Anh.

## Cách làm việc
- Đọc phần code liên quan trước khi sửa; giữ phong cách code hiện có.
- Thay đổi nhỏ, có thể review; mỗi task kết thúc bằng tóm tắt: file đã đổi, migration, endpoint mới,
  cách kiểm thử, giả định/rủi ro còn lại.
- Viết test cùng lúc với code: unit cho quy tắc nghiệp vụ, integration cho API và phân quyền.
- Trước khi báo xong, chạy và sửa đến khi qua: `npm run check`, `npm run build`, test backend (pytest),
  `alembic upgrade head` trên DB sạch, và `alembic downgrade -1 && alembic upgrade head` cho migration mới.
- Không tự thêm tính năng ngoài phạm vi (thanh toán, chứng chỉ, giám sát thi, app di động).
- Không commit secret; cấu hình nhà cung cấp AI qua biến môi trường phía server.
