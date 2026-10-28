# Phương án dùng MQTT cho các lab — 29/10/2026

Nối tiếp [MQTT_CURRENT_STATE_2026-10-16.md](MQTT_CURRENT_STATE_2026-10-16.md). Tài liệu này chốt hợp đồng và thứ tự làm; phần đã code được đánh dấu rõ.

## 1. Hợp đồng topic

| Topic | Chiều | Payload | Trạng thái |
|---|---|---|---|
| `sensors/{uid}/telemetry` | thiết bị → BE | JSON TelemetryFrame (≤ 64 KiB) | Đã có consumer + WebSocket |
| `sensors/{uid}/image` | thiết bị → BE | JPEG nhị phân (≤ 2 MiB, bắt đầu FFD8, kết thúc FFD9) | **Đã code phía BE** (29/10) |
| `cmd/{uid}` | BE → thiết bị | JSON lệnh | Chưa có luồng publish/ACK |
| `cmd/{uid}/ack` | thiết bị → BE | JSON kết quả | Chưa có |

`{uid}` là `device_uid` đã đăng ký, trùng `device_id` trong payload. Mỗi thiết bị chỉ được publish vào `sensors/{uid}/#` và subscribe `cmd/{uid}/#` (ACL theo thiết bị).

## 2. Đường đi dữ liệu theo lab

- **Lab 4.1, 4.2, 4.3, 4.5 (cảm biến):** ESP32 publish JSON mỗi 1–2 giây; BE đẩy qua `/ws/devices/{uid}`; các panel hiện có (Môi trường, 3D Attitude, GPS Map) đọc cùng một luồng như Serial, không cần panel riêng.
- **Lab 4.4 (camera):** bấm `p` → camera chụp, lưu thẻ SD → firmware đọc lại file JPEG và publish lên `sensors/{uid}/image` (PubSubClient chỉ hỗ trợ QoS 0; script thử dùng QoS 1) → BE kiểm tra JPEG, chủ sở hữu thiết bị, lưu vòng 10 ảnh tại `fastapi-backend/data/device-images/{uid}/` → FE gọi `GET /api/telemetry/images/{uid}` mỗi 4 giây và tải ảnh mới bằng `GET /api/telemetry/images/{uid}/{id}`.
- **Lab 5 (điều khiển):** dùng `cmd/{uid}` và `cmd/{uid}/ack` sau khi hai topic telemetry ổn định.

Serial và MQTT là hai nguồn độc lập; chọn nguồn bằng bộ chọn nguồn dữ liệu hiện có. Serial vẫn là đường mặc định trên lớp học.

## 3. Trạng thái triển khai (29/10/2026)

| Hạng mục | Trạng thái |
|---|---|
| BE nhận ảnh `sensors/{uid}/image`, API xem ảnh, Camera Viewer tải ảnh | Xong, có test |
| ACL publish `sensors/{uid}/image`: thiết bị mới có sẵn; thiết bị cũ qua migration `0011_device_image_acl` (chạy `alembic upgrade head`) | Xong; migration mới kiểm tra cú pháp trên DB dev (DB dev chưa có thiết bị nên chưa thấy dòng ACL được thêm) |
| `firmware_snippet` và `GET /api/devices/{uid}/mqtt` có topic ảnh | Xong |
| Tài khoản broker theo thiết bị | Đã có sẵn: BE tạo `dev_<uid>` trong PostgreSQL, EMQX đọc qua view (xem [EMQX_POSTGRES_SETUP.md](EMQX_POSTGRES_SETUP.md)). **Còn phải bật nguồn PostgreSQL trên EMQX server** (việc của quản trị broker) |
| Firmware nhận thông tin broker | Ví dụ [Lab4-04_Camera_MQTT.cpp](../fastapi-backend/app/firmware/examples/Lab4-04_Camera_MQTT.cpp): sinh viên dán hằng số từ `firmware_snippet`. Không sửa thư viện CDH nên không phải build lại compiler image. Biên dịch được, chưa chạy trên phần cứng |
| 4b: ảnh qua Serial theo khối | Xong: Lab4-04b gửi `IMG_BEGIN/IMG_CHUNK/IMG_END` sau khi lưu SD, FE ghép và kiểm tra JPEG. Biên dịch được và có catalog/hash mới, chưa chạy trên phần cứng |
| Script thử nhận ảnh khi chưa có camera | `fastapi-backend/scripts/mqtt_send_image.py <uid> <ảnh.jpg>` |

Bước 1–2 bên dưới vẫn là hướng dài hạn cho telemetry cảm biến; riêng phần ảnh đã có cách chạy như bảng trên.

## 4. Việc cần làm theo thứ tự

1. **Bật nguồn PostgreSQL trên EMQX server** và kiểm tra đăng nhập bằng credential thiết bị thật (chặn mọi bước sau; BE đã tạo `dev_<uid>` + ACL trong DB, xem EMQX_POSTGRES_SETUP.md).
2. **Firmware nhận cấu hình broker cho toàn bộ lab** (ví dụ camera đã dán hằng số thủ công): compiler cấp macro `MQTT_HOST/PORT/USER/PASS` cho thư viện CDH, client ID theo `device_uid`, reconnect có backoff, kiểm tra kết quả publish. Sửa topic Lab7-03 từ `cubesat/telemetry/...` sang `sensors/{uid}/telemetry`.
3. **Lab sensor qua MQTT**: bổ sung bản MQTT cho 4.1/4.2/4.3/4.5 (cùng sketch, thêm publish JSON). Kiểm tra đầu-cuối: ESP32 → broker → BE → trình duyệt.
4. **Camera 4.4 qua MQTT**: firmware đọc file từ SD theo khối (đệm ≤ 4 KiB) và publish một message JPEG. Cần kiểm tra giới hạn message của broker/ESP32 (ví dụ dùng `beginPublish` streaming nên không cần buffer lớn) trước khi chốt 2 MiB.
5. **TLS thật** (CA + xác minh tên miền), thay `setInsecure()`.
6. **Lệnh `cmd/{uid}`** có ACK và timeout; idempotency theo `command_id`.

## 5. Rủi ro đã biết

- Ảnh lưu đĩa cục bộ, theo vòng 10 ảnh/thiết bị: đủ cho lớp học, không dùng được khi chạy nhiều worker (ponytail trong `device_images.py`).
- FE polling 4 giây thay vì push để không đổi hợp đồng WebSocket; đổi sang push khi cần.
- Chưa kiểm tra với phần cứng: camera hiện hỏng nên cả hai đường gửi ảnh (Serial, MQTT) mới được biên dịch và kiểm thử phần giải mã/nhận, chưa chạy với camera thật.
- Ví dụ MQTT mặc định không xác thực máy chủ nếu `ROOT_CA` để trống.
