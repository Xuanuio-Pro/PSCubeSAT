// Lesson order follows the PTITCube syllabus README:
// video -> doc -> câu hỏi -> ... -> tổng hợp -> Lab Test. Quiz/labtest pages carry no answers.
// All 60 `quiz` items across Lab 0-8 are server-graded quiz lessons in /classes (banks keyed by lesson id);
// `checkpointId` on Lab 2-8 items stays for legacy self-review pages in LabLayout.
export const CURRICULUM = {
  "0": {
    "objective": "Nắm vững lịch sử, tiêu chuẩn kích thước CubeSat 1U, ống phóng P-POD, môi trường vật lý quỹ đạo LEO và nguyên lý 6 phân hệ cốt lõi.",
    "lessons": [
      {
        "id": "overview",
        "type": "video",
        "label": "Video 0.1",
        "title": "Tổng quan Vệ tinh Nhỏ CubeSat & Các Phân hệ Không gian"
      },
      {
        "id": "document",
        "type": "document",
        "label": "Doc 0.1",
        "title": "Tiêu chuẩn CubeSat 1U, Ống phóng P-POD & Môi trường Quỹ đạo LEO"
      },
      {
        "id": "quiz-0-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 0.1",
        "title": "Câu hỏi kiểm tra Doc 0.1",
        "description": "Trắc nghiệm lịch sử CubeSat, tiêu chuẩn 1U, cơ chế P-POD và các hiện tượng vật lý LEO (thoát khí, hàn nguội, SEU/SEL/TID, chu kỳ nhiệt)."
      },
      {
        "id": "document-0-2",
        "type": "document",
        "label": "Doc 0.2",
        "title": "Kiến trúc Hệ thống & Vai trò 6 Phân hệ Cốt lõi trên CubeSat 1U"
      },
      {
        "id": "quiz-0-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 0.2",
        "title": "Câu hỏi kiểm tra Doc 0.2",
        "description": "Trắc nghiệm chức năng cốt lõi, luồng dữ liệu viễn trắc/viễn lệnh và cơ chế phối hợp giữa 6 phân hệ."
      },
      {
        "id": "video-0-2",
        "type": "video",
        "label": "Video 0.2",
        "title": "Mô hình 3D Vệ tinh CubeSat Thời gian thực trên WebGL"
      },
      {
        "id": "components",
        "type": "components",
        "label": "Thực hành",
        "title": "Khám phá Mô hình 3D & Thông số Kỹ thuật các Phân hệ"
      },
      {
        "id": "quiz-0-3",
        "type": "quiz",
        "label": "Câu hỏi Thực hành",
        "title": "Câu hỏi kiểm tra Thực hành",
        "description": "Trắc nghiệm nhận diện vị trí bo mạch, cổng kết nối, ăng-ten và thông số kỹ thuật từng linh kiện trên mô hình 3D."
      },
      {
        "id": "summary-0",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 0",
        "description": "Nắm vững cấu trúc tổng thể và mối tương quan phối hợp giữa các phân hệ trên vệ tinh."
      },
      {
        "id": "labtest-0",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 0",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 0."
      }
    ]
  },
  "1": {
    "objective": "Làm chủ vi điều khiển ESP32-WROOM-32, môi trường Web IDE đám mây, nạp firmware qua Web Serial API, làm chủ nguyên lý và lập trình từng linh kiện ngoại vi cơ bản (LED, Nút nhấn, LED 7 đoạn 74HC595, UART, WiFi/Web Server).",
    "lessons": [
      {
        "id": "video-1-1",
        "type": "video",
        "label": "Video 1.1",
        "title": "Tổng quan Phân hệ Xử lý Trung tâm (OBC) & Vi điều khiển ESP32",
        "videoUrl": ""
      },
      {
        "id": "document-1-1",
        "type": "document",
        "label": "Doc 1.1",
        "title": "Kiến trúc Phần cứng ESP32-WROOM-32, Strapping Pins & Bản đồ Bộ nhớ"
      },
      {
        "id": "quiz-1-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.1",
        "title": "Câu hỏi kiểm tra Doc 1.1",
        "description": "Trắc nghiệm kiến trúc lõi kép Xtensa LX6, bộ nhớ SRAM/Flash, các chân Strapping Pins nguy hiểm và quy hoạch GPIO."
      },
      {
        "id": "video-1-2",
        "type": "video",
        "label": "Video 1.2",
        "title": "Biên dịch Cloud & Nạp Firmware qua Web Serial API",
        "videoUrl": ""
      },
      {
        "id": "document-1-2",
        "type": "document",
        "label": "Doc 1.2",
        "title": "Môi trường Web IDE & Giao thức Nạp Firmware qua Web Serial API"
      },
      {
        "id": "quiz-1-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.2",
        "title": "Câu hỏi kiểm tra Doc 1.2",
        "description": "Trắc nghiệm quy trình biên dịch Cloud Server, cơ chế bắt tay Web Serial API và cấu hình tốc độ nạp."
      },
      {
        "id": "doc-1-3",
        "type": "document",
        "label": "Doc 1.3",
        "title": "Nguyên lý Điều khiển GPIO & Điều chế Độ rộng Xung LEDC PWM"
      },
      {
        "id": "quiz-1-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.3",
        "title": "Câu hỏi kiểm tra Doc 1.3",
        "description": "Trắc nghiệm mạch ngõ ra Push-Pull, tính toán điện trở hạn dòng, cấu hình kênh LEDC và chu kỳ xung PWM."
      },
      {
        "id": "practice-1-led",
        "type": "practice",
        "label": "Thực hành LED",
        "title": "Thực hành Component LED",
        "description": "Thực hành lập trình điều khiển LED cơ bản, chuỗi LED và điều chế xung PWM (3 bài con).",
        "exercises": [
          {
            "id": "Lab1-01_Blink_LED",
            "label": "Lab1-01_Blink_LED",
            "title": "Lab1-01_Blink_LED: Nhấp nháy LED Heartbeat giám sát chu trình sống của bo mạch",
            "description": "Nhấp nháy LED Heartbeat giám sát chu trình sống của bo mạch",
            "exerciseCode": "Lab1-01_Blink_LED",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-01_Blink_LED"
          },
          {
            "id": "Lab1-02_Control_Multiple_LEDs",
            "label": "Lab1-02_Control_Multiple_LEDs",
            "title": "Lab1-02_Control_Multiple_LEDs: Điều khiển chuỗi LED tuần tự bằng mảng và vòng lặp",
            "description": "Điều khiển chuỗi LED tuần tự bằng mảng và vòng lặp",
            "exerciseCode": "Lab1-02_Control_Multiple_LEDs",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-02_Control_Multiple_LEDs"
          },
          {
            "id": "Lab1-03_PWM_LED",
            "label": "Lab1-03_PWM_LED",
            "title": "Lab1-03_PWM_LED: Điều chế xung PWM tạo hiệu ứng đèn thở (Breathing LED)",
            "description": "Điều chế xung PWM tạo hiệu ứng đèn thở (Breathing LED)",
            "exerciseCode": "Lab1-03_PWM_LED",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-03_PWM_LED"
          }
        ]
      },
      {
        "id": "quiz-1-4",
        "type": "quiz",
        "label": "Câu hỏi Thực hành LED",
        "title": "Câu hỏi kiểm tra Thực hành LED",
        "description": "Trắc nghiệm cấu hình pinMode(), digitalWrite(), các hàm LEDC PWM (ledcSetup(), ledcAttachPin(), ledcWrite()) và giải thuật Duty Cycle."
      },
      {
        "id": "doc-1-4",
        "type": "document",
        "label": "Doc 1.4",
        "title": "Nút nhấn Cơ học, Điện trở Pull-up & Giải thuật Lọc Rung Tiếp điểm (Debounce)"
      },
      {
        "id": "quiz-1-5",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.4",
        "title": "Câu hỏi kiểm tra Doc 1.4",
        "description": "Trắc nghiệm trạng thái Floating, điện trở kéo lên nội tâm (INPUT_PULLUP) và hiện tượng nảy tiếp điểm cơ khí."
      },
      {
        "id": "practice-1-button",
        "type": "practice",
        "label": "Thực hành Nút Nhấn",
        "title": "Thực hành Component Nút Nhấn",
        "description": "Đọc trạng thái mức logic của nút nhấn và đảo trạng thái đèn LED kết hợp chống rung (2 bài con).",
        "exercises": [
          {
            "id": "Lab1-04_Button",
            "label": "Lab1-04_Button",
            "title": "Lab1-04_Button: Đọc trạng thái mức logic của nút nhấn",
            "description": "Đọc trạng thái mức logic của nút nhấn",
            "exerciseCode": "Lab1-04_Button",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-03_Button"
          },
          {
            "id": "Lab1-05_LED_Button",
            "label": "Lab1-05_LED_Button",
            "title": "Lab1-05_LED_Button: Đảo trạng thái đèn LED bằng nút nhấn kết hợp chống rung",
            "description": "Đảo trạng thái đèn LED bằng nút nhấn kết hợp chống rung",
            "exerciseCode": "Lab1-05_LED_Button",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-04_LED_Button"
          }
        ]
      },
      {
        "id": "quiz-1-6",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Nút Nhấn",
        "title": "Câu hỏi kiểm tra Thực hành Nút Nhấn",
        "description": "Trắc nghiệm phân tích hàm digitalRead(), biến trạng thái chốt (Toggle) và giải thuật lọc chống rung phần mềm."
      },
      {
        "id": "doc-1-5",
        "type": "document",
        "label": "Doc 1.5",
        "title": "IC Dịch Bit Chốt 74HC595 & Lập trình Điều khiển LED 7 Đoạn"
      },
      {
        "id": "quiz-1-7",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.5",
        "title": "Câu hỏi kiểm tra Doc 1.5",
        "description": "Trắc nghiệm cấu tạo thanh ghi dịch/chốt 8-bit, giản đồ xung nhịp (DS, SH_CP, ST_CP) và bảng mã giải mã LED 7 đoạn."
      },
      {
        "id": "Lab1-06_7_Segment_LED",
        "type": "practice",
        "label": "Lab1-06_7_Segment_LED",
        "title": "Thực hành Component 74HC595 & LED 7 Đoạn",
        "description": "Dịch 8-bit qua IC 74HC595 hiển thị số đếm 0-9 trên LED 7 đoạn",
        "exerciseCode": "Lab1-06_7_Segment_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-05_7_Segment_LED"
      },
      {
        "id": "quiz-1-8",
        "type": "quiz",
        "label": "Câu hỏi Thực hành 74HC595",
        "title": "Câu hỏi kiểm tra Thực hành 74HC595",
        "description": "Trắc nghiệm hàm shiftOut(), thứ tự bit MSBFIRST/LSBFIRST, thao tác chốt latchPin và mảng mã byte hiển thị."
      },
      {
        "id": "doc-1-6",
        "type": "document",
        "label": "Doc 1.6",
        "title": "Giao tiếp Nối tiếp Bất đồng bộ UART & Lập trình Serial"
      },
      {
        "id": "quiz-1-9",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.6",
        "title": "Câu hỏi kiểm tra Doc 1.6",
        "description": "Trắc nghiệm cấu trúc khung truyền UART (Start, Data, Parity, Stop bits), tốc độ baud và bộ đệm phần cứng FIFO."
      },
      {
        "id": "practice-1-uart",
        "type": "practice",
        "label": "Thực hành UART",
        "title": "Thực hành Component UART",
        "description": "Truyền nhận dữ liệu qua cổng nối tiếp UART và phân tích cú pháp lệnh điều khiển bật/tắt thiết bị (2 bài con).",
        "exercises": [
          {
            "id": "Lab1-07_Serial_Communication",
            "label": "Lab1-07_Serial_Communication",
            "title": "Lab1-07_Serial_Communication: Truyền nhận dữ liệu qua cổng nối tiếp UART",
            "description": "Truyền nhận dữ liệu qua cổng nối tiếp UART",
            "exerciseCode": "Lab1-07_Serial_Communication",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-06_Serial_Communication"
          },
          {
            "id": "Lab1-08_Serial_Control_LED",
            "label": "Lab1-08_Serial_Control_LED",
            "title": "Lab1-08_Serial_Control_LED: Phân tích cú pháp lệnh Serial điều khiển bật/tắt thiết bị",
            "description": "Phân tích cú pháp lệnh Serial điều khiển bật/tắt thiết bị",
            "exerciseCode": "Lab1-08_Serial_Control_LED",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-07_Serial_Control_LED"
          }
        ]
      },
      {
        "id": "quiz-1-10",
        "type": "quiz",
        "label": "Câu hỏi Thực hành UART",
        "title": "Câu hỏi kiểm tra Thực hành UART",
        "description": "Trắc nghiệm hàm Serial.available(), Serial.read(), cấu trúc switch-case giải mã lệnh và định dạng xuất chuỗi."
      },
      {
        "id": "doc-1-7",
        "type": "document",
        "label": "Doc 1.7",
        "title": "Mạng Không dây WiFi (STA / SoftAP) & Máy chủ Web HTTP Nhúng"
      },
      {
        "id": "quiz-1-11",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.7",
        "title": "Câu hỏi kiểm tra Doc 1.7",
        "description": "Trắc nghiệm chế độ trạm STA vs điểm truy cập SoftAP, cấp phát IP, giao thức HTTP và xử lý phương thức GET/POST."
      },
      {
        "id": "doc-1-8",
        "type": "document",
        "label": "Doc 1.8",
        "title": "Kỹ thuật Định thời Non-blocking với millis() & Chống Tràn số"
      },
      {
        "id": "quiz-1-12",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.8",
        "title": "Câu hỏi kiểm tra Doc 1.8",
        "description": "Trắc nghiệm tác hại của hàm chặn delay(), kiểu dữ liệu unsigned long và phép trừ chống lỗi tràn số sau 49.7 ngày."
      },
      {
        "id": "video-1-5",
        "type": "video",
        "label": "Video 1.3",
        "title": "Kết nối WiFi & Điều khiển Thiết bị qua Web Server Nhúng",
        "videoUrl": ""
      },
      {
        "id": "practice-1-wifi",
        "type": "practice",
        "label": "Thực hành WiFi & Web Server",
        "title": "Thực hành Component WiFi & Web Server",
        "description": "Kết nối WiFi cục bộ, phát WiFi SoftAP WPA2 và dựng Web Server HTTP nhúng điều khiển thiết bị (3 bài con).",
        "exercises": [
          {
            "id": "Lab1-09_WiFi_Connection",
            "label": "Lab1-09_WiFi_Connection",
            "title": "Lab1-09_WiFi_Connection: Kết nối ESP32 vào mạng WiFi cục bộ và lấy địa chỉ IP",
            "description": "Kết nối ESP32 vào mạng WiFi cục bộ và lấy địa chỉ IP",
            "exerciseCode": "Lab1-09_WiFi_Connection",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-08_WiFi_Connection"
          },
          {
            "id": "Lab1-10_WiFi_AP_Mode",
            "label": "Lab1-10_WiFi_AP_Mode",
            "title": "Lab1-10_WiFi_AP_Mode: Cấu hình vệ tinh phát mạng WiFi SoftAP bảo mật WPA2",
            "description": "Cấu hình vệ tinh phát mạng WiFi SoftAP bảo mật WPA2",
            "exerciseCode": "Lab1-10_WiFi_AP_Mode",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-09_WiFi_AP_Mode"
          },
          {
            "id": "Lab1-11_Web_Server_LED",
            "label": "Lab1-11_Web_Server_LED",
            "title": "Lab1-11_Web_Server_LED: Dựng Web Server HTTP nhúng điều khiển thiết bị qua trình duyệt",
            "description": "Dựng Web Server HTTP nhúng điều khiển thiết bị qua trình duyệt",
            "exerciseCode": "Lab1-11_Web_Server_LED",
            "repositoryUrl": "https://github.com/PTITCube/Lab1-10_Web_Server_LED"
          }
        ]
      },
      {
        "id": "quiz-1-13",
        "type": "quiz",
        "label": "Câu hỏi Thực hành WiFi & Web Server",
        "title": "Câu hỏi kiểm tra Thực hành WiFi & Web Server",
        "description": "Trắc nghiệm cấu hình WiFi.begin(), WiFi.softAP(), hàm định tuyến server.on() và vòng lặp server.handleClient()."
      },
      {
        "id": "summary-1",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 1",
        "description": "Hoàn thiện kỹ năng lập trình nhúng C++ cơ bản và điều khiển toàn diện các linh kiện ngoại vi của bo mạch OBC."
      },
      {
        "id": "labtest-1",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Câu hỏi kiểm tra Thực hành lab-test",
        "description": "Trắc nghiệm tổng hợp lab1"
      }
    ]
  },
  "2": {
    "objective": "Nắm vững nguyên lý pin Li-Po, mạch sạc CC/CV TP4056, lập trình đọc điện áp và dung lượng pin với IC MAX17048 qua I2C, công tắc ngắt an toàn và lập trình điều khiển dòng ra vào mạch hạ áp cấp nguồn cảm biến để tiết kiệm năng lượng.",
    "lessons": [
      {
        "id": "video-2-1",
        "type": "video",
        "label": "Video 2.1",
        "title": "Tổng quan Phân hệ Nguồn (EPS) & Quản lý Năng lượng Vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-2-1",
        "type": "document",
        "label": "Doc 2.1",
        "title": "Pin Li-Po, Thuật toán Sạc CC/CV, Nguồn Xung & Giám sát Pin MAX17048 qua I2C"
      },
      {
        "id": "quiz-doc-2-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 2.1",
        "title": "Câu hỏi kiểm tra Doc 2.1",
        "description": "Trắc nghiệm đặc tính phóng pin Li-Po, 2 pha sạc CC/CV của TP4056, hiệu suất Buck/Boost và các thanh ghi VCELL, SOC của MAX17048 qua I2C.",
        "checkpointId": "doc-2-1"
      },
      {
        "id": "video-2-2",
        "type": "video",
        "label": "Video 2.2",
        "title": "Đọc Thanh ghi Điện áp và Dung lượng Pin MAX17048 qua I2C",
        "videoUrl": ""
      },
      {
        "id": "practice-2-max17048",
        "type": "practice",
        "label": "Thực hành Nguồn & MAX17048",
        "title": "Thực hành Component Nguồn & MAX17048",
        "description": "Đọc trực tiếp thanh ghi MAX17048 qua Wire.h và giám sát pin bằng thư viện PTITCube (2 bài con).",
        "exercises": [
          {
            "id": "Lab2-01a_Battery_I2C",
            "label": "Thực hành 01a",
            "title": "Lab2-01a_Battery_I2C: Đọc trực tiếp thanh ghi điện áp và dung lượng pin MAX17048 qua Wire.h",
            "description": "Đọc trực tiếp thanh ghi điện áp và dung lượng pin MAX17048 qua Wire.h",
            "exerciseCode": "Lab2-01a_Battery_I2C",
            "repositoryUrl": "https://github.com/PTITCube/Lab2-01a_Battery_I2C"
          },
          {
            "id": "Lab2-01b_Battery_Library",
            "label": "Thực hành 01b",
            "title": "Lab2-01b_Battery_Library: Giám sát thông số pin và quản lý nguồn EPS qua thư viện PTITCube",
            "description": "Giám sát thông số pin và quản lý nguồn EPS qua thư viện PTITCube",
            "exerciseCode": "Lab2-01b_Battery_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab2-01b_Battery_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-2-max17048",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Nguồn & MAX17048",
        "title": "Câu hỏi kiểm tra Thực hành Nguồn & MAX17048",
        "description": "Trắc nghiệm ghép 2 byte thành số nguyên 16-bit, hệ số phân giải 78.125 µV, hàm myEPS.getVoltage() và ngưỡng cảnh báo pin yếu.",
        "checkpointId": "practice-2-max17048"
      },
      {
        "id": "document-2-2",
        "type": "document",
        "label": "Doc 2.2",
        "title": "Cơ chế An toàn Phóng (RBF), Mạch Giám sát Brownout & Kỹ thuật Power Gating Cảm biến"
      },
      {
        "id": "quiz-doc-2-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 2.2",
        "title": "Câu hỏi kiểm tra Doc 2.2",
        "description": "Trắc nghiệm công tắc hành trình chân ray, chốt RBF, mạch Reset Brownout (BOD) và kỹ thuật điều khiển dòng vào hạ áp để triệt tiêu dòng tĩnh của cảm biến.",
        "checkpointId": "doc-2-2"
      },
      {
        "id": "Lab2-02_Power_Saving",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Thực hành Component Tiết Kiệm Điện",
        "description": "Tự động kích hoạt chế độ tiết kiệm năng lượng (Power Saving Mode) dựa trên điện áp/dung lượng pin và điều khiển mạch hạ áp qua thư viện PTIT_EPS",
        "exerciseCode": "Lab2-02_Power_Saving",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-02_Power_Saving"
      },
      {
        "id": "quiz-practice-2-power",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Tiết Kiệm Điện",
        "title": "Câu hỏi kiểm tra Thực hành Tiết Kiệm Điện",
        "description": "Trắc nghiệm điều khiển chân khống chế dòng vào hạ áp, quy tắc logic (0 bật / 1 ngắt), thời gian ổn định nguồn và hiệu quả giảm tiêu thụ điện.",
        "checkpointId": "practice-2-power"
      },
      {
        "id": "summary-2",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 2",
        "description": "Nắm vững phương pháp quản lý, tối ưu hóa và bảo vệ nguồn điện cho vệ tinh."
      },
      {
        "id": "labtest-2",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 2",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 2."
      }
    ]
  },
  "3": {
    "objective": "Nắm vững nguyên lý và lập trình giao tiếp SPI với thẻ MicroSD, xây dựng bộ phân tích lệnh Shell CLI, lập trình đa nhiệm FreeRTOS với khóa Mutex và bộ định thời Watchdog Timer.",
    "lessons": [
      {
        "id": "video-3-1",
        "type": "video",
        "label": "Video 3.1",
        "title": "Phân hệ C&DH & Hệ thống Lưu trữ Hộp Đen Dữ liệu Vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-3-1",
        "type": "document",
        "label": "Doc 3.1",
        "title": "Giao tiếp Bus SPI Tốc độ cao & Quản lý Hệ thống Tập tin FAT32 trên Thẻ MicroSD"
      },
      {
        "id": "quiz-doc-3-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 3.1",
        "title": "Câu hỏi kiểm tra Doc 3.1",
        "description": "Trắc nghiệm 4 đường tín hiệu SPI (MOSI, MISO, SCK, CS), chuẩn CPOL/CPHA Mode 0, bảng phân bổ FAT32 và vai trò hàm file.flush().",
        "checkpointId": "doc-3-1"
      },
      {
        "id": "video-3-2",
        "type": "video",
        "label": "Video 3.2",
        "title": "Thao tác Đọc/Ghi Thẻ MicroSD An toàn & Tránh Phân Mảnh Dữ liệu",
        "videoUrl": ""
      },
      {
        "id": "practice-3-sd",
        "type": "practice",
        "label": "Thực hành MicroSD",
        "title": "Thực hành Component Thẻ Nhớ MicroSD",
        "description": "Khởi tạo giao tiếp SPI với thẻ MicroSD và ghi log viễn trắc định dạng CSV tự động (2 bài con).",
        "exercises": [
          {
            "id": "Lab3-01a_MicroSD_SPI",
            "label": "Thực hành 01a",
            "title": "Lab3-01a_MicroSD_SPI: Khởi tạo phần cứng và giao tiếp thẻ MicroSD qua bus SPI",
            "description": "Khởi tạo phần cứng và giao tiếp thẻ MicroSD qua bus SPI",
            "exerciseCode": "Lab3-01a_MicroSD_SPI",
            "repositoryUrl": "https://github.com/PTITCube/Lab3-01a_MicroSD_SPI"
          },
          {
            "id": "Lab3-01b_MicroSD_Library",
            "label": "Thực hành 01b",
            "title": "Lab3-01b_MicroSD_Library: Ghi log dữ liệu viễn trắc tự động định dạng CSV có dấu thời gian",
            "description": "Ghi log dữ liệu viễn trắc tự động định dạng CSV có dấu thời gian",
            "exerciseCode": "Lab3-01b_MicroSD_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab3-01b_MicroSD_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-3-sd",
        "type": "quiz",
        "label": "Câu hỏi Thực hành MicroSD",
        "title": "Câu hỏi kiểm tra Thực hành Thẻ Nhớ MicroSD",
        "description": "Trắc nghiệm hàm SD.begin(), cờ mở tệp FILE_APPEND, định dạng chuỗi CSV và cơ chế xả đệm dataFile.flush().",
        "checkpointId": "practice-3-sd"
      },
      {
        "id": "document-3-cli",
        "type": "document",
        "label": "Doc 3.2",
        "title": "Kiến trúc Bộ Phân tích Cú pháp Lệnh Shell CLI Quản lý Tập tin trên Vệ tinh"
      },
      {
        "id": "quiz-doc-3-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 3.2",
        "title": "Câu hỏi kiểm tra Doc 3.2",
        "description": "Trắc nghiệm kiến trúc Lexer/Parser dòng lệnh, tách token khoảng trắng, mã lệnh và tham số theo triết lý Silent Success.",
        "checkpointId": "doc-3-2"
      },
      {
        "id": "Lab3-02_Linux_FS_Commands",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Thực hành Component Shell CLI",
        "description": "Xây dựng hệ thống 11 lệnh Linux quản lý tệp trên thẻ nhớ qua cổng Serial",
        "exerciseCode": "Lab3-02_Linux_FS_Commands",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-02_Linux_FS_Commands"
      },
      {
        "id": "quiz-practice-3-cli",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Shell CLI",
        "title": "Câu hỏi kiểm tra Thực hành Shell CLI",
        "description": "Trắc nghiệm duyệt thư mục file.openNextFile(), đọc tệp file.read(), xóa tệp SD.remove() và kiểm tra dung lượng SD.usedBytes().",
        "checkpointId": "practice-3-cli"
      },
      {
        "id": "video-3-3",
        "type": "video",
        "label": "Video 3.3",
        "title": "Hệ điều hành Thời gian thực (FreeRTOS) & Lập trình Đa nhiệm trên Vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-3-3",
        "type": "document",
        "label": "Doc 3.3",
        "title": "Đa nhiệm FreeRTOS, Quản lý Tác vụ, Xung đột Tài nguyên & Đồng bộ hóa bằng Mutex"
      },
      {
        "id": "quiz-doc-3-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 3.3",
        "title": "Câu hỏi kiểm tra Doc 3.3",
        "description": "Trắc nghiệm bộ điều phối chiếm quyền (Preemption), tranh chấp tài nguyên dùng chung, nghịch đảo ưu tiên (Priority Inversion) và kế thừa ưu tiên qua Mutex.",
        "checkpointId": "doc-3-3"
      },
      {
        "id": "Lab3-03_Multitasking_Scheduler",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Thực hành Component FreeRTOS Multitasking",
        "description": "Thực thi đồng thời 3 tác vụ độc lập đồng bộ hóa an toàn qua Mutex và PTIT_Scheduler",
        "exerciseCode": "Lab3-03_Multitasking_Scheduler",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-03_Multitasking_Scheduler"
      },
      {
        "id": "quiz-practice-3-rtos",
        "type": "quiz",
        "label": "Câu hỏi Thực hành FreeRTOS",
        "title": "Câu hỏi kiểm tra Thực hành FreeRTOS",
        "description": "Trắc nghiệm hàm xTaskCreatePinnedToCore(), vòng lặp for(;;), vTaskDelay() và cặp hàm khóa tài nguyên xSemaphoreTake() / xSemaphoreGive().",
        "checkpointId": "practice-3-rtos"
      },
      {
        "id": "video-3-4",
        "type": "video",
        "label": "Video 3.4",
        "title": "Tự Động Phục Hồi Lỗi Treo Hệ Thống Bằng Watchdog Timer",
        "videoUrl": ""
      },
      {
        "id": "document-3-4",
        "type": "document",
        "label": "Doc 3.4",
        "title": "Cơ chế Mạch Giám sát Phần cứng WDT & Lập trình Task Watchdog Timer (TWDT)"
      },
      {
        "id": "quiz-doc-3-4",
        "type": "quiz",
        "label": "Câu hỏi Doc 3.4",
        "title": "Câu hỏi kiểm tra Doc 3.4",
        "description": "Trắc nghiệm cơ chế đếm ngược WDT, phân biệt IWDT và TWDT, quy trình làm tươi Watchdog Timer (Feed/Reset WDT).",
        "checkpointId": "doc-3-4"
      },
      {
        "id": "Lab3-04_Watchdog_Timer",
        "type": "practice",
        "label": "Thực hành 04",
        "title": "Thực hành Component Watchdog",
        "description": "Kích hoạt Task Watchdog Timer, nạp lại định kỳ và tự động phục hồi khi hệ thống bị treo",
        "exerciseCode": "Lab3-04_Watchdog_Timer",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-04_Watchdog_And_Event"
      },
      {
        "id": "Lab3-05_Event_Driven_Queue",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Thực hành Component Hướng sự kiện (Event-Driven)",
        "description": "Xây dựng kiến trúc hướng sự kiện xử lý ngắt và viễn lệnh qua FreeRTOS Queue",
        "exerciseCode": "Lab3-05_Event_Driven_Queue",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-05_Event_Driven_Queue"
      },
      {
        "id": "quiz-practice-3-wdt-event",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Watchdog & Event",
        "title": "Câu hỏi kiểm tra Thực hành Watchdog & Event",
        "description": "Trắc nghiệm cấu hình esp_task_wdt_init(), esp_task_wdt_add(), esp_task_wdt_reset() và truyền nhận hàng đợi xQueueSend() / xQueueReceive().",
        "checkpointId": "practice-3-wdt-event"
      },
      {
        "id": "summary-3",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 3",
        "description": "Thiết lập thành công hộp đen lưu trữ dữ liệu quỹ đạo và xây dựng nền tảng phần mềm đa nhiệm tin cậy cao."
      },
      {
        "id": "labtest-3",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 3",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 3."
      }
    ]
  },
  "4": {
    "objective": "Nắm vững nguyên lý và lập trình từng cảm biến cụ thể: cảm biến khí quyển BMP280, cảm biến quán tính IMU MPU6500, module định vị GNSS L76X, tải trọng Camera OV2640 và IC chuyển mạch 74HC4066.",
    "lessons": [
      {
        "id": "video-4-1",
        "type": "video",
        "label": "Video 4.1",
        "title": "Tổng quan Phân hệ Cảm biến & Tải trọng Quang học trên Vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-4-1",
        "type": "document",
        "label": "Doc 4.1",
        "title": "Giao thức Bus I2C & Lập trình Cảm biến Khí quyển BMP280"
      },
      {
        "id": "quiz-doc-4-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.1",
        "title": "Câu hỏi kiểm tra Doc 4.1",
        "description": "Trắc nghiệm phần cứng Open-Drain, điều kiện START/STOP, địa chỉ I2C 0x76 của BMP280 và công thức tính độ cao khí áp.",
        "checkpointId": "doc-4-1"
      },
      {
        "id": "video-4-2",
        "type": "video",
        "label": "Video 4.2",
        "title": "Đọc Cảm biến Khí quyển Áp suất, Nhiệt độ & Tính Độ cao Barometric",
        "videoUrl": ""
      },
      {
        "id": "practice-4-bmp280",
        "type": "practice",
        "label": "Thực hành BMP280",
        "title": "Thực hành Component BMP280",
        "description": "Đọc hằng số hiệu chuẩn thô qua I2C và tính toán áp suất, nhiệt độ, độ cao qua thư viện PTITCube (2 bài con).",
        "exercises": [
          {
            "id": "Lab4-01a_Environment_I2C",
            "label": "Thực hành 01a",
            "title": "Lab4-01a_Environment_I2C: Đọc mảng hằng số hiệu chuẩn và dữ liệu thô từ BMP280 qua I2C",
            "description": "Đọc mảng hằng số hiệu chuẩn và dữ liệu thô từ BMP280 qua I2C",
            "exerciseCode": "Lab4-01a_Environment_I2C",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-01a_Environment_I2C"
          },
          {
            "id": "Lab4-01b_Environment_Library",
            "label": "Thực hành 01b",
            "title": "Lab4-01b_Environment_Library: Đọc và tính toán áp suất khí quyển, nhiệt độ, độ cao qua thư viện PTITCube",
            "description": "Đọc và tính toán áp suất khí quyển, nhiệt độ, độ cao qua thư viện PTITCube",
            "exerciseCode": "Lab4-01b_Environment_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-01b_Environment_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-4-bmp280",
        "type": "quiz",
        "label": "Câu hỏi Thực hành BMP280",
        "title": "Câu hỏi kiểm tra Thực hành BMP280",
        "description": "Trắc nghiệm hàm Wire.read(), bù trừ phi tuyến tính với các hệ số hiệu chuẩn (dig_T, dig_P) và công thức tính độ cao Hypsometric.",
        "checkpointId": "practice-4-bmp280"
      },
      {
        "id": "video-4-3",
        "type": "video",
        "label": "Video 4.3",
        "title": "Cảm biến Quán tính IMU 6 Trục & Thuật toán Ước lượng Góc Nghiêng",
        "videoUrl": ""
      },
      {
        "id": "document-4-imu",
        "type": "document",
        "label": "Doc 4.2",
        "title": "Cảm biến IMU 6 Trục MPU6500, Từ kế 3 Trục GY-271 & Bộ Lọc Bù (Complementary Filter)"
      },
      {
        "id": "quiz-doc-4-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.2",
        "title": "Câu hỏi kiểm tra Doc 4.2",
        "description": "Trắc nghiệm cảm biến MEMS, hiện tượng trôi dạt Gyro, công thức tính góc hướng La bàn atan2(Y, X) và hệ số bộ lọc bù α = 0.98.",
        "checkpointId": "doc-4-2"
      },
      {
        "id": "practice-4-imu",
        "type": "practice",
        "label": "Thực hành IMU MPU6500",
        "title": "Thực hành Component IMU MPU6500 & La Bàn",
        "description": "Đọc dữ liệu quán tính/từ trường qua I2C thuần và ước lượng góc nghiêng Roll, Pitch, Heading bằng bộ lọc bù (2 bài con).",
        "exercises": [
          {
            "id": "Lab4-02a_IMU_I2C",
            "label": "Thực hành 02a",
            "title": "Lab4-02a_IMU_I2C: Đọc dữ liệu gia tốc, vận tốc góc từ MPU6500 và từ trường từ GY-271 qua I2C thuần",
            "description": "Đọc dữ liệu gia tốc, vận tốc góc từ MPU6500 và từ trường từ GY-271 qua I2C thuần",
            "exerciseCode": "Lab4-02a_IMU_I2C",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-02a_IMU_I2C"
          },
          {
            "id": "Lab4-02b_IMU_Library",
            "label": "Thực hành 02b",
            "title": "Lab4-02b_IMU_Library: Cài đặt bộ lọc bù ước lượng góc nghiêng Roll, Pitch và Heading La bàn qua thư viện",
            "description": "Cài đặt bộ lọc bù ước lượng góc nghiêng Roll, Pitch và Heading La bàn qua thư viện",
            "exerciseCode": "Lab4-02b_IMU_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-02b_IMU_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-4-imu",
        "type": "quiz",
        "label": "Câu hỏi Thực hành IMU MPU6500",
        "title": "Câu hỏi kiểm tra Thực hành IMU MPU6500",
        "description": "Trắc nghiệm thanh ghi PWR_MGMT_1 (0x6B), đọc Burst 14 byte từ 0x3B, chuyển đổi số nguyên bù 2 sang đơn vị trọng trường (g) và thuật toán lọc bù.",
        "checkpointId": "practice-4-imu"
      },
      {
        "id": "video-4-4",
        "type": "video",
        "label": "Video 4.4",
        "title": "Thu nhận Tọa độ Toàn cầu Định vị GNSS từ Module L76X",
        "videoUrl": ""
      },
      {
        "id": "document-4-gnss",
        "type": "document",
        "label": "Doc 4.3",
        "title": "Module Định vị GNSS L76X & Giao tiếp UART Nhận Bản tin NMEA Thô"
      },
      {
        "id": "quiz-doc-4-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.3",
        "title": "Câu hỏi kiểm tra Doc 4.3",
        "description": "Trắc nghiệm cấu tạo ăng-ten gốm, thời gian chốt vệ tinh TTFF (Cold/Hot start) và cấu hình UART2 tốc độ 9600 bps.",
        "checkpointId": "doc-4-3"
      },
      {
        "id": "practice-4-nmea-raw",
        "type": "practice",
        "label": "Thực hành Đọc NMEA thô",
        "title": "Thực hành Đọc giá trị thô NMEA",
        "description": "Nhận luồng bản tin NMEA thô qua UART và phân loại, kiểm tra toàn vẹn Checksum XOR (2 bài con).",
        "exercises": [
          {
            "id": "Lab4-03a_GPS_UART",
            "label": "Thực hành 03a",
            "title": "Lab4-03a_GPS_UART: Nhận và xuất trực tiếp luồng bản tin NMEA thô ($GPRMC, $GPGGA) từ GNSS qua UART",
            "description": "Nhận và xuất trực tiếp luồng bản tin NMEA thô ($GPRMC, $GPGGA) từ GNSS qua UART",
            "exerciseCode": "Lab4-03a_GPS_UART",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-03a_GPS_UART"
          },
          {
            "id": "Lab4-03b_GPS_Library",
            "label": "Thực hành 03b",
            "title": "Lab4-03b_GPS_Library: Đệm dòng dữ liệu, phân loại câu tin NMEA và kiểm tra tính toàn vẹn Checksum XOR",
            "description": "Đệm dòng dữ liệu, phân loại câu tin NMEA và kiểm tra tính toàn vẹn Checksum XOR",
            "exerciseCode": "Lab4-03b_GPS_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-03b_GPS_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-4-nmea-raw",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Đọc NMEA thô",
        "title": "Câu hỏi kiểm tra Thực hành Đọc NMEA thô",
        "description": "Trắc nghiệm cấu hình Serial2.begin(9600), vòng lặp đọc byte và nhận diện bản tin $GPRMC.",
        "checkpointId": "practice-4-nmea-raw"
      },
      {
        "id": "document-4-2",
        "type": "document",
        "label": "Doc 4.4",
        "title": "Chuẩn Giao thức NMEA 0183 & Kỹ thuật Giải mã Tọa độ GPS Thập phân"
      },
      {
        "id": "quiz-doc-4-4",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.4",
        "title": "Câu hỏi kiểm tra Doc 4.4",
        "description": "Trắc nghiệm cấu trúc bản tin NMEA, công thức đổi tọa độ Độ-Phút sang Độ Thập phân, tính Checksum XOR và chỉ số HDOP.",
        "checkpointId": "doc-4-4"
      },
      {
        "id": "Lab4-03c_GPS_PTITCube",
        "type": "practice",
        "label": "Thực hành 03c",
        "title": "Thực hành Chuyển đổi NMEA thành các trường giá trị có ý nghĩa",
        "description": "Bóc tách tọa độ, độ cao, vận tốc, hướng đi và thời gian UTC qua thư viện PTITCube",
        "exerciseCode": "Lab4-03c_GPS_PTITCube",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-03c_GPS_PTITCube"
      },
      {
        "id": "quiz-practice-4-nmea-decode",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Giải mã NMEA",
        "title": "Câu hỏi kiểm tra Thực hành Giải mã NMEA",
        "description": "Trắc nghiệm máy trạng thái myGPS.update(), kiểm tra điều kiện chốt vệ tinh và trích xuất dữ liệu tọa độ số thực.",
        "checkpointId": "practice-4-nmea-decode"
      },
      {
        "id": "document-4-camera",
        "type": "document",
        "label": "Doc 4.5",
        "title": "Camera CMOS OV2640, Nén Ảnh Phần cứng JPEG & Giao thức Bắt tay UART"
      },
      {
        "id": "quiz-doc-4-5",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.5",
        "title": "Câu hỏi kiểm tra Doc 4.5",
        "description": "Trắc nghiệm ma trận điểm ảnh CMOS, xung nhịp XCLK, cơ chế nén JPEG và cặp byte đánh dấu ảnh (0xFFD8 / 0xFFD9).",
        "checkpointId": "doc-4-5"
      },
      {
        "id": "practice-4-camera",
        "type": "practice",
        "label": "Thực hành Camera OV2640",
        "title": "Thực hành Component Camera OV2640",
        "description": "Bắt tay UART chụp ảnh với ESP32-CAM và tự động lưu trữ luồng JPEG vào thẻ nhớ MicroSD (2 bài con).",
        "exercises": [
          {
            "id": "Lab4-04a_Camera_UART",
            "label": "Thực hành 04a",
            "title": "Lab4-04a_Camera_UART: Bắt tay UART chụp ảnh với ESP32-CAM và ghi trực tiếp luồng JPEG vào MicroSD",
            "description": "Bắt tay UART chụp ảnh với ESP32-CAM và ghi trực tiếp luồng JPEG vào MicroSD",
            "exerciseCode": "Lab4-04a_Camera_UART",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-04a_Camera_UART"
          },
          {
            "id": "Lab4-04b_Camera_Library",
            "label": "Thực hành 04b",
            "title": "Lab4-04b_Camera_Library: Chụp ảnh và tự động quản lý lưu trữ vào MicroSD qua thư viện PTIT_Camera",
            "description": "Chụp ảnh và tự động quản lý lưu trữ vào MicroSD qua thư viện PTIT_Camera",
            "exerciseCode": "Lab4-04b_Camera_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab4-04b_Camera_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-4-camera",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Camera OV2640",
        "title": "Câu hỏi kiểm tra Thực hành Camera OV2640",
        "description": "Trắc nghiệm gói lệnh chụp ảnh, đệm nhận luồng byte ảnh nhị phân qua UART và lưu trữ dữ liệu ảnh.",
        "checkpointId": "practice-4-camera"
      },
      {
        "id": "video-4-5",
        "type": "video",
        "label": "Video 4.5",
        "title": "Giải quyết Xung đột Cổng UART giữa Camera và GPS bằng IC Ghép kênh",
        "videoUrl": ""
      },
      {
        "id": "document-4-3",
        "type": "document",
        "label": "Doc 4.6",
        "title": "IC Khóa Chuyển mạch Tương tự 74HC4066 & Kỹ thuật Ghép kênh UART Luân phiên"
      },
      {
        "id": "quiz-doc-4-6",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.6",
        "title": "Câu hỏi kiểm tra Doc 4.6",
        "description": "Trắc nghiệm xung đột cổng UART phần cứng, cấu tạo công tắc 74HC4066, điện trở tiếp xúc R_ON và giải pháp phân chia thời gian (TDM).",
        "checkpointId": "doc-4-6"
      },
      {
        "id": "Lab4-05_Camera_Multiplexer",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Thực hành Component Multiplexer",
        "description": "Chuyển mạch luân phiên Camera & GPS bằng IC Multiplexer 74HC4066 giải quyết xung đột cổng UART",
        "exerciseCode": "Lab4-05_Camera_Multiplexer",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-06_Camera_Multiplexer"
      },
      {
        "id": "quiz-practice-4-mux",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Multiplexer",
        "title": "Câu hỏi kiểm tra Thực hành Multiplexer",
        "description": "Trắc nghiệm điều khiển chân chọn kênh GPIO HIGH/LOW, quy trình flush bộ đệm và luân phiên giữa lấy tọa độ và chụp ảnh.",
        "checkpointId": "practice-4-mux"
      },
      {
        "id": "document-4-sensors",
        "type": "document",
        "label": "Doc 4.7",
        "title": "Kiến trúc Thu thập Mạng Đa Cảm biến Đồng bộ Trong Chu trình Khép kín"
      },
      {
        "id": "quiz-doc-4-7",
        "type": "quiz",
        "label": "Câu hỏi Doc 4.7",
        "title": "Câu hỏi kiểm tra Doc 4.7",
        "description": "Trắc nghiệm chu trình vòng lặp cảm biến tập trung, chiến lược đồng bộ dấu thời gian (Timestamping) và phân bổ chu kỳ lấy mẫu.",
        "checkpointId": "doc-4-7"
      },
      {
        "id": "Lab4-06_Read_All_Sensors",
        "type": "practice",
        "label": "Thực hành 06",
        "title": "Thực hành Tích Hợp Đa Cảm Biến",
        "description": "Thu thập dữ liệu toàn bộ cảm biến (BMP280, MPU6500, QMC5883, GPS) và đóng gói gói tin Telemetry",
        "exerciseCode": "Lab4-06_Read_All_Sensors",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-05_Read_All_Sensors"
      },
      {
        "id": "quiz-practice-4-all-sensors",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Đa Cảm Biến",
        "title": "Câu hỏi kiểm tra Thực hành Đa Cảm Biến",
        "description": "Trắc nghiệm cấu trúc dữ liệu struct TelemetryPacket, gom dữ liệu khí áp, quán tính, tọa độ và tối ưu tài nguyên.",
        "checkpointId": "practice-4-all-sensors"
      },
      {
        "id": "summary-4",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 4",
        "description": "Xây dựng thành công hệ sinh thái thu thập dữ liệu đa cảm biến và tải trọng quang học hoàn chỉnh."
      },
      {
        "id": "labtest-4",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 4",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 4."
      }
    ]
  },
  "5": {
    "objective": "Nắm vững lý thuyết truyền sóng không gian, tính toán cân bằng tuyến Link Budget, lập trình module LoRa Ebyte E32, đóng gói khung bản tin viễn trắc với mã CRC-16 và xây dựng trạm mặt đất thu nhận tín hiệu.",
    "lessons": [
      {
        "id": "video-5-1",
        "type": "video",
        "label": "Video 5.1",
        "title": "Tổng quan Phân hệ Truyền thông (COM) Băng tần UHF trên Vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-5-1",
        "type": "document",
        "label": "Doc 5.1",
        "title": "Lý thuyết Sóng Vô tuyến Không gian, Cân bằng Tuyến Link Budget & Dịch tần Doppler"
      },
      {
        "id": "quiz-doc-5-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 5.1",
        "title": "Câu hỏi kiểm tra Doc 5.1",
        "description": "Trắc nghiệm công thức suy hao không gian tự do Friis, các thông số Link Budget (EIRP, độ nhạy thu) và độ lệch tần Doppler băng UHF 433MHz trên quỹ đạo LEO.",
        "checkpointId": "doc-5-1"
      },
      {
        "id": "document-5-lora",
        "type": "document",
        "label": "Doc 5.2",
        "title": "Công nghệ Trải phổ LoRa CSS & Lập trình Module Ebyte E32-433T20D"
      },
      {
        "id": "quiz-doc-5-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 5.2",
        "title": "Câu hỏi kiểm tra Doc 5.2",
        "description": "Trắc nghiệm kỹ thuật trải phổ Chirp Spread Spectrum (CSS), các chân chế độ M0/M1, chân tín hiệu bận AUX và cấu hình công suất phát.",
        "checkpointId": "doc-5-2"
      },
      {
        "id": "video-5-2",
        "type": "video",
        "label": "Video 5.2",
        "title": "Cấu hình Tham số Vô tuyến & Kỹ thuật Đóng gói Bản tin Viễn trắc",
        "videoUrl": ""
      },
      {
        "id": "practice-5-lora",
        "type": "practice",
        "label": "Thực hành LoRa E32",
        "title": "Thực hành Component LoRa E32",
        "description": "Cấu hình LoRa E32 phát telemetry, đóng gói CRC-16, nhận chuỗi đồng bộ Sync Word và giải mã viễn lệnh Telecommand (4 bài con).",
        "exercises": [
          {
            "id": "Lab5-01a_Send_Telemetry_UART",
            "label": "Thực hành 01a",
            "title": "Lab5-01a_Send_Telemetry_UART: Cấu hình tham số LoRa E32 và phát luồng dữ liệu viễn trắc qua UART",
            "description": "Cấu hình tham số LoRa E32 và phát luồng dữ liệu viễn trắc qua UART",
            "exerciseCode": "Lab5-01a_Send_Telemetry_UART",
            "repositoryUrl": "https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART"
          },
          {
            "id": "Lab5-01b_Send_Telemetry_Library",
            "label": "Thực hành 01b",
            "title": "Lab5-01b_Send_Telemetry_Library: Đóng gói bản tin Telemetry chuẩn kèm mã kiểm tra CRC-16 tự động",
            "description": "Đóng gói bản tin Telemetry chuẩn kèm mã kiểm tra CRC-16 tự động",
            "exerciseCode": "Lab5-01b_Send_Telemetry_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab5-01b_Send_Telemetry_Library"
          },
          {
            "id": "Lab5-02a_Receive_Command_UART",
            "label": "Thực hành 02a",
            "title": "Lab5-02a_Receive_Command_UART: Thu nhận luồng dữ liệu không gian và kiểm tra chuỗi đồng bộ Sync Word",
            "description": "Thu nhận luồng dữ liệu không gian và kiểm tra chuỗi đồng bộ Sync Word",
            "exerciseCode": "Lab5-02a_Receive_Command_UART",
            "repositoryUrl": "https://github.com/PTITCube/Lab5-02a_Receive_Command_UART"
          },
          {
            "id": "Lab5-02b_Receive_Command_Library",
            "label": "Thực hành 02b",
            "title": "Lab5-02b_Receive_Command_Library: Giải mã viễn lệnh Telecommand từ Trái Đất và điều khiển cơ cấu chấp hành",
            "description": "Giải mã viễn lệnh Telecommand từ Trái Đất và điều khiển cơ cấu chấp hành",
            "exerciseCode": "Lab5-02b_Receive_Command_Library",
            "repositoryUrl": "https://github.com/PTITCube/Lab5-02b_Receive_Command_Library"
          }
        ]
      },
      {
        "id": "quiz-practice-5-lora",
        "type": "quiz",
        "label": "Câu hỏi Thực hành LoRa E32",
        "title": "Câu hỏi kiểm tra Thực hành LoRa E32",
        "description": "Trắc nghiệm kiểm tra chân AUX == HIGH, gửi dữ liệu qua SerialLoRa.write(), cấu trúc khung tin và xác thực Header/Sync Word.",
        "checkpointId": "practice-5-lora"
      },
      {
        "id": "document-5-2",
        "type": "document",
        "label": "Doc 5.3",
        "title": "Đóng gói Bản tin Telemetry, Kiểm lỗi CRC-16 & Kiến trúc Trạm Mặt Đất"
      },
      {
        "id": "quiz-doc-5-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 5.3",
        "title": "Câu hỏi kiểm tra Doc 5.3",
        "description": "Trắc nghiệm đa thức sinh CRC-16-CCITT (0x1021), cơ chế Stop-and-Wait ARQ, máy thu vô tuyến định nghĩa bằng phần mềm (SDR) và phần tử quỹ đạo TLE.",
        "checkpointId": "doc-5-3"
      },
      {
        "id": "video-5-3",
        "type": "video",
        "label": "Video 5.3",
        "title": "Xây dựng & Vận hành Trạm Mặt Đất Thu Phát Tín hiệu Thực tế",
        "videoUrl": ""
      },
      {
        "id": "Lab5-03_Ground_Station_Demo",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Thực hành Trạm Mặt Đất",
        "description": "Thiết lập luồng giao tiếp vô tuyến hai chiều hoàn chỉnh giữa vệ tinh và trạm mặt đất",
        "exerciseCode": "Lab5-03_Ground_Station_Demo",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-03_Satellite_Comm_System"
      },
      {
        "id": "quiz-practice-5-ground",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Trạm Mặt Đất",
        "title": "Câu hỏi kiểm tra Thực hành Trạm Mặt Đất",
        "description": "Trắc nghiệm xác thực mã CRC-16 bản tin Downlink, đóng gói Telecommand và giải mã phản hồi ACK từ vệ tinh.",
        "checkpointId": "practice-5-ground"
      },
      {
        "id": "summary-5",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 5",
        "description": "Hoàn thành liên kết truyền thông viễn trắc và viễn lệnh không gian hai chiều tin cậy cao."
      },
      {
        "id": "labtest-5",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 5",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 5."
      }
    ]
  },
  "6": {
    "objective": "Hiểu rõ vai trò đa chiều của khung cơ khí, tiêu chuẩn vật liệu nhôm hàng không Al 6061-T6, xử lý bề mặt Anodize Type III / Alodine, ngăn xếp PC/104, bu lông thông hơi và trực tiếp lắp ráp hoàn thiện khung vệ tinh của bộ kit.",
    "lessons": [
      {
        "id": "video-6-1",
        "type": "video",
        "label": "Video 6.1",
        "title": "Tổng quan Phân hệ Cấu trúc Cơ khí (Structure) & Bảo vệ Vệ tinh Trong Không gian",
        "videoUrl": ""
      },
      {
        "id": "document-6-1",
        "type": "document",
        "label": "Doc 6.1",
        "title": "Vai trò Khung Cơ khí & Tác động Đa chiều Lên Các Phân hệ trên CubeSat"
      },
      {
        "id": "quiz-doc-6-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 6.1",
        "title": "Câu hỏi kiểm tra Doc 6.1",
        "description": "Trắc nghiệm tác động đa chiều của khung: tản nhiệt thụ động (EPS), lồng Faraday chắn nhiễu EMI (OBC), mặt đất phản xạ Ground Plane (COM) và hệ quy chiếu tọa độ (ADCS/Sensors).",
        "checkpointId": "doc-6-1"
      },
      {
        "id": "document-6-2",
        "type": "document",
        "label": "Doc 6.2",
        "title": "Hợp kim Nhôm Hàng không, Công nghệ Xử lý Bề mặt & Tiêu chuẩn Thoát khí ASTM E595"
      },
      {
        "id": "quiz-doc-6-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 6.2",
        "title": "Câu hỏi kiểm tra Doc 6.2",
        "description": "Trắc nghiệm so sánh Al 6061-T6 vs Al 7075-T6, lớp Anodize Type III cách điện chống hàn nguội, lớp Alodine tiếp mass vỏ và tiêu chuẩn thoát khí ASTM E595 (TML và CVCM).",
        "checkpointId": "doc-6-2"
      },
      {
        "id": "document-6-3",
        "type": "document",
        "label": "Doc 6.3",
        "title": "Tiêu chuẩn Ngăn xếp Bo mạch PC/104, Bu lông Thông hơi & Cân đối Khối lượng (Mass Budget)"
      },
      {
        "id": "quiz-doc-6-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 6.3",
        "title": "Câu hỏi kiểm tra Doc 6.3",
        "description": "Trắc nghiệm khoảng cách ngăn xếp PC/104, hiện tượng rò rỉ ảo do bẫy khí, bu lông thông hơi, keo khóa ren Loctite 222 và cân bằng trọng tâm CoM trong phạm vi ±20 mm.",
        "checkpointId": "doc-6-3"
      },
      {
        "id": "video-6-2",
        "type": "video",
        "label": "Video 6.2",
        "title": "Hướng dẫn Quy trình Lắp ráp Khung Cơ khí CubeSat 1U của Bộ Kit",
        "videoUrl": ""
      },
      {
        "id": "assembly-6",
        "type": "assembly",
        "label": "Thực hành",
        "title": "Lắp ráp khung cơ khí theo hướng dẫn và kiểm tra dung sai kết cấu thực tế"
      },
      {
        "id": "quiz-practice-6-frame",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Khung Cơ Khí",
        "title": "Câu hỏi kiểm tra Thực hành Khung Cơ Khí",
        "description": "Trắc nghiệm thứ tự siết bu lông theo đường chéo, kiểm tra dung sai kích thước 1U (100 × 100 × 113.5 mm) và quy trình nghiệm thu vật lý.",
        "checkpointId": "practice-6-frame"
      },
      {
        "id": "summary-6",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 6",
        "description": "Hoàn thiện bộ khung vật lý cho vệ tinh của bộ kit."
      },
      {
        "id": "labtest-6",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 6",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 6."
      }
    ]
  },
  "7": {
    "objective": "Nắm vững phương pháp giải quyết 5 thách thức tích hợp đa phân hệ, lập trình phần mềm bay tuần tự Non-blocking, lập trình hệ thống đa nhiệm FreeRTOS, cài đặt máy trạng thái hữu hạn sứ mệnh (Mission FSM) và mô phỏng chu kỳ quỹ đạo 95 phút.",
    "lessons": [
      {
        "id": "video-7-1",
        "type": "video",
        "label": "Video 7.1",
        "title": "Tổng quan Bài toán Tích hợp Hệ thống Toàn diện (System Integration) trên Vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-7-1",
        "type": "document",
        "label": "Doc 7.1",
        "title": "5 Thách thức Tích hợp Hệ thống 1U & Kiến trúc Phần mềm Bay Tuần tự Non-blocking"
      },
      {
        "id": "quiz-doc-7-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 7.1",
        "title": "Câu hỏi kiểm tra Doc 7.1",
        "description": "Trắc nghiệm 5 thách thức tích hợp (nhiễu EMI cao tần từ LoRa, sụt áp Brownout, bẫy nhiệt chân không, nghẽn đường truyền) và kiến trúc Super-Loop Non-blocking.",
        "checkpointId": "doc-7-1"
      },
      {
        "id": "Lab7-01_Full_Satellite_Program",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Thực hành Phần mềm Bay Tuần tự",
        "description": "Phần mềm bay tích hợp chạy theo vòng lặp tuần tự Non-blocking kết hợp millis()",
        "exerciseCode": "Lab7-01_Full_Satellite_Program",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-01_Full_Satellite_Program"
      },
      {
        "id": "quiz-practice-7-superloop",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Phần mềm Bay Tuần tự",
        "title": "Câu hỏi kiểm tra Thực hành Phần mềm Bay Tuần tự",
        "description": "Trắc nghiệm cấu trúc hàm loop(), các biến cờ thời gian bất đồng bộ (lastTelemetry, lastSensorRead) và cơ chế gom dữ liệu không dùng delay().",
        "checkpointId": "practice-7-superloop"
      },
      {
        "id": "document-7-2",
        "type": "document",
        "label": "Doc 7.2",
        "title": "Kiến trúc Phân lớp Phần mềm Bay (FSW), Máy Trạng thái Sứ mệnh & Cơ chế Tự phục hồi FDIR"
      },
      {
        "id": "quiz-doc-7-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 7.2",
        "title": "Câu hỏi kiểm tra Doc 7.2",
        "description": "Trắc nghiệm quy định 30 phút im lặng vô tuyến trong STATE_BOOT, thuật toán dập quay B-dot, ngưỡng chuyển trạng thái STATE_POWER_SAVE và quy trình phục hồi FDIR.",
        "checkpointId": "doc-7-2"
      },
      {
        "id": "document-7-3",
        "type": "document",
        "label": "Doc 7.3",
        "title": "Sổ tay Vận hành Bay (FOM) & Mô phỏng Chu kỳ Quỹ đạo LEO 95 Phút"
      },
      {
        "id": "quiz-doc-7-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 7.3",
        "title": "Câu hỏi kiểm tra Doc 7.3",
        "description": "Trắc nghiệm cửa sổ liên lạc trạm mặt đất (AOS, Data Dump, LOS) và mô hình phân bổ chu kỳ quỹ đạo LEO (60 phút ban ngày / 35 phút vùng tối).",
        "checkpointId": "doc-7-3"
      },
      {
        "id": "video-7-2",
        "type": "video",
        "label": "Video 7.2",
        "title": "Luồng Dữ liệu Thời gian thực & Kịch bản Hoạt động Phối hợp Đa Phân hệ",
        "videoUrl": ""
      },
      {
        "id": "Lab7-02_RTOS_Satellite_System",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Thực hành Phần mềm Bay Đa nhiệm",
        "description": "Phần mềm bay đa nhiệm FreeRTOS phân chia hai lõi CPU, tích hợp mô phỏng chu kỳ quỹ đạo 95 phút",
        "exerciseCode": "Lab7-02_RTOS_Satellite_System",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-02_RTOS_Satellite_System"
      },
      {
        "id": "quiz-practice-7-rtos",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Phần mềm Bay Đa nhiệm",
        "title": "Câu hỏi kiểm tra Thực hành Phần mềm Bay Đa nhiệm",
        "description": "Trắc nghiệm phân chia tác vụ giữa Core 0 (Truyền thông) và Core 1 (Cảm biến), hàng đợi Queue liên lõi và mô phỏng chu kỳ ánh sáng mặt trời.",
        "checkpointId": "practice-7-rtos"
      },
      {
        "id": "summary-7",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 7",
        "description": "Vệ tinh đã được tích hợp hoàn chỉnh phần cứng và phần mềm, sẵn sàng vận hành bay thử nghiệm trên quỹ đạo giả lập."
      },
      {
        "id": "labtest-7",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 7",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 7."
      }
    ]
  },
  "8": {
    "objective": "Áp dụng phương pháp luận Kỹ thuật Hệ thống Không gian (Systems Engineering), vòng đời dự án NASA/ESA (Phases A-F), ma trận kiểm định MECE, lập trình khối trực quan hóa Dashboard LMS và triển khai 1 trong 3 đề tài đồ án công nghệ không gian thực chiến.",
    "lessons": [
      {
        "id": "video-8-1",
        "type": "video",
        "label": "Video 8.1",
        "title": "Kỹ thuật Hệ thống Không gian (Systems Engineering) & Vòng đời Dự án Hàng không Vũ trụ",
        "videoUrl": ""
      },
      {
        "id": "document-8-1",
        "type": "document",
        "label": "Doc 8.1",
        "title": "Phương pháp luận Kỹ thuật Hệ thống, Vòng đời Dự án NASA/ESA & Ma trận Kiểm định MECE"
      },
      {
        "id": "quiz-doc-8-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 8.1",
        "title": "Câu hỏi kiểm tra Doc 8.1",
        "description": "Trắc nghiệm các mốc thẩm định dự án (SRR, PDR, CDR, FRR) và 4 phương pháp kiểm định MECE (Test, Analysis, Inspection, Demonstration).",
        "checkpointId": "doc-8-1"
      },
      {
        "id": "document-8-widgets",
        "type": "document",
        "label": "Doc 8.2",
        "title": "Thiết kế Giao diện Giám sát & Ánh xạ Dữ liệu Các Widget trên Dashboard LMS"
      },
      {
        "id": "quiz-doc-8-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 8.2",
        "title": "Câu hỏi kiểm tra Doc 8.2",
        "description": "Trắc nghiệm lựa chọn widget trực quan hóa dữ liệu phù hợp (Gauge đo áp pin, biểu đồ chuỗi thời gian, mô hình 3D tư thế IMU, bản đồ quỹ đạo Ground Track).",
        "checkpointId": "doc-8-2"
      },
      {
        "id": "document-8-2",
        "type": "document",
        "label": "Doc 8.3",
        "title": "Thiết kế Sứ mệnh & Khung Mã nguồn cho 3 Đề tài Đồ án Capstone Thực chiến"
      },
      {
        "id": "quiz-doc-8-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 8.3",
        "title": "Câu hỏi kiểm tra Doc 8.3",
        "description": "Trắc nghiệm bài toán kỹ thuật của 3 đề tài sứ mệnh (hàng rào địa lý Geofencing cháy rừng, Store-and-Forward nông nghiệp IoT, chuyển tiếp phao cứu sinh LoRa).",
        "checkpointId": "doc-8-3"
      },
      {
        "id": "video-8-2",
        "type": "video",
        "label": "Video 8.2",
        "title": "Xây dựng Giao diện Giám sát với Dashboard Builder qua Cổng Web Serial",
        "videoUrl": ""
      },
      {
        "id": "Lab8-01_Custom_Mission",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Thực hành Đồ án Capstone",
        "description": "Triển khai khung mã nguồn chuẩn, tùy biến máy trạng thái, tích hợp cảm biến và thiết kế Dashboard hoàn chỉnh",
        "exerciseCode": "Lab8-01_Custom_Mission",
        "repositoryUrl": "https://github.com/PTITCube/Lab8-01_Custom_Mission"
      },
      {
        "id": "quiz-practice-8-capstone",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Đồ án Capstone",
        "title": "Câu hỏi kiểm tra Thực hành Đồ án Capstone",
        "description": "Trắc nghiệm kiến trúc mã nguồn đồ án, thiết lập máy trạng thái nhiệm vụ, tối ưu hóa băng thông truyền tin và kiểm thử chức năng toàn hệ thống.",
        "checkpointId": "practice-8-capstone"
      },
      {
        "id": "summary-8",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 8",
        "description": "Hoàn tất đồ án Capstone, làm chủ toàn bộ quy trình thiết kế, lập trình và vận hành một sứ mệnh vệ tinh CubeSat độc lập."
      },
      {
        "id": "labtest-8",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 8",
        "description": "Trắc nghiệm tổng hợp kiến thức Lab 8."
      }
    ]
  }
};

const INTRO_LESSONS = [
  { id: 'overview', type: 'video', label: '01', title: 'Tổng quan bài học' },
  { id: 'document', type: 'document', label: '02', title: 'Tài liệu hướng dẫn' },
  { id: 'components', type: 'components', label: '03', title: 'Thành phần' },
];

export const LESSON_TYPE_LABELS = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', summary: 'Tổng hợp', components: 'Thành phần', assembly: 'Thực hành', quiz: 'Câu hỏi', labtest: 'Lab Test' };
export function lessonExercises(lesson) {
  if (Array.isArray(lesson?.exercises) && lesson.exercises.length > 0) return lesson.exercises;
  if (lesson?.exerciseCode) {
    return [{
      id: lesson.exerciseCode,
      label: lesson.exerciseCode,
      title: lesson.description ? `${lesson.exerciseCode}: ${lesson.description}` : lesson.title,
      description: lesson.description || lesson.title,
      exerciseCode: lesson.exerciseCode,
      repositoryUrl: lesson.repositoryUrl || '',
    }];
  }
  return [];
}
export function getExercisesForLab(labId) { return getLessonsForLab(labId).flatMap(lessonExercises); }
export function getLessonsForLab(labId) { return CURRICULUM[labId]?.lessons || INTRO_LESSONS; }
export function getLessonForLab(labId, requestedId) {
  const lessons = getLessonsForLab(labId);
  return lessons.find(lesson => lesson.id === requestedId || (lesson.exercises || []).some(ex => ex.id === requestedId)) || lessons[0];
}
export const lessonUrl = (slug, lessonId) => `/${slug}?lesson=${encodeURIComponent(lessonId)}`;
