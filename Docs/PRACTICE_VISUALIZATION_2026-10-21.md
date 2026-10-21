# Hiển thị dữ liệu thực hành Lab1–Lab8 — 21/10/2026

Cập nhật hiện hành: [Đăng nhập bắt buộc và giữ đủ khối trực quan](AUTH_LAB_VISUALIZATION_2026-10-21.md). Khối gốc của từng Lab được giữ và bổ sung panel riêng theo bài; mọi dịch vụ yêu cầu đăng nhập. Xem thêm [báo cáo kiểm tra chức năng](PTITCUBE_LAB_FUNCTIONAL_AUDIT_2026-10-21.md). Mô tả/ma trận bên dưới ghi lại lượt sửa hiển thị ban đầu, trước các cập nhật này.

## Kết quả

Đã sửa luồng USB Serial → giải mã → dữ liệu/sự kiện → panel của từng bài. Giao diện thực hành dùng chung một bộ chọn panel theo mã bài, thay vì mỗi Lab có một bảng cố định. Serial Monitor có ở mọi bài. Code C++ và Blockly vẫn lưu theo khóa riêng của từng bài; thay đổi bảng hiển thị không ghi đè mã đang lưu.

Lab6-01 có bộ đếm Sensor/Network, thời điểm quan sát, thời gian giữa cặp log bắt đầu/kết thúc, dòng thời gian có zoom và danh sách sự kiện. Nhiệt độ 28,5°C và mạng trong mẫu này là minh họa; không đưa vào các kênh đo phần cứng. LED không có log nên giữ trạng thái chưa xác nhận.

## Quy tắc dữ liệu

- Chỉ `rx` có `origin=serial` mới được giải mã. Log compiler/app, lệnh TX và log phát LoRa không trở thành telemetry cảm biến.
- JSON chuẩn vẫn tuân thủ hợp đồng FE/BE hiện hành. Bổ sung bộ giải mã cục bộ cho log chữ và các snapshot của giáo trình; không thay schema API, DB hay MQTT.
- Log chữ có nhãn và đơn vị: nhiệt độ °C, áp suất hPa, điện áp V; gia tốc m/s² chuyển sang g bằng 9,80665; gyro rad/s chuyển sang °/s; Gauss chuyển sang µT bằng hệ số 100. Không tự hiệu chỉnh số đo sai dựa vào độ lớn.
- `RAW_ACCEL` được vẽ dưới dạng số đếm thanh ghi có dấu 16 bit; chưa đổi ra g và không dựng tư thế khi chưa biết cấu hình thang đo.
- Lab7-02: đọc `eps.batt_v`, `env.temp/press`, `imu.a*_ms2/g*_rads`, `gps.lat/lng/alt`.
- Lab7-03: chỉ bóc các tiền tố `[TELEMETRY] EPS/Env/Acc/Gyro/Mag/GPS:`. Sáu snapshot riêng không làm mất giá trị của nhau. Đổi đúng đơn vị Sensor library.
- NMEA GGA/RMC: kiểm checksum, trạng thái fix, cấu trúc, phút <60 và phạm vi tọa độ. `No Fix` hoặc `valid:false` xóa vị trí ngay; không ghép vĩ độ/kinh độ thuộc hai mẫu khác nhau.
- Trường quá 5 giây không được cập nhật hiện `—`, kể cả khi kênh khác vẫn có dữ liệu. JSON null và log cảm biến unavailable/NaN được nhận diện sẽ hủy giá trị cũ. Biểu đồ vẫn giữ lịch sử, có chú thích khi mất mẫu mới.
- Gyro tích phân theo thời gian giữa hai mẫu gyro, không theo gói nhiệt độ xen giữa. Mô hình 3D chỉ là tư thế ước tính từ gia tốc và gyro, yaw tương đối, không phải nghiệm định hướng đã hợp nhất/hiệu chuẩn.
- Ở chế độ USB, đổi bài hoặc phiên kết nối xóa snapshot/sự kiện cũ; đổi nguồn hoặc thiết bị cũng xóa dữ liệu của luồng trước. Mã nguồn/workspace được giữ lại. Callback phiên cũ bị loại; thiết bị có UID được giữ ràng buộc.
- Sự kiện giữ tối đa 120; lịch sử telemetry giữ tối đa 200. Các thư viện biểu đồ/3D/bản đồ/dashboard được tải khi bài cần đến chúng.

## Lệnh và bằng chứng phản hồi

Không tự gửi `get_sensor/get_gps/get_eps/...` cho firmware không hỗ trợ. Bảng phân hệ đối chiếu thụ động từng trường/phản hồi, không biến một dòng Serial bất kỳ thành trạng thái OK của toàn bộ hệ thống.

Lệnh nhanh theo mẫu: Lab1-03 `1/0`; Lab3-02 `pwd/ls`; Lab4-04b `p`; Lab7-03 nhóm lệnh chẩn đoán thực sự có trong bản firmware đã sửa. Lab5 dùng đường lệnh LoRa, không giả định USB OBC là cổng uplink. Lệnh tùy chỉnh vẫn dùng Serial Monitor. Giao diện phân biệt ghi USB thành công với phản hồi thực thi; lỗi ghi không được ghi nhận là thành công.

Camera phân biệt yêu cầu chụp, lỗi chụp và lưu file thành công. File trên SD không tự xuất hiện thành ảnh trong trình duyệt; cần firmware gửi `IMG:<JPEG base64>`, data URI PNG/JPEG, hoặc `imageData` trong JSON. Widget ảnh của dashboard dùng CameraViewer thật, thay placeholder.

## Ma trận 32 bài

Mỗi dòng có fixture đầu ra tương ứng trong `tests/fixtures/practice-serial.json`. Đây là kiểm thử giải mã/hiển thị, không phải chứng nhận kiểm thử lại phần cứng cả 32 bài.

| Bài | Panel ngoài Serial / bảng sự kiện | Trường nhận diện trong fixture | Lệnh nhanh USB |
|---|---|---|---|
| Lab1-01_Blink_LED | Sự kiện / log gốc | Không tự tạo số đo | — |
| Lab1-02_Serial_Communication | Sự kiện / log gốc | Sự kiện serial | — |
| Lab1-03_Serial_Control_LED | Sự kiện / log gốc | ledOn | 1, 0 |
| Lab1-04_WiFi_Connection | Sự kiện / log gốc | Sự kiện network | — |
| Lab1-05_WiFi_AP_Mode | Sự kiện / log gốc | Sự kiện network | — |
| Lab1-06_Web_Server_LED | Sự kiện / log gốc | Sự kiện network | — |
| Lab2-01a_Battery_GPIO | Điện áp | voltageV | — |
| Lab2-01b_Battery_Library | Điện áp | voltageV, uptimeMs | — |
| Lab2-02_Power_Saving | Điện áp | voltageV | — |
| Lab3-01a_MicroSD_SPI | Sự kiện / log gốc | Sự kiện storage | — |
| Lab3-01b_MicroSD_Library | Sự kiện / log gốc | Sự kiện storage | — |
| Lab3-02_Linux_FS_Commands | Sự kiện / log gốc | Sự kiện storage | pwd, ls |
| Lab4-01a_Environment_I2C | Môi trường | temperatureC, pressureHpa | — |
| Lab4-01b_Environment_Library | Môi trường | temperatureC, pressureHpa | — |
| Lab4-02a_IMU_I2C | Thanh ghi IMU | Sự kiện raw-imu | — |
| Lab4-02b_IMU_Library | Tư thế 3D ước tính | accZ, gyroZ, magX | — |
| Lab4-03a_GPS_UART | Bản đồ GPS | gpsLat, gpsLon, gpsAlt | — |
| Lab4-03b_GPS_Library | Bản đồ GPS | gpsLat, gpsLon, gpsAlt | — |
| Lab4-04a_Camera_UART | Camera | Không tự tạo số đo | — |
| Lab4-04b_Camera_Library | Camera | Sự kiện camera | p |
| Lab4-05_Read_All_Sensors | Môi trường, Tư thế 3D ước tính | temperatureC, pressureHpa, accZ, gyroZ, magX | — |
| Lab5-01a_Send_Telemetry_UART | Telemetry | Sự kiện radio | — |
| Lab5-01b_Send_Telemetry_Library | Telemetry | Sự kiện radio | — |
| Lab5-02a_Receive_Command_UART | Telemetry | Sự kiện radio | — |
| Lab5-02b_Receive_Command_Library | Telemetry | Sự kiện radio | — |
| Lab5-03_Satellite_Comm_System | Telemetry | Sự kiện radio | — |
| Lab6-01_Multitasking_Scheduler | Tác vụ / timeline | Sự kiện task | — |
| Lab6-02_Watchdog_And_Event | Sự kiện / log gốc | Sự kiện alert | — |
| Lab7-01_Camera_Multiplexer | Bản đồ GPS, Camera | gpsLat, gpsLon | — |
| Lab7-02_Full_Satellite_Program | Điện áp, Môi trường, Tư thế 3D ước tính, Bản đồ GPS, Camera, Telemetry | voltageV, temperatureC, pressureHpa, accZ, gyroZ, gpsLon | — |
| Lab7-03_RTOS_Satellite_System | Điện áp, Môi trường, Tư thế 3D ước tính, Bản đồ GPS, Camera, Telemetry | voltageV, temperatureC, pressureHpa, accZ, gyroZ, magX, gpsLon | ping, status, uptime, get_*, pause, resume, capture, help |
| Lab8-01_Custom_Mission | Dashboard tùy biến | Không tự tạo số đo | — |

## Kiểm chứng

- `npm run test:telemetry`: 63 ca, gồm 32 bài và các ca hồi quy về đơn vị, null/NaN, freshness, ghép gói, ràng buộc thiết bị, đổi nguồn, GPS và thời gian gyro.
- `npm run check`: lint, TypeScript, schema, auth storage, curriculum, Blockly, flash, telemetry và BE. BE có 82 ca; 8 ca phụ thuộc cấu hình tích hợp được skip trong chế độ mặc định.
- `npm run build`: thành công. Vẫn có cảnh báo kích thước thư viện Blockly, 3D và ECharts; các thư viện trực quan đã được tách tải theo nhu cầu.
- `scripts/test-practice-browser.mjs`: kiểm tra trên Edge headless với cổng USB giả lập trong browser context riêng; không mở COM thật. Qua Lab6 timeline, Lab4 nhiệt độ/áp suất/độ ẩm vắng mặt/hết hạn, Lab7 sáu gói/đơn vị/No Fix/lệnh ping, camera lệnh p/lưu SD/ảnh PNG/ngắt USB và đồ thị IMU thô. Không có exception JavaScript.
- Screenshot kiểm chứng ở `build_cache/practice-browser/lab6-scheduler.png` và `lab4-environment.png` (thư mục cache không đưa vào Git).

Chạy lại kiểm thử trình duyệt khi dev server đang chạy:

```powershell
# Nếu Playwright không cài trong project, đặt đường dẫn module được cung cấp bởi runtime.
$env:PSCUBESAT_PLAYWRIGHT = '<đường dẫn module playwright>'
$env:PSCUBESAT_WEB_URL = 'http://localhost:5175'
node scripts/test-practice-browser.mjs
```

## Giới hạn cần phân biệt

- Chưa nạp lại và chạy xác nhận phần cứng tất cả bài trong lượt sửa này; GPS trong nhà và radio LoRa chưa có trạm phát không được dùng để kết luận phần cứng lỗi.
- Lab1 blink không xuất Serial và Lab8 mẫu khung không xuất telemetry: giao diện không thể chứng minh hoạt động từ dữ liệu chưa có. Muốn thấy LED hoặc số đo tùy biến cần bổ sung output vào chương trình.
- Mã gốc GitHub Lab6-02 chỉ xét một trục. Bản mẫu tải từ ứng dụng đã sửa ba trục/thời gian/NaN/watchdog và bổ sung telemetry; cần chủ động dùng bản mới vì workspace hiện có không tự bị thay thế.
- Các bài camera lưu SD chưa cung cấp giao thức tải file/ảnh về web. Luồng UART thô không được tùy tiện coi là base64. Tương tự, log phát LoRa/MQTT không phải xác nhận đầu nhận đã nhận.
- Với chương trình tự viết khác định dạng mẫu, Serial Monitor vẫn hiển thị log gốc. Xuất JSON theo hợp đồng telemetry là cách ổn định để dùng các biểu đồ; giá trị canonical dùng g, °/s, µT, °C, hPa, V.
