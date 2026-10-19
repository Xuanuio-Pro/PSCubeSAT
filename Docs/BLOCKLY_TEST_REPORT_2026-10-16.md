# Kiểm thử Blockly — 16/10/2026

## Xác minh trước khi merge — 19/10/2026

Phần Blockly được tách từ nhánh làm việc MQTT sang nhánh dựa trên `main` (`2595a04`), không kèm hai commit MQTT riêng. Trên nhánh này, `npm run check`, `npm run test:blockly:runtime` và `npm run build` đều PASS. Backend có 54 test, skip 6; số test ít hơn lượt 16/10 vì không kèm 11 test của nhánh MQTT. Cảnh báo chunk trên 500 kB vẫn còn. Không nạp lại phần cứng trong lượt xuất bản này; kết quả phần cứng bên dưới là của ngày 16/10.

## Phạm vi

Kiểm tra trình soạn thảo Blockly dùng chung của Lab 1–8: cấu trúc block, sinh C++, lưu/nhập/xuất, chuyển tab, biên dịch cho hai board được hỗ trợ. Lab 0 là trang giới thiệu và không có editor (`editorPanel={null}`). Yêu cầu nạp phần cứng áp dụng cho các phần Lab 4, trừ GPS.

## Kiểm tra tự động

- `npm run check`: lint, typecheck, schema telemetry, test Blockly, flash, telemetry và backend đều qua. Backend chạy 65 test, 6 test được skip theo điều kiện môi trường.
- Sau khi bổ sung kiểm tra ổn định, `npm run test:blockly`: **14/14 nhóm PASS**. Bao gồm tất cả loại block được phép trong từng lab, nhập/xuất và sinh mã lặp lại, đổi lab không giữ tài nguyên/biến cũ; 20 lần tách/nối block không làm trùng câu lệnh.
- `npm run test:blockly:runtime`: **PASS**. Biên dịch và chạy C++ trên máy bằng g++, so sánh đúng 14 dòng kết quả của phép chia số thực, ưu tiên toán tử, lũy thừa, modulo, if/else, repeat, for đếm giảm, while/until và biến. Stub chỉ thay Arduino/Serial, không thay logic C++ được sinh.
- `npm run lint` và `npm run build`: **PASS** sau khi thêm script/test. Vite còn cảnh báo kích thước chunk trên 500 kB.

## Giao diện

Đã mở thực hành từng Lab 1–8 trên `localhost:5175`: workspace hiển thị, sinh C++ hợp lệ, nút biên dịch được bật. Chuyển sang tab C++ và trở lại Blockly ở từng lab vẫn giữ bài. Đã kiểm tra trực tiếp thao tác kéo tách chuỗi block trên Lab 8: báo lỗi block rời và vô hiệu hóa biên dịch; undo/redo phản ánh đúng; kéo nối lại khôi phục trạng thái hợp lệ. Không thấy lỗi console trong lượt thử này.

Lab 4 nhập bài `all-sensors.json`, tải C++ qua UI và đối chiếu SHA-256 với nguồn đã biên dịch/nạp: `84211dd9aa2a3c54af15da6546e9ca4ba23f6fb27219cea111b99c322ddf2407`.

Chứng cứ UI: `scratch/blockly-smoke/ui-results.json`. Kiểm tra nút biên dịch ở đây chỉ xác minh trạng thái UI; các bản build dưới đây chạy bằng dịch vụ sandbox trực tiếp, không qua tài khoản trình duyệt.

## Biên dịch firmware

Lệnh tái lập: `npm run test:blockly:compile`. Chương trình tổng hợp chứa mọi loại block được hỗ trợ để kiểm tra API C++; không nạp chương trình này lên phần cứng.

**18/18 lượt biên dịch PASS**, tiến trình kết thúc mã 0:

| Nguồn Blockly | ESP32 | ESP32-S3 |
| --- | --- | --- |
| Lab 1 | PASS | PASS |
| Lab 2 | PASS | PASS |
| Lab 3 | PASS | PASS |
| Lab 4 | PASS | PASS |
| Lab 5 | PASS | PASS |
| Lab 6 | PASS | PASS |
| Lab 7 | PASS | PASS |
| Lab 8 | PASS | PASS |
| Toàn bộ loại block | PASS | PASS |

Kết quả từng board và SHA-256 từng nguồn được ghi trong `scratch/blockly-smoke/matrix-results.json`. Log nằm ở `scratch/blockly-smoke/<fixture>-<chip>.log`; binary và manifest nằm trong thư mục cùng tên.

## Phần cứng Lab 4

Bo ESP32-D0WD-V3 revision 3.1, flash 4 MB, CP210x COM8. Đã sao lưu đầy đủ flash trước khi nạp, xác minh hash của 4 image khi nạp từng bài bằng esptool. Binary sao lưu nằm trong `scratch/lab4-blockly-hardware/firmware-before.bin` và không đưa vào Git.

| Bài Blockly | Build | Nạp + hash | Chạy Serial | Chứng cứ |
| --- | --- | --- | --- | --- |
| Môi trường | PASS | PASS | PASS, 18 giây | 16 gói có nhiệt độ và áp suất |
| IMU | PASS | PASS | PASS, 18 giây | 69 gói, đủ 9 trục acc/gyro/mag dạng số |
| Camera qua MUX | PASS | PASS | PASS, 80 giây | Lưu `/photos/blockly_0.jpg`, 12.163 byte; 77 gói uptime |
| Cảm biến tổng hợp | PASS | PASS | PASS, 20 giây | 77 gói có môi trường và IMU |

Không thấy Guru Meditation, brownout hoặc watchdog trong các khoảng ghi trên. Log camera xác nhận ảnh đã lưu; chưa tải và xem nội dung ảnh JPEG. Không thử GPS trên phần cứng. Firmware cuối cùng được nạp là bài cảm biến tổng hợp.

Sau khi người dùng kết nối lại COM8, đã kiểm tra thêm **120 giây liên tục: PASS**. Nhận 525 gói, toàn bộ 11 trường môi trường/IMU là số hữu hạn; uptime tăng liên tục từ 17.920.847 đến 18.040.843 ms, khoảng cách lớn nhất giữa hai gói là 229 ms. Không phát hiện reset, brownout hoặc watchdog trong khoảng ghi. Chứng cứ bổ sung: `scratch/lab4-blockly-hardware/soak-results.json` và `soak-serial.log`. Đây là thử nghiệm 2 phút, không phải chứng nhận chạy dài hạn.

Các sửa lỗi đi kèm: khởi tạo camera chọn MUX chân 12/14 thay vì mặc định UART trực tiếp; tên ảnh tự tăng và bỏ qua file `.jpg`/`.part` đã có; khởi tạo cảm biến chọn riêng ENV/IMU để kiểm thử độc lập.

Chứng cứ: `scratch/lab4-blockly-hardware/results.json`, các file `*-build.log`, `*-flash.log`, `*-serial.log` và nguồn `.cpp`/bài `.json` tương ứng. Có thể tạo lại bốn bài bằng `node scripts/blockly-lab4-fixtures.mjs`.

## Giới hạn của kết luận

PASS áp dụng cho các trường hợp được liệt kê, không bảo đảm mọi chương trình tùy ý do người dùng ghép đều đúng chức năng. Các lab ngoài Lab 4 được kiểm tra giao diện, sinh mã và biên dịch; chưa xác minh riêng từng phân hệ trên phần cứng (ví dụ đối tác LoRa, broker WiFi/MQTT). ESP32-S3 chỉ được biên dịch, không có bo S3 để nạp. Các bài mẫu Lab 6–8 có phần dùng chung, và fixture toàn bộ block bổ sung kiểm tra các API không có trong bài mẫu.

## Rà soát và tối ưu tiếp theo cùng ngày

- Gom đếm loại block trong validation; gom cảnh báo theo block và chỉ cập nhật cảnh báo trên UI khi nội dung thay đổi. Không quét toàn bộ danh sách lỗi cho từng block.
- Bỏ qua kết quả đọc file nếu workspace đã bị thay thế/hủy do chuyển lab; hủy callback resize đang chờ khi đóng editor.
- Bỏ prop `code` truyền ngược vào editor ở Lab 1–8 và ref DOM không dùng. Toolbar nội bộ dùng trực tiếp nguồn C++ đang được chọn; callback `setCode` vẫn cung cấp mã cho thanh thao tác của trang lab.
- Chạy lại `npm run check`, `npm run test:blockly:runtime`, `npm run build`: PASS (backend vẫn có 6 test skip). Sinh lại fixtures và đối chiếu SHA-256 với 18 build đã đạt: tất cả nguồn C++ không đổi, không cần nạp lại bo.
- Kiểm tra UI Lab 4 sau tối ưu: kéo tách block bật cảnh báo và khóa biên dịch; hoàn tác xóa cảnh báo và bật lại biên dịch.
