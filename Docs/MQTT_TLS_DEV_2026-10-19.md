# MQTT TLS development override — 19/10/2026

Theo yêu cầu mới của người dùng, cho phép bỏ xác minh chứng chỉ để tiếp tục thử nghiệm broker server. TLS vẫn mã hóa kết nối nhưng không xác thực danh tính broker trong chế độ này.

## Đã thực hiện

- Thêm `MQTT_TLS`, `MQTT_TLS_VERIFY`, `MQTT_CA_FILE`, các trường admin vào Settings; password không xuất hiện trong repr.
- Chính sách TLS dùng chung cho consumer, simulator và probe tại `app/core/mqtt_transport.py`. Mặc định verify=true; chỉ verify=false mới dùng CERT_NONE. Không tự fallback khi CA lỗi. Không suy ra TLS từ số port.
- Khôi phục probe Phase 0 và test từ nhánh MQTT trước đây vào workspace hiện tại; báo cáo phân biệt TLS handshake thành công với chứng chỉ được xác minh (`tls_verified=false`).
- Cập nhật riêng các biến MQTT trong .env local từ cấu hình đã tìm được ở dự án bên cạnh: server 14.224.143.43:8883, TLS=true, VERIFY=false. Secret không commit, không ghi vào báo cáo.
- Không sửa các thay đổi Auth/Blockly đang làm dở; không restart broker hoặc cấp/xóa tài khoản server.

## Bằng chứng

Probe tới server thật bằng service account: TCP 8883 PASS; TLS handshake với verification disabled PASS; MQTT CONNECT PASS; subscribe sensors/# PASS; publish/subscribe nonce không retained trên test/codex/probe PASS. Không publish telemetry hay command vào thiết bị thật.

Đọc $SYS/broker/version bị broker từ chối SUBACK. Chưa có credential MQTT admin nên chưa gửi lệnh dynsec. Không kết luận broker đã bật/tắt dynsec dựa trên việc tài khoản service không đọc được $SYS.

Kết quả chi tiết: `mqtt-phase0-insecure-result-2026-10-19.json`.

- Probe unit tests: 13/13 PASS.
- Toàn bộ BE trên workspace hiện tại: 69 tests, OK, 7 skipped. Các test skipped không được tính là integration đã đạt.
- Settings hiệu lực sau cập nhật: server 14.224.143.43:8883, TLS=true, verify=false.

## Sử dụng và phần còn lại

BE đọc .env lúc khởi động; nếu process đang chạy giữ Settings cũ thì cần restart BE để nhận endpoint mới. Không tự restart runtime đang chạy hoặc kích hoạt simulation của người khác trong đợt kiểm tra này.

Để bật lại xác minh, đặt MQTT_TLS_VERIFY=true và MQTT_CA_FILE tới CA đúng, sau đó restart BE. `.env.example` giữ verify=true.

Việc bỏ xác minh TLS chỉ gỡ trở ngại kết nối. Provision từng user/device, revoke/rotate và integration ACL vẫn cần quyền quản trị broker hoặc API provision thực tế; service account hiện tại không tự được coi là admin. Các phase này chưa được triển khai và chưa được chứng minh hoàn tất. Điểm dừng về provisioning trong yêu cầu gốc vẫn còn; ngoại lệ mới của người dùng chỉ thay đổi kiểm tra chứng chỉ TLS.
