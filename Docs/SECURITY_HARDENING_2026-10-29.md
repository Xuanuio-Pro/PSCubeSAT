# Tăng cường bảo mật — 29/10/2026

Phạm vi: chống dò mật khẩu, spam, lạm dụng compile, sao chép nội dung hàng loạt, nhúng trang để lừa đảo, và hướng dẫn chặn DDoS ở Cloudflare. Nhánh `feat/security-hardening`.

## 1. Đã có trong code

### Giới hạn tần suất (`app/core/rate_limit.py`)

Middleware ASGI đếm theo cửa sổ cố định; vượt ngưỡng trả `429` với `{"code": "RATE_LIMITED", "message", "details": {"rule", "retry_after"}}` và header `Retry-After`. Frontend hiển thị sẵn trường `message`.

| Quy tắc | Phạm vi | Ngưỡng |
|---|---|---|
| `login`, `google_login` | IP | 60 / phút |
| `register` | IP | 30 / giờ |
| `password_change` | user | 5 / 15 phút |
| `compile` | user | 10 / 10 phút |
| `quiz_generation` (AI, tốn tiền) | user | 10 / giờ |
| `quiz_attempt` (bắt đầu/nộp bài) | user | 30 / phút |
| `content_read` (giáo trình, lộ trình, bài học, đề) | user | 120 / phút — vượt ngưỡng ghi log `content_scrape_suspected` |
| `source_download` (tải mã mẫu) | user | 30 / 10 phút — cũng ghi `content_scrape_suspected` |
| `api_user` | user | 600 / phút |
| `api_ip` | IP | 3000 / phút |

Ngưỡng theo IP đủ rộng cho cả lớp (~40 SV) dùng chung một IP NAT của trường. Quy tắc "user" lấy `sub` trong JWT đã kiểm chữ ký; token giả bị tính vào bucket IP.

**Giới hạn đã biết:** bộ đếm nằm trong RAM của process. Đúng với 1 worker uvicorn hiện tại (Dockerfile); khi tăng worker phải chuyển bộ đếm sang Redis. Khởi động lại backend sẽ xóa bộ đếm.

### Chống dò mật khẩu (`app/services/auth.py`)

- Sai 5 lần với cùng **email + IP** trong 15 phút → khóa cặp đó tới hết cửa sổ (`429 LOGIN_LOCKED`). Đăng nhập đúng xóa bộ đếm của cặp.
- Sai 30 lần với cùng **email** từ mọi IP trong 1 giờ → khóa email (chống dò phân tán). Khóa theo cặp trước để một IP lạ không khóa được tài khoản của người khác.
- Email không tồn tại vẫn chạy bcrypt với hash giả: thời gian phản hồi không lộ email nào đã đăng ký.

### Header và cấu hình

- Nginx (`nginx-security-headers.conf`, include ở mọi location): `X-Frame-Options: SAMEORIGIN` và CSP `frame-ancestors 'self'` (trang khác không nhúng được web để lừa người dùng), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, HSTS 1 năm, `Cross-Origin-Opener-Policy`, `Permissions-Policy` (chỉ cho Web Serial và vị trí trên chính trang).
- CSP đầy đủ cho script/style/ảnh/kết nối đang ở chế độ **Report-Only**: trình duyệt chỉ cảnh báo trong console. Theo dõi 1–2 tuần (đăng nhập Google, bản đồ, font, 3D), không còn cảnh báo thì đổi tên header sang `Content-Security-Policy` để bắt buộc.
- Chống kết nối chậm (slowloris) ở nginx: timeout header 15 s, body 30 s.
- `APP_ENV=production` tắt `/docs`, `/redoc`, `/openapi.json`.
- SQL injection: đã rà, toàn bộ truy vấn dùng ORM/tham số; các f-string còn lại chỉ ghép tên bảng hằng trong migration/công cụ.

### IP thật của người dùng

| Triển khai | `CLIENT_IP_HEADER` |
|---|---|
| Caddy (`docker-compose.production.yml`) | để trống — Caddy ghi đè `X-Forwarded-For`, uvicorn lấy đúng IP |
| Cloudflare tunnel (`--tunnel`) | `CF-Connecting-IP` — bắt buộc, nếu không mọi người dùng chung một IP hoặc IP giả mạo được |

Chỉ đặt `CF-Connecting-IP` khi **mọi** request đi qua Cloudflare; nếu cổng gốc vẫn mở ra Internet, kẻ tấn công tự gửi header này để né giới hạn.

## 2. Cấu hình Cloudflare (người quản trị domain làm một lần)

DDoS tầng mạng/băng thông không chặn được trong code; phải chặn trước khi tới máy chủ.

1. **SSL/TLS** → Full (strict); Edge Certificates → bật Always Use HTTPS, HSTS (max-age 12 tháng, chưa bật preload).
2. **Security → WAF → Managed rules**: bật Cloudflare Managed Ruleset (gói Free có bộ cơ bản).
3. **Security → Bots**: bật Bot Fight Mode (chặn công cụ cào dữ liệu phổ biến).
4. **Security → WAF → Rate limiting rules** (gói Free được 1 quy tắc), ưu tiên:
   - URI path bằng `/api/auth/login` HOẶC `/api/auth/register`, cùng IP > 20 request / 10 giây → Block 10 giây.
5. **Security → Settings**: Security Level = Medium; khi đang bị tấn công bật **Under Attack Mode** tạm thời.
6. **Không để lộ IP gốc**: với tunnel, máy chủ không mở cổng 80/443 ra Internet; với Caddy, chỉ cho dải IP của Cloudflare vào cổng 443 (firewall).
7. Đặt `CLIENT_IP_HEADER=CF-Connecting-IP` trong `.env` của backend khi dùng tunnel rồi restart backend.

## 3. Chống sao chép dữ liệu — giới hạn thực tế

Người đã đăng nhập luôn sao chép được những gì họ được xem. Hệ thống hiện:
- yêu cầu đăng nhập + membership lớp cho mọi nội dung (đã có từ trước);
- không cache nội dung riêng tư (`Cache-Control: no-store`, đã có);
- không gửi đáp án Lab Test khi đang làm bài (đã có);
- chặn tốc độ đọc/tải hàng loạt và ghi log `content_scrape_suspected` để quản trị viên xem tài khoản nào đang cào.

Tra log: lọc `action=content_scrape_suspected` hoặc `action=rate_limited` trong log backend.

## 4. Kiểm chứng

- `app/tests/test_rate_limit.py`: cửa sổ/`Retry-After`, dọn bộ nhớ đúng cửa sổ từng khóa, đếm riêng từng user, token giả rơi về IP, log cào dữ liệu, header IP tin cậy.
- `app/tests/test_auth.py`: khóa cặp email+IP, không ảnh hưởng tài khoản khác, đăng nhập đúng xóa bộ đếm, email không tồn tại vẫn chạy bcrypt.
- Nginx: `nginx -t` hợp lệ; chạy thử container xác nhận header có ở trang chính, `/assets/`, route SPA.
- Chưa kiểm chứng: cấu hình Cloudflare (cần quyền domain), CSP chế độ bắt buộc.
