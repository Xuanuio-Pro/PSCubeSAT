# Sprint 5 — Dashboard, migration, pilot

Ngày: 26/10/2026. Phạm vi: mục 8, 10, 11 của kế hoạch. Quyết định: [DECISIONS.md](DECISIONS.md) mục Sprint 5.

## Kết quả

- **Dashboard Admin** (`/admin/dashboard`): tài khoản theo role × trạng thái, lớp theo trạng thái/chế độ, SV hoạt động 7/30 ngày (có sự kiện học hoặc bắt đầu Lab Test; đăng nhập không tính), tỷ lệ hoàn thành và điểm Lab Test trung bình theo lab; điều khiển chế độ pilot từng lớp.
- **Báo cáo lớp** (`/classes/{id}/report`, `GET /api/classes/{id}/reports[?format=csv]`): tiến độ, số lab đạt, điểm cao nhất và số lượt từng Lab Test, bài chờ duyệt, lần hoạt động gần nhất, lịch sử biên dịch legacy (chỉ tham khảo). CSV UTF-8 có BOM, chặn công thức.
- **Cờ theo lớp**: cột `classes.lms_mode` = `enabled` | `read_only` | `off`. Đường legacy chỉ bị chặn với SV của lớp pilot; user ngoài pilot giữ luồng cũ. `read_only` là rollback: chặn mọi ghi (`CLASS_READ_ONLY`), vẫn đọc được kết quả/báo cáo.
- **Link cũ** `/labN?lesson=`: `GET /api/lms/lab-entry` → vào lớp / chọn lớp / luồng cũ / trải nghiệm; `/api/lms/config` thêm `legacy_allowed`.
- **Migration dữ liệu**: `python -m app.services.legacy_migration report|import-pilot|compare` — báo cáo ánh xạ chỉ-đọc, nhập lớp pilot từ danh sách email (dry-run mặc định, `--apply` mới ghi), so khớp backup. `compiled_at` giữ nguyên làm lịch sử, không thành hoàn thành.
- **Hiệu năng**: lộ trình của cả lớp tính bằng 2 query (`member_paths`) thay vì 2 query/SV; `class_progress` dùng chung.
- **Tài liệu**: [RUNBOOK_RELEASE.md](RUNBOOK_RELEASE.md), [LOAD_TEST.md](LOAD_TEST.md), [USER_GUIDE.md](USER_GUIDE.md), [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md).

## File chính

| Nhóm | File |
|---|---|
| Schema/migration | `models/tables.py` (`Classroom.lms_mode`), `models/learning.py` (index hoạt động), `alembic/versions/0010_class_lms_mode.py` |
| Quyền/legacy | `services/permissions.py` (`legacy_restricted`, `require_legacy_allowed`, kiểm `lms_mode`), `routers/progress.py`, `routers/compiler.py`, `routers/curriculum.py`, `routers/quizzes.py` |
| Báo cáo/dashboard | `services/reports.py`, `routers/reports.py`, `routers/admin.py`, `services/learning_progress.py` |
| Lớp/redirect | `services/classes.py` (`set_class_mode`), `services/curriculum_access.py` (`lab_entry`), `routers/classes.py`, `schemas/classes.py` |
| Công cụ | `services/legacy_migration.py`, `scripts/load_test.py` |
| UI | `pages/AdminDashboardPage.jsx`, `pages/ClassReportPage.jsx`, `components/classes/LabEntry.jsx`, `App.jsx`, `contexts/AuthContext.jsx`, `pages/HomePage.jsx`, `pages/ClassDetailPage.jsx`, `components/classes/LmsLayout.jsx`, `classes.css` |
| Test | `test_reports.py`, `test_e2e.py`, `test_e2e_postgres.py`, `test_legacy_migration.py`; cập nhật `test_classes.py`, `test_course_configuration.py`, revision trong `test_classes_postgres.py`/`test_curriculum_postgres.py` |

## Migration và API

`0010_class_lms_mode`: thêm `classes.lms_mode TEXT NOT NULL DEFAULT 'enabled'` + CHECK, index `progress_events(membership_id, created_at)`. Lớp có sẵn nhận `enabled`. Downgrade giữ cột/index. Đã thử `downgrade -1` → `upgrade head` trên PostgreSQL thật và trên bản sao DB local (0005 → 0010).

API mới: `GET /api/admin/dashboard`, `PATCH /api/admin/classes/{id}/lms-mode` (Admin, `{lms_mode, reason}`), `GET /api/classes/{id}/reports`, `GET /api/lms/lab-entry?lab_id=&lesson=`. Thay đổi hợp đồng: `ClassResponse` thêm `lms_mode`; `/api/lms/config` thêm `legacy_allowed`; mã lỗi mới `CLASS_READ_ONLY` (409). Hành vi đổi: khi cờ tổng bật, user không thuộc lớp pilot dùng lại được API legacy (trước đây bị chặn).

## Kiểm chứng

Xem [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md#kết-quả-chạy): `npm run check`, `npm run build`, pytest PostgreSQL 159 passed / 2 skipped, ruff check đạt, tải 300 SV đạt bất biến.

## Giới hạn và việc còn mở

- Độ trễ khi 300 SV thao tác cùng một giây: p95 tới ~14 s (một worker ~35–50 req/s). Rủi ro lưu đáp án sát giờ cần quyết định nghiệp vụ — LOAD_TEST.md.
- UI mới chưa thử trên trình duyệt trong sprint này (chỉ lint/typecheck/build). Mất mạng khi thi chỉ có unit test logic cache.
- Flash/telemetry thiết bị thật, đo tải trên server thật, duyệt 180 câu và pilot lớp thật còn mở.
- Onboarding dev: PostgreSQL dev qua `npm run dev:db:docker`, `npm run dev:db` chạy được trên mọi OS, test PG qua `npm run test:be:postgres` (README mục Quickstart).
