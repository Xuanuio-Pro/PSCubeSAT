# Chạy đăng ký / đăng nhập với PostgreSQL và Google

## PostgreSQL và cấu hình backend

Backend đã có đăng ký / đăng nhập bằng email và mật khẩu. Các API:

- `POST /api/auth/register`: `{ "email": "...", "password": "...", "full_name": "..." }`.
- `POST /api/auth/login`: `{ "email": "...", "password": "..." }`.
- `GET /api/auth/me`: header `Authorization: Bearer <access_token>`.
- `PATCH /api/auth/password`: mật khẩu hiện tại và mật khẩu mới.
- `POST /api/auth/logout`: lưu thu hồi token hiện tại vào PostgreSQL, cache thêm trên Redis nếu khả dụng.
- `GET /api/auth/google/config`: lấy Client ID công khai cho nút Google.
- `POST /api/auth/google`: `{ "credential": "<Google ID token>" }`.

Máy hiện tại đã được cấu hình PostgreSQL local trong `fastapi-backend/.env`, giữ JWT secret ngẫu nhiên và Google Client ID đã điền. Database đã tạo và kiểm tra thực tế; xem `Docs/LOCAL_DATABASE_SETUP.md` để biết cách chạy lại và vị trí lưu tài khoản. Trên máy khác, sao chép `fastapi-backend/.env.example` thành `fastapi-backend/.env`, rồi thay:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=CHUOI_NGAU_NHIEN_DU_DAI
GOOGLE_CLIENT_ID=
```

Backend luôn đọc `.env` trong thư mục `fastapi-backend`, dù được chạy từ thư mục khác. `.env` được Git bỏ qua. Mật khẩu database có ký tự đặc biệt cần URL-encode. Chưa có Google Client ID thì để trống; đăng nhập bằng email/mật khẩu vẫn hoạt động khi PostgreSQL đã được cấu hình.

Nếu có PostgreSQL sẵn, dùng URL của database đó. Để chạy một database local mới bằng Docker (cần Docker Desktop đang chạy):

```powershell
docker run --name cubesat-postgres -e POSTGRES_USER=cubesat -e POSTGRES_PASSWORD=YOUR_LOCAL_PASSWORD -e POSTGRES_DB=cubesat -p 127.0.0.1:5432:5432 -v cubesat_pgdata:/var/lib/postgresql/data -d postgres:16
```

Sau đó dùng `DATABASE_URL=postgresql://cubesat:YOUR_LOCAL_PASSWORD@localhost:5432/cubesat` và chạy `npm run db:migrate`. Alembic tạo/nâng cấp schema; startup backend chỉ kiểm tra revision đã ở head. Tài khoản database chạy migration cần quyền tạo bảng và extension `pgcrypto`. Không còn seed admin với mật khẩu cố định; admin local hiện tại được giữ nguyên. Xem `Docs/PLATFORM_STABILIZATION.md` để biết quy trình migration.

Từ thư mục dự án:

```powershell
C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe -m pip install -r fastapi-backend/requirements.txt
npm run dev
```

Frontend: `http://localhost:5175`. Backend: `http://localhost:8005/docs`. Khi chạy container backend, HOST database phải là địa chỉ truy cập được từ container, chẳng hạn `host.docker.internal` cho PostgreSQL trên máy Windows.

## Bật Google khi đã có Client ID

1. Trong Google Cloud, cấu hình màn hình đồng ý OAuth và tạo OAuth Client ID loại **Web application**.
2. Thêm **Authorized JavaScript origins**: `http://localhost:5175` và origin của website thật, ví dụ `https://cubesat.p-tech.xyz`. Nếu dùng frontend Docker local, thêm `http://localhost:5173`. Origin không có đường dẫn.
3. Điền `GOOGLE_CLIENT_ID=...apps.googleusercontent.com` vào `fastapi-backend/.env`.
4. Khởi động lại backend, tải lại frontend. Không cần Client Secret hoặc redirect URI cho luồng nút Google dùng popup này.

Hai trang đăng nhập và đăng ký dùng nút Google Identity Services. Backend dùng `google-auth` kiểm tra chữ ký, audience, issuer, hạn token và email đã xác minh trước khi phát JWT của ứng dụng. Lần đầu tạo user mới; những lần sau tra theo Google `sub`, không theo email có thể thay đổi.

Với tài khoản email/mật khẩu có sẵn, chỉ tự liên kết khi Google có thẩm quyền đối với email đó (`@gmail.com` hoặc tài khoản Workspace có `hd`). Email bên thứ ba đã có tài khoản phải đăng nhập bằng mật khẩu; chưa có luồng liên kết thủ công. Tài khoản chỉ dùng Google được lưu mật khẩu ngẫu nhiên không cung cấp cho người dùng; mục đổi mật khẩu hiện yêu cầu biết mật khẩu cũ.

Tài liệu xác thực chính thức: [Verify the Google ID token on your server side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Log Windows và MQTT

Lỗi `UnicodeEncodeError ... cp1252` đã được sửa bằng cấu hình stdout/stderr UTF-8 và log file UTF-8.

`WinError 10061` tại `localhost:1883` cho biết MQTT broker chưa nhận kết nối ở địa chỉ này. Khởi động broker hoặc điền đúng `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD` trong `.env`. Đây là dịch vụ telemetry riêng; đăng ký / đăng nhập cần PostgreSQL, không cần MQTT. Token bị thu hồi được lưu trong PostgreSQL nên logout vẫn có hiệu lực khi Redis không khả dụng.

## Kiểm thử

```powershell
cd fastapi-backend
C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe -m pip install -r requirements-dev.txt
C:/Users/Xuanuio/miniconda3/envs/stemcube/python.exe -m unittest app.tests.test_auth
cd ..
npm run build
```

Các bài kiểm thử API dùng database SQLite trong bộ nhớ, không ghi vào PostgreSQL thật. Xác thực Google được mô phỏng trong kiểm thử; kiểm tra đăng nhập với tài khoản Google thật cần Client ID hợp lệ và origin đã được cho phép.
