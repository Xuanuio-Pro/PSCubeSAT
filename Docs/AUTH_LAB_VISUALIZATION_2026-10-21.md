# Đăng nhập bắt buộc và trực quan bài thực hành — 21/10/2026

## Kết quả triển khai

Ứng dụng yêu cầu đăng nhập trước khi mở trang chính, hồ sơ hoặc Lab0–Lab8. Khi truy cập một bài bằng URL, đăng nhập xong sẽ trở về đúng bài và query đã chọn. Token lưu trong trình duyệt được kiểm chứng bằng `/api/auth/me` trước khi mở dịch vụ; không dùng việc có token trong storage làm bằng chứng đăng nhập.

SerialProvider và TelemetryProvider chỉ tồn tại trong phiên đã đăng nhập. Đăng xuất xóa phiên cục bộ ngay cả khi máy chủ mất mạng; hết hạn token hoặc API trả 401 sẽ đưa về đăng nhập, đóng reader/cổng USB và dừng WebSocket. Có kiểm tra phiên định kỳ/focus, kiểm soát callback cũ và ngăn bắt đầu nạp nếu tài khoản đã đổi trong lúc tải artifact. Một thao tác ghi flash đã bắt đầu không bị cắt giữa chừng để tránh hỏng firmware; không tự mở lại Serial sau khi thoát phiên.

BE yêu cầu JWT hợp lệ cho compiler/boards/template, manifest/binary, catalog/source, health, thiết bị, progress, simulation và telemetry. WebSocket kiểm tài khoản, quyền sở hữu thiết bị và kiểm lại phiên trong kết nối. Đăng ký/đăng nhập/cấu hình đăng nhập Google vẫn mở để tạo phiên; trang giới thiệu API và tài liệu OpenAPI chỉ là metadata. Không có chế độ compile khách qua HTTP. Artifact vẫn kiểm đúng chủ sở hữu.

## Giữ các khối ban đầu

Làm rõ hiển thị kết nối Lab1: không hiện khối chờ IP hoặc lời nhắc kết nối USB. Chỉ sau khi nhận IP hợp lệ từ Serial mới hiện khối kết quả với `WiFi connected.` và `IP address: ...`; Lab1.6 thêm `HTTP server started.` khi nhận đúng log khởi động HTTP. Địa chỉ web có thể nhấn mở khi server đã báo khởi động. Lab1.5 hiển thị AP và số client. Ngắt USB, đổi nguồn/bài hoặc nhận lỗi mạng sẽ ẩn khối kết nối.

Điều chỉnh Lab1 theo yêu cầu riêng: 1.1–1.3 chỉ có Serial Monitor, bỏ LED/Echo và bảng Command Uplink (lệnh 1/0 vẫn có thể nhập trực tiếp trong Serial Monitor). 1.4 hiển thị một thông báo kết nối WiFi/IP; 1.5 thông báo IP AP và số client; 1.6 một thông báo địa chỉ web có link khi nhận IP hợp lệ và log HTTP server started. Không còn các khối thông tin mạng/LED/Echo riêng ở các bài này. Địa chỉ AP được giữ qua các bản tin số client; lỗi kết nối xóa địa chỉ cũ. Các Lab khác giữ cách hiển thị đã đối chiếu trước đó.

Cập nhật giao diện theo yêu cầu tiếp theo: đã đọc trực tiếp các trang Lab trong `C:/Users/Xuanuio/Desktop/IEC/CubeSAT/PTIT-STEM-CUBE`. Serial Monitor đứng đầu phần trực quan của cả 32 bài (các mẫu đều dùng Serial để quan sát, cấu hình hoặc kiểm tra). Các cụm panel gốc giữ đúng thứ tự; Lab5 giữ telemetry và bảng lệnh cùng cụm. Bỏ banner giải thích panel, mô tả bộ giải mã, log sự kiện trùng Serial, hướng dẫn C++/Blockly dài và các chú thích lặp lại. Giữ trạng thái chờ/lỗi, đơn vị, nhãn minh họa và kết quả cần cho việc thực hành; bảng hoạt động chỉ hiện cho scheduler hoặc khi có sự kiện đáng hiển thị. Kiểm thử trình duyệt đi qua đủ 32 bài và xác nhận Serial Monitor đứng đầu, không bị lặp ở phần trực quan chung.

Các panel gốc được đối chiếu với mã trang trước thay đổi và giữ lại, rồi hợp với panel riêng của từng bài bằng `visualizationPlan`. Không bỏ 3D/GPS/camera chỉ vì đang mở bài BMP280 hoặc IMU raw. Các khối chưa có số đo phù hợp ghi rõ trạng thái chờ; khối được giữ ngoài chức năng của bài có chú thích. Serial Monitor và bảng kết quả/sự kiện có trong mọi bài thực hành. Lab0 giữ khối khám phá thành phần.

| Lab | Khối gốc giữ lại | Chức năng bổ sung theo bài |
|---|---|---|
| 1 — 6 bài | Serial Monitor | Blink/trạng thái GPIO, lời chào và Echo; nút 1/0 cho Lab1-03; IP, số client AP và lịch sử WiFi/HTTP cho 04–06; trạng thái LED web cho 06 |
| 2 — 3 bài | Điện áp + Serial | Biểu đồ pin theo mẫu thật, trạng thái nguồn/deep sleep theo log; thiếu mẫu mới hiện chờ |
| 3 — 3 bài | Serial | Kết quả ghi SD, log yêu cầu khác phản hồi lưu; danh sách tệp/thư mục có thời gian; pwd/ls và lệnh shell cho 02, lỗi lệnh đi vào khối SD |
| 4 — 9 bài | 3D, GPS, camera, môi trường, Serial | Đồ thị IMU raw riêng; đơn vị đúng cho IMU thư viện/BMP; GPS No Fix không thành 0,0; lệnh p của camera thư viện, trạng thái lưu SD khác preview ảnh truyền về |
| 5 — 5 bài | Telemetry, bảng lệnh, Serial | Phân biệt TX/RX LoRa và USB; chọn rõ cổng OBC hay USB–LoRa của GS. Mặc định OBC không nhận lệnh USB thì vô hiệu hóa bảng lệnh. Preset GS Lab5-03 theo lệnh thực của bài |
| 6 — 2 bài | System Check + Serial | 01: bộ đếm LED/Sensor/Network, thời gian và timeline; nhiệt độ/mạng mẫu ghi nhãn minh họa. 02: môi trường, tư thế ước tính, telemetry, cảnh báo/phục hồi từ firmware |
| 7 — 3 bài | 3D, GPS, điện áp | Camera, SD và System Check; 02/03 thêm môi trường/telemetry; 03 thêm WiFi/MQTT và nhóm lệnh USB đã hỗ trợ |
| 8 — 1 bài | Dashboard tùy biến + Serial | Widget dùng cùng nguồn telemetry/camera thật; mẫu khung chưa xuất số đo sẽ chờ, không sinh số liệu để lấp biểu đồ |

System Check đối chiếu thụ động các trường đo/phản hồi của từng phân hệ. Không gửi lệnh chẩn đoán chung tới firmware chưa hỗ trợ. Ghi USB thành công, yêu cầu gửi LoRa/MQTT và hoàn tất thực thi là các bằng chứng khác nhau. Bản đồ, mô hình và số đo không tự xác nhận toàn bộ thiết bị hoạt động.

Danh sách phản hồi WiFi/SD chỉ giữ một phần lịch sử có thời gian; IP/client đã báo không chứng minh kết nối hiện còn sống, file đã liệt kê không phải cây thư mục trực tiếp. Dùng `ls` để đọc lại. Số đo có freshness riêng; log tác vụ không làm tươi số đo cũ. Workspace/C++/Blockly lưu riêng từng bài vẫn được giữ qua chuyển tab/bài.

## Kiểm chứng và cách dùng

- `npm run check`: lint, TypeScript, schema, auth storage/redirect/expiry, curriculum, Blockly, flash, telemetry và BE đều PASS. Lượt cuối: 66 telemetry tests; BE 86 tests, 8 ca tích hợp opt-in được skip. Các ca bổ sung kiểm khách/token giả/token hết hạn/token bị thu hồi không dùng được dịch vụ và không gọi compiler worker; người dùng hợp lệ vẫn tải được mã mẫu/artifact đúng chủ.
- `npm run build`: PASS; còn cảnh báo kích thước các thư viện Blockly/3D/ECharts.
- `scripts/test-practice-browser.mjs`: Edge headless, API/USB được mock trong browser context riêng. Kiểm đăng nhập, trả về đúng lesson, reload kiểm `/me`, tải `.ino` có Bearer token, logout/401/expiry đóng USB; kiểm timeline, số đo/đơn vị/freshness, GPS No Fix, ảnh lỗi/ảnh thật, panel gốc, IMU raw, WiFi/LED và danh sách SD. Không mở COM thật.
- Catalog vẫn đối chiếu 32 checksum nguồn cuối với build ESP32 sandbox đã thành công ở lượt kiểm nguồn trước. Lượt này không thay mã firmware hoặc compiler image; không cần dùng kết quả build của mã khác để thay thế.

Đăng nhập → chọn đúng bài → tải **mã mẫu ESP32 (.ino)** nếu cần bản đã sửa → giữ bản sao chương trình đang sửa và đưa mẫu vào editor → chọn ESP32, biên dịch/nạp và chọn nguồn USB Serial. Mẫu không tự ghi đè workspace. Xem [báo cáo nguồn và build từng bài](PTITCUBE_LAB_FUNCTIONAL_AUDIT_2026-10-21.md) để biết cấu hình mạng, MQTT và pin map.

Chưa chứng nhận lại phần cứng cả 32 bài trong lượt này. GPS trong nhà, RF LoRa thiếu GS, camera slave, điện áp đã hiệu chuẩn, độ bền SD và MQTT device auth cần điều kiện thiết bị/mạng tương ứng. Build và kiểm thử trình duyệt không thay cho các phép kiểm này.
