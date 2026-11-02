# Nạp ESP32 từ website chạy trên server

## Cách hoạt động

Website công khai dùng HTTPS với chứng chỉ được trình duyệt tin cậy. Server biên dịch và trả firmware; trình duyệt trên máy người dùng dùng Web Serial/esptool-js để nạp ESP32 cắm USB vào chính máy đó. API `/api` và WebSocket `/ws` dùng cùng domain, qua reverse proxy.

```text
Chrome/Edge trên máy người dùng ─ HTTPS ─ Caddy ─ Nginx frontend ─ FastAPI
             │
             └── Web Serial / USB ─ ESP32 trên máy người dùng
```

Lỗi HTTP qua IP là chính sách của trình duyệt. Xóa kiểm tra JavaScript không cấp quyền USB. HTTP localhost là ngoại lệ khi trình duyệt chạy ngay trên máy đó. Trình duyệt hỗ trợ Web Serial, HTTPS tin cậy, quyền chọn cổng và thiết bị USB local là các điều kiện riêng biệt.

## Triển khai server bằng HTTPS tự động

Dùng riêng `docker-compose.production.yml`, không ghép với compose mặc định: stack production chỉ công khai cổng 80/443 của Caddy. Caddy cấp/gia hạn chứng chỉ cho domain và chuyển HTTP sang HTTPS.

1. Trỏ DNS A/AAAA của domain website, ví dụ cubesat.p-tech.xyz, tới server. Domain phải tới đúng server; nếu không dùng IPv6 thì không để AAAA trỏ sai. Cho phép cổng 80/443 đến Caddy và đảm bảo chúng chưa bị reverse proxy khác chiếm.
2. Đặt `SITE_DOMAIN=cubesat.p-tech.xyz` trong `.env` ở root (hoặc biến môi trường server). Giá trị chỉ là hostname, không kèm https://, port hay đường dẫn. Không đưa secret vào biến VITE_*.
3. Chuẩn bị `fastapi-backend/.env`: DATABASE_URL phải là DB server/container có thể truy cập, JWT_SECRET và các thông tin MQTT thật. `127.0.0.1` trong container là container đó, không phải máy host. Compose thiết lập Redis nội bộ và ALLOWED_ORIGINS theo domain HTTPS.
4. Build image compiler tin cậy trên cùng Docker daemon với BE:

```sh
docker build -f fastapi-backend/compiler/Dockerfile -t pscubesat-compiler:1 fastapi-backend
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml run --rm --no-deps fastapi python -m alembic upgrade head
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs --tail=100 gateway
```

5. Mở `https://<domain>/lab1` bằng Chrome/Edge desktop, không mở IP server qua HTTP. Website phải không có cảnh báo chứng chỉ. Cắm ESP32 vào máy người dùng, biên dịch, bấm Nạp Code và chọn cổng USB. Trình duyệt cần thao tác bấm trực tiếp để mở hộp chọn port; ứng dụng giữ yêu cầu này trước khi tải firmware.
6. Kiểm tra `/api/health`, đăng nhập, artifact download và telemetry WebSocket trên cùng domain. Không cấu hình frontend gọi API http:// từ trang https://. VITE_WS_URL mặc định để trống để suy ra wss://<domain>/ws.

Các container frontend/backend không cần tự có chứng chỉ. Caddy kết thúc TLS; Nginx giữ X-Forwarded-Proto đúng cho BE và trả `Permissions-Policy: serial=(self)` cho trang HTML. Backend Docker build bỏ qua .env, dữ liệu và cache; env thật chỉ được truyền lúc chạy.

Giữ volume caddy_data để tránh cấp lại chứng chỉ sau mỗi lần restart. Compose production không mount source code để hot reload. Image compiler và quyền Docker hiện tại của hệ thống vẫn cần được chuẩn bị; HTTPS không thay thế phần compiler này.

## Nếu server đã có Nginx/Cloudflare Tunnel

Không chạy thêm Caddy chiếm cổng 80/443. Dùng reverse proxy đang có để cung cấp HTTPS cho **trang frontend**, không chỉ riêng API/MQTT. Với compose mặc định, proxy tới frontend:80 trong Docker network hoặc cổng frontend đã publish. Chuyển tiếp `/api` và `/ws` qua Nginx hiện có, bật WebSocket ở proxy ngoài và giữ Permissions-Policy cho Serial. Xem thêm `Deployment_Cloudflare_Guide.md`.

TLS của mqtt.p-tech.xyz:8883 không làm trang http://<IP>:5175 trở thành HTTPS; website và broker MQTT là hai origin riêng.

## Thử qua LAN và giới hạn trình duyệt

- Phát triển trên máy cắm board: http://localhost:5175 vẫn dùng được nếu trình duyệt hỗ trợ Web Serial.
- Máy khác trong LAN: dùng chứng chỉ tin cậy cho IP/domain LAN theo `LAN_HTTPS_SERIAL.md`, hoặc truy cập domain HTTPS đã triển khai. Không tự động đổi port 5175 sang 443 vì đó có thể là dịch vụ khác.
- Khi chuyển từ HTTP sang HTTPS, localStorage thuộc origin khác: tải/lưu code cần giữ trước khi chuyển địa chỉ. Ứng dụng không tự redirect trang dev đang mở để tránh mất phiên làm việc.
- Nếu bị chặn bởi iframe, mở website trực tiếp trong tab riêng. Trang cha và chính sách nhúng cũng phải cho phép Serial.
- Với trình duyệt không cung cấp Web Serial (nhiều môi trường mobile/Safari/Firefox), dùng Chrome/Edge desktop hỗ trợ. HTTPS không tự thêm API vào trình duyệt.
- USB được chọn thuộc máy người dùng. Không thể nạp vào board cắm trên server chỉ bằng Web Serial trên máy client; luồng đó cần agent/gateway khác.

## Chẩn đoán sau deploy

Trong console DevTools trên trang HTTPS:

```js
window.isSecureContext // true
'serial' in navigator // true trên trình duyệt hỗ trợ
```

Tab Network: HTML có Permissions-Policy cho serial; `/api/health` và artifact trả đúng response, `/ws` dùng wss://. Không bỏ qua cảnh báo chứng chỉ hoặc khởi động browser với flag tắt bảo mật để nghiệm thu production.

Nguồn: [MDN Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API), [Serial Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/serial), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Kết quả kiểm tra 21/10/2026

- `npm run check`: PASS, gồm 12 test artifact/Serial và 82 test BE (8 skipped), cùng lint/typecheck và các test hiện có.
- `npm run build`: PASS; vẫn có cảnh báo bundle lớn đã có từ trước.
- Compose production: hợp lệ; chỉ gateway publish cổng, frontend/backend nội bộ; CORS dùng domain HTTPS.
- `nginx -t` và `caddy validate`: PASS trên image tương ứng.
- `python scripts/test-https-deployment.py`: PASS. Test dùng Docker network/container riêng, port localhost ngẫu nhiên và CA test được xác minh riêng cho client test, không cài CA vào máy. Kiểm tra HTTP redirect, SPA, Permissions-Policy, scheme HTTPS tới backend và nhận frame qua WSS. Tài nguyên Docker test được dọn sau khi chạy.
- Test proxy dùng backend giả để kiểm chứng routing/transport; chưa cấp chứng chỉ công khai hay deploy server thật, chưa flash lại board trong đợt sửa này. Chứng chỉ công khai phụ thuộc DNS/cổng 80/443 đúng khi triển khai thực tế.
