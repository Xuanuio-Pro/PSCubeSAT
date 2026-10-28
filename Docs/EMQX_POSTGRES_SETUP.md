# EMQX xác thực ESP32 trực tiếp bằng PostgreSQL

## Kiến trúc đã chốt

- Người dùng web: đăng ký vào `users`, password bcrypt, đăng nhập JWT. Không tạo MQTT account cho user, không gọi cổng 18083 khi đăng ký.
- ESP32: BE tạo Device + MQTTCredential + bốn ACL trong một transaction PostgreSQL. Username mới `dev_<device_uid>`, secret ngẫu nhiên 32 byte trước khi encode URL-safe, chỉ trả một lần. DB chỉ lưu bcrypt hash.
- EMQX đọc hai view `emqx_mqtt_authn` và `emqx_mqtt_authz`; không gọi BE và không cần BE có admin broker.
- Service account BE hiện tại giữ nguyên trên EMQX. Không đưa credential service vào ESP32.
- Firmware/username cũ được giữ nguyên; migration không đổi password hoặc ACL đã có.

## API đã triển khai

| Endpoint | Kết quả |
|---|---|
| POST /api/devices/register | Tạo thiết bị, trả device_secret một lần, mqtt_username và credential_backend=postgresql |
| GET /api/devices/{uid}/mqtt | Host, port, TLS, username, topics, enabled, timestamps; không password/hash |
| POST /api/devices/{uid}/mqtt/rotate | Owner tạo password mới, lưu hash, trả password một lần; cũng bật lại credential đã revoke nếu thiết bị vẫn enabled |
| POST /api/devices/{uid}/mqtt/revoke | Owner vô hiệu credential trong DB; không tuyên bố đã kick session |
| DELETE /api/devices/{uid} | Soft delete thiết bị, revoke credential, xóa ACL và giữ cleanup runtime hiện có |

Register/rotate/GET MQTT có Cache-Control: no-store. Secret không xuất hiện ở GET thông thường. Tài khoản khác không được đọc/rotate/revoke credential. User bị soft delete, thiết bị disabled/deleted hoặc credential revoked đều bị loại khỏi view authentication. ACL view chỉ còn deny cho credential không còn hoạt động.

## Migration và kiểm thử

Chạy từ fastapi-backend:

```powershell
python -m alembic upgrade head
python -m unittest app.tests.test_device_mqtt_db
$env:PSCUBESAT_TEST_POSTGRES='1'
python -m unittest app.tests.test_emqx_postgres
```

Migration 0005 phụ thuộc migration 0004_auth_email hiện có trong workspace. Migration thêm rotated_at/revoked_at và hai view; không ghi đè tài khoản hiện hữu. Test PostgreSQL tạo database riêng có prefix pscubesat_test_, rồi cleanup database đó.

## Cấu hình EMQX một lần

BE không cần gọi Management API, nhưng người quản trị vẫn phải bật nguồn PostgreSQL trên EMQX qua Dashboard hoặc cấu hình server. Chưa có đường truy cập quản trị server trong phiên này.

1. Cho EMQX truy cập **đúng PostgreSQL mà BE đang dùng**. Hiện DATABASE_URL của BE là 127.0.0.1:5432/cubesat trên máy phát triển; không dùng địa chỉ này trên server EMQX. Cần DB chung qua VPN/mạng riêng hoặc DB server có allowlist địa chỉ EMQX và TLS. Không tự mở PostgreSQL ra Internet.
2. Sau migration, chạy `fastapi-backend/emqx/grants.sql` bằng DB admin, đặt password cho role `pscubesat_emqx_reader` bằng lệnh psql `\password`. Chỉ grant đọc hai view; không cấp quyền đọc bảng users hoặc ghi DB. Không ghi password vào Git.
3. Authentication: Password-Based → PostgreSQL; nhập DB host/database/reader credentials; chọn bcrypt; dùng nguyên query trong `emqx/authentication.sql`. Giữ authenticator đang phục vụ backend-service. Xác minh không có authenticator khác cho phép đăng nhập thay thế với cùng namespace dev_ khi DB từ chối.
4. Authorization: PostgreSQL, cùng reader account; dùng query `emqx/authorization.sql`. Đặt source này trước nguồn allow-all. Với username đã biết, view trả scoped allow và catch-all deny. Cấu hình no-match=deny và rà soát nguồn ACL mặc định; không làm mất quyền của service account đã có. Kiểm tra loại wildcard/filter được broker áp dụng với subscribe.
5. Tắt authentication/authorization cache khi kiểm chứng revoke/rotate; nếu bật lại phải công bố TTL và ảnh hưởng đến độ trễ thu hồi. Không dùng cache cũ để kết luận quyền đã bị thu hồi ngay.
6. Xác minh từ ESP32 hoặc MQTT client bằng credential mới sau khi bật hai nguồn này. Chưa được coi API đăng ký thành công là chứng minh broker đã đọc DB.

EMQX hỗ trợ query theo schema/view tùy chỉnh; authentication lấy password_hash/is_superuser, authorization lấy permission/action/topic. Nguồn chính thức: [PostgreSQL Authentication](https://docs.emqx.com/en/emqx/latest/access-control/authn/postgresql.html), [PostgreSQL Authorization](https://docs.emqx.com/en/emqx/latest/access-control/authz/postgresql.html).

## Hợp đồng topic

Thiết bị chỉ publish `sensors/<uid>/telemetry`, `sensors/<uid>/status`, `sensors/<uid>/ack`, `sensors/<uid>/image` (ảnh JPEG; migration 0011 bổ sung cho thiết bị cũ); chỉ subscribe `cmd/<uid>/#`. Các topic khác bị deny. Thiết bị cũ giữ ACL cũ để không thay đổi firmware đang dùng ngoài yêu cầu.

Telemetry phải chứa device_id trùng UID, số đo đúng schema hiện có. LWT có thể dùng status topic; việc xử lý status/ACK/command hoàn chỉnh ở BE là công việc riêng chưa hoàn tất trong thay đổi này.

## Thu hồi và giới hạn

DB revoke/rotate tác động các lần xác thực tiếp theo. Nó không tự ngắt phiên MQTT đã kết nối. Với subscription tồn tại hoặc cache broker, quyền có thể còn hiệu lực tới khi session kết thúc/cache hết hạn. Nếu cần kick ngay, người vận hành dùng Dashboard/CLI của EMQX; muốn tự động phải thêm đường quản trị/hook riêng. BE hiện trả existing_sessions_disconnected=false để phản ánh đúng thực tế.

Snippet GET thiết bị là fragment cấu hình, không phải sketch đầy đủ; dùng host/port thật và placeholder password. ESP32 cần root CA hoặc CA bundle cho WiFiClientSecure dù Python/trình duyệt trên máy có trust store sẵn. Không dùng WiFiClient thường cho cổng 8883.

## Tiêu chí nghiệm thu trên server

- Hai thiết bị khác owner đăng nhập độc lập; password sai bị từ chối.
- A chỉ publish/subscribe topic của A; truy cập B và wildcard sensors/# bị chặn.
- Rotate: password cũ không login mới được, password mới login được.
- Revoke/delete hoặc xóa owner: login mới bị từ chối; kiểm tra riêng phiên đang mở theo giới hạn ở trên.
- Telemetry từ thiết bị đăng ký vào BE và tới đúng WebSocket room owner.

Các kiểm thử server này cần cấu hình EMQX và đường mạng DB; không thay bằng kết quả test SQLite/PostgreSQL local.

## Kết quả triển khai 20/10/2026

- Đã áp dụng migration `0005_emqx_postgres` vào DB local `cubesat`; kiểm tra trực tiếp xác nhận hai view tồn tại.
- Toàn bộ BE bật PostgreSQL integration: 77 tests, OK, 2 skipped. Các case riêng kiểm tra rollback khi ghi ACL lỗi, không lộ secret qua GET, owner isolation, rotate, revoke, delete và view lọc owner bị xóa.
- PostgreSQL migration test đã thử downgrade về 0004 rồi upgrade lại, credential vẫn được giữ. Chỉ làm downgrade trên database test, không downgrade DB sử dụng.
- FE hiển thị thêm MQTT username trả về khi tạo thiết bị, tránh nhầm username mới với UID.
- Chưa bật PostgreSQL source trên EMQX server, chưa kiểm chứng credential mới login broker thật. Cần DB endpoint mà server EMQX truy cập được và thao tác cấu hình server một lần; API 18083 không nằm trong luồng đăng ký/rotate/revoke của ứng dụng.
