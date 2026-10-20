# Giáo trình Lab 1–8

Cập nhật 19/10/2026 theo nội dung người dùng cung cấp và [lộ trình PTITCube](https://github.com/PTITCube). Các repo của 32 bài thực hành đã được đối chiếu với danh sách repo công khai của tổ chức.

| Lab | Video | Tài liệu | Thực hành | Tổng hợp | Tổng số phần |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 3 | 6 | 1 | 13 |
| 2 | 2 | 2 | 3 | 1 | 8 |
| 3 | 2 | 1 | 3 | 1 | 7 |
| 4 | 5 | 2 | 9 | 1 | 17 |
| 5 | 3 | 2 | 5 | 1 | 11 |
| 6 | 4 | 4 | 2 | 1 | 11 |
| 7 | 2 | 2 | 3 | 1 | 8 |
| 8 | 2 | 2 | 1 | 1 | 6 |
| Tổng | 23 | 18 | 32 | 8 | 81 |

Video, tài liệu và từng bài thực hành xen kẽ theo thứ tự giáo trình. Lab 0 giữ ba mục. Menu máy tính hiển thị đầy đủ số phần, nhãn loại nội dung và mã bài; điện thoại dùng bộ chọn phần học. Có nút Phần trước/Phần tiếp theo và trang tổng hợp riêng.

## Nội dung và đường dẫn

- `src/data/curriculum.js` là danh mục chung cho sidebar, menu điện thoại và nội dung. Mỗi phần có ID ổn định; URL lưu ID trong `?lesson=...`, hỗ trợ tải lại và Back/Forward. ID không hợp lệ sẽ mở phần đầu của lab hiện tại.
- Mỗi bài thực hành liên kết trực tiếp tới repo PTITCube tương ứng. Không tự nạp lời giải. Tab C++ và mẫu mặc định vẫn được dùng khi tạo bài mới.
- `src/data/lesson-reading.js` cung cấp ghi chú đọc nhập môn cho 18 chủ đề tài liệu, có phần tự kiểm tra. Đây là nội dung tóm lược được biên soạn trong ứng dụng; không phải toàn bộ tài liệu gốc của repo.
- Chưa có URL video cho 23 bài giảng. Trường `videoUrl` để trống và giao diện báo chờ cập nhật; có thể bổ sung URL đúng từng mục sau. Không đánh dấu video trống là đã xem.
- API tiến độ hiện lưu cờ video/tài liệu ở mức lab. Việc mở bài thực hành không tự đánh dấu hoàn thành; menu hiển thị số phần thay vì tiến độ `0/3` giả.

## Bài làm riêng từng bài thực hành

Mã C++ và Blockly dùng khóa localStorage có mã bài, chẳng hạn `ptit:source:v1:lab:1:exercise:Lab1-02_Serial_Communication`. Đổi bài sẽ mở lại đúng bản lưu của bài đó; file tải xuống có tên theo mã bài. Nguồn dữ liệu và kết nối Serial tiếp tục dùng chung cho các bài trong lab.

Bản lưu cũ ở mức lab được phục hồi vào bài thực hành đầu tiên khi chưa có bản lưu riêng. Khóa cũ vẫn được giữ; các bài còn lại bắt đầu từ mẫu mặc định. Bản lưu trên trình duyệt chưa đồng bộ sang DB hoặc giữa các thiết bị.

## Kiểm chứng

- `npm run test:curriculum`: thứ tự/số lượng, 32 ID bài, nội dung đọc, URL/fallback, khóa lưu độc lập và tương thích khóa cũ.
- `npm run check`: lint, typecheck, schema và các bộ test liên quan đều đạt; backend có 7 test được skip theo điều kiện môi trường hiện có.
- `npm run build`: build production đạt; còn cảnh báo kích thước chunk lớn hiện có.
- Kiểm thử giao diện đã mở đủ 81 phần, đối chiếu tiêu đề, tài liệu, tổng hợp và tab C++ mặc định của từng bài thực hành. Kết quả: `scratch/curriculum-ui-results.json`.
- Sửa hai bài Lab 1 bằng hai chương trình khác nhau, đổi qua lại và tải lại trang: mã được phục hồi độc lập, URL giữ đúng phần học. Đã phục hồi nội dung ban đầu sau kiểm thử.

Không nạp phần cứng trong lượt thay đổi cấu trúc giáo trình này.
