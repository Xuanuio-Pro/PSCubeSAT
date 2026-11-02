# Đối chiếu giáo trình GitHub PTITCube — 21/10/2026

Cập nhật giao diện và quyền truy cập: [đăng nhập bắt buộc, giữ các khối gốc và bổ sung trực quan từng bài](AUTH_LAB_VISUALIZATION_2026-10-21.md).

## Kết quả và phạm vi

Đã tải lại nguồn hiện tại từ tổ chức [PTITCube](https://github.com/PTITCube/), chốt commit và checksum của 40 repository Lab cùng PTITCube-Library. Đã đối chiếu đủ **32 bài thực hành** đang nằm trong giáo trình web với mã nguồn, chức năng, lệnh, pin map và định dạng dữ liệu. Tám repository còn lại là ví dụ tên cũ; không tính thành tám bài mới.

**32/32 bản mẫu cuối trong dự án đã build thành công cho OBC ESP32**, bằng compiler sandbox hiện tại. Từng checksum mã nguồn cuối khớp chính xác với lượt build thành công; không lấy kết quả build của phiên bản cũ để thay cho mã sau sửa. Không đồng nghĩa 32 bài đều đã được nạp và chứng nhận chạy trên phần cứng trong lượt này.

Mã nguồn upstream không bị thay đổi. Những bản sửa bên dưới được phân phối trong ứng dụng qua **Tải mã mẫu ESP32 (.ino)** tại phần Yêu cầu thực hành. Chỉ mở GitHub rồi copy nguyên mã gốc có thể gặp lại các lỗi đã nêu. Workspace/C++/Blockly học viên đang lưu không tự bị thay thế.

## Lỗi đã xác định và sửa

| Nhóm | Sai lệch chức năng | Bản sửa trong dự án |
|---|---|---|
| Lab1 | Serial chỉ gửi lời chào dù bài mô tả gửi/nhận; WiFi chờ vô hạn; AP không kiểm kết quả | Echo hai chiều có giới hạn, lời chào định kỳ; timeout 15s/reconnect; HTTP server khởi động cả sau lần kết nối muộn; AP kiểm lỗi; LED xuất log ON/OFF |
| Lab2 | ADC dùng tham chiếu 3,3 V cố định; bài thư viện chưa in phần trăm pin | Raw dùng analogReadMilliVolts, cấu hình ADC rõ ràng; in phần trăm ước tính của thư viện, không coi là phép đo dung lượng thực |
| Lab3 | SD raw CS5 khác CS13 của OBC; mở file được đã coi là ghi thành công; lệnh dài/bị chặn; cd/ls có thể báo OK với file thường | SPI18/19/23 CS13; append và kiểm byte ghi; kiểm appendFile; nhận lệnh không chặn, giới hạn 128 byte; kiểm đúng kiểu directory trước khi giao lệnh thư viện |
| Lab4 BMP/IMU | Áp suất thư viện bị chia thêm 100 trong mã gốc; đơn vị từ trường sai/không khớp parser; thiếu kiểm ACK I2C | Giữ hPa của thư viện, chỉ Adafruit Pa đổi sang hPa; đọc cả BMP 0x76/0x77; giữ/đổi đúng m/s², rad/s, Gauss/G; kiểm lỗi giao dịch và short read |
| Lab4 GPS | Raw chưa chọn MUX; coi 0,0 là mất fix | Chọn GPS MUX12/14, UART2 RX16/TX17 9600; kiểm hasFix và tuổi fix thay cho phỏng đoán từ tọa độ |
| Lab4 Camera UART | UART1 RX32/TX33 và lệnh C không khớp OBC/camera slave hiện tại | UART2 RX16/TX17 115200, MUX camera12/14, CAPTURE → SIZE → OK → JPEG → DONE; timeout, giới hạn buffer, kiểm marker/đủ byte, base64 preview |
| Lab4 Camera thư viện | MUX bị bỏ qua, có thể ghi đè ảnh cũ, lỗi khởi tạo không thử lại | p/P, MUX12/14, tên file mới, captureToFile thử mount lại; phân biệt lưu SD với ảnh đã truyền về web |
| Lab5 UART | M1=GPIO35 là chân chỉ nhận trên ESP32; TX27 đụng AUX và khác pin map thư viện | UART1 RX26/TX25, M0=32/M1=33/AUX27; TX chờ AUX có timeout; GS phải cùng baud/channel/transparent mode; không giả ACK |
| Lab5 lệnh | GPS chưa fix vẫn trả 0,0 | Trả no-fix hoặc JSON null. Lệnh vẫn qua LoRa đúng bài, không coi OBC USB là radio uplink |
| Lab6-01 | Giữ mutex Serial suốt delay mô phỏng 500 ms làm nghẽn log các tác vụ khác; LED không có bằng chứng Serial | Nhả mutex trong khoảng delay, xuất LED ON/OFF; giao diện đếm riêng LED/Sensor/Network, timeline; nhiệt độ và mạng minh họa vẫn ghi nhãn rõ |
| Lab6-02 | Chỉ kiểm abs(aX) nên board đứng yên vẫn có thể báo freefall; thiếu enableWatchdog; spam cảnh báo; không có số đo để quan sát bình thường | Độ lớn ba trục <1 m/s² liên tục ≥200 ms, loại NaN/Inf, watchdog yêu cầu 10s, giới hạn cảnh báo 2s, telemetry thật mỗi giây, phục hồi chỉ khi dữ liệu hợp lệ |
| Lab7-01/03 | Ảnh có thể ghi đè tên cố định; SD lỗi ban đầu không thử lại; lệnh file qua USB thiếu đường xử lý | Tên ảnh mới, thử lại SD trong capture; USB và radio dùng kiểm directory/mutex SPI; lỗi lệnh quá dài có phản hồi |
| Lab7-02 | Mã gốc gọi API không tồn tại và có log thành công giả định | Giữ bản sửa API thực, snapshot SI có nhãn, hasFix, kiểm appendFile và không coi sendMessage là ACK |
| Lab7-03 MQTT | Topic cubesat/telemetry/* không được BE sensors/# nhận; client ID cố định; cấu hình macro trong sketch không truyền sang .cpp của thư viện | Client MQTT cấu hình runtime ngay trong sketch, credential/client ID riêng, sensors/{DEVICE_UID}/telemetry, một snapshot chuẩn hóa g/°s/µT/°C/hPa/V, publish có kết quả và ghi rõ QoS0 chưa có ACK |
| FE | Bỏ qua log G của bản IMU đã sửa, báo lỗi cảm biến cho lỗi WiFi, coi log bật watchdog là alarm, ảnh hỏng hiện như preview bình thường, cold-start Vite reload mất USB | Parser theo đúng log thực, phân loại đúng phân hệ/event/recovery, bỏ ảnh không decode được; prebundle các dependency lazy trước khi dùng Serial |

## Ma trận mã nguồn cuối

Các link upstream được ghim vào commit đã kiểm tra. Kết quả build dùng bản sửa tương ứng trong catalog, không khẳng định mã nguyên gốc GitHub của mọi bài đều build được với compiler này.

| Bài | Upstream commit | SHA256 mã cuối (12 ký tự đầu) | ESP32 sandbox |
|---|---|---|---|
| [Lab1-01_Blink_LED](https://github.com/PTITCube/Lab1-01_Blink_LED/blob/64e8a794e1190ef48c54410b46449a2fc4c7eeb7/src/main.cpp) | 64e8a794e119 | 4bc007085f08 | PASS |
| [Lab1-02_Serial_Communication](https://github.com/PTITCube/Lab1-02_Serial_Communication/blob/2b69ba784225bee0d1a984f23695766161e6a57b/src/main.cpp) | 2b69ba784225 | 723d327fed06 | PASS |
| [Lab1-03_Serial_Control_LED](https://github.com/PTITCube/Lab1-03_Serial_Control_LED/blob/4530ac2a68fb610793773d5122b154504502d8f0/src/main.cpp) | 4530ac2a68fb | 446fb677c31e | PASS |
| [Lab1-04_WiFi_Connection](https://github.com/PTITCube/Lab1-04_WiFi_Connection/blob/04fde642b98cecefca70c7b5da4d8e72d8f5e046/src/main.cpp) | 04fde642b98c | 4c3ca3b9466a | PASS |
| [Lab1-05_WiFi_AP_Mode](https://github.com/PTITCube/Lab1-05_WiFi_AP_Mode/blob/1fdcb473f07576072f0b446fa413ef129fccf376/src/main.cpp) | 1fdcb473f075 | 624729e6da6d | PASS |
| [Lab1-06_Web_Server_LED](https://github.com/PTITCube/Lab1-06_Web_Server_LED/blob/c85d704a4f0133af5316d5b826da091dda50be8a/src/main.cpp) | c85d704a4f01 | c64fe59d6ac9 | PASS |
| [Lab2-01a_Battery_GPIO](https://github.com/PTITCube/Lab2-01a_Battery_GPIO/blob/33da095f82a2a714c1f1d908be1d3d3b69dbeddc/src/main.cpp) | 33da095f82a2 | c99d8da79c52 | PASS |
| [Lab2-01b_Battery_Library](https://github.com/PTITCube/Lab2-01b_Battery_Library/blob/53fed36a7b31fb5659b583910119ca170ba416b9/src/main.cpp) | 53fed36a7b31 | 5cb87840bb2f | PASS |
| [Lab2-02_Power_Saving](https://github.com/PTITCube/Lab2-02_Power_Saving/blob/8a7d40969ec4ab6035014541934807e64a6c98e6/src/main.cpp) | 8a7d40969ec4 | 8226cc98e5ce | PASS |
| [Lab3-01a_MicroSD_SPI](https://github.com/PTITCube/Lab3-01a_MicroSD_SPI/blob/3da6ecdf36f98cb735bc0b5c979bedc3e3d6c9e8/src/main.cpp) | 3da6ecdf36f9 | 772521f8fed2 | PASS |
| [Lab3-01b_MicroSD_Library](https://github.com/PTITCube/Lab3-01b_MicroSD_Library/blob/8145856370115be49a0fdeeac732744a0ccd31fe/src/main.cpp) | 814585637011 | 94a586e309ab | PASS |
| [Lab3-02_Linux_FS_Commands](https://github.com/PTITCube/Lab3-02_Linux_FS_Commands/blob/18283df4f3b0cabda8ae99f3086621a477fa1fb0/src/main.cpp) | 18283df4f3b0 | 06ec27d124cf | PASS |
| [Lab4-01a_Environment_I2C](https://github.com/PTITCube/Lab4-01a_Environment_I2C/blob/f70a2aba0677d9bcb02e257f70df7f40914c7e39/src/main.cpp) | f70a2aba0677 | 6a946e408cb4 | PASS |
| [Lab4-01b_Environment_Library](https://github.com/PTITCube/Lab4-01b_Environment_Library/blob/fee0d7709b121ea76c39c834aa1cd4c906199c4d/src/main.cpp) | fee0d7709b12 | bca2fcb6457d | PASS |
| [Lab4-02a_IMU_I2C](https://github.com/PTITCube/Lab4-02a_IMU_I2C/blob/270d2b381140c82c32ef619ca9b17d0885891732/src/main.cpp) | 270d2b381140 | fa1e52829b34 | PASS |
| [Lab4-02b_IMU_Library](https://github.com/PTITCube/Lab4-02b_IMU_Library/blob/3b35cfd1c1c248b4090ce129a2d661be07becff8/src/main.cpp) | 3b35cfd1c1c2 | e81ec3c72d6c | PASS |
| [Lab4-03a_GPS_UART](https://github.com/PTITCube/Lab4-03a_GPS_UART/blob/a8751c38b6285f69a0b750088297ee8ab1a87edd/src/main.cpp) | a8751c38b628 | fe2647f3f446 | PASS |
| [Lab4-03b_GPS_Library](https://github.com/PTITCube/Lab4-03b_GPS_Library/blob/ac4376f4e7882f69716abb4abf68bcc278af1c09/src/main.cpp) | ac4376f4e788 | 4db235c5ddcf | PASS |
| [Lab4-04a_Camera_UART](https://github.com/PTITCube/Lab4-04a_Camera_UART/blob/1bf4bbc43e4ced23a2d0ee48ecced87eabb2cbb7/src/main.cpp) | 1bf4bbc43e4c | 46562d49dc46 | PASS |
| [Lab4-04b_Camera_Library](https://github.com/PTITCube/Lab4-04b_Camera_Library/blob/cfa93f99b96d4be3e8354a31a3d5b191051c5451/src/main.cpp) | cfa93f99b96d | 4fa3021e772f | PASS |
| [Lab4-05_Read_All_Sensors](https://github.com/PTITCube/Lab4-05_Read_All_Sensors/blob/8ba9f1a9ab1a7a002aa7ae3883879f5926dc34f9/src/main.cpp) | 8ba9f1a9ab1a | 98b7fa0c3f33 | PASS |
| [Lab5-01a_Send_Telemetry_UART](https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART/blob/47d62d81e407d9fd0cbd336912ab9a65c1505687/src/main.cpp) | 47d62d81e407 | 69c7ac1a780b | PASS |
| [Lab5-01b_Send_Telemetry_Library](https://github.com/PTITCube/Lab5-01b_Send_Telemetry_Library/blob/fec7725019e27d304fbd9745914f9eedd3c04015/src/main.cpp) | fec7725019e2 | e25973cd5ade | PASS |
| [Lab5-02a_Receive_Command_UART](https://github.com/PTITCube/Lab5-02a_Receive_Command_UART/blob/9759b69a799ab28a1da18d36da6db8a057ea1f7a/src/main.cpp) | 9759b69a799a | acae6834e33e | PASS |
| [Lab5-02b_Receive_Command_Library](https://github.com/PTITCube/Lab5-02b_Receive_Command_Library/blob/5f98479e4d47cbf22bf2a5764687b75fbf35b54d/src/main.cpp) | 5f98479e4d47 | 5b589db68583 | PASS |
| [Lab5-03_Satellite_Comm_System](https://github.com/PTITCube/Lab5-03_Satellite_Comm_System/blob/3053a45cc28a1d7d4028cb90301076ad4ea5145d/src/main.cpp) | 3053a45cc28a | 46c9433a2510 | PASS |
| [Lab6-01_Multitasking_Scheduler](https://github.com/PTITCube/Lab6-01_Multitasking_Scheduler/blob/e97a2946816d26b0edfa6aa2aa09b6ec29811a89/src/main.cpp) | e97a2946816d | 4734ead895a6 | PASS |
| [Lab6-02_Watchdog_And_Event](https://github.com/PTITCube/Lab6-02_Watchdog_And_Event/blob/fcb70064d32cdd92d2cdfb7ddca1ad73446bf97a/src/main.cpp) | fcb70064d32c | bf29af83e4f6 | PASS |
| [Lab7-01_Camera_Multiplexer](https://github.com/PTITCube/Lab7-01_Camera_Multiplexer/blob/b52092abc5e3910c6ace330ae92f6c4940cf963a/src/main.cpp) | b52092abc5e3 | c9665ce33478 | PASS |
| [Lab7-02_Full_Satellite_Program](https://github.com/PTITCube/Lab7-02_Full_Satellite_Program/blob/35540b244a4d1cf8df459beb567757c1b9616949/src/main.cpp) | 35540b244a4d | bfb72f2fcc6e | PASS |
| [Lab7-03_RTOS_Satellite_System](https://github.com/PTITCube/Lab7-03_RTOS_Satellite_System/blob/f7b9c6cdeb70011bc54bfae4509f9b2582bb32a2/src/main.cpp) | f7b9c6cdeb70 | 5179d9a83f03 | PASS |
| [Lab8-01_Custom_Mission](https://github.com/PTITCube/Lab8-01_Custom_Mission/blob/66f456ca34db9653fc048986e6db8fe9208cd2c1/src/main.cpp) | 66f456ca34db | 83877e21cdab | PASS |

## Cách dùng bản đã kiểm tra

1. Đăng nhập, mở đúng bài thực hành, bấm **Tải mã mẫu ESP32 (.ino)**. API yêu cầu Bearer JWT hợp lệ và chỉ trả file có trong allowlist 32 bài: `GET /api/curriculum/exercises/{id}/source`; metadata/checksum ở `GET /api/curriculum/exercises`.
2. Giữ bản sao code đang sửa, mở file mẫu và đưa vào editor. Mẫu không tự ghi đè workspace hiện có. Chọn ESP32 cho OBC với pin map này; biên dịch qua compiler quản lý của dự án có library overlay hiện tại.
3. Với WiFi, điền SSID/password đúng. Lab7-03 dùng WiFiManager để cấu hình mạng; thay khối MQTT runtime bằng config riêng trả về lúc tạo/rotate thiết bị. Cấu hình CA PEM hoặc chủ động bật tùy chọn prototype đã cung cấp; không đưa credential thật vào repo. Client dùng đúng DEVICE_UID, username/password, client ID và topic.
4. Kết nối Serial 115200, đối chiếu số đo và trạng thái với log. Lệnh camera p/P, LED 1/0, shell SD pwd/ls/cd/... và nhóm chẩn đoán Lab7-03 phải dùng đúng firmware đang chạy.

## Bằng chứng kiểm thử

- 32/32 nguồn cuối: ESP32 sandbox build PASS, đủ artifact để tạo flash manifest. Compiler image được lưu cho từng bài trong catalog; nguồn thư viện upstream ghim `218d2b6b78b75140962999cc7aad0c786838bb25` với overlay v6 đang dùng. Không thay compiler image hoặc bỏ cách ly.
- Native C++: chạy đúng hàm FallDetector/isOverheating trích từ mã cuối; kiểm đứng yên theo ba hướng, ngưỡng thời gian, transient, NaN/Inf, phục hồi, tràn millis và ngưỡng nhiệt độ.
- `npm run check`: PASS; gồm 64 telemetry tests, 32 fixture bài thực hành, kiểm schema, curriculum, Blockly, auth storage và flash. BE 84 tests, 8 integration opt-in skipped. Sau cập nhật checksum cuối, kiểm catalog/hash/download chạy lại riêng.
- `npm run build`: PASS. Còn cảnh báo kích thước các thư viện Blockly/3D/ECharts; chúng được tải theo phần cần dùng.
- Trình duyệt Edge với USB mock trong context riêng: PASS scheduler/timeline/LED, môi trường, sparse RTOS/đơn vị, GPS No Fix, lệnh USB, camera lưu file/ảnh hợp lệ/ảnh hỏng, ngắt USB, IMU raw và telemetry/cảnh báo/phục hồi Lab6-02. Đã tái hiện và sửa late dependency reload của Vite; lượt sau giữ được phiên Serial qua các bài.
- API catalog: khớp đúng 32 bài, checksum mã cuối, download .ino yêu cầu đăng nhập và từ chối ID/path ngoài allowlist. Không truy cập file .env và không yêu cầu thông tin quản trị broker.

Tái chạy: `python scripts/audit-ptitcube.py --fetch` tải metadata/nguồn ghim; `--compile --only <danh sách ID>` build các bản sửa; `python scripts/test-firmware-logic.py` chạy kiểm tra native C++; `node scripts/test-practice-browser.mjs` chạy kiểm tra trình duyệt với Playwright và URL dev server.

## Điều kiện chưa được chứng nhận bằng phần cứng trong lượt này

Không nạp lại hàng loạt 32 bài lên board trong lượt kiểm tra. Kết quả trên là đối chiếu source, compile, native logic, API và browser mock. Không dùng GPS indoor hoặc thiếu GS LoRa để kết luận phần cứng lỗi. Chưa chứng nhận liên lạc RF hai đầu, kết nối WiFi của board ở mạng thực, MQTT device auth trên broker ngoài, pin/ADC đã hiệu chuẩn, ghi SD dài hạn hoặc chất lượng ảnh từ toàn bộ các bài.

Lab7-03 chỉ phát MQTT khi đã điền credential và cấu hình TLS/mạng phù hợp. Admin broker phải đã bật cách xác thực/ACL thiết bị mà hệ thống dùng; bản sửa topic không tự cấp quyền trên broker. Không cấu hình thì firmware báo chưa cấu hình và tiếp tục USB/SD/LoRa, không báo MQTT online giả.

Preview camera UART cố ý giới hạn JPEG 32768 byte để vừa giao thức Serial trình duyệt. Ảnh lớn hơn dùng bài lưu SD; file trên thẻ không tự trở thành ảnh web. Kiểm marker JPEG/đủ byte không thay cho kiểm tra chất lượng ảnh bằng mắt. Lab8 là khung sứ mệnh tự viết theo giáo trình, chưa có nhiệm vụ hoặc telemetry thì không tạo dữ liệu giả.

Pin map trong catalog là **OBC ESP32 đã đối chiếu với thư viện/mạch của dự án**, không chứng nhận chạy đúng chân trên ESP32-S3. Các bản mẫu còn phụ thuộc giá trị điện trở chia áp, địa chỉ cảm biến, firmware camera slave và cấu hình radio thực tế.
