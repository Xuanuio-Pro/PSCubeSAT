# Hướng dẫn cấu hình SMTP (quên mật khẩu qua email)

Khi bật SMTP, người dùng bấm **Quên mật khẩu**, nhập email và nhận liên kết đặt lại mật khẩu qua thư. Admin không phải xử lý từng yêu cầu. Khi chưa cấu hình SMTP, yêu cầu được chuyển về trang `/admin/users` như trước.

## 1. Luồng hoạt động

1. Người dùng vào `/forgot-password`, nhập email.
2. Backend tạo token dùng một lần (lưu dạng hash, hết hạn sau `PASSWORD_RESET_TOKEN_TTL_MINUTES`, mặc định 30 phút) và gửi thư chứa liên kết `FRONTEND_URL/reset-password?token=...`.
3. Người dùng mở liên kết, đặt mật khẩu mới (tối thiểu 8 ký tự, 1 chữ in hoa, 1 ký tự đặc biệt).
4. Phản hồi của trang luôn giống nhau dù email có tồn tại hay không, để không lộ tài khoản nào có thật.
5. Nếu gửi thư lỗi, yêu cầu tự chuyển về hàng chờ admin (không bị mất).

## 2. Biến cấu hình

Đặt trong `fastapi-backend/.env` (file này nằm trong `.gitignore`, không đưa lên GitHub). File mẫu: `fastapi-backend/.env.example`.

| Biến | Ý nghĩa | Ví dụ |
|---|---|---|
| `SMTP_HOST` | Máy chủ SMTP. **Để trống = tắt tính năng**, quay về luồng admin | `smtp.gmail.com` |
| `SMTP_PORT` | Cổng | `587` (STARTTLS) hoặc `465` (SSL) |
| `SMTP_USER` | Tài khoản đăng nhập SMTP | `ten@gmail.com` |
| `SMTP_PASSWORD` | Mật khẩu SMTP (với Gmail là App Password) | `abcd efgh ijkl mnop` |
| `SMTP_FROM` | Địa chỉ hiển thị ở mục Người gửi. Trống thì dùng `SMTP_USER` | `ten@gmail.com` |
| `SMTP_USE_TLS` | Dùng STARTTLS (cổng 587) | `true` |
| `SMTP_USE_SSL` | Dùng SSL ngay từ đầu (cổng 465); khi bật thì bỏ qua STARTTLS | `false` |
| `FRONTEND_URL` | Địa chỉ giao diện dùng trong liên kết email | `http://localhost:5175` |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | Thời hạn liên kết, từ 5 đến 1440 phút | `30` |

Đặt `FRONTEND_URL` đúng địa chỉ người dùng truy cập (ví dụ `https://lms.example.com` khi triển khai thật). Nếu để trống, backend dùng origin đầu tiên trong `ALLOWED_ORIGINS`.

## 3. Cấu hình bằng Gmail

1. Đăng nhập tài khoản Google dùng làm hộp gửi thư.
2. Bật **Xác minh 2 bước** tại <https://myaccount.google.com/security>.
3. Vào <https://myaccount.google.com/apppasswords>, tạo **Mật khẩu ứng dụng** (App Password) 16 ký tự. Không dùng mật khẩu Gmail chính.
4. Điền vào `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ten@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
SMTP_FROM=ten@gmail.com
FRONTEND_URL=http://localhost:5175
```

Lưu ý: Gmail cá nhân giới hạn số thư gửi mỗi ngày. Với lớp học thật nên dùng SMTP của trường hoặc dịch vụ gửi thư riêng (cùng các biến trên, chỉ đổi host, cổng và tài khoản).

## 4. Áp dụng và kiểm tra

Backend chỉ đọc `.env` lúc khởi động và chế độ reload không theo dõi file này, nên **phải khởi động lại backend** sau khi sửa.

1. Dừng rồi chạy lại backend (`npm run dev` hoặc `npm run dev:be`).
2. Kiểm tra cờ đã bật:

```powershell
curl http://127.0.0.1:8005/api/auth/password-reset/config
```

Kết quả mong đợi: `{"smtp_enabled":true,"token_ttl_minutes":30}`.

3. Mở `/forgot-password`. Dòng mô tả phải là "nhận liên kết tự đặt lại mật khẩu qua email" (không còn "gửi tới quản trị viên").
4. Nhập email của một tài khoản có thật, kiểm tra hộp thư (cả thư rác), mở liên kết và đặt mật khẩu mới.
5. Mở lại cùng liên kết lần hai: phải bị từ chối (liên kết chỉ dùng một lần).

## 5. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Trang vẫn hiện "gửi tới quản trị viên" | Chưa khởi động lại backend, hoặc `SMTP_HOST` trống | Khởi động lại, kiểm tra lệnh `curl` ở mục 4 |
| Không có thư, log có `SMTP delivery failed` | Sai tài khoản hoặc App Password, cổng/TLS không khớp, bị chặn mạng | Kiểm tra lại biến; cổng 587 đi với `SMTP_USE_TLS=true`, cổng 465 đi với `SMTP_USE_SSL=true` |
| Gmail báo "Username and Password not accepted" | Dùng mật khẩu Gmail chính hoặc chưa bật xác minh 2 bước | Tạo App Password |
| Thư vào thư rác | Gửi từ Gmail cá nhân | Nhắc người dùng kiểm tra spam; lâu dài dùng SMTP của trường |
| Liên kết trong thư trỏ sai địa chỉ | `FRONTEND_URL` sai | Sửa rồi khởi động lại backend |
| Yêu cầu nằm trong hàng chờ admin dù đã bật SMTP | Lần gửi thư đó lỗi nên tự chuyển dự phòng | Admin cấp liên kết hoặc mật khẩu tạm tại `/admin/users`, đồng thời sửa lỗi SMTP |

Log backend ghi `[PasswordReset] Sent reset email for ...` khi gửi thành công (email được che bớt) và `SMTP delivery failed ... falling back to admin queue` khi lỗi.

## 6. Bảo mật

- Không đưa `SMTP_PASSWORD` vào Git, ảnh chụp màn hình hay tin nhắn. Nếu lỡ lộ, thu hồi App Password cũ ở trang Google rồi tạo cái mới.
- Token đặt lại chỉ lưu dạng hash trong cơ sở dữ liệu, dùng một lần và tự hết hạn.
- Endpoint quên mật khẩu có giới hạn tần suất theo IP.
- Tài khoản quản trị (`admin`) không đặt lại bằng luồng này khi SMTP tắt; khi SMTP bật, liên kết chỉ gửi tới email của chính tài khoản đó.
- Trang `/admin/users` vẫn dùng được để cấp liên kết hoặc mật khẩu tạm cho trường hợp ngoại lệ (người dùng không còn truy cập email).
