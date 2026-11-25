# Doc 3.2: Giao diện dòng lệnh và hệ điều hành

### 1. Giao diện dòng lệnh
Để phục vụ việc kiểm thử, vận hành và trút dữ liệu từ trạm mặt đất, phân hệ C&DH cài đặt một bộ phân tích cú pháp dòng lệnh tương tự hệ điều hành Linux thông qua cổng nối tiếp UART (`PTIT_Storage::handleCommand`):
- **`pwd`:** In đường dẫn thư mục làm việc hiện tại (ví dụ: `/`, `/photos`, `/hieu`).
- **`cd <path>`:** Đổi thư mục làm việc hiện tại (hỗ trợ thư mục cha `..`, thư mục gốc `/`, thư mục home `~`, đường dẫn tương đối và tuyệt đối).
- **`ls [path]`:** Duyệt cây thư mục trên thẻ MicroSD, phân loại `DIR:` và `FILE:` kèm dung lượng byte.
- **`cat <path>`:** Mở tệp tin nhật ký văn bản và in toàn bộ nội dung ra màn hình.
- **`touch <path>`:** Tạo một tệp tin mới rỗng nếu tệp chưa tồn tại.
- **`echo <text> [> | >> <file>]`:** In chuỗi văn bản hoặc chuyển hướng ghi đè (`>`) / ghi nối tiếp (`>>`) vào tệp tin.
- **`mkdir <path>`:** Tạo thư mục mới trên thẻ nhớ.
- **`rmdir <path>`:** Xóa thư mục rỗng (bảo vệ không xóa thư mục gốc `/`).
- **`rm <path>`:** Xóa bỏ tệp tin dữ liệu cũ trên thẻ nhớ (từ chối xóa nếu đường dẫn là thư mục).
- **`df`:** In tổng dung lượng, dung lượng đã dùng và dung lượng còn trống (MB).
- **`help`:** Hiển thị danh sách các lệnh được hệ thống hỗ trợ.

**Nguyên tắc hoạt động:**
- Các lệnh thay đổi trạng thái (`cd`, `mkdir`, `rmdir`, `rm`, `touch`, `echo >`) không in thông báo khi thành công. Lệnh có đầu ra hoặc gặp lỗi mới hiển thị thông tin.
- Trước khi mở tệp hoặc thư mục, gọi `SD.exists()` để kiểm tra sự tồn tại và tránh lỗi VFS.

![Kiến trúc Shell CLI và bộ điều phối FreeRTOS](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab3_cli_rtos_overview.png)

### 2. Vòng lặp tuần tự và FreeRTOS
Chương trình đơn giản có thể dùng vòng lặp tuần tự. Hệ thống nhiều tác vụ cần hệ điều hành thời gian thực như FreeRTOS:

| Tiêu chí | Vòng lặp tuần tự | FreeRTOS |
| :--- | :--- | :--- |
| **Thực thi** | Chạy lần lượt các hàm trong `loop()`. | Chia thời gian CPU cho nhiều tác vụ. |
| **Đáp ứng sự kiện** | Phụ thuộc thời gian chạy các hàm trước đó. | Tác vụ ưu tiên cao có thể chiếm CPU. |
| **Bộ nhớ** | Các hàm dùng chung một ngăn xếp. | Mỗi tác vụ có ngăn xếp riêng. |
| **Độ phức tạp** | Dễ viết, khó mở rộng khi hệ thống lớn. | Cần đồng bộ tác vụ bằng Mutex, Queue hoặc Semaphore. |

### 3. Tác vụ và bộ điều phối ưu tiên
- **Tác vụ (Task):** Mỗi chức năng độc lập của vệ tinh được đóng gói thành một luồng thực thi vô tận (ví dụ: `TaskTelemetry`, `TaskSensors`, `TaskCommand`, `TaskStorage`).
- **Mức Ưu tiên (Priority):** Mỗi tác vụ được gán một con số ưu tiên (từ 0 đến $N-1$). Con số càng lớn, độ ưu tiên càng cao.
- **Bộ điều phối ưu tiên:** Mỗi nhịp hệ thống (thường là $1\text{ ms}$), bộ điều phối kiểm tra các tác vụ sẵn sàng và cấp CPU cho tác vụ có mức ưu tiên cao nhất.
