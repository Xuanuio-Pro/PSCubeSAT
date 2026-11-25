# Doc 8.2: Chọn và thiết kế khối hiển thị trên LMS

### 1. Chọn khối hiển thị phù hợp
Bảng điều khiển (Mission Dashboard) là giao diện duy nhất để kíp trực trạm mặt đất nắm bắt được sức khỏe của vệ tinh. Việc lựa chọn đúng loại Widget trực quan hóa cho từng đại lượng dữ liệu là yếu tố then chốt giúp tránh sai lầm trong vận hành:

| Thành phần | Dữ liệu | Mục đích |
| :--- | :--- | :--- |
| **Đồng hồ chỉ thị** | Điện áp pin, SOC, nhiệt độ | Hiển thị giá trị tức thời và ngưỡng cảnh báo. |
| **Đồ thị theo thời gian** | Điện áp, công suất, RSSI | Theo dõi xu hướng và chu kỳ nạp xả. |
| **Mô hình tư thế 3D** | Góc Roll, Pitch, Yaw từ IMU | Hiển thị tư thế vệ tinh. |
| **Bản đồ quỹ đạo mặt đất** | Vĩ độ, kinh độ, độ cao | Hiển thị đường bay và vùng phủ sóng. |
| **Cửa sổ dữ liệu thô** | Byte nhị phân, chuỗi ASCII | Kiểm tra dữ liệu, CRC-16 và lỗi giao thức. |
| **Bảng phát lệnh** | Lệnh và tham số | Phát lệnh với bước xác nhận an toàn. |
| **Thư viện ảnh** | Các mảnh dữ liệu ảnh | Ghép và hiển thị ảnh khi nhận đủ dữ liệu. |

![Kiến trúc bảng điều khiển viễn trắc thời gian thực](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab8_telemetry_dashboard.png)
