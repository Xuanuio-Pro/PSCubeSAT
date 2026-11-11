# Giáo trình Lab 1–8

Cập nhật 19/10/2026 theo nội dung người dùng cung cấp và [lộ trình PTITCube](https://github.com/PTITCube). Các repo của 44 bài thực hành đã được đối chiếu với danh sách repo công khai của tổ chức.

| Lab | Video | Tài liệu | Thực hành | Tổng hợp | Tổng số phần |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 4 | 10 | 1 | 19 |
| 2 | 2 | 2 | 4 | 1 | 9 |
| 3 | 4 | 4 | 6 | 1 | 15 |
| 4 | 5 | 3 | 14 | 1 | 23 |
| 5 | 3 | 2 | 7 | 1 | 13 |
| 6 | 2 | 1 | 0 | 1 | 4 |
| 7 | 2 | 1 | 2 | 1 | 6 |
| 8 | 2 | 2 | 1 | 1 | 6 |
| Tổng | 24 | 19 | 44 | 8 | 95 |

Video, tài liệu và từng bài thực hành xen kẽ theo thứ tự giáo trình. Lab 0 giữ ba mục. Menu máy tính hiển thị đầy đủ số phần, nhãn loại nội dung và mã bài; điện thoại dùng bộ chọn phần học. Có nút Phần trước/Phần tiếp theo và trang tổng hợp riêng.

## Nội dung và đường dẫn

- `src/data/curriculum.js` là danh mục chung cho sidebar, menu điện thoại và nội dung. Mỗi phần có ID ổn định; URL lưu ID trong `?lesson=...`, hỗ trợ tải lại và Back/Forward. ID không hợp lệ sẽ mở phần đầu của lab hiện tại.
- Mỗi bài thực hành liên kết trực tiếp tới repo PTITCube tương ứng. Không tự nạp lời giải. Tab C++ và mẫu mặc định vẫn được dùng khi tạo bài mới.
- `src/data/lesson-reading.js` cung cấp ghi chú đọc nhập môn cho 19 chủ đề tài liệu, có phần tự kiểm tra. Đây là nội dung tóm lược được biên soạn trong ứng dụng; không phải toàn bộ tài liệu gốc của repo.
- Chưa có URL video cho 24 bài giảng. Trường `videoUrl` để trống và giao diện báo chờ cập nhật; có thể bổ sung URL đúng từng mục sau. Không đánh dấu video trống là đã xem.
- API tiến độ hiện lưu cờ video/tài liệu ở mức lab. Việc mở bài thực hành không tự đánh dấu hoàn thành; menu hiển thị số phần thay vì tiến độ `0/3` giả.

## Bài làm riêng từng bài thực hành

Mã C++ và Blockly dùng khóa localStorage có mã bài, chẳng hạn `ptit:source:v1:lab:1:exercise:Lab1-06_Serial_Communication`. Đổi bài sẽ mở lại đúng bản lưu của bài đó; file tải xuống có tên theo mã bài. Nguồn dữ liệu và kết nối Serial tiếp tục dùng chung cho các bài trong lab.

Bản lưu cũ ở mức lab được phục hồi vào bài thực hành đầu tiên khi chưa có bản lưu riêng. Khóa cũ vẫn được giữ; các bài còn lại bắt đầu từ mẫu mặc định. Bản lưu trên trình duyệt chưa đồng bộ sang DB hoặc giữa các thiết bị.

## Kiểm chứng

- `npm run test:curriculum`: thứ tự/số lượng, 44 ID bài, nội dung đọc, URL/fallback, khóa lưu độc lập và tương thích khóa cũ.
- `npm run check`: lint, typecheck, schema và các bộ test liên quan đều đạt; backend có 7 test được skip theo điều kiện môi trường hiện có.
- `npm run build`: build production đạt; còn cảnh báo kích thước chunk lớn hiện có.
- Kiểm thử giao diện đã mở đủ 81 phần (đợt kiểm thử giao diện 19/10; chưa chạy lại sau khi cấu trúc lại), đối chiếu tiêu đề, tài liệu, tổng hợp và tab C++ mặc định của từng bài thực hành. Kết quả: `scratch/curriculum-ui-results.json`.
- Sửa hai bài Lab 1 bằng hai chương trình khác nhau, đổi qua lại và tải lại trang: mã được phục hồi độc lập, URL giữ đúng phần học. Đã phục hồi nội dung ban đầu sau kiểm thử.

Không nạp phần cứng trong lượt thay đổi cấu trúc giáo trình này.

## Cấu trúc lại 11/11/2026 (đồng bộ với tổ chức PTITCube)

Nguồn: các repo trong https://github.com/PTITCube (Lab1, Lab3, Lab6 và các lab liên quan đã đổi cấu trúc).

- **Lab 1** có thêm 4 bài GPIO: `Lab1-02_Control_Multiple_LEDs`, `Lab1-03_Button`, `Lab1-04_LED_Button`, `Lab1-05_7_Segment_LED`, kèm Video 1.3/Doc 1.3 (video để trống, tài liệu tóm lược từ README upstream). Các bài Serial/WiFi/Web Server dời thành `Lab1-06` đến `Lab1-10`; video/tài liệu WiFi cũ thành `video-1-4`/`document-1-4`.
- **Lab 2** đổi `Lab2-01a_Battery_GPIO` thành `Lab2-01a_Battery_I2C` (IC MAX17048, sketch lấy từ upstream); thêm bài tổng quan `Lab2-01_Detect_Battery_Voltage`.
- **Lab 3** nhận Scheduler và Watchdog từ Lab 6 (`Lab3-03_Multitasking_Scheduler`, `Lab3-04_Watchdog_And_Event`) cùng video/tài liệu RTOS và Watchdog (`video-3-3`, `video-3-4`, `document-3-2` đến `document-3-4`); thêm `Lab3-01_Save_To_MicroSD`.
- **Lab 4** nhận `Lab4-06_Camera_Multiplexer` và `document-4-3` từ Lab 7; thêm `Lab4-01`, `02`, `03`, `04` (bài tổng quan dùng thư viện, 03 là GPS raw).
- **Lab 5** thêm `Lab5-01_Send_Telemetry`, `Lab5-02_Receive_Command`.
- **Lab 6** chỉ còn lắp ráp cơ khí (không có bài thực hành).
- **Lab 7** còn `Lab7-01_Full_Satellite_Program`, `Lab7-02_RTOS_Satellite_System`.

Ánh xạ ID cũ → mới: `fastapi-backend/alembic/versions/0013_curriculum_restructure.py`. Migration đổi khóa trong `lab_progress.lesson_progress` (chuyển sang đúng hàng lab khi bài đổi lab) và có downgrade; cờ/ngày hoàn thành mức lab không bị sửa. Bản nháp trình duyệt dưới khóa cũ vẫn đọc được qua `loadDraft` (`src/components/editor/project-files.js`), trừ `Lab2-01a` vì phần cứng đã đổi. Phiên bản khóa học đã xuất bản và lớp đang dùng không bị sửa; seed tạo phiên bản mới theo hash.

Bài thực hành mới từ upstream không có log Serial bổ sung nên panel trực quan chỉ hiện dữ liệu sketch thực in; fixture `tests/fixtures/practice-serial.json` của các bài mới để trống dòng log.
