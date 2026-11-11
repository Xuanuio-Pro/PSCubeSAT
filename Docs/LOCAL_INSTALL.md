# Cài đặt CubeSAT LMS trên một máy (Docker)

Dành cho máy cá nhân hoặc máy chủ phòng lab. Chỉ cần Docker; không cần cài Node, Python hay PostgreSQL. Không dùng cho server công khai (xem `deploy/server.sh`).

## Yêu cầu

- Docker Desktop (Windows/macOS) hoặc Docker Engine + Compose v2 (Linux), đang chạy.
- Tối thiểu 4 CPU, 8 GB RAM, khoảng 12 GB ổ trống (image biên dịch ESP32 chiếm ~6 GB).
- Lần cài đầu cần Internet để tải image và toolchain ESP32.

## Cài đặt

```bash
git clone -b develop https://github.com/Xuanuio-Pro/PSCubeSAT.git
cd PSCubeSAT
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-local.ps1
```

Linux/macOS:

```bash
bash setup-local.sh
```

Script sẽ:

1. Tạo `.env.local` với mật khẩu database và khóa JWT ngẫu nhiên (chỉ tạo một lần; giữ file này cùng dữ liệu, không đưa lên Git).
2. Build và chạy PostgreSQL, Redis, backend, frontend; tự chạy migration và nạp giáo trình.
3. Build image biên dịch `pscubesat-compiler:1` nếu máy chưa có (15–40 phút lần đầu). Thêm `-SkipCompiler` / `--skip-compiler` để bỏ qua; khi đó chức năng Biên dịch báo lỗi cho đến khi chạy lại không có cờ này.
4. Hỏi email và mật khẩu cho tài khoản admin đầu tiên.

Mở http://localhost:8080. Admin đăng nhập tại http://localhost:8080/admin/login. Đổi cổng khi cài lần đầu bằng `-Port 9090` / `--port 9090`, hoặc sửa `LOCAL_PORT` trong `.env.local` rồi chạy lại `start`.

## Vận hành hằng ngày

| Việc | Windows | Linux/macOS |
| --- | --- | --- |
| Chạy lại sau khi tắt máy | `.\setup-local.ps1 start` | `bash setup-local.sh start` |
| Dừng | `.\setup-local.ps1 stop` | `bash setup-local.sh stop` |
| Trạng thái | `.\setup-local.ps1 status` | `bash setup-local.sh status` |
| Log backend | `.\setup-local.ps1 logs` | `bash setup-local.sh logs` |
| Tạo / nâng quyền admin | `.\setup-local.ps1 admin` | `bash setup-local.sh admin` |

Cập nhật phiên bản mới: `git pull`, rồi chạy lại lệnh cài đặt (không có tham số). Migration và giáo trình chạy lại an toàn, dữ liệu được giữ nguyên. Nếu lần cập nhật đổi thư viện biên dịch, xóa image cũ (`docker rmi pscubesat-compiler:1`) trước khi chạy lại để build bản mới.

## Sao lưu và chuyển dữ liệu sang máy khác

Trong các lệnh dưới đây, `$C` là viết tắt của `docker compose --env-file .env.local -f docker-compose.local.yml` (chạy trong thư mục dự án). Bash: `C="docker compose --env-file .env.local -f docker-compose.local.yml"` rồi dùng `$C`. PowerShell: `function C { docker compose --env-file .env.local -f docker-compose.local.yml @args }` rồi thay `$C` bằng `C`.

Sao lưu (tạo file `cubesat.dump` trong thư mục dự án):

```bash
$C exec -T postgres pg_dump -U cubesat -Fc -f /tmp/cubesat.dump cubesat
$C cp postgres:/tmp/cubesat.dump ./cubesat.dump
```

Khôi phục trên máy mới sau khi đã cài đặt (thay toàn bộ dữ liệu hiện có của máy đó):

```bash
$C stop fastapi
$C cp ./cubesat.dump postgres:/tmp/restore.dump
$C exec -T postgres dropdb -U cubesat --force cubesat
$C exec -T postgres createdb -U cubesat cubesat
$C exec -T postgres pg_restore -U cubesat -d cubesat /tmp/restore.dump
$C up -d --wait
```

Chạy các lệnh trên bằng PowerShell hoặc bash trên Linux/macOS. Git Bash trên Windows tự đổi đường dẫn `/tmp/...`; nếu dùng Git Bash, đặt `MSYS_NO_PATHCONV=1` trước.

Dữ liệu nằm trong Docker volume `pscubesat-local_postgres_data`. `docker compose ... down` giữ dữ liệu; chỉ `down -v` mới xóa.

## Giới hạn hiện tại

- **Nạp firmware qua USB** dùng Web Serial: chỉ chạy trên Chrome/Edge khi mở bằng `localhost` trên chính máy cài đặt. Máy khác trong mạng LAN vẫn học, làm bài và biên dịch được, nhưng muốn nạp qua USB từ máy đó thì cần HTTPS (chưa có trong gói này).
- **Không có MQTT broker**: telemetry qua cáp USB (Serial) hoạt động; telemetry/ảnh qua MQTT từ thiết bị cần cấu hình EMQX theo `Docs/EMQX_POSTGRES_SETUP.md`. Backend ghi cảnh báo kết nối MQTT định kỳ (tối đa mỗi 30 giây), không ảnh hưởng các chức năng khác.
- **Admin đầu tiên**: khi chưa có admin, trang `/admin/signup` cho phép người truy cập đầu tiên tự tạo admin. Script tạo admin ngay sau khi cài; nếu bỏ qua bước này, hãy tạo admin trước khi cho máy khác truy cập.
- Cổng web mặc định mở cho cả mạng LAN. Chỉ cho máy này truy cập: thêm `LOCAL_BIND=127.0.0.1` vào `.env.local` rồi chạy `start`.
