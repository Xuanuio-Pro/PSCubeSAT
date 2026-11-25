# Doc 1.2: Web IDE và nạp firmware qua Web Serial API

### 1. Soạn và biên dịch trên PTITCube Web IDE

PTITCube Web IDE cho phép viết mã, biên dịch và nạp chương trình cho ESP32 ngay trên trình duyệt, không cần cài Python, GCC, ESP-IDF hoặc trình điều khiển USB-UART.

![Quy trình biên dịch đám mây và nạp Web Serial](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab1_cloud_compile_flow.png)

- **Monaco Editor:** Tô màu cú pháp C++, gợi ý mã bằng IntelliSense, tự động thụt lề và phát hiện lỗi cú pháp.
- **Biên dịch:** Máy chủ tạo môi trường chứa `xtensa-esp32-elf-gcc`, biên dịch mã, liên kết thư viện PTITCube và tạo tệp nhị phân `firmware.bin` trong vòng dưới 5 giây.

### 2. Nạp firmware qua Web Serial API

Web Serial API là tiêu chuẩn web của W3C, cho phép trang HTTPS giao tiếp hai chiều với thiết bị nối qua USB.

1. Nhấn **Kết nối OBC**. Lệnh `navigator.serial.requestPort()` mở hộp thoại chọn cổng COM của chip USB-UART (CP2102 hoặc CH340).
2. Cổng nối tiếp dùng tốc độ 115200 bps và định dạng **SERIAL_8N1**: 8 bit dữ liệu, không bit chẵn lẻ, 1 bit dừng.
3. Mạch hai transistor NPN trên bo OBC dùng tín hiệu **DTR** và **RTS** để tự khởi động lại ESP32 và đưa chip vào chế độ nạp:
   - DTR ở mức HIGH, RTS ở mức LOW: kéo `EN` xuống 0 V để khởi động lại.
   - DTR ở mức LOW, RTS ở mức HIGH: kéo `GPIO0` xuống 0 V để vào chế độ nạp.
   - Nhả `EN` lên 3.3 V khi `GPIO0` vẫn ở mức 0 V để mở ROM Bootloader.
4. Dữ liệu trong `firmware.bin` được đóng khung theo SLIP rồi ghi vào bộ nhớ Flash SPI. Khi hoàn tất, ESP32 khởi động lại và chạy chương trình mới.
