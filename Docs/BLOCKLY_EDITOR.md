# Blockly cho PTIT CubeSat

Cập nhật: 16/10/2026.

## Sử dụng

1. Mở Lab 1–8 → **Thực hành** → **Kéo thả**. Lần đầu có bài mẫu phù hợp với lab.
2. **Khởi tạo** chạy một lần trong `setup()`. **Lặp liên tục** chạy trong `loop()`.
3. Chọn nhóm bên trái, kéo block lệnh vào một trong hai vùng. Gắn block giá trị vào ô đầu vào. Ví dụ: gắn **Điện áp pin** vào **Serial · in dòng**, hoặc vào phép so sánh của block **nếu**.
4. Sửa các lỗi phía dưới workspace. Nhấn thông báo để chọn và đưa block lỗi vào giữa màn hình. Block rời, thiếu giá trị hoặc thiếu vùng chương trình sẽ khóa biên dịch.
5. Xem **Mã nguồn C++** để đọc kết quả. Mặc định biên dịch dùng mã sinh từ Blockly. **Chỉnh sửa bản C++** tạo bản riêng; thanh trạng thái luôn chỉ rõ nguồn đang biên dịch. **Dùng mã từ block** chuyển trở lại mà vẫn giữ bản C++ riêng.
6. Chọn đúng board, **Biên dịch**, rồi dùng luồng **Nạp code** hiện có. Chỉnh mã làm firmware đã biên dịch trước đó không còn hợp lệ để nạp.

**Hoàn tác / Làm lại** hỗ trợ lịch sử trong phiên chỉnh sửa; **Sắp xếp** căn các khối và thu phóng vừa vùng nhìn. **Mở rộng** dành thêm không gian; Escape thu gọn.

Bài tự lưu riêng từng lab, trên trình duyệt và origin hiện tại. Đổi tab không hủy workspace. Tải lại trang hoặc chuyển bài giữ được dữ liệu đã lưu. **Xuất bài** tải JSON có thể nhập lại; **Tải .ino** xuất C++. Tạo bài mới/nhập bài tự tải bản cũ để giữ lại. Nhập file khác lab sẽ bị từ chối. Dữ liệu này chưa đồng bộ tài khoản hoặc giữa các máy.

## Các nhóm block

| Nhóm | Bắt đầu từ | Chức năng |
| --- | --- | --- |
| Chương trình, Arduino | Lab 1 | Setup/loop, GPIO, ADC, delay, millis, Serial |
| Nguồn EPS | Lab 2 | Khởi tạo/cập nhật, điện áp và phần trăm pin |
| Lưu trữ SD | Lab 3 | Ghi dòng văn bản hoặc số |
| Cảm biến | Lab 4 | Nhiệt độ, áp suất, IMU XYZ |
| GPS / Camera | Lab 4 | Tọa độ, fix GPS, chụp ảnh vào SD |
| LoRa | Lab 5 | Gửi và nhận chuỗi |
| WiFi / MQTT | Lab 7 | Khởi tạo và cập nhật CDH theo cấu hình thư viện firmware |
| Telemetry, điều kiện, vòng lặp, toán, văn bản, biến số | Lab 1 | JSON Serial, if/else, repeat/while/for, biểu thức, ghép chuỗi, biến kiểu số |

Biến Blockly hiện có kiểu số (`double`); văn bản được tạo bằng block văn bản/ghép chuỗi. Bộ sinh mã chỉ hỗ trợ các block hiển thị trong toolbox, không chạy JavaScript hoặc chuyển ngược C++ thành block.

## Quy tắc sinh mã

- `arduino-generator.js` dùng `Blockly.CodeGenerator`, `statementToCode` và `valueToCode`; đi theo các kết nối thực tế, giữ thứ tự và khối lồng nhau.
- Biểu thức có ngoặc rõ ràng; phép chia dùng số thực. Vòng `for` tính giới hạn/bước một lần, hỗ trợ đếm giảm, chặn bước bằng 0. Các vòng lặp nhường CPU bằng `delay(1)` để tránh chiếm hết tác vụ ESP32.
- Chỉ khai báo phân hệ được dùng. Khởi tạo phân hệ tự thêm vào setup nếu chưa có block init; init tường minh chỉ được đặt trực tiếp trong setup, mỗi phân hệ một lần. Sensor/EPS/GPS/CDH được cập nhật đầu mỗi lượt loop; có thể đặt block cập nhật bên trong vòng lặp con khi cần lấy mẫu mới.
- Tên biến C++ do generator cấp để tránh từ khóa/tên không hợp lệ; chuỗi được escape trước khi sinh C++.
- Telemetry Serial phát `device_id`, `source: hardware`, `uptimeMs` và phép đo của các phân hệ đang dùng. Adapter Serial bổ sung các trường còn thiếu theo schema chung. Không dùng uptime làm thời gian Unix. Giá trị NaN/Infinity của cảm biến được gửi là `null`.
- IMU đổi gia tốc từ m/s² sang g, gyro từ rad/s sang °/s. Áp suất hPa và từ trường µT giữ nguyên theo thư viện firmware đang dùng.
- Block khởi tạo cảm biến cho phép chọn tất cả, chỉ môi trường BMP280 hoặc chỉ IMU MPU/QMC.
- Block camera chọn MUX chân 12/14 (mặc định trên OBC) hoặc UART trực tiếp. Mỗi lần chụp dùng `captureToFile()` với tên `/photos/blockly_N.jpg` chưa tồn tại; bỏ qua cả file `.part` còn lại, không ghi đè ảnh cũ. Block này lưu vào SD, không tự truyền ảnh qua Serial. GPIO và cấu hình WiFi/MQTT cần khớp phần cứng/thư viện thực tế. Bài mẫu LED dùng chân 2; không mặc định chân này là LED cho mọi board.
- File bài giới hạn 1 MB, 500 block; được kiểm tra ở workspace tạm trước khi thay bài đang mở. Lỗi đọc localStorage không làm tự ghi đè bản lưu hỏng.

## Cấu trúc mã

- `src/components/editor/blockly-toolbox.js`: định nghĩa block, Việt hóa, phân nhóm theo lab.
- `src/components/editor/arduino-generator.js`: generator C++, validation, đơn vị telemetry.
- `src/components/editor/blockly-project.js`: bài mẫu, lưu/nhập/xuất có phiên bản.
- `src/components/editor/BlocklyEditor.jsx`: vòng đời workspace, ResizeObserver, undo/redo, lỗi.
- `src/components/editor/IDEPanel.jsx`: hai tab, nguồn biên dịch, bản C++ riêng và mở rộng.

## Kiểm chứng

`npm run test:blockly` kiểm tra bài mẫu 8 lab, lưu/đọc JSON, biểu thức và cấu trúc lồng nhau, block rời/thiếu giá trị, block bị tắt, khởi tạo, biến/vòng đếm giảm, từng loại block trong toolbox và gói telemetry qua adapter thật. Đã thêm vào `npm run check`.

`npm run test:blockly:compile` tạo mã C++ của 8 bài mẫu và chương trình chứa toàn bộ loại block, rồi biên dịch từng chương trình cho ESP32 và ESP32-S3 bằng compiler sandbox hiện có. Cần Docker đang chạy và compiler image đã được chuẩn bị. Kết quả, SHA-256 nguồn, log và binary nằm trong `scratch/blockly-smoke/`, không đưa vào Git. Script không nạp phần cứng.

`npm run test:blockly:runtime` dùng g++ trên PATH để biên dịch và thực thi C++ của bài kiểm tra logic, đối chiếu đầu ra chính xác. Arduino/Serial được thay bằng stub trên máy; kiểm tra này xác minh phép tính, điều kiện, biến và vòng lặp, không giả lập cảm biến.

Đã kiểm tra UI của cả 8 lab, kéo tách/nối block, báo lỗi và khóa biên dịch, hoàn tác/làm lại, đổi tab, phục hồi bản C++ riêng sau khi tải lại, xuất JSON và nhập lại. Lab 4 đã nạp/chạy trên ESP32 thật cho môi trường, IMU, camera và cảm biến tổng hợp; bỏ GPS theo yêu cầu. Xem phạm vi, số liệu và giới hạn trong [báo cáo kiểm thử ngày 16/10/2026](BLOCKLY_TEST_REPORT_2026-10-16.md).

Tham khảo API chính thức: [Block-code generators](https://developers.google.com/blockly/guides/create-custom-blocks/code-generation/block-code), [Save and load](https://developers.google.com/blockly/guides/configure/web/serialization).
