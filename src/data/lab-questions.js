// End-of-lab question outline, following the "❓ Câu hỏi kiểm tra" items of the PTITCube syllabus
// (https://github.com/PTITCube, profile README). Each checkpoint follows either a Doc or a practice group.
//
// `questions` is intentionally empty: content is authored later. A question may only carry
// what the learner sees while answering:
//   { id: 'q1', type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer',
//     prompt: '...', choices: [{ id: 'A', text: '...' }] }
// Never put correct answers or explanations here — this file ships in the browser bundle.
// Graded questions belong in the server-side Lab Test bank (AGENTS.md rule 5).

const doc = (id, label, topics) => ({ id, kind: 'doc', label, topics, exercises: [], questions: [] });
const practice = (id, label, topics, exercises) => ({ id, kind: 'practice', label, topics, exercises, questions: [] });

export const LAB_QUESTION_SETS = {
  0: {
    summary: 'Nắm vững cấu trúc tổng thể và mối tương quan phối hợp giữa các phân hệ trên vệ tinh.',
    checkpoints: [
      doc('doc-0-1', 'Câu hỏi kiểm tra Doc 0.1', 'Lịch sử CubeSat, thông số tiêu chuẩn 1U, cơ chế nhả chốt lò xo P-POD và các hiện tượng vật lý LEO (thoát khí, hàn nguội, SEU/SEL/TID, chu kỳ nhiệt 95 phút).'),
      doc('doc-0-2', 'Câu hỏi kiểm tra Doc 0.2', 'Chức năng hạt nhân, luồng dữ liệu viễn trắc/viễn lệnh và cơ chế phối hợp giữa 6 phân hệ CubeSat.'),
      practice('practice-0', 'Câu hỏi kiểm tra Thực hành', 'Nhận diện trực quan vị trí bo mạch, cổng kết nối, ăng-ten và thông số kỹ thuật từng linh kiện trên mô hình 3D.', []),
    ],
  },
  1: {
    summary: 'Hoàn thiện kỹ năng lập trình nhúng C++ cơ bản và điều khiển toàn diện các linh kiện ngoại vi của bo mạch OBC.',
    checkpoints: [
      doc('doc-1-1', 'Câu hỏi kiểm tra Doc 1.1', 'Kiến trúc lõi kép Xtensa LX6, bản đồ bộ nhớ SRAM/Flash, các chân Strapping Pins nguy hiểm (GPIO 0, 2, 12, 15) và bảng chân GPIO an toàn.'),
      doc('doc-1-2', 'Câu hỏi kiểm tra Doc 1.2', 'Quy trình biên dịch Cloud Server, cơ chế bắt tay Web Serial API của trình duyệt và tốc độ baud nạp firmware.'),
      doc('doc-1-3', 'Câu hỏi kiểm tra Doc 1.3', 'Nguyên lý diode phát quang, định luật Ohm tính điện trở hạn dòng, cấu trúc kênh LEDC và công thức tính chu kỳ xung PWM.'),
      practice('practice-1-led', 'Câu hỏi kiểm tra Thực hành LED', 'Khối chức năng mã nguồn: pinMode(), digitalWrite(), mảng chân GPIO, các hàm cấu hình PWM (ledcSetup(), ledcAttachPin(), ledcWrite()) và giải thuật điều chế Duty Cycle.',
        ['Lab1-01_Blink_LED', 'Lab1-02_Control_Multiple_LEDs', 'Lab1-03_PWM_LED']),
      doc('doc-1-4', 'Câu hỏi kiểm tra Doc 1.4', 'Mức logic hở mạch (Floating), mạch điện trở kéo lên nội và hiện tượng nảy tiếp điểm cơ khí (Contact Bounce).'),
      practice('practice-1-button', 'Câu hỏi kiểm tra Thực hành Nút Nhấn', 'Khối code đọc digitalRead(), biến trạng thái chốt (Toggle) và giải thuật lọc chống rung phần mềm với thời gian trễ kiểm tra.',
        ['Lab1-04_Button', 'Lab1-05_LED_Button']),
      doc('doc-1-5', 'Câu hỏi kiểm tra Doc 1.5', 'Thanh ghi dịch 8-bit và thanh ghi chốt (Storage Register), giản đồ xung chân DS, SH_CP, ST_CP và bảng mã Anode/Cathode chung.'),
      practice('practice-1-74hc595', 'Câu hỏi kiểm tra Thực hành 74HC595', 'Cấu trúc hàm shiftOut(), thứ tự truyền bit MSBFIRST/LSBFIRST, thao tác chốt latchPin bằng cặp lệnh LOW/HIGH và mảng mẫu byte hiển thị.',
        ['Lab1-06_7_Segment_LED']),
      doc('doc-1-6', 'Câu hỏi kiểm tra Doc 1.6', 'Khung truyền UART (Start bit, Data bits, Parity bit, Stop bit), tốc độ baud và bộ đệm phần cứng FIFO.'),
      practice('practice-1-uart', 'Câu hỏi kiểm tra Thực hành UART', 'Khối code Serial.available(), Serial.read(), cấu trúc switch-case giải mã ký tự điều khiển và kỹ thuật định dạng in ấn.',
        ['Lab1-07_Serial_Communication', 'Lab1-08_Serial_Control_LED']),
      doc('doc-1-7', 'Câu hỏi kiểm tra Doc 1.7', 'Sóng WiFi 2.4GHz, địa chỉ IP động DHCP và IP tĩnh, giao thức HTTP cổng 80 và các phương thức GET/POST.'),
      doc('doc-1-8', 'Câu hỏi kiểm tra Doc 1.8', 'Tác hại của hàm chặn delay() trong phần mềm bay, kiểu unsigned long của millis() và phép trừ chống lỗi tràn số sau 49.7 ngày.'),
      practice('practice-1-wifi', 'Câu hỏi kiểm tra Thực hành WiFi & Web Server', 'Khối code WiFi.begin(), WiFi.softAP(), đăng ký định tuyến server.on(), xử lý chuỗi phản hồi HTML và vòng lặp Non-blocking server.handleClient().',
        ['Lab1-09_WiFi_Connection', 'Lab1-10_WiFi_AP_Mode', 'Lab1-11_Web_Server_LED']),
    ],
  },
  2: {
    summary: 'Nắm vững phương pháp quản lý, tối ưu hóa và bảo vệ nguồn điện cho vệ tinh.',
    checkpoints: [
      doc('doc-2-1', 'Câu hỏi kiểm tra Doc 2.1', 'Đường đặc tính phóng điện pin Li-Po, 2 pha sạc CC/CV của TP4056, hiệu suất nguồn xung Buck/Boost, địa chỉ 7-bit 0x36 và thanh ghi 0x02 (VCELL), 0x04 (SOC) của MAX17048.'),
      practice('practice-2-max17048', 'Câu hỏi kiểm tra Thực hành Nguồn & MAX17048', 'Ghép 2 byte thành số nguyên 16-bit, hệ số phân giải 78.125 µV, hàm đóng gói getBatteryVoltage() và phương pháp phát hiện pin yếu.',
        ['Lab2-01a_Battery_I2C', 'Lab2-01b_Battery_Library']),
      doc('doc-2-2', 'Câu hỏi kiểm tra Doc 2.2', 'Công tắc hành trình ray phóng, chốt RBF, mạch Reset Brownout BOD và kỹ thuật điều khiển dòng vào hạ áp để cắt dòng tiêu thụ tĩnh của khối cảm biến.'),
      practice('practice-2-power', 'Câu hỏi kiểm tra Thực hành Tiết Kiệm Điện', 'Khối code điều khiển chân khống chế dòng vào hạ áp, quy tắc logic (0 bật / 1 ngắt), thời gian chờ ổn định điện áp ngõ ra (100 ms) và hiệu quả giảm dòng rò.',
        ['Lab2-02_Power_Saving']),
    ],
  },
  3: {
    summary: 'Thiết lập hộp đen lưu trữ dữ liệu quỹ đạo và xây dựng nền tảng phần mềm đa nhiệm tin cậy cao.',
    checkpoints: [
      doc('doc-3-1', 'Câu hỏi kiểm tra Doc 3.1', '4 đường tín hiệu SPI (MOSI, MISO, SCK, CS), cực tính và pha xung nhịp (CPOL/CPHA Mode 0), bảng phân bổ tệp FAT32 và bộ đệm 512 byte trong RAM.'),
      practice('practice-3-sd', 'Câu hỏi kiểm tra Thực hành Thẻ Nhớ MicroSD', 'Khối code SD.begin(), mở tệp với cờ FILE_APPEND, ghi chuỗi CSV timestamp,v,soc và vai trò của flush() để tránh mất dữ liệu khi mất nguồn.',
        ['Lab3-01a_MicroSD_SPI', 'Lab3-01b_MicroSD_Library']),
      doc('doc-3-2', 'Câu hỏi kiểm tra Doc 3.2', 'Kiến trúc phân tích cú pháp dòng lệnh (Lexer/Parser), tách token bằng khoảng trắng, phân tách mã lệnh và tham số điều khiển vệ tinh từ xa.'),
      practice('practice-3-cli', 'Câu hỏi kiểm tra Thực hành Shell CLI', 'Duyệt thư mục openNextFile(), đọc xuất nội dung read(), xóa tệp SD.remove() và đo dung lượng thẻ nhớ SD.usedBytes().',
        ['Lab3-02_Linux_FS_Commands']),
      doc('doc-3-3', 'Câu hỏi kiểm tra Doc 3.3', 'Định thời chiếm quyền (Preemption), cấu trúc TCB, tương tranh tài nguyên dùng chung, bài học Mars Pathfinder và kế thừa ưu tiên (Priority Inheritance) của Mutex.'),
      practice('practice-3-rtos', 'Câu hỏi kiểm tra Thực hành FreeRTOS', 'Hàm xTaskCreatePinnedToCore(), vòng lặp tác vụ for(;;), hàm nhả CPU vTaskDelay() và cặp hàm xSemaphoreTake() / xSemaphoreGive().',
        ['Lab3-03_Multitasking_Scheduler']),
      doc('doc-3-4', 'Câu hỏi kiểm tra Doc 3.4', 'Cơ chế đếm ngược của WDT, phân biệt IWDT và TWDT, quy trình "cho chó ăn" (Feed/Reset WDT).'),
      practice('practice-3-wdt-event', 'Câu hỏi kiểm tra Thực hành Watchdog & Event', 'Cấu hình esp_task_wdt_init(), đăng ký esp_task_wdt_add(), gọi định kỳ esp_task_wdt_reset() và truyền nhận dữ liệu qua hàng đợi xQueueSend() / xQueueReceive().',
        ['Lab3-04_Watchdog_Timer', 'Lab3-05_Event_Driven_Queue']),
    ],
  },
  4: {
    summary: 'Xây dựng hệ sinh thái thu thập dữ liệu đa cảm biến và tải trọng quang học hoàn chỉnh.',
    checkpoints: [
      doc('doc-4-1', 'Câu hỏi kiểm tra Doc 4.1', 'Chân Open-Drain I2C, điều kiện START/STOP trên SDA/SCL, ACK/NACK, địa chỉ 0x76 của BMP280 và công thức độ cao khí áp.'),
      practice('practice-4-bmp280', 'Câu hỏi kiểm tra Thực hành BMP280', 'Đọc chuỗi byte Wire.read(), bù phi tuyến với hệ số hiệu chuẩn (dig_T, dig_P) và tính độ cao theo công thức Hypsometric.',
        ['Lab4-01a_Environment_I2C', 'Lab4-01b_Environment_Library']),
      doc('doc-4-2', 'Câu hỏi kiểm tra Doc 4.2', 'Cấu trúc cảm biến MEMS, trôi dạt (Drift) của con quay, nhiễu tần số cao của gia tốc kế và hệ số α = 0.98 trong bộ lọc bù.'),
      practice('practice-4-imu', 'Câu hỏi kiểm tra Thực hành IMU MPU6500', 'Đánh thức MPU6500 qua PWR_MGMT_1 (0x6B), đọc burst 14 byte từ 0x3B, đổi số bù 2 sang đơn vị g và thuật toán bộ lọc bù.',
        ['Lab4-02a_IMU_I2C', 'Lab4-02b_IMU_Library']),
      doc('doc-4-3', 'Câu hỏi kiểm tra Doc 4.3', 'Ăng-ten gốm Patch, bộ khuếch đại tạp âm thấp LNA, thời gian chốt TTFF (Cold/Hot start) và cấu hình UART2 GPIO 16/17.'),
      practice('practice-4-nmea-raw', 'Câu hỏi kiểm tra Thực hành Đọc NMEA thô', 'Serial2.begin(9600), vòng đọc while(Serial2.available()) và nhận dạng bản tin $GPRMC bắt đầu bằng ký tự $.',
        ['Lab4-03a_GPS_UART', 'Lab4-03b_GPS_Library']),
      doc('doc-4-4', 'Câu hỏi kiểm tra Doc 4.4', 'Ý nghĩa từng trường $GPRMC/$GPGGA, công thức Degrees + Minutes/60.0, thuật toán Checksum XOR và ngưỡng đánh giá HDOP.'),
      practice('practice-4-nmea-decode', 'Câu hỏi kiểm tra Thực hành Giải mã NMEA', 'Máy trạng thái update(), kiểm tra điều kiện chốt vị trí và trích xuất tọa độ số thực.',
        ['Lab4-03c_GPS_PTITCube']),
      doc('doc-4-5', 'Câu hỏi kiểm tra Doc 4.5', 'Ma trận điểm ảnh CMOS, xung nhịp ngoài XCLK (10–20 MHz), nén JPEG phần cứng và cặp byte đánh dấu 0xFFD8 / 0xFFD9.'),
      practice('practice-4-camera', 'Câu hỏi kiểm tra Thực hành Camera OV2640', 'Gói lệnh chụp ảnh, đệm nhận luồng byte ảnh nhị phân qua UART và lưu dữ liệu ảnh vào bộ nhớ.',
        ['Lab4-04a_Camera_UART', 'Lab4-04b_Camera_Library']),
      doc('doc-4-6', 'Câu hỏi kiểm tra Doc 4.6', 'Nguyên nhân xung đột UART, công tắc 2 chiều trong 74HC4066, điện trở tiếp xúc R_ON và dồn kênh thời gian (TDM).'),
      practice('practice-4-mux', 'Câu hỏi kiểm tra Thực hành Multiplexer', 'Mã điều khiển chân chọn kênh HIGH/LOW, flush bộ đệm trước khi đổi kênh và phối hợp luân phiên lấy tọa độ với chụp ảnh.',
        ['Lab4-05_Camera_Multiplexer']),
      doc('doc-4-7', 'Câu hỏi kiểm tra Doc 4.7', 'Chu trình vòng lặp cảm biến tập trung, đồng bộ dấu thời gian (Timestamping) và phân bổ chu kỳ lấy mẫu cho từng cảm biến.'),
      practice('practice-4-all-sensors', 'Câu hỏi kiểm tra Thực hành Đa Cảm Biến', 'Cấu trúc dữ liệu viễn trắc tổng hợp, gom dữ liệu khí áp, quán tính, tọa độ và quản lý tài nguyên vi điều khiển.',
        ['Lab4-06_Read_All_Sensors']),
    ],
  },
  5: {
    summary: 'Hoàn thành liên kết truyền thông viễn trắc và viễn lệnh không gian hai chiều tin cậy cao.',
    checkpoints: [
      doc('doc-5-1', 'Câu hỏi kiểm tra Doc 5.1', 'Công thức suy hao không gian tự do Friis, thành phần Link Budget (EIRP, suy hao khí quyển, độ nhạy máy thu) và dịch tần Doppler băng UHF 433 MHz.'),
      doc('doc-5-2', 'Câu hỏi kiểm tra Doc 5.2', 'Trải phổ Chirp Spread Spectrum (CSS), các chân chế độ M0, M1, chân báo bận AUX và công suất phát 20 dBm (100 mW).'),
      practice('practice-5-lora', 'Câu hỏi kiểm tra Thực hành LoRa E32', 'Chờ chân AUX == HIGH, gửi gói qua UART của LoRa, cấu trúc gói tin nhị phân và kiểm tra Header/Sync Word.',
        ['Lab5-01a_Send_Telemetry_UART', 'Lab5-01b_Send_Telemetry_Library', 'Lab5-02a_Receive_Command_UART', 'Lab5-02b_Receive_Command_Library']),
      doc('doc-5-3', 'Câu hỏi kiểm tra Doc 5.3', 'Đa thức CRC-16-CCITT (0x1021), cơ chế ARQ, máy thu SDR và định dạng phần tử quỹ đạo TLE (Two-Line Element).'),
      practice('practice-5-ground', 'Câu hỏi kiểm tra Thực hành Trạm Mặt Đất', 'Xác thực CRC-16 khi nhận Downlink, đóng gói Telecommand từ mặt đất và giải mã phản hồi ACK từ vệ tinh.',
        ['Lab5-03_Ground_Station_Demo']),
    ],
  },
  6: {
    summary: 'Hoàn thiện bộ khung vật lý cho vệ tinh của bộ kit.',
    checkpoints: [
      doc('doc-6-1', 'Câu hỏi kiểm tra Doc 6.1', 'Tác động đa chiều của khung cơ khí: dẫn nhiệt thụ động (EPS), lồng Faraday suy giảm EMI (OBC), Ground Plane cho anten monopole (COM) và trục tham chiếu (ADCS/Sensors).'),
      doc('doc-6-2', 'Câu hỏi kiểm tra Doc 6.2', 'So sánh Al 6061-T6 và Al 7075-T6, Anodize Type III và Alodine Class 3, tiêu chuẩn thoát khí ASTM E595 (TML, CVCM).'),
      doc('doc-6-3', 'Câu hỏi kiểm tra Doc 6.3', 'Khoảng cách ngăn xếp PC/104, rò rỉ ảo và bu lông thông hơi, keo khóa ren Loctite 222 và giới hạn trọng tâm CoM.'),
      practice('practice-6-frame', 'Câu hỏi kiểm tra Thực hành Khung Cơ Khí', 'Thứ tự siết bu lông theo đường chéo, dung sai kích thước 1U (100 × 100 × 113.5 mm) và quy trình thẩm tra kết cấu hoàn thiện.', []),
    ],
  },
  7: {
    summary: 'Tích hợp hoàn chỉnh phần cứng và phần mềm, sẵn sàng vận hành bay thử nghiệm trên quỹ đạo giả lập.',
    checkpoints: [
      doc('doc-7-1', 'Câu hỏi kiểm tra Doc 7.1', '5 thách thức tích hợp (EMI từ LoRa vào I2C, sụt áp Brownout, bẫy nhiệt, nghẽn đường truyền) và kiến trúc Super-Loop Non-blocking.'),
      practice('practice-7-superloop', 'Câu hỏi kiểm tra Thực hành Phần mềm Bay Tuần tự', 'Cấu trúc hàm loop(), biến thời gian bất đồng bộ (lastTelemetry, lastSensorRead) và gom dữ liệu không dùng delay().',
        ['Lab7-01_Full_Satellite_Program']),
      doc('doc-7-2', 'Câu hỏi kiểm tra Doc 7.2', '30 phút im lặng vô tuyến trong STATE_BOOT, thuật toán dập quay B-dot, điều kiện chuyển STATE_POWER_SAVE khi pin dưới ngưỡng và quy trình FDIR.'),
      doc('doc-7-3', 'Câu hỏi kiểm tra Doc 7.3', 'Cửa sổ liên lạc trạm mặt đất (AOS, Data Dump, LOS) và phân bổ thời gian chu kỳ quỹ đạo LEO 95 phút.'),
      practice('practice-7-rtos', 'Câu hỏi kiểm tra Thực hành Phần mềm Bay Đa nhiệm', 'Task truyền thông ghim Core 0, Task cảm biến ghim Core 1, hàng đợi Queue giữa 2 lõi và biến mô phỏng ánh sáng mặt trời theo quỹ đạo.',
        ['Lab7-02_RTOS_Satellite_System']),
    ],
  },
  8: {
    summary: 'Hoàn tất đồ án Capstone, làm chủ quy trình thiết kế, lập trình và vận hành một sứ mệnh CubeSat độc lập.',
    checkpoints: [
      doc('doc-8-1', 'Câu hỏi kiểm tra Doc 8.1', 'Các mốc đánh giá dự án (SRR, PDR, CDR, FRR) và 4 phương pháp kiểm định MECE (Test, Analysis, Inspection, Demonstration).'),
      doc('doc-8-2', 'Câu hỏi kiểm tra Doc 8.2', 'Tiêu chí chọn widget trực quan hóa: đồng hồ cho pin, đồ thị chuỗi thời gian cho môi trường, mô hình 3D cho tư thế IMU, bản đồ Ground Track cho GPS.'),
      doc('doc-8-3', 'Câu hỏi kiểm tra Doc 8.3', 'Bài toán cốt lõi của 3 sứ mệnh: Geofencing, Store-and-Forward bằng ALOHA và chuyển tiếp phao cứu sinh LoRa băng thông hẹp.'),
      practice('practice-8-capstone', 'Câu hỏi kiểm tra Thực hành Đồ án Capstone', 'Kiến trúc mã nguồn đồ án, máy trạng thái nhiệm vụ, tối ưu băng thông truyền tin và kiểm thử chức năng toàn hệ thống.',
        ['Lab8-01_Custom_Mission']),
    ],
  },
};

export const labQuestionsUrl = labId => `/lab${labId}/questions`;
export function getLabQuestionSet(labId) { return LAB_QUESTION_SETS[labId] || null; }
