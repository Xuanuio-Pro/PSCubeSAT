# Tài khoản và đăng nhập Google

## Lưu tài khoản

Máy này dùng PostgreSQL local đã cấu hình trong `fastapi-backend/.env`. Xem [cách chạy và sao lưu database](LOCAL_DATABASE_SETUP.md). Trên máy khác cần cài dependencies, cấu hình `DATABASE_URL`, `JWT_SECRET` ngẫu nhiên và chạy `npm run db:migrate`; `.env` không đưa vào Git. Backend đọc `.env` cố định trong `fastapi-backend` và kiểm tra migration trước khi nhận API. FE ở cổng 5175, BE ở 8005. Redis/MQTT không bắt buộc để đăng ký/đăng nhập; logout vẫn lưu thu hồi token trong PostgreSQL khi Redis tắt.

`POST /api/auth/register` thực sự ghi vào PostgreSQL, commit trước khi trả JWT. Bảng `users` lưu ID, email chuẩn hóa chữ thường, họ tên, role `user`, thời gian tạo và bcrypt hash trong `password_hash`. Không lưu mật khẩu gốc, không trả hash ra API. Login chỉ đọc tài khoản còn hoạt động và kiểm tra bcrypt.

Migration `0004_auth_email` chuẩn hóa email cũ và thêm unique index `lower(email)`, tránh trùng cả khi đăng ký đồng thời. Migration dừng nếu phát hiện các tài khoản cũ trùng email sau chuẩn hóa, để người quản trị xác minh chủ sở hữu trước khi xử lý; không tự gộp hay xóa tài khoản.

Google tạo/liên kết tài khoản trong `users` và lưu Google `sub` trong `google_identities`. Backend kiểm tra chữ ký, audience bằng Client ID của máy chủ, expiry, issuer và email đã xác minh. Không dùng email hay token do frontend tự giải mã làm bằng chứng xác thực. Tự liên kết tài khoản theo email chỉ áp dụng Gmail hoặc Google Workspace có `hd`; email ngoài Google đã tồn tại phải đăng nhập mật khẩu. Lần đăng nhập tiếp theo tra `sub` ổn định. Google user được tạo với hash của mật khẩu ngẫu nhiên không cung cấp cho người dùng; họ đăng nhập bằng Google.

Ô **Lưu thiết bị này** chọn `localStorage`; không chọn dùng `sessionStorage` (vẫn giữ khi tải lại tab, hết khi phiên trình duyệt kết thúc). JWT vẫn hết hạn theo `JWT_EXPIRE_MINUTES`; đây không phải cơ chế kéo dài token. Khi đăng xuất, token được thu hồi trong PostgreSQL và xóa cả hai vùng lưu. Compiler, flasher và WebSocket dùng cùng bộ đọc token.

## Cấu hình Google Cloud

1. Mở [Google Auth Platform](https://console.cloud.google.com/auth/overview), chọn hoặc tạo project. Khai báo Branding và Audience. Nếu ứng dụng đang ở Testing, thêm tài khoản sẽ dùng thử vào danh sách Test users khi giao diện Google yêu cầu.
2. Vào **Clients → Create client → Web application**. Trong **Authorized JavaScript origins**, thêm origin đúng cổng đang mở, ví dụ `http://localhost:5175` và `http://localhost:5173`. Không thêm `/login` hay `/api/auth/google` vào origin. Khi triển khai, thêm origin HTTPS của website thực tế. Chỉ dùng các phạm vi đăng nhập email/profile/openid, không cần quyền Gmail/Drive.
3. Điền Client ID dạng `123...-abc....apps.googleusercontent.com` vào `fastapi-backend/.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=CLIENT_ID_WEB_CUA_BAN.apps.googleusercontent.com
   ALLOWED_ORIGINS=http://localhost:5175,http://localhost:5173,http://localhost:4173
   ```

   Luồng hiện tại dùng GIS popup và JavaScript callback gửi ID token bằng JSON tới backend. Không cần Client Secret và không cần cấu hình redirect URI cho callback này. Client ID được frontend lấy từ `/api/auth/google/config`, không phải sửa mã JSX.
4. Khởi động lại FastAPI để đọc `.env` mới (chỉ lưu file `.env` không bảo đảm server reload). Chạy `npm run dev:be` trong terminal; dừng phiên server cũ trước khi khởi động nếu cổng 8005 đang được sử dụng. Chạy frontend `npm run dev:fe -- --port 5175`, vào `/login` hoặc `/signup` rồi bấm nút Google.
5. Chọn tài khoản và đồng ý với Google. Frontend gửi `{ "credential": "<ID token>" }` tới `POST /api/auth/google`. Thành công trả JWT nội bộ và user, chuyển về trang chủ; không trả Google token cho các API khác.

Tham khảo chính thức: [thiết lập Client ID và origins](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [xác minh ID token trên server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Kiểm tra lỗi Google

- **Chưa được bật**: `GOOGLE_CLIENT_ID` trống; cấu hình rồi restart backend.
- **Origin is not allowed**: URL, giao thức hoặc port đang mở chưa khớp Authorized JavaScript origins của đúng Web Client ID.
- **Access blocked/Testing**: kiểm tra Audience, Test users và chính sách tổ chức của tài khoản Google.
- API **401**: token không hợp lệ/hết hạn/sai audience, email chưa xác minh, tài khoản bị xóa hoặc không thể tự liên kết email ngoài Google.
- API **503**: chưa có Client ID hoặc không tải được khóa xác minh Google; kiểm tra cấu hình và mạng của backend.

## Kiểm chứng ngày 19/10/2026

Đã chạy auth HTTP handlers với DB PostgreSQL đang cấu hình, đọc user từ kết nối DB mới và xác minh email chuẩn hóa, tên tiếng Việt, role, bcrypt hash; thử đăng ký trùng, sai mật khẩu, login, `/me`, logout và dùng lại token bị thu hồi. PASS. Tài khoản thử có email UUID riêng và đã được xóa; số tài khoản đang có vẫn là 3. DB được nâng lên `0004_auth_email`.

Test tự động bao gồm SQLite API, xác minh Google token (mock chữ ký/claims), liên kết Google theo `sub`, phục hồi tài khoản cũ, migration DB mới/cũ trên PostgreSQL thật, đăng ký đồng thời và bộ lưu phiên frontend. Không coi test mock Google là bằng chứng đã chọn tài khoản thật trong popup.

Lệnh tái lập:

```powershell
npm run db:migrate
npm run test:auth
& C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe scripts/check-auth-db.py
# Nếu FE :5175 và BE :8005 đang chạy, thử xuyên proxy qua HTTP thật
& C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe scripts/check-auth-db.py --live
# PostgreSQL integration: tạo và dọn các database test riêng, không reset DB cubesat
$env:PSCUBESAT_TEST_POSTGRES='1'
Set-Location fastapi-backend
& C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe -m unittest app.tests.test_migrations
```

Đã mở `http://localhost:5175/login` trên trình duyệt: nút Google hiển thị, nhưng Google trả lỗi console **`[GSI_LOGGER]: The given origin is not allowed for the given client ID.`** Vì vậy cần mở đúng Web Client có Client ID đang nằm trong `.env` và bổ sung `http://localhost:5175` vào Authorized JavaScript origins, lưu lại rồi tải lại trang. Không cần đổi code hoặc tạo client khác nếu đang sở hữu client này. Chưa xác minh đăng nhập Google thật vì cấu hình origin hiện bị Google từ chối.
