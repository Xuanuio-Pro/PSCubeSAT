# PTITCube: thư viện, biên dịch và nạp code — 15/10/2026

## Phạm vi thay đổi

Repository [PTITCube-Library](https://github.com/PTITCube/PTITCube-Library) tại commit `218d2b6b78b75140962999cc7aad0c786838bb25` đã có `library.json` giống nội dung yêu cầu. Không tạo commit/push lên repository đó trong lượt này.

BE đã tích hợp thư viện Git theo commit trên cho cả `esp32` và `esp32s3`. Compiler image tải thư viện và dependencies lúc build image; mỗi job biên dịch tiếp tục chạy không network, không mount filesystem host, dưới user không đặc quyền. Không có fallback sang compiler host.

Các file chính: `fastapi-backend/app/services/build_config.py`, `fastapi-backend/compiler/prepare.py`, `fastapi-backend/compiler/Dockerfile`. Hai fixture `ptitcube_smoke.cpp` và `camera_driver_smoke.cpp` chỉ dùng kiểm tra compile/link; không phải firmware nghiệm thu phần cứng.

## Dependencies và conflict

| Thư viện | Constraint upstream | Bản resolve trong lần kiểm tra host |
|---|---|---|
| WiFiManager | ^2.0.16-rc.2 | 2.0.16-rc.2 |
| PubSubClient | ^2.8 | 2.8.0 |
| ArduinoJson | ^7.1.0 | 7.4.3 |
| TinyGPSPlus | ^1.0.3 | 1.1.0 |
| Adafruit MPU6050 | ^2.2.6 | 2.2.9 |
| Adafruit BMP280 Library | ^2.6.8 | 2.6.8 |
| Adafruit QMC5883P Library | ^1.0.2 | 1.0.2 |

Các dependencies bắc cầu được PlatformIO cài khi chuẩn bị image. Các constraint `^` vẫn có thể resolve phiên bản mới ở lần rebuild sau; commit PTITCube, platform espressif32 6.10.0 và PlatformIO Core 6.1.18 đã pin. Giữ image đã kiểm chứng khi triển khai.

**Camera manifest:** key `"https://github.com/espressif/esp32-camera.git": "*"` bị PlatformIO coi là tên package registry (`owner=https:`), và cài thất bại. Theo [PlatformIO dependencies](https://docs.platformio.org/en/latest/manifests/library-json/fields/dependencies.html), Git URL phải nằm ở giá trị dependency, ví dụ `"esp32-camera": "https://github.com/espressif/esp32-camera.git#<ref>"`.

Trong cấu hình Arduino hiện tại, driver camera tương thích đã có trong framework Arduino-ESP32 2.0.17. `prepare.py` bỏ riêng dependency camera bị khai báo sai trong bản manifest cache trước khi resolve các thư viện còn lại. Không kéo thêm camera master có thể lệch IDF. Upstream nên bỏ dependency này cho profile Arduino, hoặc tách profile ESP-IDF với ref driver tương thích. Module `PTIT_Camera` của PTITCube hiện giao tiếp camera qua UART, không gọi trực tiếp `esp_camera.h`.

**Trùng kiểu dữ liệu:** include `esp_camera.h` và các header Adafruit Unified Sensor trong cùng translation unit gây lỗi `sensor_t`. Smoke test PTITCube và smoke test driver camera được tách riêng. Nếu cần cả hai API trong firmware thực tế, đặt camera sau wrapper `.cpp` riêng, không để các header xung đột cùng xuất hiện trong một `.cpp`. API compiler hiện nhận một source sketch; wrapper cần nằm trong thư viện hoặc mở rộng hỗ trợ nhiều file. Không khẳng định sketch ghép trực tiếp hai nhóm header có thể build.

**Phần cứng:** build được không xác nhận pin map, UART, I2C hoặc model board đúng với thiết bị thật. PTITCube có pin mapping riêng; cần đối chiếu sơ đồ mạch trước khi chạy các module. Fixture gọi đủ API để buộc linker kiểm tra, không dùng để flash.

## Kiểm tra nạp code và công việc FE tiếp theo

`src/components/serial/WebFlasher.jsx` vẫn dùng `setInterval`/`Math.random` và tự thông báo thành công; chưa có lời gọi `ESPLoader.writeFlash`. `CloudCompiler.jsx` hardcode `board: 'esp32s3'`, chỉ chuyển `binBase64`/`fileName` qua callback tùy chọn, chưa dùng artifact flash manifest. Nút compile và flash chưa nối thành một luồng dữ liệu.

FE cần thực hiện theo thứ tự:

1. Chọn board nhất quán với template và request compile; lưu artifact cùng source hash để tránh nạp bản build cũ sau khi sửa code.
2. Nhận `artifact.flash`, tải đủ bốn file bằng URL của BE, kiểm tra size/SHA-256. Giữ token khi tải artifact của tài khoản.
3. Nhường quyền cổng Serial từ monitor cho flasher: hủy reader, release lock, đóng phiên monitor trước khi esptool mở cổng.
4. Xác nhận chip khớp manifest; ghi bootloader, partitions, boot_app0 và firmware theo từng offset trong manifest. Không hardcode offset bootloader chung cho ESP32/S3; không chỉ nạp application binary lên board trống.
5. Hiển thị progress từ callback ghi flash; chỉ báo thành công khi thao tác thật hoàn tất. Reset chip, trả cổng về monitor ở 115200 baud, kiểm tra heartbeat và phản hồi `ping` của Lab1.
6. Giữ code/workspace và artifact ngoài component bị unmount khi chuyển tab; vô hiệu artifact khi source/board thay đổi hoặc artifact hết hạn.

Lệnh `python -m serial.tools.list_ports` trả `no ports found`. Chưa nạp lên ESP vật lý và chưa nghiệm thu Serial thật trong lượt này. Không sửa FE theo phân công trước đó; chi tiết giao thức và artifact ở [LAB1_BE_FE_CONTRACT.md](LAB1_BE_FE_CONTRACT.md).

## Chạy lại kiểm chứng

Image build đã compile/link thành công cả hai fixture trên Linux:

| Board | PTITCube: flash dùng / application partition | Camera driver: flash dùng |
|---|---|---|
| ESP32 | 1.103.857 / 1.310.720 bytes (84,2%) | 267.473 bytes |
| ESP32-S3 | 1.066.481 / 3.342.336 bytes (31,9%) | 261.269 bytes |

Đây là số đo chương trình kiểm tra, không phải dung lượng toàn bộ flash. ESP32 còn ít dư địa hơn khi bổ sung tính năng; theo dõi size ở mỗi build, chỉ đổi partition khi đã xác định nhu cầu OTA và dữ liệu.

Từ thư mục `fastapi-backend`, bật Docker Engine Linux:

```powershell
docker build -f compiler/Dockerfile -t pscubesat-compiler:ptitcube .
$env:COMPILER_IMAGE = 'pscubesat-compiler:ptitcube'
$env:PSCUBESAT_TEST_DOCKER = '1'
$env:PSCUBESAT_TEST_POSTGRES = '1'
python -m unittest discover -s app/tests -v
```

PostgreSQL tests dùng cấu hình local và database tạm riêng. Integration tests mới biên dịch PTITCube và camera driver trên cả hai board rồi đối chiếu SHA-256 của đủ bốn file artifact. Test Lab1 và kiểm tra không truy cập được file host vẫn giữ nguyên.

## Kết quả cuối

- Discovery: 49 tests, 47 PASS và 2 Docker tests tạm skip trong lúc build image; sau đó chạy riêng cả 2 Docker tests và đều PASS (138,475 giây). Tổng cộng 49/49 tests đã được chạy và đạt qua hai lượt, bao gồm PostgreSQL và Docker thật.
- Sáu build runtime thành công: PTITCube, camera driver và Lab1 × ESP32/ESP32-S3. Mỗi build tạo artifact đủ bốn file và SHA-256 khớp dữ liệu tải bằng artifact service. Đây là kiểm tra dịch vụ BE; chưa phải thao tác nạp qua giao diện trình duyệt.
- Thử include file marker chỉ tồn tại trên host bị từ chối; nội dung marker không xuất hiện trong log compiler.
- Image đã kiểm chứng được gắn tag local `pscubesat-compiler:1` (cũng là `:ptitcube`), ID `sha256:45f4bdc4573779fcb0bc12e09ed7acef7b17b358ee32d47d248f0be488cc657b`. Tag `:verified` cũ vẫn giữ nguyên để tham chiếu.
- Logs Git-ignored: `fastapi-backend/logs/ptitcube-image-final.log`, `ptitcube-backend-tests.log`, `ptitcube-sandbox-tests.log`.

Khi triển khai máy khác: build compiler image trên Docker daemon mà API sử dụng, rồi triển khai lại BE với source mới. Chưa restart/redeploy stack ứng dụng đang chạy trong lượt này. Bước tiếp theo của FE là bỏ mô phỏng flash và nối artifact → esptool → Serial; sau đó nghiệm thu trên board thật bằng template Lab1.

## Bổ sung: sửa lỗi HTTP 500 trên trình duyệt Windows

Sau khi kiểm tra trên server dev thực tế, phát hiện hai lỗi mà test chạy trực tiếp bằng `asyncio.run` trước đó chưa bao phủ:

1. Uvicorn `--reload` trên Windows dùng SelectorEventLoop, không hỗ trợ `asyncio.create_subprocess_exec`. Cả health và compile ném `NotImplementedError` khi gọi Docker. `app/core/subprocess_loop.py` chuyển riêng thao tác Docker sang ProactorEventLoop ở worker thread khi gặp Windows Selector; các môi trường khác giữ loop hiện tại. Hủy request được chuyển tới worker và chờ dọn container trước khi trả quyền sử dụng build cache.
2. Uvicorn theo dõi cả file `build_cache/esp32s3/export_flash_manifest.py`; mỗi compile ghi file này làm server reload và đứt kết nối. `dev.py` dùng đường dẫn tuyệt đối để loại `build_cache` khỏi reload, tương thích với bản Uvicorn đang cài. `npm run dev` và `npm run dev:be` đã chuyển sang launcher này. Chạy BE riêng bằng `python dev.py` từ thư mục backend.

Kiểm chứng sau sửa:

- 22 tests compiler/transport đạt, gồm 5 bài chạy lại trên Windows Selector để kiểm tra transport, timeout, cancellation và cleanup.
- Bộ lọc reload đã kiểm tra: bỏ file Python trong build cache, vẫn nhận thay đổi source trong app.
- HTTP qua proxy FE `http://localhost:5175`: health 200; compile PTITCube trên ESP32-S3 trả 200, `success=true`, 28.438 ms.
- Tải đủ bốn file qua URL artifact và kiểm tra size/SHA-256: bootloader 15.104 bytes tại `0x0`, partitions 3.072 bytes tại `0x8000`, boot_app0 8.192 bytes tại `0xe000`, firmware 1.066.672 bytes tại `0x10000`.

Server dev đã được khởi động lại bằng launcher mới. Đây là kiểm chứng HTTP qua đúng proxy trình duyệt dùng, chưa phải nạp board vật lý. Log test: `fastapi-backend/logs/windows-subprocess-tests.log`; log server: `fastapi-backend/logs/windows-dev-verification.log`.
