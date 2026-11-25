# Doc 5.3: Đóng gói bản tin, CRC-16 và chuẩn CCSDS

### 1. Cấu trúc khung bản tin
Để đảm bảo dữ liệu truyền qua không gian không bị xáo trộn, luồng byte được đóng gói thành các cấu trúc khung truyền tin tiêu chuẩn:

| Trường | Độ dài | Mô tả |
| :--- | :--- | :--- |
| **Preamble** | 4 byte | Chuỗi `0xAA 0xAA 0xAA 0xAA`, đồng bộ bộ thu. |
| **Sync Word** | 2 byte | `0xD3 0x91`, đánh dấu đầu gói tin. |
| **Packet Length** | 1 byte | Độ dài phần dữ liệu ($N$). |
| **Satellite ID** | 1 byte | Mã vệ tinh, ví dụ `0x42`. |
| **Packet Sequence** | 2 byte | Số thứ tự từ 0 đến 65535. |
| **Telemetry Data** | $N - 5$ byte | Điện áp, SOC, nhiệt độ, áp suất, gia tốc và tọa độ GPS. |
| **CRC-16** | 2 byte | Phát hiện lỗi dữ liệu. |

![Cấu trúc khung bản tin viễn trắc và mã kiểm tra CRC-16](https://raw.githubusercontent.com/PTITCube/PTITCube-Figs/main/png/lab5_telemetry_frame_crc.png)

### 2. Kiểm tra lỗi bằng CRC-16-CCITT
Trong không gian, nhiễu có thể làm sai một số bit dữ liệu. Phương pháp tính tổng đơn giản có thể bỏ sót lỗi khi hai lỗi bit triệt tiêu nhau.
- **Thuật toán CRC-16-CCITT:** Sử dụng đa thức sinh chuẩn quốc tế:

$$G(x) = x^{16} + x^{12} + x^5 + 1 \quad (\text{Hex: } \mathbf{0x1021})$$

  Giá trị khởi tạo thanh ghi: `0xFFFF`.
- Khi trạm mặt đất nhận được gói tin, nó thực hiện tính toán lại mã CRC trên toàn bộ chuỗi byte nhận được. Nếu mã CRC tính toán trùng khớp hoàn toàn với 2 byte CRC đính kèm ở cuối gói tin, gói tin được xác nhận là vẹn toàn 100%. Nếu sai khác dù chỉ một bit, gói tin bị loại bỏ ngay lập tức.

### 3. Kiểm soát luồng và phân mảnh gói tin
- **Cơ chế dừng và chờ (ARQ):**
  - Trạm mặt đất gửi lệnh; vệ tinh kiểm tra CRC và phản hồi `ACK` nếu hợp lệ. Trạm chỉ gửi lệnh tiếp theo sau khi nhận `ACK`. Nếu hết thời gian chờ, trạm gửi lại tối đa ba lần.
- **Chia nhỏ tệp ảnh:**
  - Một bức ảnh JPEG có dung lượng $30\text{ KB}$ không thể phát trong một gói tin duy nhất vì xác suất xảy ra lỗi trên gói tin lớn là rất cao.
  - Tệp ảnh được chia thành các mảnh 64 byte.
  - Mỗi mảnh được gắn thêm tiêu đề: `[Image_ID, Chunk_Index, Total_Chunks]`. Trạm mặt đất đón nhận từng mảnh và ráp lại thành bức ảnh hoàn chỉnh. Nếu thiếu mảnh nào, trạm chỉ cần yêu cầu phát lại đúng mảnh đó.

### 4. Chuẩn CCSDS và giao thức AX.25
- **AX.25:** Giao thức truyền gói tin vô tuyến nghiệp dư; địa chỉ gọi hiệu xác định trạm gửi và nhận.
- **CCSDS:** Bộ tiêu chuẩn truyền thông dữ liệu không gian do NASA, ESA và JAXA ban hành, gồm giao thức RF, liên kết dữ liệu và sửa lỗi như LDPC, Turbo Codes.
