# Nạp USB qua địa chỉ LAN

Web Serial và Web Crypto cần secure context. HTTP localhost được trình duyệt coi là đáng tin cậy; HTTP IP LAN không có ngoại lệ này. Mở được trang qua LAN không có nghĩa là được dùng USB. USB thuộc máy chạy trình duyệt; nếu mở trang trên máy B, không thể chọn cổng USB đang cắm trên máy A chỉ bằng địa chỉ IP của A.

## HTTPS cho Vite

Đã hỗ trợ hai biến server-only `DEV_HTTPS_CERT` và `DEV_HTTPS_KEY`. Không đổi HTTP mặc định khi chưa cấu hình. `/api` và `/ws` vẫn qua proxy cùng origin; BE nội bộ không cần mở HTTPS riêng.

1. Cài [mkcert theo hướng dẫn chính thức](https://github.com/FiloSottile/mkcert), hoặc dùng chứng chỉ của CA nội bộ đã được máy truy cập tin cậy.
2. Ví dụ PowerShell tại thư mục dự án:

```powershell
mkcert -install
New-Item -ItemType Directory -Force .certs
mkcert -cert-file .certs/lan.pem -key-file .certs/lan-key.pem localhost 127.0.0.1 192.168.50.243 192.168.144.1
```

3. Thêm vào `.env.local` ở root, giữ các biến đang có:

```dotenv
DEV_HTTPS_CERT=.certs/lan.pem
DEV_HTTPS_KEY=.certs/lan-key.pem
```

4. Khởi động lại Vite; mở `https://192.168.50.243:5175/` hoặc IP thuộc mạng của máy truy cập. Chứng chỉ phải khớp IP và được máy đó tin cậy. Khi IP thay đổi cần cấp lại chứng chỉ.
5. Máy client khác cần tin cậy CA cấp chứng chỉ (chỉ phân phối chứng chỉ CA công khai, không phân phối private key). Dùng Chrome/Edge hỗ trợ Web Serial trên desktop và cấp quyền chọn port khi bấm nút. Board cắm vào máy client đó.

Không giải quyết bằng cách chỉ bấm bỏ qua cảnh báo chứng chỉ hoặc tắt kiểm tra bảo mật trình duyệt. `.certs/` và `.env.local` đã được gitignore. Chưa cài CA/chứng chỉ vào máy người dùng trong lượt sửa này.

Tham khảo: [MDN Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API), [Vite server.https](https://vite.dev/config/server-options#server-https).
