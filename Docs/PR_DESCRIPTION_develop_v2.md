# feat: mật khẩu mạnh, xác minh email khi đăng ký, quên mật khẩu qua email, xóa tài khoản

Nhánh nguồn: `sswizzz/PSCubeSAT:develop_v2` → đích: `Xuanuio-Pro/PSCubeSAT:develop`
Gồm 3 commit trên `develop` hiện tại (36 file, +1162/-114). Không có commit nào của nhánh khác.

## Tóm tắt

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Chính sách mật khẩu mạnh khi đặt mật khẩu mới | Backend + 4 form |
| 2 | Quên mật khẩu tự phục vụ qua email (bật bằng cấu hình SMTP) | Cấu hình, giao diện, tài liệu |
| 3 | Xác minh email khi đăng ký | Migration `0020`, backend, 3 trang |
| 4 | Admin xóa tài khoản (xóa mềm) | Backend + `/admin/users` |
| 5 | Hộp xác nhận chính giữa màn hình ở `/admin/users` | Giao diện |

## 1. Mật khẩu mạnh
- Mật khẩu mới: tối thiểu 8 ký tự, ít nhất 1 chữ in hoa, ít nhất 1 ký tự đặc biệt (không phải chữ, số, khoảng trắng); giữ giới hạn 72 byte UTF-8.
- Áp dụng ở server (`validate_new_password` trong `app/schemas/auth.py`) cho đăng ký, đăng ký admin đầu tiên, đổi mật khẩu và đặt lại mật khẩu.
- **Đăng nhập không đổi**: tài khoản cũ mật khẩu yếu vẫn đăng nhập được, chỉ phải theo quy tắc mới khi đổi hoặc đặt lại.
- Frontend: `src/utils/passwordPolicy.js` và `PasswordRequirements` hiển thị checklist yêu cầu, tích ✓ theo thời gian thực ở Đăng ký, Đăng ký admin, Hồ sơ, Đặt lại mật khẩu.

## 2. Quên mật khẩu qua email
- Luồng email đã có sẵn trong code; PR chỉ làm cho nó dễ bật và rõ ràng hơn. Khi `SMTP_HOST` trống vẫn dồn về hàng chờ admin như cũ.
- `fastapi-backend/.env.example`: thêm khối `SMTP_*`, `FRONTEND_URL`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`, `EMAIL_VERIFICATION_TTL_HOURS`.
- Gửi mail lỗi vẫn rơi về hàng chờ admin; thông báo chung nay nói rõ khả năng đó và vẫn giống hệt với email không tồn tại (không lộ tài khoản).
- Trang Quên mật khẩu nhắc kiểm tra thư rác và thời hạn liên kết.
- Tài liệu: `Docs/SMTP_GUIDE.md` (cấu hình Gmail App Password, kiểm tra, xử lý sự cố, bảo mật).

## 3. Xác minh email khi đăng ký
- **Chỉ khi SMTP đã cấu hình.** Không có SMTP: đăng ký như cũ (đánh dấu đã xác minh, cấp token ngay).
- Có SMTP: tạo tài khoản chưa xác minh, gửi liên kết dùng một lần (hash trong `email_verification_tokens`, hết hạn sau `EMAIL_VERIFICATION_TTL_HOURS`, mặc định 24 giờ), **không cấp token**.
- Đăng nhập email/mật khẩu bị chặn bằng `EMAIL_NOT_VERIFIED` (403) đến khi xác minh; chỉ báo sau khi mật khẩu đúng nên không lộ tài khoản. Kiểm tra từ DB mỗi lần đăng nhập.
- Endpoint mới: `POST /api/auth/verify-email`, `POST /api/auth/resend-verification` (phản hồi luôn giống nhau, mỗi lần gửi thu hồi liên kết cũ, có giới hạn tần suất theo IP). `POST /api/auth/register` trả `RegisterResponse` (thêm `verification_required`, `email_sent`, `message`; vẫn có `access_token`/`user` khi không cần xác minh).
- Đăng nhập Google, admin đầu tiên và hoàn tất đặt lại mật khẩu qua email đều đánh dấu đã xác minh.
- Frontend: màn "Kiểm tra email của bạn" sau đăng ký (nút Gửi lại có đếm ngược 60 giây), trang `/verify-email`, nút "Gửi lại email xác minh" ở trang đăng nhập khi gặp `EMAIL_NOT_VERIFIED`.
- Gửi thư lỗi lúc đăng ký: tài khoản vẫn được tạo, người dùng bấm Gửi lại.

### Migration `0020_email_verification` (nối sau `0019_merge_reset_and_quiz`)
- Thêm `users.email_verified_at` và bảng `email_verification_tokens`.
- **Backfill**: mọi tài khoản hiện có được đặt `email_verified_at = created_at`, nên không ai bị khóa.
- Downgrade xóa cột và bảng (chỉ mất trạng thái xác minh mới; upgrade lại backfill tất cả là đã xác minh). Đã chạy `upgrade head` → `downgrade -1` → `upgrade head` trên DB dev.

## 4. Admin xóa tài khoản
- `DELETE /api/admin/users/{id}` (chỉ admin): **xóa mềm** (`deleted_at`, trạng thái khóa), giữ dữ liệu học tập, bài làm, audit và lịch sử lớp; không phá khóa ngoại RESTRICT.
- Hiệu lực: phiên đăng nhập hiện có mất ngay, bị gỡ khỏi mọi lớp (membership → `removed`), thu hồi yêu cầu đặt lại mật khẩu đang mở, ghi `audit_logs` (`user.delete`, không lưu email).
- Chặn: xóa chính mình, xóa tài khoản admin (403 `FORBIDDEN_ROLE`); giảng viên còn lớp chưa lưu trữ (409, trả danh sách mã lớp).
- Hạn chế đã biết: email của tài khoản đã xóa vẫn bị giữ (chỉ mục duy nhất) nên chưa đăng ký lại được.

## 5. Giao diện `/admin/users`
- Hộp xác nhận (Xóa, Khóa, Cấp quyền, Cấp link đặt lại, Cấp mật khẩu tạm) dùng lại `ConfirmDialog` chính giữa màn hình, thay cho khung chèn trên bảng.
- Hộp hiển thị link đặt lại / mật khẩu tạm một lần cũng ở giữa màn hình, có nút Sao chép; `locked` nên Esc và bấm nền không đóng (tránh mất mật khẩu chỉ hiện một lần).
- `ConfirmDialog` thêm các prop `children`, `wide`, `locked`; các nơi dùng khác không đổi hành vi. Xóa CSS không còn dùng (`.admin-confirm`, `.admin-temp-password*`).

## Mã lỗi mới (ngoài danh sách chung trong AGENTS.md)
`EMAIL_NOT_VERIFIED` (403), ghi trong `Docs/DECISIONS.md`.

## Cách bật / kiểm thử thủ công
1. Điền `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `FRONTEND_URL` vào `fastapi-backend/.env`, **khởi động lại backend** (chỉ đọc `.env` lúc khởi động), rồi `alembic upgrade head`.
2. `/signup` với email thật → nhận thư → đăng nhập trước khi bấm bị chặn → bấm liên kết → đăng nhập được; mở lại liên kết lần hai bị từ chối.
3. `/forgot-password` → nhận thư đặt lại → đặt mật khẩu mạnh.
4. `/admin/users` (tài khoản admin): thử Xóa, Khóa, Cấp link đặt lại, Cấp mật khẩu tạm.
5. Để trống `SMTP_HOST` và khởi động lại: đăng ký vào thẳng như cũ.

## Kiểm thử đã chạy
- `npm run lint`, `npm run typecheck`, `npm run build`: qua.
- `npm run check` đầy đủ (gồm toàn bộ pytest) đã qua sau thay đổi mật khẩu mạnh.
- Sau khi thêm xác minh email: toàn bộ pytest chạy được 214 qua, 18 bỏ qua, 1 fail do hai route công khai mới chưa nằm trong danh sách route công khai của test; đã sửa và test đó qua.
- Sau khi thêm xóa tài khoản: chỉ chạy lại `test_classes.py` (các test xóa và test khóa người dùng) và lint/typecheck/build; **chưa chạy lại toàn bộ pytest**.
- Test mới: 10 test xác minh email và 2 test xóa tài khoản; test mật khẩu mạnh.
- `app/tests/conftest.py` ép `smtp_host` rỗng cho mọi test, để `.env` cục bộ không đổi luồng hay gửi thư thật.

## Chưa kiểm chứng
- Chưa gửi thư xác minh/đặt lại thật qua SMTP.
- Chưa xem hai hộp thoại mới trên giao diện thật (cần đăng nhập admin).
- Chưa chạy `alembic upgrade head` trên DB sạch hoàn toàn (chỉ trên DB dev đã có dữ liệu).

## Rủi ro / lưu ý khi merge
- Bật SMTP rồi triển khai: người dùng mới phải xác minh; Gmail cá nhân có hạn mức thư/ngày, nên dùng SMTP của trường cho lớp thật.
- Quy tắc chặn xác minh chỉ áp dụng khi SMTP bật; tắt SMTP sẽ không khóa người đang chờ xác minh.
- `FRONTEND_URL` sai sẽ làm liên kết trong thư trỏ sai địa chỉ.
- Merge đủ 3 commit để migration `0020` và code đi cùng nhau.
