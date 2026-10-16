# Hướng dẫn triển khai nền tảng IoT vệ tinh (ESP32 + MQTT)

# Mục tiêu

Xây dựng hệ thống gồm:

ESP32 -\> MQTT Broker -\> MQTT Consumer -\> PostgreSQL + Redis -\>
FastAPI -\> React Dashboard

Phạm vi tài liệu: - Thiết kế MQTT Broker - Device Registry - Telemetry
Pipeline - Command Pipeline

(Không bao gồm OTA và mở rộng quy mô lớn.)

------------------------------------------------------------------------

# 1. Kiến trúc tổng thể

``` text
Internet
    |
mqtt.example.com:8883
    |
Mosquitto (Docker)
    |
MQTT Consumer
   | \
   |  +--> Redis (latest state)
   |
   +--> PostgreSQL (history)
           |
        FastAPI
           |
 React (REST + WebSocket)
```

## Vai trò

-   Mosquitto: Broker, chỉ chuyển tiếp message.
-   MQTT Consumer: subscribe, validate, lưu dữ liệu.
-   Redis: trạng thái mới nhất của từng vệ tinh.
-   PostgreSQL: lịch sử telemetry và thông tin thiết bị.
-   FastAPI: API, xác thực người dùng, WebSocket.
-   React: Dashboard.

------------------------------------------------------------------------

# 2. MQTT Broker

## Khuyến nghị

-   Chạy bằng Docker Compose.
-   Dùng Mosquitto.
-   Không nhúng vào FastAPI.

Expose: - 1883: MQTT (chỉ dùng nội bộ/dev) - 8883: MQTT over TLS
(production)

Không bật anonymous.

Mỗi thiết bị có: - device_id - device_secret

------------------------------------------------------------------------

# 3. Device Registry

Bảng devices:

-   id
-   owner_id
-   device_uuid
-   secret_hash
-   status
-   created_at
-   last_seen

Khi đăng ký thiết bị:

1.  Sinh UUID.
2.  Sinh secret ngẫu nhiên.
3.  Hash secret.
4.  Lưu DB.
5.  Trả device_uuid + secret đúng một lần để nạp vào ESP32.

------------------------------------------------------------------------

# 4. Topic

Khuyến nghị:

user/{user_id}/satellite/{device_uuid}/telemetry

user/{user_id}/satellite/{device_uuid}/status

user/{user_id}/satellite/{device_uuid}/cmd

Quy tắc:

-   ESP32 chỉ publish telemetry/status.
-   ESP32 chỉ subscribe cmd.
-   Backend subscribe toàn bộ telemetry.

------------------------------------------------------------------------

# 5. Authentication & Authorization

Authentication: - Username=device_uuid - Password=device_secret

Authorization: - Thiết bị chỉ được publish topic của chính nó. - Thiết
bị chỉ được subscribe cmd của chính nó.

Dashboard không kết nối MQTT trực tiếp. Dashboard -\> FastAPI -\>
WebSocket.

------------------------------------------------------------------------

# 6. Telemetry Pipeline

ESP32 publish JSON.

MQTT Consumer:

-   Parse
-   Validate
-   Kiểm tra thiết bị
-   Cập nhật Redis latest state
-   Đưa vào buffer

Flush buffer xuống PostgreSQL mỗi vài giây hoặc theo batch.

FastAPI:

-   REST lấy lịch sử.
-   WebSocket lấy realtime từ Redis/Consumer.

------------------------------------------------------------------------

# 7. Database

devices

telemetry

Mỗi bản ghi telemetry gồm: - device_id - timestamp - gps - temperature -
pressure - battery - gyro

------------------------------------------------------------------------

# 8. Command Pipeline

Web -\> FastAPI

FastAPI kiểm tra quyền.

Publish:

user/{user_id}/satellite/{device_uuid}/cmd

ESP32 subscribe và thực thi.

Sau đó publish status hoặc kết quả.

------------------------------------------------------------------------

# 9. Docker Compose (logic)

-   nginx
-   react
-   fastapi
-   mqtt-consumer
-   mosquitto
-   redis
-   postgres

Mỗi service là một container độc lập.

------------------------------------------------------------------------

# 10. Lộ trình triển khai

1.  Chạy Mosquitto.
2.  Viết ESP32 publish telemetry.
3.  Viết MQTT Consumer.
4.  Lưu PostgreSQL.
5.  Redis latest state.
6.  FastAPI REST.
7.  FastAPI WebSocket.
8.  React Dashboard.
9.  Authentication.
10. Authorization (ACL).
