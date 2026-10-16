# Ổn định nền tảng — 14/10/2026

## Schema và migration

Tất cả ORM dùng một `Base` và một model `User` trong `app/models/tables.py`. `db_models.py` chỉ giữ alias để tương thích import.

Alembic có ba revision:

1. `0001_baseline`: tạo schema rỗng từ snapshot SQL, hoặc tiếp nhận database cũ có đủ các bảng nền tảng. Không seed tài khoản admin với mật khẩu cố định.
2. `0002_platform_schema`: thêm cột còn thiếu (`device_type`, `deleted_at` của MQTT credentials, `updated_at`/`deleted_at` của commands), bảng Google/token thu hồi, FK telemetry và partition mặc định.
3. `0003_constraints`: thống nhất kiểu dữ liệu auth, điền giá trị mặc định cho các boolean/status NULL của schema cũ và áp dụng NOT NULL theo ORM.

Các migration tiếp nhận schema cũ theo hướng giữ dữ liệu, không tự downgrade. Nếu cần rollback, dùng backup đã xác minh. FK telemetry sẽ từ chối nâng cấp nếu schema cũ có telemetry tham chiếu thiết bị không tồn tại; migration không tự xóa những bản ghi đó.

Database local đã nâng lên `0003_constraints`. Backup trước migration nằm ở `fastapi-backend/data/pre-platform-migration.backup`. `alembic check` không phát hiện sai lệch với ORM. Tài khoản admin local được giữ nguyên.

Từ thư mục dự án:

```powershell
npm run db:migrate
```

`npm run dev` và `npm run dev:be` tự khởi động PostgreSQL local và chạy migration trước khi mở backend. Startup FastAPI chỉ kiểm tra kết nối và revision, không sửa schema; nếu migration còn thiếu, startup thất bại với thông báo chạy Alembic. Khi deploy container, chạy `python -m alembic upgrade head` bằng một job riêng trước khi khởi động ứng dụng. Migration hiện yêu cầu kết nối PostgreSQL online.

`app/db/init.sql` chỉ là tài liệu tham khảo schema cũ. Thay đổi schema mới cần revision Alembic; không sửa file này để nâng cấp database.

## Quyền telemetry

- `/api/telemetry/latest` yêu cầu đăng nhập, chỉ trả cache của thiết bị đang hoạt động thuộc user hiện tại.
- `/api/telemetry/latest/{uid}` yêu cầu quyền sở hữu; thiết bị của user khác, bị xóa/vô hiệu hóa hoặc không tồn tại đều trả 404.
- `/api/devices/positions` cũng yêu cầu đăng nhập và chỉ trả vị trí thiết bị của user, không còn công khai toàn bộ vị trí.
- WebSocket dùng cùng chính sách JWT, token thu hồi và quyền sở hữu với REST. Session DB được đóng sau xác thực; kết nối kiểm tra lại quyền/hạn token khi nhận tin hoặc mỗi 30 giây.

Frontend/API client ngoài repo dùng endpoint vị trí công khai trước đây cần gửi Bearer token.

## MQTT và validation

Chỉ chấp nhận topic `sensors/{uid}/telemetry`, với UID gồm chữ, số, `_` hoặc `-`, dài 1–64 ký tự. `payload.device_id` phải có và khớp UID trên topic. Backend xác nhận thiết bị có owner, đang enabled và chưa xóa trước khi ghi cache, gửi WS hoặc cập nhật GPS. Payload tối đa 64 KiB.

JSON/UTF-8 lỗi, thiếu ID, sai topic/ID, thiết bị không hợp lệ, NaN/Infinity và GPS vượt phạm vi đều bị từ chối. Các giá trị số 0, timestamp 0 và `source`/`seq` được giữ đúng khi chuẩn hóa.

ACL tài khoản test `esp32_device` chỉ cho publish `sensors/esp32_device/telemetry` và đọc `cmd/esp32_device/#`. Account backend vẫn là account tin cậy để simulator publish cho các UID. Broker cần được reload/restart để áp dụng ACL mới. Backend không nhận được username publisher từ MQTT, nên broker phải ràng buộc từng credential với topic của đúng thiết bị; việc tự đồng bộ credential từ database sang broker vẫn là công việc riêng.

Validation handler trả 422 với `details` chỉ gồm `type`, `loc`, `msg`, không serialize `input`/`ctx` có thể chứa exception, bytes hoặc thông tin nhạy cảm. HTTP handler giữ `WWW-Authenticate` và các header lỗi khác.

## Kiểm tra mã JS/JSX

ESLint áp dụng cho toàn bộ `src/**/*.js` và `src/**/*.jsx`, gồm kiểm tra hooks và unused variables. TypeScript bật `allowJs`/`checkJs` cho ứng dụng thật, gồm `main.jsx`, các trang và components. Cấu hình JS dùng `strict: false` cho bước chuyển dần sang typed code; vẫn kiểm tra props, API thư viện và thuộc tính, không dùng `@ts-nocheck` để bỏ qua file.

Các lỗi hiện có đã được sửa: kiểu Web Serial/Google/Leaflet, props tùy chọn, chiều cao CSS, rotation của mesh 3D và API dashboard. Dashboard dùng entry `react-grid-layout/legacy` với `WidthProvider` để phù hợp props hiện tại và có chiều rộng đo được. Các context hooks/API được tách khỏi file provider để Fast Refresh không cảnh báo.

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:be
```

`npm run check` chạy lint, typecheck và backend tests. Các kiểm thử PostgreSQL thật là opt-in:

```powershell
$env:PSCUBESAT_TEST_POSTGRES = '1'
npm run test:be
Remove-Item Env:PSCUBESAT_TEST_POSTGRES
```

Bộ kiểm thử migration chỉ kết nối PostgreSQL local, tạo database tên `pscubesat_test_*` riêng rồi xóa chúng. Cần `POSTGRES_PASSWORD` và `POSTGRES_ADMIN_PASSWORD` trong `.env` local. Không dùng database ứng dụng làm database kiểm thử. Script test CA cũ đã được bảo vệ bằng `if __name__ == '__main__'` để test discovery không tự kết nối broker ngoài.

## Nghiệm thu

24 kiểm thử đã qua, gồm fresh install/register/login/register-device, upgrade schema cũ có dữ liệu, REST/WS owner isolation, token thu hồi, MQTT mismatch/inactive/invalid payload, số 0 và validation 422. Kiểm tra thêm trên FastAPI đang chạy với PostgreSQL thật: chủ thiết bị mở được WS/đọc REST, user khác và token đã logout bị từ chối; tài khoản và thiết bị thử đã được xóa. Lint không có warning; typecheck JSX và build thành công. Chưa kiểm thử ACL bằng broker MQTT thật vì broker local chưa chạy. Dữ liệu local và file `.env` được loại khỏi Docker build context.
