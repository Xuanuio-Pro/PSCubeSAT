# Blockly cho PTIT CubeSat

Cập nhật: 19/10/2026.

## Sử dụng

1. Mở Lab 1–8 → **Thực hành**: tab **Mã nguồn C++** được chọn mặc định và sửa trực tiếp được. Bài mới có sẵn đúng hai khối **Khởi tạo** và **Lặp liên tục**, không đặt sẵn lời giải cho từng lab.
2. **Khởi tạo** chạy một lần trong `setup()`. **Lặp liên tục** chạy trong `loop()`. Khi cả hai khối rỗng, mã mặc định là mẫu bên dưới.
3. Chọn nhóm bên trái, kéo block lệnh vào một trong hai vùng. Gắn block giá trị vào ô đầu vào. Ví dụ: gắn **Điện áp pin** vào **Serial · in dòng**, hoặc vào phép so sánh của block **nếu**.
4. Sửa các lỗi phía dưới workspace. Nhấn thông báo để chọn và đưa block lỗi vào giữa màn hình. Block rời, thiếu giá trị hoặc thiếu vùng chương trình sẽ khóa biên dịch.
5. Sửa **Mã nguồn C++** để cập nhật ngược các block sau 350 ms ngừng gõ. Sửa block cập nhật lại C++; hai tab dùng chung một chương trình, không còn thao tác tạo bản C++ riêng.
6. Chọn đúng board, **Biên dịch**, rồi dùng luồng **Nạp code** hiện có. Chỉnh mã làm firmware đã biên dịch trước đó không còn hợp lệ để nạp.

**Hoàn tác / Làm lại** hỗ trợ lịch sử trong phiên chỉnh sửa; **Sắp xếp** căn các khối và thu phóng vừa vùng nhìn. **Mở rộng** dành thêm không gian; Escape thu gọn.

Bài tự lưu riêng từng bài thực hành trong lab, trên trình duyệt và origin hiện tại. Đổi tab không hủy workspace. Tải lại trang hoặc chuyển bài giữ được dữ liệu đã lưu. Bản lưu cũ ở mức lab được phục hồi ở bài thực hành đầu tiên; khóa cũ vẫn giữ lại. **Xuất bài** tải JSON có thể nhập lại; **Tải .ino** xuất C++, tên file theo mã bài thực hành. Tạo bài mới/nhập bài tự tải bản cũ để giữ lại. Nhập file khác lab sẽ bị từ chối. Dữ liệu này chưa đồng bộ tài khoản hoặc giữa các máy. Xem [cấu trúc giáo trình](CURRICULUM.md).

**Bài mới → Tạo bài mới** khôi phục hai khối gốc và tải bản cũ về trước. Bài đã lưu từ phiên bản trước vẫn được phục hồi kèm thông báo, không bị tự xóa. Bản C++ riêng cũ được giữ để mở lại bằng **Mở bản C++ cũ**, có sao lưu mã hiện tại trước khi chuyển. Không có lựa chọn nạp bài giải mẫu trong giao diện sinh viên. Hàm tạo mẫu từng lab chỉ dùng cho fixtures/test nội bộ.

```cpp
#include <Arduino.h>
#include <math.h>

void setup() {
  Serial.begin(115200);
}

void loop() {
  delay(1000);
}
```

## Đồng bộ C++ ↔ Blockly

`cpp-to-blockly.js` tách chuỗi/chú thích/dấu ngoặc và phạm vi setup/loop. Arduino GPIO, Serial, delay, một số lời gọi phân hệ, biểu thức số/so sánh/logic và if/else được ánh xạ sang block tương ứng. Lệnh, biểu thức, biến toàn cục, hàm, vòng lặp hoặc cấu trúc khác được giữ nguyên trong nhóm **C++ tùy chỉnh**, không tự đoán rồi bỏ qua mã. Đây là chuyển đổi biểu diễn, không phải trình biên dịch C++ đầy đủ; cú pháp/kiểu dữ liệu và API C++ được kiểm tra ở bước biên dịch.

Phép nhân/chia/chia dư giữ đúng thứ tự kết hợp và phép chia nguyên của C++; chuỗi literal giữ kiểu con trỏ khi nằm trong biểu thức so sánh. `Serial.println(value, precision/base)` giữ nguyên cả lời gọi trong block C++ tùy chỉnh. Biểu thức dài không bị bung thành quá nhiều block hoặc đệ quy sâu. Chỉ di chuyển/sắp xếp block sẽ lưu vị trí mà không sinh lại chương trình; sự kiện không thay đổi mã cũng giữ bản C++ sinh viên đã định dạng.

Khi C++ thiếu hàm, chuỗi chưa đóng, dấu ngoặc không khớp hoặc lệnh chưa hoàn chỉnh: báo **Chưa đồng bộ**, giữ workspace hợp lệ gần nhất và tạm khóa chỉnh Blockly/biên dịch để không ghi đè bản đang gõ. Sửa C++ để đồng bộ lại; **Lấy lại C++ từ block** sao lưu mã đang gõ trước khi khôi phục. Khi chuyển đổi C++ thành block, không tự thêm Serial.begin, init/update hay delay vào mã người dùng. Các lời gọi đó hiện rõ thành block khi có trong C++.

Mã sinh ra đi theo kết nối thực tế của sinh viên và tự cập nhật khi không còn lỗi cấu trúc/đầu vào; bài trống hoặc bài lỗi không cung cấp C++ để biên dịch. Validation không tự chấm đúng đáp án của đề lab: cần biên dịch và quan sát kết quả chạy để kiểm chứng chức năng.

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

Biến Blockly có kiểu số (`double`); văn bản được tạo bằng block văn bản/ghép chuỗi. C++ giữ nguyên kiểu khai báo trong các block C++ tùy chỉnh. Tên biến mới không trùng các tên đã nhập từ C++.

## Quy tắc sinh mã

- `arduino-generator.js` dùng `Blockly.CodeGenerator`, `statementToCode` và `valueToCode`; đi theo các kết nối thực tế, giữ thứ tự và khối lồng nhau.
- Biểu thức có ngoặc rõ ràng; phép chia dùng số thực. Vòng `for` tính giới hạn/bước một lần, hỗ trợ đếm giảm, chặn bước bằng 0. Các vòng lặp nhường CPU bằng `delay(1)` để tránh chiếm hết tác vụ ESP32.
- Bài tạo từ Blockly tự khai báo phân hệ dùng, thêm init nếu cần và cập nhật Sensor/EPS/GPS/CDH đầu loop. Bài chuyển từ C++ giữ nguyên các lời gọi init/update, không tự chèn thêm hoặc làm trùng khai báo. Init lặp/đặt trong điều kiện được giữ trong block C++ tùy chỉnh.
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
- `src/components/editor/cpp-to-blockly.js`: chuyển C++ sang workspace và giữ các phần chưa ánh xạ bằng block C++ tùy chỉnh.
- `src/components/editor/IDEPanel.jsx`: một chương trình dùng chung hai tab, tự lưu, trạng thái đồng bộ và mở rộng.

## Kiểm chứng

`npm run test:blockly` kiểm tra bài mẫu 8 lab, lưu/đọc JSON, biểu thức và cấu trúc lồng nhau, block rời/thiếu giá trị, block bị tắt, khởi tạo, biến/vòng đếm giảm, từng loại block trong toolbox và gói telemetry qua adapter thật. Đã thêm vào `npm run check`.

`npm run test:blockly:compile` tạo mã C++ của 8 bài mẫu và chương trình chứa toàn bộ loại block, rồi biên dịch từng chương trình cho ESP32 và ESP32-S3 bằng compiler sandbox hiện có. Cần Docker đang chạy và compiler image đã được chuẩn bị. Kết quả, SHA-256 nguồn, log và binary nằm trong `scratch/blockly-smoke/`, không đưa vào Git. Script không nạp phần cứng.

`npm run test:blockly:runtime` dùng g++ trên PATH để biên dịch và thực thi C++ của bài kiểm tra logic, đối chiếu đầu ra chính xác. Arduino/Serial được thay bằng stub trên máy; kiểm tra này xác minh phép tính, điều kiện, biến và vòng lặp, không giả lập cảm biến.

Lượt đồng bộ hai chiều ngày 19/10: 22 nhóm test Blockly PASS; runtime g++ chạy bản gốc và bản C++ → Blockly → C++ ra cùng 14 dòng mong đợi. Sáu build sandbox PASS trên ESP32/ESP32-S3: mẫu mặc định, toàn bộ block, và toàn bộ block sau chuyển đổi ngược. Kết quả ở `scratch/blockly-smoke/bidir-results.json`; tạo lại bằng `node scripts/blockly-smoke.mjs` rồi `python scripts/blockly-compile-matrix.py --bidir`. Đã kiểm tra UI sửa `delay(250)` thành block Chờ 250 ms, sửa block thành 750 ms rồi tải C++ chứa `delay(750)`. C++ thiếu ngoặc báo lỗi và khóa biên dịch; sửa lại khôi phục đồng bộ. Không nạp phần cứng trong lượt này.

Lượt rà soát tiếp theo ngày 19/10: 24 test Blockly PASS, `npm run check` và build production PASS. Sáu build sandbox được chạy lại, đều PASS và khớp SHA-256 nguồn sau sửa. UI xác nhận Sắp xếp giữ nguyên file C++ từng ký tự; sửa block Chờ 250 thành 750 cập nhật C++ và vẫn giữ phép tính/phần định dạng Serial. Sửa lớp hiển thị Mở rộng để editor không bị header/telemetry che; Escape thu gọn và bài mặc định còn đúng hai block. Runtime bổ sung đối chiếu phép chia/chia dư, kiểu chuỗi và Serial precision; cả bốn nguồn C++ biên dịch bằng g++ thành công, nhưng lượt thực thi này bị Windows Application Control chặn file `.exe`, nên chưa xác nhận PASS runtime sau sửa. Báo cáo runtime được đặt `pass: false` trước mỗi lượt để tránh dùng nhầm kết quả PASS cũ.

Đã kiểm tra UI của cả 8 lab, kéo tách/nối block, báo lỗi và khóa biên dịch, hoàn tác/làm lại, đổi tab, phục hồi bản C++ riêng sau khi tải lại, xuất JSON và nhập lại. Lab 4 đã nạp/chạy trên ESP32 thật cho môi trường, IMU, camera và cảm biến tổng hợp; bỏ GPS theo yêu cầu. Xem phạm vi, số liệu và giới hạn trong [báo cáo kiểm thử ngày 16/10/2026](BLOCKLY_TEST_REPORT_2026-10-16.md).

Tham khảo API chính thức: [Block-code generators](https://developers.google.com/blockly/guides/create-custom-blocks/code-generation/block-code), [Save and load](https://developers.google.com/blockly/guides/configure/web/serialization).
