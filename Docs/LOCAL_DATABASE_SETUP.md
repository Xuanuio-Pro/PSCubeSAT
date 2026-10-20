# Tổng hợp đăng nhập và database local

Cập nhật: 14/10/2026, múi giờ Việt Nam.

## Database đã tạo

| Mục | Giá trị |
| --- | --- |
| Hệ quản trị | PostgreSQL 16.15, chạy trực tiếp trên Windows |
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `cubesat` |
| User backend | `cubesat` — chủ sở hữu database, không có quyền superuser |
| User quản trị PostgreSQL | `postgres` |
| Múi giờ database | `Asia/Ho_Chi_Minh` |
| Dữ liệu | `fastapi-backend/data/pgdata` |
| Runtime | `fastapi-backend/data/postgres-runtime/pgsql` |
| Log PostgreSQL | `fastapi-backend/data/postgres.log` |

PostgreSQL chỉ lắng nghe trên loopback. Runtime dùng [bản binary Windows do EDB cung cấp](https://www.enterprisedb.com/download-postgresql-binaries). Docker Desktop hiện gặp lỗi nội bộ ở socket `dockerInference`, nên database này không phụ thuộc Docker.

Đã tạo schema: `users`, `devices`, `mqtt_credentials`, `mqtt_acl`, `telemetry`, các partition telemetry, `lab_progress`, `commands`, `google_identities`, `auth_revoked_tokens`. Có partition mặc định để tiếp nhận telemetry ngoài các tháng tạo sẵn và cột `devices.device_type` khớp model backend.

## Tài khoản và cấu hình

Mật khẩu database, user quản trị PostgreSQL và tài khoản admin website được sinh ngẫu nhiên, lưu trong `fastapi-backend/data/LOCAL_CREDENTIALS.md`. Tài khoản admin website là `admin@stemcube.vn`; mật khẩu mẫu `admin123` đã được thay thế.

`fastapi-backend/.env` đã có `DATABASE_URL`, JWT secret và Google Client ID. Cả `.env` và thư mục `data` được Git bỏ qua. Tài liệu này không chứa mật khẩu.

## Chạy lại sau khi khởi động máy

Từ thư mục dự án:

```powershell
npm run dev
```

Lệnh này tự chạy `npm run dev:db` và `npm run db:migrate` trước khi mở frontend/backend. Database đang chạy thì giữ nguyên; database đã dừng thì khởi động lại bằng runtime local. `npm run dev:be` cũng tự khởi động database trước.

| Địa chỉ | Chức năng |
| --- | --- |
| `http://localhost:5175` | Frontend |
| `http://localhost:5175/login` | Đăng nhập |
| `http://localhost:5175/signup` | Đăng ký |
| `http://localhost:8005/docs` | Swagger API |

Chỉ khởi động hoặc dừng database:

```powershell
npm run dev:db
npm run dev:db:stop
```

Database chạy nền và giữ dữ liệu khi tắt frontend/backend. Thư mục `pgdata` chứa dữ liệu thật, cần được giữ lại khi dọn project.

## Luồng xác thực đã hoàn thành

- Email/mật khẩu: đăng ký, đăng nhập, lấy thông tin user, đổi mật khẩu, đăng xuất.
- Google: hai trang Login/Register dùng Google Identity Services, gửi `credential` tới `POST /api/auth/google`. Backend kiểm tra token Google, tìm/liên kết/tạo user rồi trả JWT nội bộ.
- Token thu hồi được lưu dưới dạng SHA-256 trong PostgreSQL. Redis là cache tùy chọn; đăng xuất vẫn có hiệu lực khi Redis không khả dụng và sau khi backend khởi động lại.
- Nút Google đọc Client ID công khai từ backend. Cần đăng ký origin `http://localhost:5175` trong Google Cloud để popup hoạt động tại frontend local.

## Kết quả kiểm tra

- 24 bài kiểm thử tự động đã qua, bao gồm migration trên PostgreSQL thật và phân quyền telemetry.
- Frontend build thành công.
- Kiểm thử API trên PostgreSQL thật đã qua: đăng ký, email trùng, sai mật khẩu, đăng nhập, `/me`, danh sách thiết bị, tiến độ lab, đổi mật khẩu, đăng xuất, từ chối token bị thu hồi, giữ phiên đăng nhập khác, từ chối token Google không hợp lệ, đăng nhập admin và từ chối mật khẩu admin cũ.
- Tài khoản kiểm thử tạm đã được xóa; tài khoản admin được giữ lại.
- Lệnh dừng/chạy lại PostgreSQL đã được kiểm tra; dữ liệu và tài khoản admin vẫn còn sau khi khởi động lại.
- Chưa đăng nhập bằng tài khoản Google thật trong popup; bước này cần người dùng chọn tài khoản trong trình duyệt.

MQTT broker ở `localhost:1883` và Redis ở `127.0.0.1:6379` chưa chạy. MQTT cần cho telemetry/simulator; lỗi kết nối MQTT không ngăn đăng ký/đăng nhập. Redis không bắt buộc cho thu hồi token ở cấu hình hiện tại.

## Sao lưu

Chạy từ thư mục dự án, nhập mật khẩu user `cubesat` đã lưu khi được hỏi:

```powershell
& './fastapi-backend/data/postgres-runtime/pgsql/bin/pg_dump.exe' -h 127.0.0.1 -p 5432 -U cubesat -d cubesat -F c -f './fastapi-backend/data/cubesat.backup'
```

File backup được lưu ở `fastapi-backend/data/cubesat.backup`. Khi chuyển sang máy khác, dùng backup thay vì sao chép cluster đang hoạt động.

Schema hiện do Alembic quản lý ở revision `0004_auth_email`; revision này bổ sung unique email không phân biệt hoa/thường. Chi tiết xác thực và Google xem `Docs/Auth_Setup.md`; các thay đổi nền tảng trước đó xem `Docs/PLATFORM_STABILIZATION.md`.
