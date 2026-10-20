// Introductory notes for the document slots; solved code is not preloaded.
export const READING_NOTES = {
  'document-1-1': [
    'OBC thực thi chương trình điều khiển và trao đổi dữ liệu với các phân hệ. Phân biệt chân nguồn, GND và GPIO trước khi đấu nối.',
    'UART truyền dữ liệu nối tiếp; I2C dùng SDA/SCL và địa chỉ thiết bị; SPI dùng clock, đường dữ liệu và chân chọn chip. Đối chiếu sơ đồ bo để chọn đúng chân và mức điện áp.',
    'Trong Arduino, setup() chạy sau khởi động; loop() lặp lại liên tục. Serial giúp quan sát log và nhận lệnh từ máy tính.',
  ],
  'document-1-2': [
    'Mở từng bài thực hành để viết C++ hoặc nối block trong hai vùng Khởi tạo và Lặp liên tục. Sửa C++ cập nhật ngược Blockly; chỉnh block cập nhật lại mã.',
    'Chọn đúng ESP32 hoặc ESP32-S3, biên dịch và đọc log trước khi nạp. Kết nối bo qua USB, chọn đúng cổng Serial và quan sát chương trình sau khi reset.',
    'Mỗi bài tự lưu riêng trên trình duyệt. Tải file .ino và xuất JSON Blockly để sao lưu/chuyển máy; thay đổi mã yêu cầu biên dịch lại trước khi nạp.',
  ],
  'document-1-3': [
    'WiFi Station kết nối vào mạng có sẵn; Access Point tạo mạng để thiết bị khác kết nối. Phân biệt tên mạng, địa chỉ IP và trạng thái kết nối.',
    'Máy chủ HTTP tiếp nhận request theo đường dẫn và trả response gồm mã trạng thái, header và nội dung. Trình duyệt gửi yêu cầu để đọc trạng thái hoặc điều khiển LED.',
    'Đọc địa chỉ IP trên Serial, kiểm tra máy tính ở đúng mạng. Không đưa mật khẩu WiFi thực vào kho mã hoặc báo cáo công khai.',
  ],
  'document-2-1': [
    'EPS phân phối năng lượng từ pin và nguồn sạc đến các phân hệ. Xác định điện áp định mức và yêu cầu dòng của từng tải theo tài liệu phần cứng.',
    'Điện áp ADC có thể đã qua cầu chia áp. Quy đổi theo cấu hình đo và tỷ số chia áp thực tế trước khi suy ra điện áp pin.',
    'Phần trăm pin là ước lượng phụ thuộc loại pin và thuật toán. Đối chiếu điện áp với đồng hồ và quan sát khi tải hoạt động.',
  ],
  'document-2-2': [
    'Tải hoạt động đồng thời có thể làm nguồn sụt áp. Ghi nhận điện áp và log reset để phân biệt lỗi phần mềm với vấn đề cấp nguồn.',
    'Deep sleep giảm điện năng bằng cách tạm dừng phần lớn hoạt động. Xác định nguồn đánh thức và chu kỳ lấy mẫu trước khi cho bo ngủ.',
    'Hoàn tất ghi file và truyền dữ liệu trước khi ngủ. So sánh thời gian hoạt động/ngủ với yêu cầu nhiệm vụ.',
  ],
  'document-3-1': [
    'MicroSD có thể giao tiếp qua SPI. Kiểm tra CS, SCK, MOSI, MISO và nguồn; nhiều thiết bị cùng bus cần chân chọn riêng.',
    'Hệ thống tập tin tổ chức dữ liệu theo đường dẫn, thư mục và file. Phân biệt tạo mới, ghi đè và ghi nối tiếp khi lưu log.',
    'Kiểm tra kết quả mở/ghi file, đóng hoặc flush phù hợp. Đọc lại dữ liệu và xử lý trường hợp không có thẻ; không rút nguồn khi đang ghi.',
  ],
  'document-4-1': [
    'I2C sử dụng SDA và SCL để giao tiếp với thiết bị có địa chỉ riêng. Kiểm tra nguồn, GND chung và điện trở kéo lên theo phần cứng.',
    'Đọc thanh ghi gồm chọn địa chỉ thiết bị, thanh ghi và nhận số byte tương ứng. Đối chiếu thứ tự byte, độ nhạy và đơn vị theo datasheet.',
    'So sánh cách đọc thanh ghi với thư viện PTITCube. Quan sát dữ liệu khi đứng yên và khi thay đổi môi trường/tư thế để nhận biết lỗi đo.',
  ],
  'document-4-2': [
    'GPS thường phát câu NMEA qua UART. Thu thập một dòng hoàn chỉnh trước khi tách trường và kiểm tra checksum theo định dạng module.',
    'Phân biệt thời gian, trạng thái fix, vĩ độ, kinh độ và cao độ. Đổi tọa độ NMEA đúng định dạng và dấu theo bán cầu.',
    'Chỉ dùng vị trí khi có fix hợp lệ; không coi giá trị 0 hoặc bản tin cũ là tọa độ hiện tại. Đối chiếu dữ liệu thô với thư viện.',
  ],
  'document-5-1': [
    'Đường truyền vô tuyến phụ thuộc tần số, công suất, anten và môi trường. Kiểm tra cấu hình hai đầu và hướng dẫn module trước khi truyền.',
    'Phân biệt UART giữa vi điều khiển và module với đường vô tuyến giữa hai module. Theo dõi log tại cả bên gửi và nhận.',
    'Thử bản tin ngắn có số thứ tự để đo mất gói và thời gian nhận, sau đó mới tích hợp dữ liệu cảm biến.',
  ],
  'document-5-2': [
    'Packet cần có ranh giới, loại bản tin, định danh thiết bị và payload. Hai đầu thống nhất cách mã hóa, độ dài và kiểm tra lỗi.',
    'Telemetry truyền trạng thái/giá trị đo về trạm; command gửi yêu cầu điều khiển lên vệ tinh. Kiểm tra lệnh trước khi thực thi và phản hồi kết quả xử lý.',
    'Phân biệt dữ liệu mới, đã cũ và mất kết nối. Lưu log gửi/nhận để truy vết sai lệch hoặc trùng gói.',
  ],
  'document-6-1': [
    'Khung cơ khí giữ vị trí và bảo vệ các bo. Đối chiếu kích thước, điểm bắt vít, khoảng cách cách điện và đường đi dây theo bản vẽ.',
    'Lắp từng cụm khi đã ngắt nguồn; kiểm tra vật dẫn có thể gây chạm chập và tránh kéo căng cáp.',
    'Sau lắp ráp, kiểm tra nguồn và từng phân hệ trước khi vận hành toàn bộ hệ thống.',
  ],
  'document-6-2': [
    'Tác vụ RTOS có hàm thực thi, stack và độ ưu tiên. Bộ điều phối phân chia thời gian chạy cho các tác vụ sẵn sàng.',
    'Phân tách nháy LED, lấy mẫu và truyền tin theo chu kỳ. Tránh vòng bận không nhường CPU; dùng cơ chế chờ của RTOS.',
    'Ghi thời gian thực thi và kiểm tra tác vụ ưu tiên cao có làm đói tác vụ khác hay không.',
  ],
  'document-6-3': [
    'Hai tác vụ truy cập đồng thời dữ liệu hoặc bus có thể gây race condition. Xác định tài nguyên dùng chung và vùng cần bảo vệ.',
    'Dùng mutex cho tài nguyên cần độc quyền; queue giúp truyền dữ liệu giữa tác vụ. Không giữ khóa khi chờ lâu hoặc chờ tài nguyên khác thiếu thứ tự rõ ràng.',
    'Thiết kế timeout và đường xử lý lỗi; thử tình huống mất thiết bị, lỗi truyền và tác vụ dừng bất thường.',
  ],
  'document-6-4': [
    'Watchdog phát hiện phần mềm không tiến triển trong thời gian cho phép. Chọn timeout dựa trên thời gian xử lý dài nhất đã đo.',
    'Chỉ cập nhật watchdog khi tác vụ đã hoàn thành bước kiểm tra cần thiết. Cập nhật vô điều kiện có thể che việc hệ thống bị treo.',
    'Thử gây treo có kiểm soát, đọc nguyên nhân reset và kiểm tra khả năng khởi động lại. Watchdog bổ sung phục hồi, không bảo đảm phần mềm tuyệt đối không lỗi.',
  ],
  'document-7-1': [
    'Ghép kênh cho phép dùng chung đường giao tiếp giữa nhiều thiết bị. Phần mềm cần chọn đúng kênh trước mỗi phiên trao đổi.',
    'Kiểm tra sơ đồ MUX, chân điều khiển và trạng thái mặc định; tránh hai thiết bị cùng điều khiển đường tín hiệu.',
    'Trong đa nhiệm, bảo vệ việc chọn kênh và giao tiếp bằng cùng cơ chế khóa để tác vụ khác không đổi kênh giữa phiên.',
  ],
  'document-7-2': [
    'Tách lớp truy cập phần cứng, dịch vụ phân hệ, xử lý nhiệm vụ và giao tiếp trạm. Mỗi lớp có trách nhiệm và đầu vào/đầu ra rõ ràng.',
    'Bản tuần tự xử lý công việc theo vòng lặp; bản RTOS chia tác vụ và đồng bộ dữ liệu. So sánh độ trễ, tài nguyên và khả năng phục hồi.',
    'Thống nhất đơn vị, chu kỳ lấy mẫu và quy tắc lỗi. Kiểm thử từng phân hệ rồi chạy kịch bản toàn hệ thống có ghi log.',
  ],
  'document-8-1': [
    'Bắt đầu từ yêu cầu nhiệm vụ và tiêu chí đo được. Mô tả ranh giới hệ thống, các phân hệ, luồng dữ liệu và giao diện.',
    'Dùng sơ đồ khối, trạng thái hoặc trình tự để giải thích hoạt động. Liên kết mỗi yêu cầu với phép kiểm chứng cụ thể.',
    'Theo dõi thay đổi thiết kế, giả định và kết quả kiểm thử để báo cáo có thể truy vết.',
  ],
  'document-8-2': [
    'Với vệ tinh khí tượng, xác định đại lượng đo, đơn vị, chu kỳ lấy mẫu và cách lưu/truyền dữ liệu. Với cảnh báo cháy, phân biệt tín hiệu quan sát với kết luận cần thêm bằng chứng.',
    'Dashboard cần nguồn dữ liệu, định danh thiết bị và trạng thái mới/cũ/mất kết nối rõ ràng. Không trộn dữ liệu minh họa với dữ liệu phần cứng.',
    'Chọn nhiệm vụ có tiêu chí kiểm chứng phù hợp bộ kit; chuẩn bị yêu cầu, kiến trúc, chương trình và số liệu thực nghiệm.',
  ],
};

export function lessonReadingContent(lab, lesson) {
  const notes = READING_NOTES[lesson.id] || [];
  return `# ${lesson.label}: ${lesson.title}\n\n${notes.join('\n\n')}\n\n## Tự kiểm tra\n\n- Giải thích các khái niệm bằng sơ đồ hoặc ví dụ.\n- Xác định cấu hình phần cứng và cách quan sát kết quả cho bài thực hành liên quan.\n- Ghi lại điểm chưa rõ để đối chiếu khi chạy chương trình.\n\nMục tiêu Lab ${lab.id}: ${lab.description}\n\n[Lộ trình và các kho bài thực hành PTITCube](https://github.com/PTITCube)\n`;
}
