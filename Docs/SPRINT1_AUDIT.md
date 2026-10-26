# Sprint 1 — Kiểm kê trước khi sửa code

Ngày: 22/10/2026. Kiểm kê này ghi nhận trạng thái trước triển khai, theo AGENTS.md và mục 2, 3, 7, 12 của kế hoạch LMS. Chưa sửa code khi lập tài liệu.

## Model và bảng

ORM tập trung trong `fastapi-backend/app/models/tables.py`, dùng chung `Base` từ `app/db/database.py`; `models/db_models.py` là lớp import tương thích.

| Model / bảng | Nội dung/ràng buộc đáng chú ý |
|---|---|
| User / users | id, email unique (thêm unique lower(email)), password_hash, full_name, role admin/user; created_at, updated_at, deleted_at; chưa có trạng thái active/locked |
| Device / devices | Chủ sở hữu user, device_uid unique, loại thiết bị, enabled, trạng thái, vị trí, timestamps, soft delete |
| MQTTCredential / mqtt_credentials | Quan hệ một credential/device, username unique, hash, enabled, rotated_at/revoked_at, soft delete |
| MQTTACL / mqtt_acl | Device, permission, action, topic |
| Telemetry / telemetry | Device, JSONB payload, received_at; partition theo thời gian |
| LabProgress / lab_progress | Unique user_id + lab_id, video_watched, doc_viewed, compiled_at, completed_at, updated_at |
| Command / commands | Device, JSONB command, status, executed_at, timestamps |
| GoogleIdentity / google_identities | Google subject PK, user_id unique |
| RevokedToken / auth_revoked_tokens | SHA256 token PK, expires_at |

Chưa có classes, class_memberships, audit_logs hoặc bảng nội dung/lượt thi LMS. Simulation có model/runtime riêng, không phải bảng giáo trình. Migration hiện tại: 0001 baseline → 0002 platform_schema → 0003 constraints → 0004 auth_email → 0005 emqx_postgres. Migration 0005 tạo view EMQX authn/authz. Startup kiểm tra migration head, không tự sửa schema.

## Luồng auth và JWT

- `routers/auth.py`: POST register, login, google, logout; GET me, google/config; PATCH password.
- `RegisterRequest` nhận email/password/full_name; service gán cứng role=user. Pydantic hiện bỏ qua extra field, chưa chủ động từ chối client gửi role.
- Mật khẩu bcrypt; login email chuẩn hóa lower/strip. Google dùng subject ổn định; chỉ liên kết email khi Google có thẩm quyền cho địa chỉ đó.
- JWT HS256: sub=user ID, email, role; thêm exp và jti; thời hạn lấy từ settings (mặc định 1440 phút). JWT secret ở cấu hình server.
- `get_current_user`: kiểm Redis blacklist, decode JWT, tra RevokedToken trong PostgreSQL, SELECT user theo sub và deleted_at IS NULL. Có đọc DB mỗi request; không lấy quyền từ role claim. Lỗi xác thực trả None; `get_required_user` trả 401.
- Logout lưu SHA256 token vào DB và cache Redis; mất Redis vẫn dùng DB. Chưa có trạng thái locked, dependency kiểm role hoặc membership.
- WebSocket dùng `get_current_user` và kiểm chủ sở hữu thiết bị khi kết nối, sau message hoặc timeout 30 giây. Cập nhật auth chung sẽ tác động cả lần tái xác thực này.
- Frontend `AuthContext`: gọi me để xác thực phiên; có kiểm hạn token, polling 60 giây/focus, đăng xuất khi API trả 401. `App.jsx` chỉ guard đăng nhập, chưa guard theo role.

## Nơi kiểm tra quyền

Tìm `role/admin` trong backend: role hiện chỉ ở model, tạo user, claims và response; chưa có kiểm tra role nghiệp vụ. Các dịch vụ thiết bị/telemetry có kiểm tra chủ sở hữu. Route curriculum và compiler có dependency đăng nhập ở router; progress kiểm ở từng endpoint. Không có lớp để kiểm membership.

## Endpoint progress / compiler / curriculum

| Nhóm | Endpoint hiện tại |
|---|---|
| Progress | GET /api/progress; POST /api/progress/{lab_id}/video-watched; POST /api/progress/{lab_id}/doc-viewed |
| Compiler | GET /api/boards; GET /api/labs/1/template; POST /api/compile; GET /api/artifacts/{artifact_id}; GET /api/artifacts/{artifact_id}/files/{filename} |
| Curriculum | GET /api/curriculum/exercises; GET /api/curriculum/exercises/{exercise_id}/source |

Compile nhận code, board, lab_id tùy chọn, include_binary; chưa có class_id/lesson_id. Artifact kiểm người sở hữu. Curriculum lấy catalog/source từ allowlist trong repo, yêu cầu đăng nhập nhưng chưa có quyền theo lớp.

## Chỗ coi compile là hoàn thành

`routers/compiler.py`, sau result.success và có owner_id/lab_id, gọi `ProgressService.mark_compiled`. Hàm này ghi compiled_at rồi gọi `_recompute_completion`. Trong `services/progress.py`, Lab 0 dùng video_watched AND doc_viewed; Lab 1–8 dùng compiled_at khác NULL để ghi completed_at. Test `test_migrations.py::test_concurrent_progress_creation_and_completion` đang xác nhận hành vi legacy đó.

Theo chỉ đạo riêng cho Sprint 1, không sửa logic này hoặc schema/ID giáo trình, bản nháp. Việc loại bỏ cách tính này thuộc sprint tiến độ; không được coi lớp quản lý trong Sprint 1 là lớp đã triển khai khóa học theo tiến trình.

## Cách chạy test

Từ root:

```powershell
npm run check
npm run build
npm run test:auth
```

`check` chạy lint, TypeScript, telemetry schema, auth-storage, curriculum, Blockly, flash, telemetry/practice và backend unittest discovery. Từ `fastapi-backend`:

```powershell
node ../scripts/python.mjs -m unittest discover -s app/tests -p 'test_*.py'
node ../scripts/python.mjs -m pytest app/tests
node ../scripts/python.mjs -m alembic upgrade head
```

Python resolver ưu tiên .venv, conda hoặc PSCUBESAT_PYTHON. Runtime phát hiện có aiosqlite/asyncpg/ruff nhưng chưa có pytest; cần bổ sung dependency dev. Test auth hiện dùng SQLite in-memory + httpx ASGITransport; test migration PostgreSQL bật bằng PSCUBESAT_TEST_POSTGRES=1, tự tạo/xóa DB pscubesat_test_<uuid> và đọc cấu hình local mà không in secret. Không chạy downgrade trên DB ứng dụng: dùng DB thử biệt lập cho upgrade/downgrade/upgrade. Kết quả kiểm thử sẽ ghi riêng sau triển khai; các lệnh trên chưa phải bằng chứng đã pass.

## Đối chiếu mục 2 kế hoạch

Không phát hiện mâu thuẫn với các nhận định trong mục 2 qua mã đã đọc. Bổ sung chi tiết kế hoạch chưa ghi rõ: auth đã đọc DB và kiểm token bị thu hồi; có unique email không phân biệt hoa/thường; lỗi API legacy dùng error_code thay vì code; bài test hiện chủ yếu dùng unittest, chưa cài pytest trong runtime. Các bảng lớp/role teacher/trạng thái locked vẫn chưa tồn tại trước Sprint 1.

## Phạm vi triển khai tiếp theo

Role/status, schema lớp/membership/audit, dependency DB, API Admin/lớp, giao diện quản lý và feature flag. Không triển khai khóa tiến trình hoặc Lab Test trong sprint này. Mọi quyết định chi tiết chưa có trong kế hoạch được ghi tại Docs/DECISIONS.md.
