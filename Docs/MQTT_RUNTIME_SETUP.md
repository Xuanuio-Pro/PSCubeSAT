# MQTT runtime

BE và simulator dùng MQTT TCP/TLS tới broker server. FE vẫn nhận telemetry qua WebSocket của BE; không cần cổng WebSocket MQTT 8084.

```dotenv
MQTT_HOST=mqtt.p-tech.xyz
MQTT_PORT=8883
MQTT_USERNAME=backend-service
MQTT_PASSWORD=<service account password>
MQTT_TOPIC=sensors/#
MQTT_TLS=true
MQTT_TLS_VERIFY=true
MQTT_CA_FILE=
```

Đặt giá trị thật trong `fastapi-backend/.env` (ignored). Không thêm `mqtts://` vào MQTT_HOST. CA để trống sử dụng trust store mặc định; domain đã kiểm chứng TLS hợp lệ. Restart BE sau khi thay env vì Settings được cache. Không chạy bootstrap Mosquitto local để cấu hình broker server.

## Trạng thái và xử lý lỗi

- GET `/api/health` có `mqtt.connected`: consumer đã kết nối và subscribe thành công; `mqtt.publisher_connected`: simulator publisher đã kết nối; `mqtt.last_message_at`: Unix timestamp frame telemetry hợp lệ cuối cùng (null nếu chưa nhận).
- Consumer subscribe QoS 1; các kết nối lỗi dùng retry từ 1 đến tối đa 30 giây, reset khi kết nối thành công. Khi mất kết nối hoặc shutdown, health chuyển disconnected.
- Publisher theo dõi mất kết nối qua iterator aiomqtt thay vì chỉ đợi stop; xóa trạng thái ready trước khi backoff, tự tạo lại client.
- WebSocket có timeout gửi 2 giây và loại client gửi lỗi khỏi room. Giới hạn này tránh một client chậm giữ consumer vô thời hạn.
- MQTT_TLS_VERIFY=false vẫn là ngoại lệ dev tùy chọn, nhưng không cần dùng với domain hiện tại.

## Kiểm chứng ngày 19/10/2026

- Broker thật: consumer runtime kết nối/subscribe topic test/codex/runtime/# thành công; simulator publisher runtime gửi frame của UID test qua TLS được xác minh, client MQTT độc lập nhận đúng frame với QoS 1. Không đăng ký UID test vào DB, không ghi telemetry test vào DB.
- Test mock kiểm chứng mất kết nối/reconnect consumer và publisher, cập nhật health, shutdown, QoS 1 và client WebSocket chậm.
- Đây chưa phải kiểm chứng phần cứng ESP32 → DB → UI hoặc broker restart thật; không restart broker dùng chung.
- Provision credential riêng cho thiết bị/user, ACL và command/ACK vẫn là phần chưa hoàn tất của kế hoạch lớn; cần MQTT admin/API provision. Service credential chỉ phục vụ BE, không nhúng vào firmware ESP32.
