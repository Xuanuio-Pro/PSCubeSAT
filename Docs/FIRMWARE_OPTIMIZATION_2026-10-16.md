# Rà soát và tối ưu firmware giáo trình — 16/10/2026

## Phạm vi

Lượt này rà soát firmware giáo trình, tập trung các sketch Lab4/Lab7 và lớp thư viện chung Sensor, Camera, Storage, Scheduler, CDH, GPS, EPS, COM. Không phải một đợt audit mới toàn bộ FE/BE. GPS và LoRa được loại khỏi tiêu chí kiểm thử phần cứng theo yêu cầu; firmware kiểm chứng tối ưu đặt `PTIT_ENABLE_GPS=0`, `PTIT_ENABLE_LORA=0`. Không yêu cầu GS gửi dữ liệu.

## Test lại trước tối ưu

Các bản nguồn đã sửa trong `app/firmware/curriculum` dùng compiler v5, OBC ESP32 COM8, Serial 115200:

| Bài | Kết quả thực tế |
|---|---|
| Lab4-04 | Gửi p 3 lần, lưu image_41.jpg / image_42.jpg / image_43.jpg; 12942 / 16600 / 18268 bytes. SD mount OK, không lỗi capture. |
| Lab7-01 | Trong 65 giây xác nhận 4 ảnh hoàn tất, 18887 / 16673 / 18227 / 52611 bytes. Lượt thứ 5 mới nhận SIZE khi hết cửa sổ quan sát, không tính thành công. Không panic. |
| Lab7-02 | 65 giây: 12 JSON telemetry parse được, 12 log SD write OK; 128 lỗi I2C. Không panic/reset ngoài reset đầu bài. |
| Lab7-03 | 65 giây: scheduler chạy, 10 chu kỳ telemetry, không panic/watchdog; còn log lỗi I2C. |

GPS No Fix không tính là lỗi trong nhà. Kết quả radio không được dùng để đánh giá pass/fail. Không có format hoặc xóa thẻ SD. Ảnh được kiểm số byte/marker JPEG và kết quả ghi, chưa tải về máy để kiểm tra hình ảnh bằng mắt.

## Những điểm đã sửa

1. **Sensor:** giới hạn tốc độ update 50 Hz, BMP 10 Hz; bỏ đọc lại thanh ghi range QMC mỗi sample vì range cố định 2G. MPU6500 dùng giao dịch ghi địa chỉ thanh ghi có STOP rồi đọc với kiểm ACK/count; vẫn trả NaN khi đọc thất bại. Có bộ đếm lỗi MPU/QMC báo theo chu kỳ, không tắt log lỗi toàn hệ thống.
2. **UART2:** đổi baud khi thực sự đổi kênh, không gọi Serial2.begin liên tục trong task GPS. Giữ một đối tượng UART chia sẻ.
3. **RTOS:** cờ pause dùng atomic; đọc snapshot sensor/ADC được khóa giữa telemetry và lệnh điều khiển; GPS/UART2 và camera được khóa; chụp ảnh khóa thêm SPI cùng storage. MQTT update/publish dùng cùng mutex.
4. **Telemetry:** dùng ArduinoJson thay ghép chuỗi số trực tiếp; dữ liệu không hữu hạn thành null, GPS chưa hợp lệ có valid=false thay vì mặc định tọa độ 0. Gộp 6 dòng SD thành một lần append mỗi chu kỳ, kiểm đủ số byte ghi và in trạng thái thật.
5. **Camera:** timeout tổng vẫn hữu hạn; chỉ feed watchdog khi task đã đăng ký, trong vòng nhận ảnh dài. Tránh watchdog reset vì ảnh lớn nhưng không bỏ giới hạn thời gian truyền.
6. **WiFi:** giới hạn thời gian kết nối/config portal để setup không chờ vô hạn trước khi tạo task.
7. **Lab4-04/Lab7-02:** tránh vòng lặp bận khi không có công việc; Lab4-04 cho gửi p để thử mount/chụp lại sau lỗi SD. Giữ ảnh cũ bằng cách chọn tên chưa tồn tại.
8. **Điều khiển test cục bộ:** Lab7-03 nhận `status`, `get_sensor`, `get_eps`, `capture`, `pause`, `resume` qua Serial, dùng chung cơ chế khóa với lệnh radio. Dòng lệnh bị giới hạn 128 ký tự.

## Kiểm chứng tối ưu

Bản RTOS tối ưu đầu tiên chạy 95 giây với GPS/LoRa tắt: 18 chu kỳ telemetry, 108 JSON hợp lệ, 18 lần ghi SD, 2 ảnh chụp trong lúc telemetry hoạt động; pause/resume phản hồi đúng. Không ghi nhận I2C error, Sensor failure counter, panic hoặc watchdog.

Bản cuối sau bổ sung khóa ADC chạy thêm 75 giây: 14 chu kỳ telemetry, 84 JSON hợp lệ, 14 lần ghi SD, 2 ảnh thành công; status/get_eps và pause/resume được gửi qua Serial. Không có I2C error, bộ đếm lỗi sensor, lỗi ghi SD, panic hoặc watchdog; đúng một boot chủ động đầu bài. Board hiện giữ bản cuối với GPS/LoRa tắt, COM8 đã đóng để người dùng mở lại. Artifact `9bb88741b47e4b80b1aa208a0c07b066` được flash 4 segment và xác minh hash.

Không khẳng định chênh lệch lỗi I2C chỉ do một thay đổi code: bản kiểm chứng cũng tắt radio/GPS theo yêu cầu nên tải phần cứng khác lượt trước. Cần test tải đầy đủ sau này nếu muốn chứng nhận cả cấu hình hệ thống.

Build sandbox ESP32-S3 cho Lab4-04 và RTOS đã PASS (không flash S3, không chứng nhận pin map S3). Bộ test compiler BE: 22 PASS, 2 integration opt-in SKIP; đã có build Docker thật riêng. Lượt này không đổi FE.

## Bản cài và bằng chứng

Compiler mặc định `pscubesat-compiler:1` đã nâng overlay v6, image `sha256:46ef9794c208af300417cf7069b5ca2eb3c727108831c9815b7e7c29bba9d119`. Dockerfile/prepare áp overlay tái lập từ repo; không sửa tự động code của người dùng. Chưa push lên GitHub.

Nguồn: `fastapi-backend/compiler/overrides/`, `fastapi-backend/app/firmware/curriculum/`.
Log trước tối ưu: `fastapi-backend/logs/retest-lab4-lab7/`.
Log tối ưu: `optimized-serial.log`, `optimized-result.json`; bản cuối: `optimized-final-{build,flash,serial}.log`, `optimized-final-result.json` trong thư mục logs.
Mã nguồn chính xác được nạp khi tắt GPS/LoRa: `fastapi-backend/logs/optimized-bench.cpp` (hai define đặt trước sketch).

## Giới hạn còn lại

- Điện áp ADC gần 0 V: chưa xác minh chân GPIO34, mạch chia áp, pin và hiệu chuẩn. Không sửa số liệu bằng giá trị giả.
- LoRa giữ nguyên theo yêu cầu không kiểm thử lại. Nhánh sendMessage có thể bỏ chunk khi AUX bận; không coi log gửi là ACK đầu nhận.
- MQTT end-to-end tới BE/GS và tải RF đồng thời chưa được chứng nhận trong bài bench này.
- API thư viện không tự thread-safe với mọi sketch; bản RTOS đã sửa phải được dùng để có cơ chế khóa tương ứng.
- Storage.readFile vẫn trả toàn bộ file vào String; với file log lớn cần API đọc theo chunk ở một đợt riêng. Firmware chưa có xoay vòng datalog theo dung lượng.
- Đây là smoke test tính năng/đồng thời, chưa phải soak test nhiều giờ hoặc thử rút SD/cảm biến giữa lúc ghi.

## Build lại 40 bài sau tối ưu

40/40 PASS trên profile ESP32, espressif32@6.10.0, thư viện pin commit và overlay v6. Dùng nguồn đã sửa nếu có, còn lại dùng src/main.cpp upstream đã snapshot. Đây là kiểm tra biên dịch, không phải chạy phần cứng toàn bộ 40 bài.

| Bài | Nguồn | Build |
|---|---|---|
| Lab1-01_Blink_LED | Upstream snapshot | PASS |
| Lab1-02_Serial_Communication | Upstream snapshot | PASS |
| Lab1-03_Serial_Control_LED | Upstream snapshot | PASS |
| Lab1-04_WiFi_Connection | Upstream snapshot | PASS |
| Lab1-05_WiFi_AP_Mode | Upstream snapshot | PASS |
| Lab1-06_Web_Server_LED | Upstream snapshot | PASS |
| Lab2-01a_Battery_GPIO | Upstream snapshot | PASS |
| Lab2-01b_Battery_Library | Upstream snapshot | PASS |
| Lab2-01_Detect_Battery_Voltage | Upstream snapshot | PASS |
| Lab2-02_Power_Saving | Upstream snapshot | PASS |
| Lab3-01a_MicroSD_SPI | Upstream snapshot | PASS |
| Lab3-01b_MicroSD_Library | Upstream snapshot | PASS |
| Lab3-01_Save_To_MicroSD | Upstream snapshot | PASS |
| Lab3-02_Linux_FS_Commands | Upstream snapshot | PASS |
| Lab4-01a_Environment_I2C | Upstream snapshot | PASS |
| Lab4-01b_Environment_Library | Bản sửa local | PASS |
| Lab4-01_Detect_Environment | Bản sửa local | PASS |
| Lab4-02a_IMU_I2C | Upstream snapshot | PASS |
| Lab4-02b_IMU_Library | Bản sửa local | PASS |
| Lab4-02_Detect_IMU_Attitude | Bản sửa local | PASS |
| Lab4-03a_GPS_UART | Upstream snapshot | PASS |
| Lab4-03b_GPS_Library | Upstream snapshot | PASS |
| Lab4-03_Detect_GPS_Rawdata | Upstream snapshot | PASS |
| Lab4-04a_Camera_UART | Upstream snapshot | PASS |
| Lab4-04b_Camera_Library | Upstream snapshot | PASS |
| Lab4-04_Camera_Snapshot | Bản sửa local | PASS |
| Lab4-05_Read_All_Sensors | Bản sửa local | PASS |
| Lab5-01a_Send_Telemetry_UART | Upstream snapshot | PASS |
| Lab5-01b_Send_Telemetry_Library | Upstream snapshot | PASS |
| Lab5-01_Send_Telemetry | Upstream snapshot | PASS |
| Lab5-02a_Receive_Command_UART | Upstream snapshot | PASS |
| Lab5-02b_Receive_Command_Library | Upstream snapshot | PASS |
| Lab5-02_Receive_Command | Upstream snapshot | PASS |
| Lab5-03_Satellite_Comm_System | Upstream snapshot | PASS |
| Lab6-01_Multitasking_Scheduler | Upstream snapshot | PASS |
| Lab6-02_Watchdog_And_Event | Upstream snapshot | PASS |
| Lab7-01_Camera_Multiplexer | Bản sửa local | PASS |
| Lab7-02_Full_Satellite_Program | Bản sửa local | PASS |
| Lab7-03_RTOS_Satellite_System | Bản sửa local | PASS |
| Lab8-01_Custom_Mission | Upstream snapshot | PASS |
