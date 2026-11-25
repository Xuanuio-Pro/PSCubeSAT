# Doc 8.3: Đề tài đồ án cuối khóa

### Đề tài 1: Vệ tinh giám sát và cảnh báo cháy rừng
- **Mục tiêu:** Ứng dụng CubeSat 1U tích hợp Camera OV2640 và cảm biến môi trường để quan sát bề mặt Trái Đất, phát hiện sớm các đám cháy rừng, gắn nhãn tọa độ GPS và truyền cảnh báo khẩn cấp về trạm mặt đất.
- **Kỹ thuật Cốt lõi:**
  - Tự động chụp ảnh khi vệ tinh đi vào vùng địa lý đã định.
  - Phân tích không gian màu (HSV/YCbCr) hoặc mô hình học máy siêu nhẹ TFLite Micro nhận diện vùng khói lửa.
  - Nén ảnh JPEG, chia thành các gói nhỏ và truyền qua LoRa.

### Đề tài 2: Trạm vệ tinh LEO thu thập và chuyển tiếp dữ liệu nông nghiệp
- **Mục tiêu:** Xây dựng vệ tinh lưu trữ rồi chuyển tiếp dữ liệu, thu thập vi khí hậu và độ ẩm đất từ cảm biến nông nghiệp ở vùng xa, sau đó gửi về trung tâm điều hành.
- **Kỹ thuật Cốt lõi:**
  - Beacon thăm dò giúp các cảm biến mặt đất ngủ để tiết kiệm pin.
  - Thuật toán đa truy cập ngẫu nhiên ALOHA giải quyết xung đột kênh vô tuyến.
  - Cơ sở dữ liệu nhật ký trên thẻ nhớ MicroSD với cờ trạng thái chuyển tiếp (`isForwarded`) và lệnh trút dữ liệu lớn (`CMD_DUMP_AGTECH_DATA`).

### Đề tài 3: Mạng vệ tinh tìm kiếm và cứu nạn
- **Mục tiêu:** Mô phỏng mạng lưới cứu hộ không gian Cospas-Sarsat: Vệ tinh lắng nghe tín hiệu cầu cứu khẩn cấp từ các phao cứu nạn ngoài biển khơi, giải mã tức thời tọa độ định vị nạn nhân và phát cảnh báo ưu tiên cao nhất về trạm cứu hộ mặt đất.
- **Kỹ thuật Cốt lõi:**
  - Xử lý ưu tiên ngắt trước đối với gói tin có cờ `EMERGENCY_SOS_FLAG`.
  - Cấu hình độ nhạy thu cực đại (LoRa SF12, BW 125kHz) bắt tín hiệu phao cứu sinh yếu ớt từ cự ly hàng trăm kilomet.
  - Hiển thị cảnh báo SOS, phát còi và chỉ đường cứu nạn trên bảng điều khiển web.
