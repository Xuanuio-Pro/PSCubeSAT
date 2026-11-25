# Doc 1.7: Wi-Fi, máy chủ HTTP và SoftAP

### 1. Wi-Fi trên ESP32

Wi-Fi trên ESP32 hỗ trợ chuẩn 802.11 b/g/n ở băng tần 2.4 GHz. Có thể dùng theo hai chế độ:

- **STA:** ESP32 kết nối mạng Wi-Fi có sẵn và nhận địa chỉ IP từ máy chủ DHCP.
- **SoftAP:** ESP32 tạo mạng Wi-Fi riêng, cho phép thiết bị kết nối trực tiếp mà không cần mạng ngoài. Địa chỉ mặc định là `192.168.4.1`.

![Kiến trúc SoftAP và máy chủ HTTP trên ESP32](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_softap_webserver.png)

### 2. Máy chủ HTTP nhúng

OBC dùng thư viện `WebServer.h` trên cổng 80:

- Dùng `server.on("/endpoint", HTTP_METHOD, handler_function)` để gán hàm xử lý cho từng địa chỉ và phương thức HTTP.
- Gọi `server.handleClient()` liên tục trong `loop()` để xử lý yêu cầu từ trình duyệt mà không chặn các tác vụ khác.
