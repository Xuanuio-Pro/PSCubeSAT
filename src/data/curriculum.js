// Lesson order follows the PTITCube syllabus README (https://github.com/PTITCube/.github, checked 2026-11-17):
// video -> doc -> câu hỏi -> ... -> tổng hợp -> Lab Test. Practice IDs never change; quiz/labtest pages carry no answers.
// Lab 0/1 `quiz-N-M` items are server-graded quiz lessons (banks keyed by lesson id). Items with `checkpointId`
// (Lab 2-8) are self-review pages of the legacy view only and are not exported to the course model.
export const CURRICULUM = {
  "0": {
    "objective": "Nắm vững lịch sử, tiêu chuẩn kích thước CubeSat 1U, ống phóng P-POD, môi trường vật lý quỹ đạo LEO và nguyên lý 6 phân hệ cốt lõi.",
    "lessons": [
      {
        "id": "overview",
        "type": "video",
        "label": "Video 0.1",
        "title": "Kỷ nguyên vệ tinh nhỏ CubeSat và các phân hệ trên không gian"
      },
      {
        "id": "document",
        "type": "document",
        "label": "Doc 0.1",
        "title": "Lịch sử CubeSat, chuẩn CalPoly, ống phóng P-POD và môi trường quỹ đạo LEO"
      },
      {
        "id": "quiz-0-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 0.1",
        "title": "Câu hỏi kiểm tra Doc 0.1"
      },
      {
        "id": "document-0-2",
        "type": "document",
        "label": "Doc 0.2",
        "title": "Kiến trúc vệ tinh 1U và vai trò 6 phân hệ cốt lõi"
      },
      {
        "id": "quiz-0-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 0.2",
        "title": "Câu hỏi kiểm tra Doc 0.2"
      },
      {
        "id": "video-0-2",
        "type": "video",
        "label": "Video 0.2",
        "title": "Demo tương tác mô hình vệ tinh 3D thời gian thực (WebGL)"
      },
      {
        "id": "components",
        "type": "components",
        "label": "Thực hành",
        "title": "Khám phá và phân tích các phân hệ trên mô hình 3D"
      },
      {
        "id": "quiz-0-3",
        "type": "quiz",
        "label": "Câu hỏi Thực hành",
        "title": "Câu hỏi kiểm tra Thực hành"
      },
      {
        "id": "summary-0",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 0"
      },
      {
        "id": "labtest-0",
        "type": "labtest",
        "label": "Lab Test",
        "title": "Kiểm tra cuối Lab 0"
      }
    ]
  },
  "1": {
    "objective": "Làm chủ vi điều khiển ESP32-WROOM-32, môi trường Web IDE, nạp firmware qua Web Serial API, nguyên lý và lập trình từng linh kiện ngoại vi cơ bản (LED, nút nhấn, LED 7 đoạn 74HC595, UART, WiFi/Web Server).",
    "lessons": [
      {
        "id": "video-1-1",
        "type": "video",
        "label": "Video 1.1",
        "title": "Giới thiệu về vi điều khiển lõi kép và phân hệ Xử lý Trung tâm (OBC)",
        "videoUrl": ""
      },
      {
        "id": "document-1-1",
        "type": "document",
        "label": "Doc 1.1",
        "title": "Kiến trúc phần cứng ESP32-WROOM-32, chân Strapping Pins an toàn và bộ nhớ SRAM/Flash"
      },
      {
        "id": "quiz-1-1",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.1",
        "title": "Câu hỏi kiểm tra Doc 1.1"
      },
      {
        "id": "video-1-2",
        "type": "video",
        "label": "Video 1.2",
        "title": "Hướng dẫn biên dịch mã nguồn trên Cloud và nạp firmware lần đầu",
        "videoUrl": ""
      },
      {
        "id": "document-1-2",
        "type": "document",
        "label": "Doc 1.2",
        "title": "Môi trường lập trình Web IDE và giao thức nạp firmware trực tiếp Web Serial API"
      },
      {
        "id": "quiz-1-2",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.2",
        "title": "Câu hỏi kiểm tra Doc 1.2"
      },
      {
        "id": "doc-1-3",
        "type": "document",
        "label": "Doc 1.3",
        "title": "Nguyên lý phần cứng và lập trình điều khiển LED đơn, chuỗi LED và điều chế xung LEDC PWM"
      },
      {
        "id": "quiz-1-3",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.3",
        "title": "Câu hỏi kiểm tra Doc 1.3"
      },
      {
        "id": "Lab1-01_Blink_LED",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Nhấp nháy đèn LED để kiểm tra bo mạch",
        "exerciseCode": "Lab1-01_Blink_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-01_Blink_LED"
      },
      {
        "id": "Lab1-02_Control_Multiple_LEDs",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Điều khiển nhiều đèn LED (chạy đèn tuần tự)",
        "exerciseCode": "Lab1-02_Control_Multiple_LEDs",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-02_Control_Multiple_LEDs"
      },
      {
        "id": "Lab1-03_PWM_LED",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Điều chế độ rộng xung LEDC PWM tạo hiệu ứng đèn thở",
        "exerciseCode": "Lab1-03_PWM_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-03_PWM_LED"
      },
      {
        "id": "quiz-1-4",
        "type": "quiz",
        "label": "Câu hỏi Thực hành LED",
        "title": "Câu hỏi kiểm tra Thực hành LED"
      },
      {
        "id": "doc-1-4",
        "type": "document",
        "label": "Doc 1.4",
        "title": "Nguyên lý và lập trình nút nhấn cơ học: INPUT_PULLUP và chống rung Debounce"
      },
      {
        "id": "quiz-1-5",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.4",
        "title": "Câu hỏi kiểm tra Doc 1.4"
      },
      {
        "id": "Lab1-03_Button",
        "type": "practice",
        "label": "Thực hành 04",
        "title": "Đọc trạng thái nút nhấn",
        "exerciseCode": "Lab1-03_Button",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-04_Button"
      },
      {
        "id": "Lab1-04_LED_Button",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Dùng nút nhấn bật/tắt đèn LED",
        "exerciseCode": "Lab1-04_LED_Button",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-05_LED_Button"
      },
      {
        "id": "quiz-1-6",
        "type": "quiz",
        "label": "Câu hỏi Thực hành Nút nhấn",
        "title": "Câu hỏi kiểm tra Thực hành Nút nhấn"
      },
      {
        "id": "doc-1-5",
        "type": "document",
        "label": "Doc 1.5",
        "title": "Vi mạch dịch bit chốt dữ liệu 74HC595 và điều khiển LED 7 đoạn"
      },
      {
        "id": "quiz-1-7",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.5",
        "title": "Câu hỏi kiểm tra Doc 1.5"
      },
      {
        "id": "Lab1-05_7_Segment_LED",
        "type": "practice",
        "label": "Thực hành 06",
        "title": "Hiển thị chữ số trên LED 7 đoạn",
        "exerciseCode": "Lab1-05_7_Segment_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-06_7_Segment_LED"
      },
      {
        "id": "quiz-1-8",
        "type": "quiz",
        "label": "Câu hỏi Thực hành 74HC595",
        "title": "Câu hỏi kiểm tra Thực hành 74HC595"
      },
      {
        "id": "doc-1-6",
        "type": "document",
        "label": "Doc 1.6",
        "title": "Giao tiếp nối tiếp bất đồng bộ UART và truyền nhận ký tự hai chiều ở 115200 bps"
      },
      {
        "id": "quiz-1-9",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.6",
        "title": "Câu hỏi kiểm tra Doc 1.6"
      },
      {
        "id": "Lab1-06_Serial_Communication",
        "type": "practice",
        "label": "Thực hành 07",
        "title": "Gửi và nhận dữ liệu từ máy tính",
        "exerciseCode": "Lab1-06_Serial_Communication",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-07_Serial_Communication"
      },
      {
        "id": "Lab1-07_Serial_Control_LED",
        "type": "practice",
        "label": "Thực hành 08",
        "title": "Điều khiển LED bằng lệnh gửi từ máy tính",
        "exerciseCode": "Lab1-07_Serial_Control_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-08_Serial_Control_LED"
      },
      {
        "id": "quiz-1-10",
        "type": "quiz",
        "label": "Câu hỏi Thực hành UART",
        "title": "Câu hỏi kiểm tra Thực hành UART"
      },
      {
        "id": "doc-1-7",
        "type": "document",
        "label": "Doc 1.7",
        "title": "Mạng không dây 802.11 (STA và SoftAP) và máy chủ Web HTTP nhúng GET/POST"
      },
      {
        "id": "quiz-1-11",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.7",
        "title": "Câu hỏi kiểm tra Doc 1.7"
      },
      {
        "id": "doc-1-8",
        "type": "document",
        "label": "Doc 1.8",
        "title": "Lập trình C++ định thời non-blocking với millis() và an toàn tràn số sau 49,7 ngày"
      },
      {
        "id": "quiz-1-12",
        "type": "quiz",
        "label": "Câu hỏi Doc 1.8",
        "title": "Câu hỏi kiểm tra Doc 1.8"
      },
      {
        "id": "video-1-5",
        "type": "video",
        "label": "Video 1.3",
        "title": "Giới thiệu về kết nối WiFi và Máy chủ Web nhúng",
        "videoUrl": ""
      },
      {
        "id": "Lab1-08_WiFi_Connection",
        "type": "practice",
        "label": "Thực hành 09",
        "title": "Kết nối vào mạng WiFi có sẵn",
        "exerciseCode": "Lab1-08_WiFi_Connection",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-09_WiFi_Connection"
      },
      {
        "id": "Lab1-09_WiFi_AP_Mode",
        "type": "practice",
        "label": "Thực hành 10",
        "title": "Phát WiFi từ vệ tinh",
        "exerciseCode": "Lab1-09_WiFi_AP_Mode",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-10_WiFi_AP_Mode"
      },
      {
        "id": "Lab1-10_Web_Server_LED",
        "type": "practice",
        "label": "Thực hành 11",
        "title": "Dựng máy chủ điều khiển LED qua trình duyệt",
        "exerciseCode": "Lab1-10_Web_Server_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-11_Web_Server_LED"
      },
      {
        "id": "quiz-1-13",
        "type": "quiz",
        "label": "Câu hỏi Thực hành WiFi & Web Server",
        "title": "Câu hỏi kiểm tra Thực hành WiFi & Web Server"
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
        "title": "Kiểm tra cuối Lab 1"
      }
    ]
  },
  "2": {
    "objective": "Nắm vững nguyên lý pin Li-Po, mạch sạc CC/CV TP4056, lập trình đọc điện áp và dung lượng pin với IC MAX17048 qua I2C, công tắc ngắt an toàn và điều khiển dòng vào mạch hạ áp cấp nguồn cảm biến để tiết kiệm năng lượng.",
    "lessons": [
      {
        "id": "video-2-1",
        "type": "video",
        "label": "Video 2.1",
        "title": "Giới thiệu về Hệ thống Nguồn trên vệ tinh (Pin Li-Po, mạch sạc CC/CV, IC Fuel Gauge)",
        "videoUrl": ""
      },
      {
        "id": "document-2-1",
        "type": "document",
        "label": "Doc 2.1",
        "title": "Pin Li-Po, mạch sạc CC/CV TP4056, nguồn Buck/Boost và đọc thanh ghi VCELL/SOC của MAX17048 qua I2C"
      },
      {
        "id": "quiz-doc-2-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 2.1",
        "checkpointId": "doc-2-1"
      },
      {
        "id": "video-2-2",
        "type": "video",
        "label": "Video 2.2",
        "title": "Giao tiếp I2C đọc các thanh ghi của IC MAX17048",
        "videoUrl": ""
      },
      {
        "id": "Lab2-01a_Battery_I2C",
        "type": "practice",
        "label": "Thực hành 01a",
        "title": "Đọc trực tiếp thanh ghi điện áp và dung lượng pin MAX17048 qua Wire.h",
        "exerciseCode": "Lab2-01a_Battery_I2C",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-01a_Battery_I2C"
      },
      {
        "id": "Lab2-01b_Battery_Library",
        "type": "practice",
        "label": "Thực hành 01b",
        "title": "Quản lý phân hệ nguồn EPS qua thư viện PTITCube",
        "exerciseCode": "Lab2-01b_Battery_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-01b_Battery_Library"
      },
      {
        "id": "quiz-practice-2-max17048",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Nguồn & MAX17048",
        "checkpointId": "practice-2-max17048"
      },
      {
        "id": "document-2-2",
        "type": "document",
        "label": "Doc 2.2",
        "title": "Ngắt an toàn phóng, giám sát sụt áp Brownout và điều khiển dòng vào mạch hạ áp (Power Gating)"
      },
      {
        "id": "quiz-doc-2-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 2.2",
        "checkpointId": "doc-2-2"
      },
      {
        "id": "Lab2-02_Power_Saving",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Tự động bật chế độ tiết kiệm năng lượng theo điện áp và dung lượng pin",
        "exerciseCode": "Lab2-02_Power_Saving",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-02_Power_Saving"
      },
      {
        "id": "quiz-practice-2-power",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Tiết Kiệm Điện",
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
        "title": "Kiểm tra cuối Lab 2"
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
        "title": "Giới thiệu về Hệ thống Lưu trữ dữ liệu hộp đen dự phòng trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-3-1",
        "type": "document",
        "label": "Doc 3.1",
        "title": "Bus SPI tốc độ cao, đọc/ghi thẻ MicroSD với FAT32, bộ đệm RAM và vai trò của file.flush()"
      },
      {
        "id": "quiz-doc-3-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 3.1",
        "checkpointId": "doc-3-1"
      },
      {
        "id": "video-3-2",
        "type": "video",
        "label": "Video 3.2",
        "title": "Thao tác đọc/ghi file an toàn, tránh lỗi phân mảnh và hỏng thẻ nhớ",
        "videoUrl": ""
      },
      {
        "id": "Lab3-01a_MicroSD_SPI",
        "type": "practice",
        "label": "Thực hành 01a",
        "title": "Giao tiếp thẻ nhớ bằng thư viện SD gốc (SPI thô)",
        "exerciseCode": "Lab3-01a_MicroSD_SPI",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-01a_MicroSD_SPI"
      },
      {
        "id": "Lab3-01b_MicroSD_Library",
        "type": "practice",
        "label": "Thực hành 01b",
        "title": "Ghi log dữ liệu tự động (Dùng thư viện PTITCube)",
        "exerciseCode": "Lab3-01b_MicroSD_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-01b_MicroSD_Library"
      },
      {
        "id": "quiz-practice-3-sd",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Thẻ Nhớ MicroSD",
        "checkpointId": "practice-3-sd"
      },
      {
        "id": "document-3-cli",
        "type": "document",
        "label": "Doc 3.2",
        "title": "Phân tích cú pháp lệnh và hệ thống lệnh Shell CLI (ls, cat, rm, df, reboot) qua cổng Serial"
      },
      {
        "id": "quiz-doc-3-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 3.2",
        "checkpointId": "doc-3-2"
      },
      {
        "id": "Lab3-02_Linux_FS_Commands",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Xây dựng hệ thống lệnh quản lý file qua máy tính",
        "exerciseCode": "Lab3-02_Linux_FS_Commands",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-02_Linux_FS_Commands"
      },
      {
        "id": "quiz-practice-3-cli",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Shell CLI",
        "checkpointId": "practice-3-cli"
      },
      {
        "id": "video-3-3",
        "type": "video",
        "label": "Video 3.3",
        "title": "Tại sao phần mềm vệ tinh hiện đại bắt buộc phải dùng Hệ điều hành Thời gian thực (RTOS)?",
        "videoUrl": ""
      },
      {
        "id": "document-3-3",
        "type": "document",
        "label": "Doc 3.3",
        "title": "Đa nhiệm FreeRTOS, tranh chấp tài nguyên, nghịch đảo ưu tiên và đồng bộ bằng khóa Mutex"
      },
      {
        "id": "quiz-doc-3-3",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 3.3",
        "checkpointId": "doc-3-3"
      },
      {
        "id": "Lab3-03_Multitasking_Scheduler",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Chạy đồng thời LED nhịp tim, viễn trắc giả lập và tự chẩn đoán với khóa Mutex",
        "exerciseCode": "Lab3-03_Multitasking_Scheduler",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-03_Multitasking_Scheduler"
      },
      {
        "id": "quiz-practice-3-rtos",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành FreeRTOS",
        "checkpointId": "practice-3-rtos"
      },
      {
        "id": "video-3-4",
        "type": "video",
        "label": "Video 3.4",
        "title": "Gỡ lỗi treo hệ thống do bức xạ không gian bằng Bộ định thời Chó canh",
        "videoUrl": ""
      },
      {
        "id": "document-3-4",
        "type": "document",
        "label": "Doc 3.4",
        "title": "Mạch giám sát WDT, phân cấp IWDT/TWDT và Task Watchdog Timer tự phục hồi lỗi treo"
      },
      {
        "id": "quiz-doc-3-4",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 3.4",
        "checkpointId": "doc-3-4"
      },
      {
        "id": "Lab3-04_Watchdog_And_Event",
        "type": "practice",
        "label": "Thực hành 04",
        "title": "Task Watchdog Timer: mô phỏng treo và tự động reset phục hồi",
        "exerciseCode": "Lab3-04_Watchdog_And_Event",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-04_Watchdog_Timer"
      },
      {
        "id": "Lab3-05_Event_Driven_Queue",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Kiến trúc hướng sự kiện với hàng đợi FreeRTOS Queue",
        "exerciseCode": "Lab3-05_Event_Driven_Queue",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-05_Event_Driven_Queue"
      },
      {
        "id": "quiz-practice-3-wdt-event",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Watchdog & Event",
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
        "title": "Kiểm tra cuối Lab 3"
      }
    ]
  },
  "4": {
    "objective": "Nắm vững nguyên lý và lập trình từng cảm biến: cảm biến khí quyển BMP280, cảm biến quán tính IMU MPU6500, module định vị GNSS L76X, tải trọng Camera OV2640 và IC chuyển mạch 74HC4066.",
    "lessons": [
      {
        "id": "video-4-1",
        "type": "video",
        "label": "Video 4.1",
        "title": "Giới thiệu tổng quan về hệ thống Cảm biến và Tải trọng quang học trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-4-1",
        "type": "document",
        "label": "Doc 4.1",
        "title": "Bus I2C chuẩn công nghiệp và lập trình cảm biến khí quyển BMP280"
      },
      {
        "id": "quiz-doc-4-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.1",
        "checkpointId": "doc-4-1"
      },
      {
        "id": "video-4-2",
        "type": "video",
        "label": "Video 4.2",
        "title": "Tương tác với cảm biến khí quyển nhiệt độ và áp suất",
        "videoUrl": ""
      },
      {
        "id": "Lab4-01a_Environment_I2C",
        "type": "practice",
        "label": "Thực hành 01a",
        "title": "Đọc cảm biến BMP280 bằng giao tiếp I2C",
        "exerciseCode": "Lab4-01a_Environment_I2C",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-01a_Environment_I2C"
      },
      {
        "id": "Lab4-01b_Environment_Library",
        "type": "practice",
        "label": "Thực hành 01b",
        "title": "Đọc nhiệt độ và áp suất BMP280 qua thư viện PTITCube",
        "exerciseCode": "Lab4-01b_Environment_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-01b_Environment_Library"
      },
      {
        "id": "quiz-practice-4-bmp280",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành BMP280",
        "checkpointId": "practice-4-bmp280"
      },
      {
        "id": "video-4-3",
        "type": "video",
        "label": "Video 4.3",
        "title": "Tương tác với cảm biến quán tính IMU 6 trục và thuật toán ước lượng góc nghiêng",
        "videoUrl": ""
      },
      {
        "id": "document-4-imu",
        "type": "document",
        "label": "Doc 4.2",
        "title": "Cảm biến quán tính MEMS 6 trục MPU6500 và bộ lọc bù tính góc Roll, Pitch"
      },
      {
        "id": "quiz-doc-4-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.2",
        "checkpointId": "doc-4-2"
      },
      {
        "id": "Lab4-02a_IMU_I2C",
        "type": "practice",
        "label": "Thực hành 02a",
        "title": "Đọc MPU6500 (burst 14 byte) và la bàn QMC5883P bằng I2C thuần",
        "exerciseCode": "Lab4-02a_IMU_I2C",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-02a_IMU_I2C"
      },
      {
        "id": "Lab4-02b_IMU_Library",
        "type": "practice",
        "label": "Thực hành 02b",
        "title": "Tính toán góc nghiêng vệ tinh (Attitude)",
        "exerciseCode": "Lab4-02b_IMU_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-02b_IMU_Library"
      },
      {
        "id": "quiz-practice-4-imu",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành IMU MPU6500",
        "checkpointId": "practice-4-imu"
      },
      {
        "id": "video-4-4",
        "type": "video",
        "label": "Video 4.4",
        "title": "Tương tác và lấy dữ liệu tọa độ từ module định vị toàn cầu GNSS",
        "videoUrl": ""
      },
      {
        "id": "document-4-gnss",
        "type": "document",
        "label": "Doc 4.3",
        "title": "Phần cứng module định vị GNSS L76X và nhận luồng NMEA thô qua UART"
      },
      {
        "id": "quiz-doc-4-3",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.3",
        "checkpointId": "doc-4-3"
      },
      {
        "id": "Lab4-03a_GPS_UART",
        "type": "practice",
        "label": "Thực hành 03a",
        "title": "Đọc dữ liệu chuẩn NMEA thô từ module qua UART",
        "exerciseCode": "Lab4-03a_GPS_UART",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-03a_GPS_UART"
      },
      {
        "id": "Lab4-03b_GPS_Library",
        "type": "practice",
        "label": "Thực hành 03b",
        "title": "Bộ đệm dòng NMEA và kiểm tra Checksum XOR",
        "exerciseCode": "Lab4-03b_GPS_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-03b_GPS_Library"
      },
      {
        "id": "quiz-practice-4-nmea-raw",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Đọc NMEA thô",
        "checkpointId": "practice-4-nmea-raw"
      },
      {
        "id": "document-4-2",
        "type": "document",
        "label": "Doc 4.4",
        "title": "Chuẩn NMEA 0183 và chuyển dữ liệu thô thành các trường có ý nghĩa"
      },
      {
        "id": "quiz-doc-4-4",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.4",
        "checkpointId": "doc-4-4"
      },
      {
        "id": "Lab4-03c_GPS_PTITCube",
        "type": "practice",
        "label": "Thực hành 03c",
        "title": "Giải mã NMEA thành tọa độ, cao độ, vận tốc và thời gian UTC",
        "exerciseCode": "Lab4-03c_GPS_PTITCube",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-03c_GPS_PTITCube"
      },
      {
        "id": "quiz-practice-4-nmea-decode",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Giải mã NMEA",
        "checkpointId": "practice-4-nmea-decode"
      },
      {
        "id": "document-4-camera",
        "type": "document",
        "label": "Doc 4.5",
        "title": "Cảm biến ảnh CMOS OV2640, nén JPEG phần cứng và nhận ảnh qua UART"
      },
      {
        "id": "quiz-doc-4-5",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.5",
        "checkpointId": "doc-4-5"
      },
      {
        "id": "Lab4-04a_Camera_UART",
        "type": "practice",
        "label": "Thực hành 04a",
        "title": "Bắt tay UART thuần với ESP32-CAM và ghi ảnh JPEG vào MicroSD",
        "exerciseCode": "Lab4-04a_Camera_UART",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-04a_Camera_UART"
      },
      {
        "id": "Lab4-04b_Camera_Library",
        "type": "practice",
        "label": "Thực hành 04b",
        "title": "Chụp ảnh bằng thư viện PTIT_Camera, lưu thẻ SD và gửi ảnh về trình duyệt qua Serial",
        "exerciseCode": "Lab4-04b_Camera_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-04b_Camera_Library"
      },
      {
        "id": "quiz-practice-4-camera",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Camera OV2640",
        "checkpointId": "practice-4-camera"
      },
      {
        "id": "document-4-sensors",
        "type": "document",
        "label": "Doc 4.6",
        "title": "Phối hợp mạng đa cảm biến và thu thập dữ liệu đồng bộ trong một chu trình"
      },
      {
        "id": "quiz-doc-4-6",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.6",
        "checkpointId": "doc-4-6"
      },
      {
        "id": "Lab4-05_Read_All_Sensors",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Tổng hợp đọc tất cả cảm biến",
        "exerciseCode": "Lab4-05_Read_All_Sensors",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-06_Read_All_Sensors"
      },
      {
        "id": "quiz-practice-4-all-sensors",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Đa Cảm Biến",
        "checkpointId": "practice-4-all-sensors"
      },
      {
        "id": "video-4-5",
        "type": "video",
        "label": "Video 4.5",
        "title": "Giải quyết xung đột phần cứng khi Camera và GPS dùng chung cổng UART",
        "videoUrl": ""
      },
      {
        "id": "document-4-3",
        "type": "document",
        "label": "Doc 4.7",
        "title": "Khóa chuyển mạch tương tự 74HC4066 và chuyển kênh luân phiên Camera/GNSS trên cùng UART"
      },
      {
        "id": "quiz-doc-4-7",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 4.7",
        "checkpointId": "doc-4-7"
      },
      {
        "id": "Lab4-06_Camera_Multiplexer",
        "type": "practice",
        "label": "Thực hành 06",
        "title": "Chuyển kênh UART2 giữa Camera và GPS qua MUX 74HC4066",
        "exerciseCode": "Lab4-06_Camera_Multiplexer",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-05_Camera_Multiplexer"
      },
      {
        "id": "quiz-practice-4-mux",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Multiplexer",
        "checkpointId": "practice-4-mux"
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
        "title": "Kiểm tra cuối Lab 4"
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
        "title": "Giới thiệu về phân hệ Giao tiếp Viễn thông không gian băng tần UHF",
        "videoUrl": ""
      },
      {
        "id": "document-5-1",
        "type": "document",
        "label": "Doc 5.1",
        "title": "Truyền thông vô tuyến không gian: sóng UHF 433 MHz, suy hao Friis, Link Budget và dịch tần Doppler"
      },
      {
        "id": "quiz-doc-5-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 5.1",
        "checkpointId": "doc-5-1"
      },
      {
        "id": "document-5-lora",
        "type": "document",
        "label": "Doc 5.2",
        "title": "Trải phổ LoRa CSS, chân và chế độ (M0, M1, AUX) của module Ebyte E32-433T20D"
      },
      {
        "id": "quiz-doc-5-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 5.2",
        "checkpointId": "doc-5-2"
      },
      {
        "id": "video-5-2",
        "type": "video",
        "label": "Video 5.2",
        "title": "Cấu hình các tham số vật lý của sóng vô tuyến và kỹ thuật đóng gói bản tin",
        "videoUrl": ""
      },
      {
        "id": "Lab5-01a_Send_Telemetry_UART",
        "type": "practice",
        "label": "Thực hành 01a",
        "title": "Đặt LoRa E32 ở chế độ thường (M0/M1) và phát bản tin qua UART",
        "exerciseCode": "Lab5-01a_Send_Telemetry_UART",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART"
      },
      {
        "id": "Lab5-01b_Send_Telemetry_Library",
        "type": "practice",
        "label": "Thực hành 01b",
        "title": "Phát bản tin telemetry định kỳ qua thư viện PTIT_COM",
        "exerciseCode": "Lab5-01b_Send_Telemetry_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-01b_Send_Telemetry_Library"
      },
      {
        "id": "Lab5-02a_Receive_Command_UART",
        "type": "practice",
        "label": "Thực hành 02a",
        "title": "Lắng nghe chuỗi dữ liệu thô",
        "exerciseCode": "Lab5-02a_Receive_Command_UART",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-02a_Receive_Command_UART"
      },
      {
        "id": "Lab5-02b_Receive_Command_Library",
        "type": "practice",
        "label": "Thực hành 02b",
        "title": "Nhận lệnh từ trạm mặt đất qua thư viện PTIT_COM",
        "exerciseCode": "Lab5-02b_Receive_Command_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-02b_Receive_Command_Library"
      },
      {
        "id": "quiz-practice-5-lora",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành LoRa E32",
        "checkpointId": "practice-5-lora"
      },
      {
        "id": "document-5-2",
        "type": "document",
        "label": "Doc 5.3",
        "title": "Đóng gói khung Telemetry, CRC-16-CCITT, Stop-and-Wait ARQ và kiến trúc trạm mặt đất"
      },
      {
        "id": "quiz-doc-5-3",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 5.3",
        "checkpointId": "doc-5-3"
      },
      {
        "id": "video-5-3",
        "type": "video",
        "label": "Video 5.3",
        "title": "Xây dựng và vận hành Trạm mặt đất thu phát tín hiệu thực tế",
        "videoUrl": ""
      },
      {
        "id": "Lab5-03_Satellite_Comm_System",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Xây dựng hệ thống liên lạc vệ tinh và trạm mặt đất",
        "exerciseCode": "Lab5-03_Satellite_Comm_System",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-03_Ground_Station_Demo"
      },
      {
        "id": "quiz-practice-5-ground",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Trạm Mặt Đất",
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
        "title": "Kiểm tra cuối Lab 5"
      }
    ]
  },
  "6": {
    "objective": "Hiểu rõ vai trò đa chiều của khung cơ khí, vật liệu nhôm hàng không Al 6061-T6, xử lý bề mặt Anodize Type III / Alodine, ngăn xếp PC/104, bu lông thông hơi và trực tiếp lắp ráp hoàn thiện khung vệ tinh của bộ kit.",
    "lessons": [
      {
        "id": "video-6-1",
        "type": "video",
        "label": "Video 6.1",
        "title": "Cơ khí chính xác, tải trọng phóng tên lửa và cấu trúc bảo vệ vệ tinh trong không gian",
        "videoUrl": ""
      },
      {
        "id": "document-6-1",
        "type": "document",
        "label": "Doc 6.1",
        "title": "Vai trò khung cơ khí và tác động đa chiều lên các phân hệ khác"
      },
      {
        "id": "quiz-doc-6-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 6.1",
        "checkpointId": "doc-6-1"
      },
      {
        "id": "document-6-2",
        "type": "document",
        "label": "Doc 6.2",
        "title": "Hợp kim nhôm không gian, xử lý bề mặt Anodize/Alodine và tiêu chuẩn thoát khí ASTM E595"
      },
      {
        "id": "quiz-doc-6-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 6.2",
        "checkpointId": "doc-6-2"
      },
      {
        "id": "document-6-3",
        "type": "document",
        "label": "Doc 6.3",
        "title": "Ngăn xếp PC/104, bu lông thông hơi, keo khóa ren, bảng khối lượng và cân bằng trọng tâm"
      },
      {
        "id": "quiz-doc-6-3",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 6.3",
        "checkpointId": "doc-6-3"
      },
      {
        "id": "video-6-2",
        "type": "video",
        "label": "Video 6.2",
        "title": "Hướng dẫn quy trình lắp khung vệ tinh của bộ kit",
        "videoUrl": ""
      },
      {
        "id": "assembly-6",
        "type": "assembly",
        "label": "Thực hành",
        "title": "Lắp ráp khung cơ khí theo hướng dẫn và chụp ảnh sản phẩm hoàn thiện"
      },
      {
        "id": "quiz-practice-6-frame",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Khung Cơ Khí",
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
        "title": "Kiểm tra cuối Lab 6"
      }
    ]
  },
  "7": {
    "objective": "Nắm vững phương pháp giải quyết 5 thách thức tích hợp đa phân hệ, lập trình phần mềm bay tuần tự Non-blocking, hệ thống đa nhiệm FreeRTOS, máy trạng thái sứ mệnh (Mission FSM) và mô phỏng chu kỳ quỹ đạo 95 phút.",
    "lessons": [
      {
        "id": "video-7-1",
        "type": "video",
        "label": "Video 7.1",
        "title": "Giới thiệu về bài toán Tích hợp Hệ thống Toàn diện trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-7-1",
        "type": "document",
        "label": "Doc 7.1",
        "title": "Năm thách thức khi tích hợp đa phân hệ và phần mềm bay vòng lặp tuần tự Non-blocking"
      },
      {
        "id": "quiz-doc-7-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 7.1",
        "checkpointId": "doc-7-1"
      },
      {
        "id": "Lab7-01_Full_Satellite_Program",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Phần mềm vệ tinh hoàn chỉnh với vòng lặp tuần tự",
        "exerciseCode": "Lab7-01_Full_Satellite_Program",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-01_Full_Satellite_Program"
      },
      {
        "id": "quiz-practice-7-superloop",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Phần mềm Bay Tuần tự",
        "checkpointId": "practice-7-superloop"
      },
      {
        "id": "document-7-2",
        "type": "document",
        "label": "Doc 7.2",
        "title": "Kiến trúc phân lớp phần mềm bay, máy trạng thái sứ mệnh (Mission FSM) và chiến lược FDIR"
      },
      {
        "id": "quiz-doc-7-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 7.2",
        "checkpointId": "doc-7-2"
      },
      {
        "id": "document-7-3",
        "type": "document",
        "label": "Doc 7.3",
        "title": "Sổ tay vận hành bay, phiên liên lạc trạm mặt đất (AOS, Data Dump, LOS) và mô phỏng quỹ đạo 95 phút"
      },
      {
        "id": "quiz-doc-7-3",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 7.3",
        "checkpointId": "doc-7-3"
      },
      {
        "id": "video-7-2",
        "type": "video",
        "label": "Video 7.2",
        "title": "Phân tích luồng dữ liệu thời gian thực và kịch bản phối hợp giữa các phân hệ",
        "videoUrl": ""
      },
      {
        "id": "Lab7-02_RTOS_Satellite_System",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Hệ thống vệ tinh chạy đa nhiệm RTOS",
        "exerciseCode": "Lab7-02_RTOS_Satellite_System",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-02_RTOS_Satellite_System"
      },
      {
        "id": "quiz-practice-7-rtos",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Phần mềm Bay Đa nhiệm",
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
        "title": "Kiểm tra cuối Lab 7"
      }
    ]
  },
  "8": {
    "objective": "Áp dụng phương pháp luận Kỹ thuật Hệ thống Không gian, vòng đời dự án NASA/ESA (Phases A-F), ma trận kiểm định MECE, lập trình Dashboard LMS và triển khai 1 trong 3 đề tài đồ án Capstone.",
    "lessons": [
      {
        "id": "video-8-1",
        "type": "video",
        "label": "Video 8.1",
        "title": "Kỹ thuật Hệ thống Không gian và vòng đời dự án hàng không vũ trụ",
        "videoUrl": ""
      },
      {
        "id": "document-8-1",
        "type": "document",
        "label": "Doc 8.1",
        "title": "Kỹ thuật hệ thống không gian, vòng đời dự án NASA/ESA theo pha và ma trận kiểm định MECE"
      },
      {
        "id": "quiz-doc-8-1",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 8.1",
        "checkpointId": "doc-8-1"
      },
      {
        "id": "document-8-widgets",
        "type": "document",
        "label": "Doc 8.2",
        "title": "Lựa chọn và ánh xạ dữ liệu cho các khối trực quan hóa (Widgets) trên Dashboard LMS"
      },
      {
        "id": "quiz-doc-8-2",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 8.2",
        "checkpointId": "doc-8-2"
      },
      {
        "id": "document-8-2",
        "type": "document",
        "label": "Doc 8.3",
        "title": "Thiết kế và khung mã nguồn cho 3 đề tài Capstone (cảnh báo cháy rừng, nông nghiệp IoT, cứu hộ SAR)"
      },
      {
        "id": "quiz-doc-8-3",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Doc 8.3",
        "checkpointId": "doc-8-3"
      },
      {
        "id": "video-8-2",
        "type": "video",
        "label": "Video 8.2",
        "title": "Hướng dẫn công cụ kéo thả Dashboard Builder kết nối Web Serial thời gian thực",
        "videoUrl": ""
      },
      {
        "id": "Lab8-01_Custom_Mission",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Khung mã nguồn tiêu chuẩn để tự tùy biến",
        "exerciseCode": "Lab8-01_Custom_Mission",
        "repositoryUrl": "https://github.com/PTITCube/Lab8-01_Custom_Mission"
      },
      {
        "id": "quiz-practice-8-capstone",
        "type": "quiz",
        "label": "Câu hỏi",
        "title": "Câu hỏi kiểm tra Thực hành Đồ án Capstone",
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
        "title": "Kiểm tra cuối Lab 8"
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
export function getLessonsForLab(labId) { return CURRICULUM[labId]?.lessons || INTRO_LESSONS; }
export function getLessonForLab(labId, requestedId) {
  const lessons = getLessonsForLab(labId);
  return lessons.find(lesson => lesson.id === requestedId) || lessons[0];
}
export const lessonUrl = (slug, lessonId) => `/${slug}?lesson=${encodeURIComponent(lessonId)}`;
