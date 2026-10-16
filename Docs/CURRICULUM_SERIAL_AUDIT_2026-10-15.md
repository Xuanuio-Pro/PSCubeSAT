# Kiểm tra code giáo trình và Serial — 15/10/2026

## Kết luận và phạm vi

Đã lấy `src/main.cpp` của 40 repository Lab1–Lab8 từ https://github.com/PTITCube. Biên dịch theo cấu hình ESP32 của compiler dự án (espressif32@6.10.0, thư viện PTITCube chung pin commit `218d2b6b78b75140962999cc7aad0c786838bb25`), không dùng từng bản thư viện vendored khác nhau trong các repo.

Lượt đầu: 37 PASS, 3 FAIL. Sau sửa: 3 bài lỗi đã build được; 5 ví dụ cảm biến đã sửa cũng build lại thành công. Không có nghĩa là đã chạy thực tế toàn bộ 40 bài. Bài Lab7-02 phải dùng bản nguồn đã sửa trong `fastapi-backend/app/firmware/curriculum/`; mã gốc vẫn gọi các API không tồn tại. Bản Lab7-03 trong thư mục này còn sửa unlock khi chưa lock thành công.

## Nguyên nhân crash BMP280 và thay đổi

- `PTIT_Sensor::update()` cũ đọc cả MPU/QMC dù `init(true,false,false)` chưa khởi tạo chúng: có thể dereference driver I2C chưa tồn tại và gây LoadProhibited/reboot.
- Overlay Sensor chỉ cấu hình/đọc cảm biến khởi tạo thành công; dữ liệu chưa có là NaN, không giả thành 0. Không in lỗi mỗi vòng lặp.
- Board COM8 nhận WHO_AM_I=0x70, là MPU6500. Adafruit_MPU6050 không dùng trực tiếp cho chip này. Đã bổ sung đọc thanh ghi MPU6500, kiểm tra ACK/count/config, ±8g và ±500°/s; đầu ra m/s² và rad/s. Tham chiếu [datasheet TDK](https://product.tdk.com/system/files/dam/doc/product/sensor/mortion-inertial/imu/data_sheet/mpu-6500-datasheet2.pdf). Chưa kiểm chứng MPU6050 thật hoặc MPU9250; không nhận MPU9250 là chip hỗ trợ.
- `getPressure()` đã là hPa: hai ví dụ môi trường bỏ phép chia 100 lần nữa. Giá trị từ trường là Gauss, sửa nhãn µT ở các ví dụ IMU. NaN nghĩa là chưa có dữ liệu, không phải lỗi giải mã Serial.
- GPS bổ sung `hasFix()` (fix không quá 5 giây), alias `getLatitude/getLongitude`.
- Scheduler thêm mutex UART2 riêng (bus 4, tổng 5), không dùng chung mutex Serial debug.
- Lab7-02 dùng đúng API EPS/COM/Storage, không giả các phép đo điện áp hệ thống/góc Euler chưa có; telemetry IMU chuyển sang gia tốc và vận tốc góc thô, log ghi SD dựa trên kết quả thật. `sendMessage` không chứng minh đầu thu đã nhận.
- Nút `Đã kết nối · Ngắt` gọi disconnect khi bấm lần hai; chỉ khóa trong lúc kết nối/nạp. Context hủy reader, nhả writer rồi đóng port.

## Kiểm chứng thực tế

ESP32-D0WD-V3 rev3.1 qua CP210x COM8; nạp 4 segment theo manifest, kiểm SHA256 trước nạp và esptool verify sau ghi. Đọc Serial trực tiếp bằng pyserial 115200; đây là kiểm chứng phần cứng/firmware, không phải thao tác flash bằng trình duyệt trong lượt này.

- I2C: BMP280 0x76, MPU6500 0x68, QMC5883P 0x2C.
- Chạy `sensor_matrix.cpp` 48 giây, đủ 8 tổ hợp bật/tắt, không panic/reboot ngoài reset chủ động đầu bài. Cảm biến tắt trả NaN; bật có dữ liệu thật.
- Khi bật cả ba: khoảng 28,43°C, 1013,5 hPa; ax≈−1,7, ay≈0,4, az≈10,0 m/s²; từ trường X≈0,23 Gauss. Gyro Y≈0,08 rad/s: cần hiệu chuẩn offset, chưa chứng nhận độ chính xác đo/góc.
- Mẫu BMP280 v4 build sandbox thành công trên cả ESP32 và ESP32-S3. Chỉ ESP32 được kiểm chứng phần cứng. GPIO21/22 cố định chưa phù hợp mọi board S3.
- Đã nạp mẫu BMP280 v4 lên COM8 và đọc 60 giây: 29 mẫu áp suất, khoảng 1013,54–1013,57 hPa ở 5 mẫu cuối; đúng 1 boot do reset chủ động, không Guru Meditation. Board hiện giữ mẫu BMP280 đã sửa, cổng Serial đã đóng sau kiểm tra.
- Compiler tests: 22 PASS, 2 Docker integration test opt-in SKIP. Có build Docker thật cho matrix và mẫu BMP280. FE lint/typecheck đã PASS; chưa thử thao tác disconnect/reconnect bằng trình duyệt trong lượt này.

Bằng chứng ở `fastapi-backend/logs/`: `sensor-matrix-v3-{compile,flash,serial}.log`, `bmp280-v4-esp32-compile.log`, `bmp280-v4-esp32s3-compile.log`, `bmp280-v4-{flash,serial}.log`, `curriculum/results.json`, `curriculum/fixed-results.json` và log từng bài. Log/cache được gitignore.

## Sử dụng bản sửa

Compiler mặc định `pscubesat-compiler:1` đã cập nhật từ candidate v4, image SHA256 `35d593d8744965b0fa1a8fca49a7764ca57d3c5dd26fab8072cc45c422e1a89c`. `compiler/Dockerfile` và `prepare.py` áp overlay từ `compiler/overrides` để build lại tái lập. Fingerprint cấu hình đổi v4 để tránh nhận artifact từ image cũ.

Các sửa đổi ở workspace/compiler local, chưa push lên PTITCube-Library hay các repository giáo trình. Muốn dùng ngoài compiler phải áp các overlay tương ứng. Sketch cũ trong editor không tự bị ghi đè: dùng ví dụ BMP280 đã sửa hoặc bỏ `/100.0` ở dòng in áp suất, sau đó biên dịch và nạp lại. Nạp lại artifact cũ vẫn chứa firmware cũ.

Kiểm tra health gọi trực tiếp router cho kết quả compiler_installed=true và image mới. Chưa xác nhận HTTP server đang phục vụ FE: localhost:8005 không lắng nghe, localhost:8000/api/health trả 404. Không thay đổi tiến trình khác đang chiếm cổng 8000. Cần chạy BE của dự án và FE trước khi kiểm thử giao diện.

## Việc còn lại để chứng nhận mọi bài chạy ổn định

1. Test từng nhóm thiết bị: nguồn/pin và sleep; MicroSD đọc-ghi; GPS có fix thật; camera lưu ảnh; LoRa có đầu thu ACK; WiFi/MQTT có hạ tầng cấu hình. Chưa có bằng chứng đủ cho các nhóm này trong lượt kiểm tra hiện tại.
2. Lab7-03: telemetry ghép chuỗi với NaN có thể tạo JSON không hợp lệ; cần serialize NaN thành null và trạng thái validity. Getter GPS cũ trả 0 khi chưa có fix, không được coi đó là vị trí thật.
3. Lab7-03: đồng bộ snapshot sensor/GPS và cờ pause giữa task; đồng bộ PubSubClient giữa update/publish. Camera ghi SD phải khóa SPI cùng storage; UART2 GPS/camera dùng hai đối tượng serial và đổi baud cần kiểm tra dài hạn. Thêm mutex UART2 mới giải quyết lỗi thiếu định danh, chưa hoàn tất các rủi ro này.
4. Hiệu chuẩn gyro/accel/magnetometer; chạy soak test dài hơn và kiểm tra cảm biến ngắt giữa chừng. 48–60 giây smoke test không thay thế kiểm tra độ ổn định nhiều giờ.
5. Kiểm tra thao tác FE trên Chrome/Edge: kết nối → ngắt → kết nối; giữ code khi đổi tab; compile/nạp đúng board; đọc log 115200. Các kiểm thử CLI firmware không thay thế hoàn toàn Web Serial.

## Kết quả từng bài

Cột ban đầu là mã gốc với overlay Sensor an toàn đầu tiên. Cột sau sửa ghi rõ bài được build lại với v4; các bài còn lại giữ kết quả lượt đầu. Bản sửa nguồn nằm trong `app/firmware/curriculum`.

| Bài / mã nguồn cố định commit | Ban đầu | Sau sửa |
|---|---|---|
| [Lab1-01_Blink_LED](https://github.com/PTITCube/Lab1-01_Blink_LED/blob/64e8a794e1190ef48c54410b46449a2fc4c7eeb7/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab1-02_Serial_Communication](https://github.com/PTITCube/Lab1-02_Serial_Communication/blob/2b69ba784225bee0d1a984f23695766161e6a57b/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab1-03_Serial_Control_LED](https://github.com/PTITCube/Lab1-03_Serial_Control_LED/blob/4530ac2a68fb610793773d5122b154504502d8f0/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab1-04_WiFi_Connection](https://github.com/PTITCube/Lab1-04_WiFi_Connection/blob/04fde642b98cecefca70c7b5da4d8e72d8f5e046/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab1-05_WiFi_AP_Mode](https://github.com/PTITCube/Lab1-05_WiFi_AP_Mode/blob/1fdcb473f07576072f0b446fa413ef129fccf376/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab1-06_Web_Server_LED](https://github.com/PTITCube/Lab1-06_Web_Server_LED/blob/c85d704a4f0133af5316d5b826da091dda50be8a/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab2-01a_Battery_GPIO](https://github.com/PTITCube/Lab2-01a_Battery_GPIO/blob/33da095f82a2a714c1f1d908be1d3d3b69dbeddc/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab2-01b_Battery_Library](https://github.com/PTITCube/Lab2-01b_Battery_Library/blob/53fed36a7b31fb5659b583910119ca170ba416b9/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab2-01_Detect_Battery_Voltage](https://github.com/PTITCube/Lab2-01_Detect_Battery_Voltage/blob/f6b86127247bd187c3bd6be9ad4dd2b1d5977755/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab2-02_Power_Saving](https://github.com/PTITCube/Lab2-02_Power_Saving/blob/8a7d40969ec4ab6035014541934807e64a6c98e6/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab3-01a_MicroSD_SPI](https://github.com/PTITCube/Lab3-01a_MicroSD_SPI/blob/3da6ecdf36f98cb735bc0b5c979bedc3e3d6c9e8/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab3-01b_MicroSD_Library](https://github.com/PTITCube/Lab3-01b_MicroSD_Library/blob/8145856370115be49a0fdeeac732744a0ccd31fe/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab3-01_Save_To_MicroSD](https://github.com/PTITCube/Lab3-01_Save_To_MicroSD/blob/f7fdfefbb6366aa99c3dc948024f3f22f2e10e89/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab3-02_Linux_FS_Commands](https://github.com/PTITCube/Lab3-02_Linux_FS_Commands/blob/18283df4f3b0cabda8ae99f3086621a477fa1fb0/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-01a_Environment_I2C](https://github.com/PTITCube/Lab4-01a_Environment_I2C/blob/f70a2aba0677d9bcb02e257f70df7f40914c7e39/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-01b_Environment_Library](https://github.com/PTITCube/Lab4-01b_Environment_Library/blob/fee0d7709b121ea76c39c834aa1cd4c906199c4d/src/main.cpp) | PASS | PASS (kiểm tra lại với patch v4) |
| [Lab4-01_Detect_Environment](https://github.com/PTITCube/Lab4-01_Detect_Environment/blob/5ce91b9458ed8aa7e404da35ddb3acfbce985e4a/src/main.cpp) | PASS | PASS (kiểm tra lại với patch v4) |
| [Lab4-02a_IMU_I2C](https://github.com/PTITCube/Lab4-02a_IMU_I2C/blob/270d2b381140c82c32ef619ca9b17d0885891732/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-02b_IMU_Library](https://github.com/PTITCube/Lab4-02b_IMU_Library/blob/3b35cfd1c1c248b4090ce129a2d661be07becff8/src/main.cpp) | PASS | PASS (kiểm tra lại với patch v4) |
| [Lab4-02_Detect_IMU_Attitude](https://github.com/PTITCube/Lab4-02_Detect_IMU_Attitude/blob/1b7ef9b6824ac6cb536b1e8bf5b4780308414149/src/main.cpp) | PASS | PASS (kiểm tra lại với patch v4) |
| [Lab4-03a_GPS_UART](https://github.com/PTITCube/Lab4-03a_GPS_UART/blob/a8751c38b6285f69a0b750088297ee8ab1a87edd/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-03b_GPS_Library](https://github.com/PTITCube/Lab4-03b_GPS_Library/blob/ac4376f4e7882f69716abb4abf68bcc278af1c09/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-03_Detect_GPS_Rawdata](https://github.com/PTITCube/Lab4-03_Detect_GPS_Rawdata/blob/50c3eb8ee139b04daaddc0d160c787cc3a93f49b/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-04a_Camera_UART](https://github.com/PTITCube/Lab4-04a_Camera_UART/blob/1bf4bbc43e4ced23a2d0ee48ecced87eabb2cbb7/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-04b_Camera_Library](https://github.com/PTITCube/Lab4-04b_Camera_Library/blob/cfa93f99b96d4be3e8354a31a3d5b191051c5451/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-04_Camera_Snapshot](https://github.com/PTITCube/Lab4-04_Camera_Snapshot/blob/a5902deccecb0e8f4e80b539eee410f836bf3325/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab4-05_Read_All_Sensors](https://github.com/PTITCube/Lab4-05_Read_All_Sensors/blob/8ba9f1a9ab1a7a002aa7ae3883879f5926dc34f9/src/main.cpp) | PASS | PASS (kiểm tra lại với patch v4) |
| [Lab5-01a_Send_Telemetry_UART](https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART/blob/47d62d81e407d9fd0cbd336912ab9a65c1505687/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab5-01b_Send_Telemetry_Library](https://github.com/PTITCube/Lab5-01b_Send_Telemetry_Library/blob/fec7725019e27d304fbd9745914f9eedd3c04015/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab5-01_Send_Telemetry](https://github.com/PTITCube/Lab5-01_Send_Telemetry/blob/96c69d9b0daa6e7bbcf1b6ff51919c44b2c5e975/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab5-02a_Receive_Command_UART](https://github.com/PTITCube/Lab5-02a_Receive_Command_UART/blob/9759b69a799ab28a1da18d36da6db8a057ea1f7a/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab5-02b_Receive_Command_Library](https://github.com/PTITCube/Lab5-02b_Receive_Command_Library/blob/5f98479e4d47cbf22bf2a5764687b75fbf35b54d/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab5-02_Receive_Command](https://github.com/PTITCube/Lab5-02_Receive_Command/blob/29a203c6f31f1c972b2559fa030480869ce6aee4/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab5-03_Satellite_Comm_System](https://github.com/PTITCube/Lab5-03_Satellite_Comm_System/blob/3053a45cc28a1d7d4028cb90301076ad4ea5145d/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab6-01_Multitasking_Scheduler](https://github.com/PTITCube/Lab6-01_Multitasking_Scheduler/blob/e97a2946816d26b0edfa6aa2aa09b6ec29811a89/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab6-02_Watchdog_And_Event](https://github.com/PTITCube/Lab6-02_Watchdog_And_Event/blob/fcb70064d32cdd92d2cdfb7ddca1ad73446bf97a/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
| [Lab7-01_Camera_Multiplexer](https://github.com/PTITCube/Lab7-01_Camera_Multiplexer/blob/b52092abc5e3910c6ace330ae92f6c4940cf963a/src/main.cpp) | FAIL | PASS (kiểm tra lại với patch v4) |
| [Lab7-02_Full_Satellite_Program](https://github.com/PTITCube/Lab7-02_Full_Satellite_Program/blob/35540b244a4d1cf8df459beb567757c1b9616949/src/main.cpp) | FAIL | PASS (kiểm tra lại với patch v4) |
| [Lab7-03_RTOS_Satellite_System](https://github.com/PTITCube/Lab7-03_RTOS_Satellite_System/blob/f7b9c6cdeb70011bc54bfae4509f9b2582bb32a2/src/main.cpp) | FAIL | PASS (kiểm tra lại với patch v4) |
| [Lab8-01_Custom_Mission](https://github.com/PTITCube/Lab8-01_Custom_Mission/blob/66f456ca34db9653fc048986e6db8fe9208cd2c1/src/main.cpp) | PASS | PASS (lượt quét ban đầu) |
