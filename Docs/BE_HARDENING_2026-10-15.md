# Backend hardening — 15/10/2026

## Thay đổi

- Compiler chỉ chạy qua Docker sandbox cho từng job. Không fallback sang PlatformIO trên host. Contract `/api/compile` và artifact giữ nguyên.
- Job không mount source BE, `.env`, Docker socket, artifact hoặc cache của job khác. Root filesystem chỉ đọc; user 65532; không network/capabilities; no-new-privileges; tối đa 2 CPU, 1536 MiB RAM, 128 PID, workspace tmpfs 768 MiB và `/tmp` 32 MiB.
- Source chỉ truyền qua stdin. Toolchain và thư viện tin cậy được tải khi build image. Build output giới hạn 1 MiB, envelope trả về giới hạn 32 MiB. Job tối đa 600 giây; timeout/cancel yêu cầu xóa container bằng tên do server tạo. Worker cũng có deadline riêng nếu API chết.
- Không dùng cache source giữa người dùng. Bốn slot tổng cho request đang chờ/chạy trên cùng cache volume; cache lock theo board vẫn bảo vệ snapshot. Job/container không đọc được cache này.
- Xóa thiết bị là **xóa mềm**: giữ Device, telemetry, command và FK; disable/đánh dấu deleted credential; xóa ACL trong DB. Thiết bị không còn xuất hiện ở list/get/GPS/telemetry authorization. Runtime hiện tại dừng và xóa simulator liên quan, đóng WS, xóa latest state.
- Progress dùng PostgreSQL `INSERT ON CONFLICT DO NOTHING`, rồi `SELECT FOR UPDATE` và refresh identity map trước khi tính hoàn thành. Khóa giữ tới commit, nên không mất cập nhật video/doc/compile và giữ timestamp đầu tiên.
- Validation: lab ID 0–8; tên thiết bị sau trim dài 1–128; description tối đa 2000; model tối đa 128; device type chỉ `hardware`, `simulator`, `ground_station`; tọa độ strict, hữu hạn và đúng miền, giữ giá trị 0 hợp lệ.

## Chạy compiler

Từ `fastapi-backend`, bật Docker Engine Linux rồi build image:

```powershell
docker build -f compiler/Dockerfile -t pscubesat-compiler:1 .
```

Sau đó chạy BE như trước. Biến `COMPILER_IMAGE` mặc định `pscubesat-compiler:1`; không kéo image tự động khi nhận request. Image phải được build trên cùng daemon mà BE sử dụng. Khi dùng Compose, build image compiler bằng lệnh trên trước khi chạy BE. `/api/health` cho biết backend `docker-sandbox` và image ID.

Docker daemon là phần tin cậy của hệ thống. Compose vẫn mount Docker socket vào **API orchestrator** để tạo/xóa container; socket không vào job compiler. Quyền socket tương đương quản trị Docker host: nên dùng daemon/host chuyên build hoặc rootless daemon khi triển khai nhiều người dùng. Đây là container isolation, không phải VM chống mọi kernel exploit. Không cho caller chọn image, command, mount hoặc Docker flags.

Nếu Docker/image thiếu, API trả `success=false`, `error_code=COMPILER_UNAVAILABLE`; nếu hàng đợi đầy trả `COMPILER_BUSY`. FE nên hiển thị lỗi và cho thử lại, không dùng artifact cũ.

## Xóa thiết bị và giới hạn đồng bộ broker

Xóa mềm không cần migration mới; tận dụng các cột `deleted_at/enabled` hiện có. Không xóa hay sửa dữ liệu production trong lượt triển khai này. Những credential mồ côi đã tồn tại từ trước không tự động bị xóa; cần kiểm kê trước khi dọn.

Việc disable credential/xóa ACL ở đây áp dụng trong PostgreSQL. Broker dùng file passwd/ACL độc lập vẫn cần luồng provision/revoke riêng như báo cáo BE-02; không tuyên bố đã thu hồi kết nối broker từ xa. Consumer và API từ chối thiết bị deleted. Runtime cleanup tức thời áp dụng trong process hiện tại; WS process khác vẫn tái kiểm tra quyền định kỳ. Chưa chuyển state sang Redis.

## Kiểm chứng

Kết quả thực tế ngày 15/10/2026: **48/48 test pass, không skip**, chạy trong 46.822 giây với cả PostgreSQL và Docker integration bật. Hai board ESP32/ESP32-S3 build thành công trong container bị tắt network và root filesystem chỉ đọc; artifact đủ bốn ảnh và hash từng ảnh đúng. Include file marker chỉ có trên host thất bại, marker không xuất hiện trong log trả về. Không còn container `pscubesat-build-*` sau test. Xóa thiết bị có/không có lịch sử, cleanup simulator/WS, progress đồng thời và validation đều pass.

Image đã build và gắn tag `pscubesat-compiler:1` trên Docker Engine local. Kiểm tra health với cấu hình mặc định trả `compiler_installed=true`, `compiler_backend=docker-sandbox`, `build_cache_ready=true`. Log đầy đủ: `fastapi-backend/logs/be-hardening-final-tests.log` (Git ignored). Cấu hình Compose đã qua `docker compose config --quiet`; không triển khai lại stack ứng dụng trong lượt này.

Nginx timeout API được nâng lên 720 giây để bao gồm kiểm tra image, chờ queue, build và cleanup. Contract FE không đổi; cần restart/redeploy BE và Nginx đang chạy để áp dụng code/cấu hình mới.

```powershell
$env:PSCUBESAT_TEST_POSTGRES='1'
$env:PSCUBESAT_TEST_DOCKER='1'
python -m unittest discover -s app/tests -v
```

PostgreSQL tests tạo database tạm riêng bằng thông tin cấu hình local rồi dọn sau test. Docker integration test build cả hai board và thử include file marker chỉ có trên host; không đọc bí mật thật. Unit tests kiểm tra envelope không được ghi đường dẫn tùy ý, output limit, timeout/cancel cleanup và không fallback compiler host.

Không đổi tiêu chí hoàn thành Lab1 (compile vẫn ghi progress theo contract cũ) trong phạm vi này. Flash/Serial phần cứng và giữ workspace vẫn cần nghiệm thu cùng FE.
