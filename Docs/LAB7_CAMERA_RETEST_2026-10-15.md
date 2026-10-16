# Lab7 camera UART và truy cập LAN — 15/10/2026

## Kết quả chẩn đoán

Đọc COM8 xác nhận chương trình đang chạy là Lab7-01 Camera Multiplexer. Có phản hồi `ERROR:CAPTURE` từ slave sau lệnh CAPTURE; không phải trường hợp mất hoàn toàn giao tiếp UART. Sau reset OBC, SD báo ready nhưng lỗi chụp vẫn xuất hiện. GPS No Fix không đồng nghĩa GPS bị hỏng.

Đối chiếu CAM_Firmware commit `79e76f9a08febafbfacae5d3868ea3f3a2da5499`: setup có thể khởi tạo camera thất bại rồi return, nhưng loop vẫn gọi `esp_camera_fb_get()`. Khi không lấy được frame, chỉ báo ERROR:CAPTURE. Chưa có log khởi động trực tiếp của camera nên chưa xác định được nguyên nhân cuối cùng (init, PSRAM, cáp cảm biến, nguồn hoặc lỗi lấy frame).

Camera hiện chỉ nối UART với OBC. Firmware gốc không có lệnh reset/OTA/flash qua giao thức CAPTURE. Reset OBC không đảm bảo reset ESP32-CAM. Bản sửa camera slave đã build nhưng **chưa nạp vào camera**; không nạp nhầm firmware camera lên COM8 của OBC.

## Thay đổi đã thực hiện

- FE phân biệt HTTP LAN không an toàn với trình duyệt thiếu Web Serial, báo hướng xử lý cụ thể khi kết nối/nạp.
- Vite nhận DEV_HTTPS_CERT và DEV_HTTPS_KEY; cấu hình/cách tin cậy chứng chỉ trong [LAN_HTTPS_SERIAL.md](LAN_HTTPS_SERIAL.md). Chưa cài CA/chứng chỉ hoặc bật HTTPS trên máy; HTTP mặc định vẫn giữ nguyên.
- Overlay Camera kiểm tra SIZE hợp lệ 4–524288 bytes; không đọc vượt phần payload còn lại; giới hạn tổng thời gian và thời gian im lặng; kiểm tra byte ghi SD và marker JPEG; dùng file .part và chỉ báo thành công khi hoàn tất. Đây là kiểm tra khung JPEG, không phải giải mã ảnh đầy đủ hay checksum giao thức.
- GPS và Camera dùng chung đối tượng Serial2, tránh hai HardwareSerial tranh cùng UART2. Các caller đa nhiệm vẫn phải khóa UART2.
- Ví dụ Lab7-01 báo kết quả capture thật, không suy ra camera hoạt động chỉ từ SD ready.
- Camera slave riêng pin framework espressif32@6.10.0, dùng driver đi kèm Arduino, kiểm tra init trước capture; thêm STATUS và QVGA/DRAM khi không có PSRAM. Mã nguồn ở `fastapi-backend/app/firmware/camera-slave`.

Compiler mặc định đã cập nhật patch v5; image `sha256:5e1ec3b03d5a8afb81059dd8adb0b2b1dbb2c246452e6b8e876abe0119f0e5ae`. Build cấu hình đổi fingerprint để không nhận output từ image cũ. Không push thay đổi lên GitHub.

## Kiểm tra

- Lab7-01/02/03 bản sửa: build sandbox ESP32 đều PASS.
- Firmware camera slave: build profile esp32cam PASS, chưa kiểm chứng camera thật.
- FE lint/typecheck PASS; 6 test flash PASS.
- BE compiler: 22 test PASS, 2 integration opt-in SKIP; đã có build sandbox thật ở trên.
- Đã nạp bản Lab7-01 mới vào OBC COM8, đủ 4 segment và hash được esptool xác minh. Log ở `fastapi-backend/logs/lab7-v5-flash.log`; log reset trước sửa ở `lab7-obc-reset-before-fix.log`, sau sửa ở `lab7-v5-serial.log`.
- Sau nạp/reset: theo dõi 55 giây, 1 boot chủ động, không Guru Meditation, 5 lần CAPTURE đều trả ERROR:CAPTURE, 0 ảnh thành công. SD ready, GPS No Fix. Cổng COM8 đã đóng sau kiểm tra để người dùng kết nối lại. OBC giữ firmware Lab7-01 v5.

## Phần cần tiếp tục trên phần cứng

Khởi động lại nguồn camera hoặc reset chính ESP32-CAM, kiểm tra nguồn và cáp sensor, rồi đọc mã CAMERA_INIT tại thời điểm camera boot. Nếu vẫn lỗi, cần đường nạp/đọc log camera để áp bản slave đã chuẩn bị. Không thể xác nhận ảnh chụp thành công chỉ từ SD ready hoặc từ việc build firmware thành công.

Lab7-03 vẫn còn các rủi ro đã nêu trong báo cáo curriculum: snapshot/cờ trạng thái giữa task, SPI camera/storage, MQTT đồng thời và JSON NaN. Lượt này tập trung bài Lab7-01 đang chạy trên board; không chứng nhận toàn bộ hệ thống RTOS.
