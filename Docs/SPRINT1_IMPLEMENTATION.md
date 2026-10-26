# Sprint 1 — Quản lý tài khoản và lớp học

Ngày: 22/10/2026. Phạm vi: role/status, lớp, membership, audit, API và giao diện quản lý. Bản kiểm kê trước khi sửa code: [SPRINT1_AUDIT.md](SPRINT1_AUDIT.md). Quyết định nghiệp vụ: [DECISIONS.md](DECISIONS.md).

## Chức năng và vị trí thay đổi

| Nhóm | File | Kết quả |
|---|---|---|
| Model | `fastapi-backend/app/models/tables.py` | UserRole thêm teacher; AccountStatus active/locked; Classroom, ClassMembership, AuditLog |
| Migration | `fastapi-backend/alembic/versions/0006_class_management.py` | Thêm enum, users.status và 3 bảng; giữ user/progress cũ |
| Auth | `app/services/auth.py`, `app/schemas/auth.py` | Chỉ nhận user active từ DB, chặn login password/Google khi locked; đăng ký từ chối role/status client gửi |
| Quyền | `app/services/permissions.py` | require_system_role; require_class_member lấy class_id từ path, kiểm membership DB và role hiện hành |
| API | `app/routers/admin.py`, `app/routers/classes.py`, `app/schemas/classes.py`, `app/services/classes.py`, `app/application.py` | Quản trị tài khoản, lớp và thành viên; transaction audit; thêm thành viên đồng thời được tuần tự hóa trên row lớp |
| Lỗi/cấu hình | `app/core/lms_errors.py`, `app/core/exceptions.py`, `app/core/config.py`, hai file env mẫu backend | Lỗi nghiệp vụ code/message/details; flag mặc định tắt |
| Giao diện | `src/pages/AdminUsersPage.jsx`, `ClassesPage.jsx`, `ClassDetailPage.jsx`, `src/components/classes/*` | Admin lọc/phân trang/đổi quyền/khóa; GV tạo/sửa/lưu trữ lớp, thêm/xóa/phục hồi SV; SV xem lớp của mình |
| Điều hướng | `src/App.jsx`, `src/components/layout/Header.jsx`, `src/contexts/AuthContext.jsx`, `auth-api.js`, `auth-session.js` | Guard Admin, flag từ server, refresh role từ me, thông báo lỗi API, giữ điểm đến sau đăng nhập |
| Kiểm thử | `app/tests/test_classes.py`, `test_classes_postgres.py`, `tests/auth-storage.test.js`, `requirements-dev.txt` | Unit/integration quyền, auth, lớp, migration và chuyển hướng; bổ sung pytest cho môi trường dev |

Đường dẫn `app/...` trong bảng thuộc `fastapi-backend/`. Không sửa model/logic `LabProgress`, router/service progress, compiler, curriculum, dữ liệu giáo trình hoặc bản nháp editor.

## Hợp đồng API

Tất cả API dưới đây yêu cầu Bearer token; ngoại trừ config, API mới còn yêu cầu `LMS_CLASS_MODE=true`.

| Method và đường dẫn | Quyền / hành vi |
|---|---|
| GET `/api/lms/config` | User active; trả `{class_mode: boolean}` |
| GET `/api/admin/users` | Admin; query search, role, status, page (>=1), page_size (1–100, mặc định 20) |
| PATCH `/api/admin/users` | Admin; body user_id và role=user/teacher hoặc status=active/locked |
| PATCH `/api/admin/users/{user_id}` | Cùng nghiệp vụ, user_id ở path |
| GET `/api/classes` | Admin thấy tất cả; GV/SV chỉ lớp có membership hiệu lực và role phù hợp; query search/status/page/page_size |
| POST `/api/classes` | Admin/GV; body code/name/description/term/status; Admin chỉ định teacher_id của GV active |
| GET `/api/classes/{class_id}` | Admin hoặc membership active; SV không xem draft |
| PATCH `/api/classes/{class_id}` | Admin/GV của lớp; sửa name/description/term/status; mã lớp bất biến |
| DELETE `/api/classes/{class_id}` | Lưu trữ lớp, giữ bản ghi và membership |
| GET `/api/classes/{class_id}/members` | Admin/GV của lớp; lọc status active/removed và phân trang; không lộ roster cho SV |
| POST `/api/classes/{class_id}/members` | Body email tài khoản đã tồn tại; thêm student, no-op nếu đã active, phục hồi nếu removed |
| DELETE `/api/classes/{class_id}/members` | Body user_id; soft remove; xóa lặp trả 204 |

Danh sách trả `{items, total, page, page_size}`. Class response có `can_manage` do server tính. Membership response chứa id/user_id/email/full_name/role/status/added_at/removed_at. API không trả password hash hoặc token trong dữ liệu quản lý.

Ví dụ lỗi truy cập chéo lớp: HTTP 403, `{ "code": "MEMBERSHIP_REQUIRED", "message": "Bạn không còn quyền truy cập lớp này.", "details": {} }`. Các lỗi cấu hình/validation của API mới trả `CONFIG_INVALID`; trùng mã lớp trả `VERSION_CONFLICT`. Auth lỗi vẫn dùng định dạng legacy và 401 để frontend kết thúc phiên ngay.

Thay đổi tài khoản và audit nằm cùng transaction. Audit ghi actor/action/target/before/after/created_at; thêm/xóa/phục hồi membership và sửa/tạo lớp cũng có audit. Thao tác no-op không thêm log giả.

## Migration và bật chức năng

1. Sao lưu DB trước phát hành và cài dependency runtime/dev theo môi trường.
2. Trong `fastapi-backend`, chạy `node ../scripts/python.mjs -m alembic upgrade head` với cấu hình DB triển khai. Startup yêu cầu migration hiện hành ngay cả khi flag tắt.
3. Giữ `LMS_CLASS_MODE=false` nếu chưa mở chức năng. Để thử quản trị lớp, đặt `LMS_CLASS_MODE=true` trong env backend và khởi động lại backend; frontend đọc cờ từ server, không cần cờ Vite riêng.
4. Admin hiện có vào `/admin/users` để cấp GV. GV vào `/classes` để tạo lớp và thêm email SV đã đăng ký; SV dùng cùng URL để xem “Lớp của tôi”. Không có endpoint công khai tạo Admin.

Migration đã được kiểm tra trên DB thử biệt lập; không chạy migration trên DB ứng dụng đang dùng trong lượt triển khai này. User cũ nhận status active qua default, giữ nguyên ID/email/password_hash/role. `lab_progress` không bị viết lại.

`downgrade -1` cố ý chỉ lùi Alembic revision, giữ schema và dữ liệu additive. `upgrade head` sau đó an toàn và không tạo dữ liệu trùng. Rollback tính năng bằng flag; không dùng binary cũ không nhận diện teacher. Không dùng downgrade như cách thu hồi quyền hoặc xóa dữ liệu.

## Kiểm chứng

- `npm run check`: đạt lint, TypeScript, telemetry schema; 112 test Node đạt; backend unittest discovery chạy 117 test, 10 skip (8 PostgreSQL được chạy riêng bằng pytest, 2 Docker).
- `npm run build`: build production; còn cảnh báo chunk lớn của các module lab/trực quan hiện có.
- Backend: `PSCUBESAT_TEST_POSTGRES=1 node ../scripts/python.mjs -m pytest app/tests -q` (PowerShell đặt biến bằng `$env:PSCUBESAT_TEST_POSTGRES='1'` trước lệnh). Kết quả: **115 passed, 2 skipped**; 2 test bị skip cần Docker compiler image/engine (`PSCUBESAT_TEST_DOCKER=1`).
- Kiểm tra PostgreSQL gồm CLI upgrade head trên DB sạch, legacy 0005 → CLI upgrade head, CLI downgrade -1 → upgrade head, đối chiếu ORM với schema, bảo toàn user/progress/lock/teacher/membership/audit; 8 request thêm cùng SV đồng thời chỉ tạo một membership và một audit.
- Test bắt buộc đã bao phủ: đăng ký gửi admin/teacher bị từ chối; role giả trong JWT không cấp quyền; GV lớp A GET/PATCH/DELETE lớp B và roster nhận 403; SV removed bị từ chối với token cũ; thêm lặp/khôi phục không trùng; locked bị 401 trên mọi HTTP route có auth trong app hiện tại, password/Google login và WebSocket authorize bị chặn.
- UI kiểm tra trên backend SQLite riêng và tài khoản giả lập: danh sách lớp GV, chi tiết lớp, thêm lặp/xóa/phục hồi SV; Admin tìm tài khoản, khóa/mở khóa; chuyển hướng sau đăng nhập; SV xem “Lớp của tôi” và chi tiết không có thao tác quản trị, mở `/admin/users` bị route guard chặn. Bố cục hẹp dùng bảng cuộn ngang và form xếp dọc.

Log kiểm tra local: `scratch/sprint1-check.log`, `scratch/sprint1-build.log`, `scratch/sprint1-pytest.log`, `scratch/sprint1-clean-db.log`. Ảnh UI với dữ liệu giả: `scratch/sprint1-admin-preview.png`. Các file scratch không đưa vào Git.

## Phạm vi còn lại và giới hạn

- Chưa có giáo trình theo lớp hoặc khóa tiến trình trong Sprint 1; flag chỉ mở quản trị lớp. Theo yêu cầu, giữ nguyên quy tắc compile legacy và không dùng nó làm tiến độ của lớp mới.
- Chưa thử nạp firmware trên thiết bị thật trong lượt này; compiler/flash/telemetry được bảo vệ bởi bộ test hồi quy hiện có. Hai test Docker thực không nằm trong môi trường kiểm chứng này.
- Lớp archived chỉ đọc; API quản lý user không sửa Admin; nhiều GV đồng quản trị, mời email, nhập CSV nằm ngoài scope.
- Hạ quyền GV giữ membership lịch sử nhưng chặn quyền dạy ngay. Dữ liệu đã hiển thị trên tab trước khi thu hồi không thể thu hồi khỏi máy người dùng; các request tiếp theo đều kiểm DB lại. Me được kiểm tra khi focus và theo chu kỳ; backend không chờ frontend để áp dụng quyền.
