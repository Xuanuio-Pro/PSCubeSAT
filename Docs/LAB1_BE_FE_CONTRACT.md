# Lab1 — BE đã triển khai và hợp đồng nối FE

## Phạm vi

Backend cung cấp template Arduino build được, board profiles, compile và artifact bất biến chứa đủ bộ image để flash lần đầu. FE thực hiện Web Serial/esptool-js, giữ code/Blockly workspace, và hiển thị Serial. Backend không có quyền truy cập cổng USB trên máy học viên và không tự xác nhận đã flash thành công.

Không cần migration database cho phần compiler/artifact này. Các thay đổi auth/schema đang có trong workspace vẫn giữ nguyên. Chính sách progress cũ (compile thành công -> mark_compiled) được giữ; chưa coi đó là bằng chứng flash/Serial thành công.

## 1. Lấy board và template

```http
GET /api/boards
GET /api/labs/1/template?board=esp32
GET /api/labs/1/template?board=esp32s3
```

`board` chỉ nhận `esp32`, `esp32s3`; mặc định template/compile là `esp32s3` để tương thích FE hiện tại.

| Board key | PlatformIO board | Chip | Flash | Serial |
|---|---|---|---|---|
| esp32 | esp32doit-devkit-v1 | esp32 | 4 MB | USB-UART, 115200 |
| esp32s3 | esp32-s3-devkitc-1 | esp32s3 | 8 MB, N8/no PSRAM | USB native CDC, 115200 |

Template response có `code`, `template_version`, `source_sha256`, `lab_id`, `board`, `board_id`, `chip`, `serial` và hướng dẫn LED. FE phải đưa `code` vào state thật, rồi cấp state đó cho Monaco/compile; không chỉ render code fallback khi state rỗng. Không ghi đè code đã lưu của học viên khi chuyển tab/remount.

Template trong `fastapi-backend/app/firmware/lab1.cpp` không dùng PTITCube.h. GPIO2 blink mỗi 500 ms, JSON heartbeat mỗi giây, không chặn chờ mở Serial. ESP32 DOIT thường có LED GPIO2. ESP32-S3 cần LED ngoài: GPIO2 -> điện trở 330 ohm -> LED -> GND; RGB LED tích hợp không nằm trong bài này.

ESP32-S3 profile bật `ARDUINO_USB_CDC_ON_BOOT=1`, `ARDUINO_USB_MODE=1`: dùng cổng USB native của chip để đọc `Serial`. Nếu phần cứng chỉ nối qua UART bridge thì cần bổ sung profile UART tương ứng trước khi dùng, không tự chọn profile khác để nạp.

## 2. Compile

```http
POST /api/compile
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "code": "<code từ editor state>",
  "board": "esp32s3",
  "lab_id": 1,
  "include_binary": false
}
```

- Code tối đa 256 KiB UTF-8, không rỗng; lab_id 0–8.
- Code được build nguyên trạng, không replace hostname/IP hoặc chuẩn hóa xuống dòng.
- `source_sha256` là SHA-256 của chính `TextEncoder().encode(code)` ở thời điểm nhấn compile, bao gồm newline/Unicode.
- Không Authorization: vẫn cho compile như API cũ; artifact dùng UUID ngẫu nhiên như capability và hết hạn sau 1 giờ. Nếu có Authorization nhưng không hợp lệ/hết hạn, trả 401.
- Có user hợp lệ: artifact chỉ người đó download được với Bearer token. User khác hoặc chưa đăng nhập nhận 404.
- Mặc định `include_binary=true` vẫn trả `binBase64`, `bin_base64`, `binSize`, `fileName` để tương thích. Các trường này chỉ chứa application firmware; dùng manifest dưới đây để flash đầy đủ. Đặt false để tránh gửi Base64 hai lần.

Response thành công:

```json
{
  "success": true,
  "compilerInstalled": true,
  "compiler_installed": true,
  "board": "esp32s3",
  "chip": "esp32s3",
  "source_sha256": "<sha256>",
  "binSize": 262016,
  "fileName": "firmware.bin",
  "duration_ms": 1234,
  "logs": "...",
  "progress_saved": true,
  "artifact": {
    "schema_version": 1,
    "id": "<32 hex characters>",
    "board": "esp32s3",
    "board_id": "esp32-s3-devkitc-1",
    "chip": "esp32s3",
    "lab_id": 1,
    "source_sha256": "<sha256>",
    "build_config_sha256": "<sha256>",
    "created_at": "<UTC ISO8601>",
    "expires_at": "<UTC ISO8601>",
    "manifest_url": "/api/artifacts/<id>",
    "serial": {"baud_rate": 115200, "transport": "usb_cdc"},
    "flash": {
      "mode": "dio", "frequency": "80m", "size": "8MB", "erase_all": false,
      "files": [
        {"name": "bootloader.bin", "offset": 0, "size": 15104, "sha256": "<sha256>", "download_url": "/api/artifacts/<id>/files/bootloader.bin"},
        {"name": "partitions.bin", "offset": 32768, "size": 3072, "sha256": "<sha256>", "download_url": "/api/artifacts/<id>/files/partitions.bin"},
        {"name": "boot_app0.bin", "offset": 57344, "size": 8192, "sha256": "<sha256>", "download_url": "/api/artifacts/<id>/files/boot_app0.bin"},
        {"name": "firmware.bin", "offset": 65536, "size": 262016, "sha256": "<sha256>", "download_url": "/api/artifacts/<id>/files/firmware.bin"}
      ]
    }
  }
}
```

Kích thước/hash/thời gian trong ví dụ chỉ minh họa; luôn dùng giá trị từ response. `progress_saved` chỉ có khi request có user và lab_id. Nếu DB progress lỗi, build/artifact vẫn success, `progress_saved=false` và có warning.

Lỗi compile vẫn HTTP 200 với `success=false` theo API cũ; FE cần kiểm tra cả HTTP status lẫn success. Các error_code mới: `BUILD_FAILED`, `BUILD_TIMEOUT`, `COMPILER_BUSY`, `COMPILER_UNAVAILABLE`, `ARTIFACT_FAILED`. Validation request trả 422; token sai trả 401. Build lỗi không bao giờ trả artifact của lần build trước.

## 3. Lấy lại manifest và download ảnh

```http
GET /api/artifacts/{id}
GET /api/artifacts/{id}/files/{filename}
Authorization: Bearer <cùng user đã compile>
```

Manifest có thể lấy lại sau refresh trong thời hạn 1 giờ. Binary response là `application/octet-stream`, Cache-Control no-store; header X-Content-SHA256 có hash nhưng FE nên đối chiếu hash trong manifest (không phụ thuộc CORS expose header).

404: không tồn tại, sai owner, hoặc tên file không thuộc manifest. 410: hết hạn còn metadata; compile lại. Artifact hết hạn được dọn ở lần compile thành công tiếp theo; sau dọn sẽ nhận 404. Nếu chạy nhiều container, cần mount cùng thư mục build_cache cho các request download đi qua nhiều replica.

FE download từng file bằng fetch có Authorization, đọc arrayBuffer, kiểm tra size/SHA-256, rồi tạo fileArray theo offset. Không dùng download URL của artifact khác hoặc đọc lại firmware từ cache board. Artifact cũ được snapshot riêng nên lần build mới không làm thay đổi binary đã trả.

## 4. Checklist flash phía FE

1. Giữ artifact cùng board và source_sha256. Đổi code/board thì hủy trạng thái “sẵn sàng nạp” cho đến khi compile lại.
2. Download/kiểm tra toàn bộ file trước khi chiếm Serial port. 401/404/410 phải hiển thị lỗi.
3. Release reader/writer/stream và đóng monitor port trước khi đưa port cho esptool-js; không để hai bên giữ port cùng lúc.
4. Kiểm tra chip mà ESPLoader phát hiện khớp artifact.chip và flash capacity khớp profile phần cứng.
5. Ghi mọi file ở `flash.files[].offset` (integer), dùng mode/frequency/size của manifest. Không hardcode offset bootloader: ESP32 profile là 4096, ESP32-S3 là 0. Backend xuất offset từ môi trường build của PlatformIO.
6. Chỉ báo nạp thành công khi thao tác write/verify thực hoàn tất. Không bật erase_all chỉ để giải quyết lỗi kết nối.
7. Reset về chế độ chạy; USB CDC có thể đổi port/re-enumerate. Mở lại monitor 115200 và chờ heartbeat/pong để xác nhận firmware đã chạy.
8. Workspace/code lưu theo lab/board/user ở FE; việc unmount editor không được xóa chúng. Persist artifact id/manifest cùng hash nếu cần lấy lại sau refresh.

Offsets/image set theo [PlatformIO espressif32 builder v6.10.0](https://github.com/platformio/platform-espressif32/blob/v6.10.0/builder/main.py), và cách ghi các image theo [Espressif flashing firmware](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/flashing-firmware.html).

## 5. Serial contract của template Lab1

Một JSON trên một dòng, UTF-8, kết thúc LF. Sau khi kết nối có thể bỏ các dòng boot ROM không phải JSON. Không coi Serial text log là telemetry cảm biến.

```json
{"type":"lab1","lab_id":1,"event":"heartbeat","seq":3,"uptime_ms":3000,"led_pin":2,"led_on":false,"blinking":true}
```

Lệnh gửi là text, kèm LF:

| Lệnh | Event phản hồi | Hành vi |
|---|---|---|
| ping | pong | Kiểm tra firmware đang chạy |
| status | status | Trạng thái hiện tại |
| led on | led_set | Bật LED, dừng blink |
| led off | led_set | Tắt LED, dừng blink |
| blink | blink_enabled | Chạy blink lại |

Event khác: boot, unknown_command, command_too_long. Command tối đa 63 ký tự, bỏ CR để hỗ trợ CRLF. Header boot có thể phát trước khi monitor mở nên dùng heartbeat/ping làm nghiệm thu. Seq tăng trong RAM và reset khi reboot; uptime_ms là millis(), không phải UTC và có wraparound.

## 6. Chạy BE và kiểm tra

```powershell
cd fastapi-backend
python -m pip install -r requirements.txt
python dev.py
python -m unittest app.tests.test_compiler -v
```

Từ 15/10/2026, compiler bắt buộc dùng Docker sandbox. Bật Docker Engine Linux rồi chạy `docker build -f compiler/Dockerfile -t pscubesat-compiler:1 .` từ thư mục backend. PlatformIO Core pin 6.1.18, platform espressif32 pin 6.10.0; tải toolchain/framework khi tạo image, job runtime không có network. Timeout build 600s; chờ cache tối đa 60s và tổng bốn slot request chờ/chạy. Thiếu image/daemon trả COMPILER_UNAVAILABLE, không fallback host. Chi tiết: [BE_HARDENING_2026-10-15.md](BE_HARDENING_2026-10-15.md).

Build_cache/artifacts dùng cùng volume build_cache đã có trong Compose; artifact/binary không đưa vào Git. Job compiler không mount volume này hoặc source BE; source truyền qua stdin, ảnh flash được kiểm tra trước khi ghi vào artifact. Compose API cần Docker socket để điều phối job; socket không được đưa vào job compiler.

## 7. Nghiệm thu

Cập nhật thư viện 15/10/2026: compiler đã tích hợp PTITCube theo commit `218d2b6b78b75140962999cc7aad0c786838bb25` và dependencies cho cả hai board. Driver camera dùng bản đi kèm Arduino-ESP32; chi tiết manifest upstream, conflict `sensor_t` và kết quả kiểm tra ở [PTITCUBE_COMPILER_FLASH_CHECK_2026-10-15.md](PTITCUBE_COMPILER_FLASH_CHECK_2026-10-15.md). Số lượng test và thời gian build dưới đây là kết quả của lượt triển khai Lab1 trước đó.

Unit/API tests kiểm tra snapshot không đổi sau build tiếp theo, ownership, traversal, expiry/cleanup, build đồng thời, code giữ nguyên bytes, build lỗi, validation, progress failure, process timeout/cancellation, anonymous compatibility và busy queue. Các test PostgreSQL hiện có vẫn opt-in.

Kết quả test discovery sau thay đổi: 35 tests, PASS, trong đó 2 PostgreSQL integration tests được skip vì chưa bật opt-in. Riêng module compiler/artifact có 11 tests PASS. Các API được kiểm tra bằng ASGITransport với dependency auth/DB thay thế để không tác động database ứng dụng.

Đã build firmware thật cho cả hai board và kiểm tra luồng HTTP template -> compile -> manifest -> download đủ bốn file; size/SHA-256 của toàn bộ file khớp manifest. `esptool image_info` xác nhận bootloader/application images hợp lệ cho đúng chip. Build lại với cache mất khoảng 3.1 giây/board trên máy hiện tại; đây là số đo cục bộ, không phải cam kết tốc độ server.

| Board | Application size | Bootloader offset | Flash profile |
|---|---|---|---|
| esp32 | 270320 bytes | 0x1000 | dio / 40m / 4MB |
| esp32s3 | 262016 bytes | 0x0 | dio / 80m / 8MB |

Chưa thực hiện nạp/read Serial trên ESP vật lý trong phiên này; phần nghiệm thu đó cần FE và board thật.
