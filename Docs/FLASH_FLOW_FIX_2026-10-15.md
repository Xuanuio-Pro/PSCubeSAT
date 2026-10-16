# Sửa luồng nạp firmware và dịch vụ BE local

## Nguyên nhân đã xác nhận

- `WebFlasher.jsx` trước đây dùng timer và số ngẫu nhiên, không truyền byte nào tới bootloader. Thông báo thành công cũ không chứng minh thiết bị đã được nạp.
- Thiết bị USB-UART ở COM8 được nhận dạng bằng esptool là **ESP32-D0WD-V3 revision 3.1**, nhưng bản build trong log người dùng là **ESP32-S3**. Chỉ nhận dạng/reset thiết bị, chưa ghi flash trong bước này.
- JSON `{"type":"err","msg":"RX error code -24"}` đến từ firmware đang chạy qua Serial. Không tìm thấy chuỗi này trong source BE, FE hoặc PTITCube đang tích hợp; chưa xác định chính xác thư viện/nguồn phát nên không suy đoán ý nghĩa mã -24.
- Redis và MQTT localhost không có dịch vụ lắng nghe; BE liên tục nhận connection refused. Đây là vấn đề dịch vụ độc lập với USB flash.
- Log Vite đính kèm bị cắt mất dòng nguyên nhân đầu tiên. Trước đó đã có phiên dev chạy; không nên khởi động thêm nhiều `npm run dev` trên cùng cổng. Không khẳng định dòng lỗi bị thiếu là lỗi bind port khi chưa có log đầy đủ.

## Thay đổi

FE nhận artifact từ compiler thay vì chỉ application base64. Mỗi lab giữ bản build và board đã chọn trong SerialProvider; sửa source hoặc đổi board khiến bản build cũ không còn được phép nạp. Dropdown hỗ trợ ESP32/ESP32-S3, mặc định ESP32 phù hợp thiết bị vừa nhận dạng.

Nạp thật dùng `esptool-js` với bộ bốn file; kiểm tra expiry, source SHA-256, kích thước, SHA-256 từng download, offsets và chip thực tế trước khi ghi. URL download được dựng từ artifact ID và tên file hợp lệ, không gửi token đến URL tùy ý. Không erase toàn chip. Bật xác minh MD5 bằng stub sau khi ghi từng ảnh; esptool tính MD5 trên dữ liệu sau khi cập nhật header flash. Progress lấy từ callback thật, 100% chỉ sau khi write/verify/reset hoàn tất.

SerialProvider khóa độc quyền trong lúc nạp: dừng monitor, hủy reader, chờ pipeline đóng và giải phóng writer/port. Sau đó flasher mở cổng. Khi kết thúc/lỗi, transport được đóng và monitor được mở lại ở 115200. Nếu cổng đổi sau reset, giao diện yêu cầu chọn lại. Log esptool được đánh dấu là log ứng dụng, không đưa vào luồng telemetry Serial.

`docker-compose.dev.yml` và `fastapi-backend/local_services.py` khởi động Redis/Mosquitto chỉ bind loopback. `npm run dev`/`dev:be` gọi bootstrap trước BE. MQTT local dùng tài khoản BE từ cấu hình; nếu thiếu password, bootstrap sinh ngẫu nhiên và lưu trong `.env` bị Git ignore, chuyển password thành hash bằng `mosquitto_passwd`. Không sửa tài khoản broker production hoặc file passwd đã có trong repository. Dịch vụ remote được bỏ qua.

Broker local này cấp quyền tài khoản BE cho `sensors/#` và `cmd/#` để chạy consumer/simulator. Chưa triển khai đồng bộ tài khoản thiết bị từ database sang broker; đăng ký thiết bị trong DB không đồng nghĩa thiết bị đó đã có tài khoản Mosquitto local. Không công bố port MQTT/Redis ra LAN.

## Kiểm chứng

- `npm run build`, typecheck và lint: PASS.
- 6 tests flash: PASS, bao gồm sai chip không ghi flash, source cũ, artifact hết hạn/thiếu file/sai offset, lỗi download/hash và không báo 100% khi write thất bại.
- 54 BE tests: 52 PASS, 2 Docker integration tests opt-in không bật trong lượt này; PostgreSQL tests đã chạy.
- MQTT local: kết nối có xác thực, publish/subscribe vòng lặp thành công. Redis ping thành công. Log BE xác nhận consumer/publisher kết nối broker và Redis.
- Biên dịch Lab1 ESP32 qua proxy FE: HTTP 200, application 270.160 bytes. Dùng đúng helper FE mới để tải bốn ảnh từ API đang chạy và xác minh hash thành công: bootloader `0x1000` (17.536 bytes), partitions `0x8000` (3.072), boot_app0 `0xe000` (8.192), firmware `0x10000` (270.160).
- Chưa xác nhận ghi flash/heartbeat trên phần cứng bằng FE trong lượt này. Không dùng kết quả mock để tuyên bố nạp vật lý thành công.

## Cách dùng

1. Giữ một phiên `npm run dev`, mở `http://localhost:5175/lab1` và tải lại trang để nhận FE mới.
2. Với thiết bị hiện tại, chọn **ESP32**, biên dịch lại code. Bản ESP32-S3 cũ không dùng cho COM8.
3. Bấm **Nạp code**, chọn cổng CP210x/COM8. Monitor sẽ tự nhường cổng. Nếu auto-reset không vào bootloader, giữ BOOT và nhấn RESET khi đang kết nối.
4. Chỉ coi ghi flash thành công khi có xác minh hash. Sau reset kiểm tra Serial 115200. Với mẫu Lab1, gửi `ping` và kiểm tra JSON `event: pong` cùng heartbeat.
5. Nếu đang mở Serial ở chương trình khác, đóng chương trình đó trước khi nạp. Firmware tùy ý có giao thức/baud riêng; build thành công không đảm bảo phát heartbeat Lab1.

Log kiểm chứng nằm trong `fastapi-backend/logs/flash-flow-dev.log`, `flash-flow-backend-tests.log`, `flash-flow-fe-build.log` (Git ignored).

## Bổ sung: nghiệm thu phần cứng thật ngày 15/10/2026

Sau khi người dùng cho phép thay firmware bằng mẫu Lab1 và cắm lại board, đã ghi thành công lên **COM8 / ESP32-D0WD-V3 revision 3.1** bằng esptool CLI 4.5.1, baud nạp 115200. Dùng artifact `e307744b1c604f2da60c77e50da9de9d` từ BE; kiểm tra lại source SHA-256 và size/hash đủ bốn file trước khi ghi. Esptool trả exit code 0 và `Hash of data verified` cho cả bốn ảnh, rồi hard reset. Không erase toàn chip.

Đọc Serial thật ở 115200 thu được boot, ba heartbeat tại uptime 1000/2000/3000 ms; gửi `ping\n` nhận `event: pong` tại uptime 1012 ms. Cổng COM8 đã đóng và giải phóng sau kiểm tra. Board hiện chạy mẫu Lab1 thay firmware trước đó.

Log: `fastapi-backend/logs/lab1-com8-write-flash.log` và `fastapi-backend/logs/lab1-com8-serial.json`. Kết quả này xác nhận artifact BE, nạp vật lý và Serial hoạt động bằng CLI; chưa phải kiểm chứng thao tác Web Serial/esptool-js từ nút nạp trên trình duyệt.
