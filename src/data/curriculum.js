// Lesson order and exercise identifiers follow the user-provided PTITCube syllabus.
// Source: https://github.com/PTITCube (checked 2026-10-19).
export const CURRICULUM = {
  "1": {
    "objective": "Làm quen với Web IDE, nạp code cho vi điều khiển chính, giao tiếp máy tính và kết nối mạng WiFi/Internet.",
    "lessons": [
      {
        "id": "video-1-1",
        "type": "video",
        "label": "Video 1.1",
        "title": "Giới thiệu về vi điều khiển và phân hệ Xử lý trung tâm",
        "videoUrl": ""
      },
      {
        "id": "document-1-1",
        "type": "document",
        "label": "Doc 1.1",
        "title": "Kiến trúc phần cứng vi điều khiển và các chuẩn giao tiếp"
      },
      {
        "id": "video-1-2",
        "type": "video",
        "label": "Video 1.2",
        "title": "Cách biên dịch và nạp code lần đầu",
        "videoUrl": ""
      },
      {
        "id": "document-1-2",
        "type": "document",
        "label": "Doc 1.2",
        "title": "Hướng dẫn sử dụng Web IDE tích hợp"
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
        "id": "Lab1-02_Serial_Communication",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Gửi và nhận dữ liệu từ máy tính",
        "exerciseCode": "Lab1-02_Serial_Communication",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-02_Serial_Communication"
      },
      {
        "id": "Lab1-03_Serial_Control_LED",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Điều khiển LED bằng lệnh gửi từ máy tính",
        "exerciseCode": "Lab1-03_Serial_Control_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-03_Serial_Control_LED"
      },
      {
        "id": "video-1-3",
        "type": "video",
        "label": "Video 1.3",
        "title": "Giới thiệu về kết nối WiFi và Máy chủ Web",
        "videoUrl": ""
      },
      {
        "id": "document-1-3",
        "type": "document",
        "label": "Doc 1.3",
        "title": "Lý thuyết về Máy chủ Web và giao thức truyền tải"
      },
      {
        "id": "Lab1-04_WiFi_Connection",
        "type": "practice",
        "label": "Thực hành 04",
        "title": "Kết nối vào mạng WiFi có sẵn",
        "exerciseCode": "Lab1-04_WiFi_Connection",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-04_WiFi_Connection"
      },
      {
        "id": "Lab1-05_WiFi_AP_Mode",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Phát WiFi từ vệ tinh",
        "exerciseCode": "Lab1-05_WiFi_AP_Mode",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-05_WiFi_AP_Mode"
      },
      {
        "id": "Lab1-06_Web_Server_LED",
        "type": "practice",
        "label": "Thực hành 06",
        "title": "Dựng máy chủ điều khiển LED qua trình duyệt",
        "exerciseCode": "Lab1-06_Web_Server_LED",
        "repositoryUrl": "https://github.com/PTITCube/Lab1-06_Web_Server_LED"
      },
      {
        "id": "summary-1",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 1",
        "description": "Hoàn thiện kỹ năng lập trình cơ bản và kết nối mạng cho vi điều khiển chính."
      }
    ]
  },
  "2": {
    "objective": "Quản lý năng lượng, đọc điện áp pin, và các chế độ tiết kiệm pin trên không gian.",
    "lessons": [
      {
        "id": "video-2-1",
        "type": "video",
        "label": "Video 2.1",
        "title": "Giới thiệu về Hệ thống Nguồn trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-2-1",
        "type": "document",
        "label": "Doc 2.1",
        "title": "Tổng quan hệ thống Nguồn (Pin, Mạch sạc, Chuyển đổi điện áp)"
      },
      {
        "id": "video-2-2",
        "type": "video",
        "label": "Video 2.2",
        "title": "Cách chuyển đổi giá trị điện áp Analog",
        "videoUrl": ""
      },
      {
        "id": "Lab2-01a_Battery_GPIO",
        "type": "practice",
        "label": "Thực hành 01a",
        "title": "Đọc điện áp pin bằng ADC (Analog)",
        "exerciseCode": "Lab2-01a_Battery_GPIO",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-01a_Battery_GPIO"
      },
      {
        "id": "Lab2-01b_Battery_Library",
        "type": "practice",
        "label": "Thực hành 01b",
        "title": "Tính toán phần trăm pin vệ tinh (Dùng thư viện PTITCube)",
        "exerciseCode": "Lab2-01b_Battery_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-01b_Battery_Library"
      },
      {
        "id": "document-2-2",
        "type": "document",
        "label": "Doc 2.2",
        "title": "Quản lý rủi ro sụt áp và các chế độ ngủ"
      },
      {
        "id": "Lab2-02_Power_Saving",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Kích hoạt chế độ ngủ sâu tiết kiệm năng lượng",
        "exerciseCode": "Lab2-02_Power_Saving",
        "repositoryUrl": "https://github.com/PTITCube/Lab2-02_Power_Saving"
      },
      {
        "id": "summary-2",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 2",
        "description": "Nắm vững cách quản lý, tối ưu và tiết kiệm điện năng cho vệ tinh."
      }
    ]
  },
  "3": {
    "objective": "Giao tiếp với thẻ nhớ để ghi nhận dữ liệu.",
    "lessons": [
      {
        "id": "video-3-1",
        "type": "video",
        "label": "Video 3.1",
        "title": "Giới thiệu về Hệ thống Lưu trữ dữ liệu dự phòng trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-3-1",
        "type": "document",
        "label": "Doc 3.1",
        "title": "Giao thức giao tiếp nối tiếp và kiến trúc hệ thống tập tin"
      },
      {
        "id": "video-3-2",
        "type": "video",
        "label": "Video 3.2",
        "title": "Thao tác đọc/ghi file an toàn, tránh hỏng thẻ nhớ",
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
        "id": "Lab3-02_Linux_FS_Commands",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Xây dựng hệ thống lệnh quản lý file qua máy tính",
        "exerciseCode": "Lab3-02_Linux_FS_Commands",
        "repositoryUrl": "https://github.com/PTITCube/Lab3-02_Linux_FS_Commands"
      },
      {
        "id": "summary-3",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 3",
        "description": "Cấu hình thành công hộp đen lưu trữ dữ liệu liên tục cho vệ tinh."
      }
    ]
  },
  "4": {
    "objective": "Tương tác với hệ sinh thái cảm biến để nhận biết môi trường không gian, tư thế vệ tinh và hình ảnh.",
    "lessons": [
      {
        "id": "video-4-1",
        "type": "video",
        "label": "Video 4.1",
        "title": "Giới thiệu tổng quan về hệ thống Cảm biến và Máy ảnh trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-4-1",
        "type": "document",
        "label": "Doc 4.1",
        "title": "Nguyên lý hoạt động và giao tiếp truyền dữ liệu của các cảm biến qua mạng I2C"
      },
      {
        "id": "video-4-2",
        "type": "video",
        "label": "Video 4.2",
        "title": "Tương tác với cảm biến nhiệt độ và áp suất",
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
        "title": "Tối ưu hóa đọc dữ liệu cảm biến môi trường",
        "exerciseCode": "Lab4-01b_Environment_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-01b_Environment_Library"
      },
      {
        "id": "video-4-3",
        "type": "video",
        "label": "Video 4.3",
        "title": "Tương tác với cảm biến gia tốc và đo góc nghiêng",
        "videoUrl": ""
      },
      {
        "id": "Lab4-02a_IMU_I2C",
        "type": "practice",
        "label": "Thực hành 02a",
        "title": "Đọc thanh ghi thô MPU6050/6500 bằng I2C",
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
        "id": "video-4-4",
        "type": "video",
        "label": "Video 4.4",
        "title": "Tương tác và lấy dữ liệu tọa độ từ module định vị",
        "videoUrl": ""
      },
      {
        "id": "document-4-2",
        "type": "document",
        "label": "Doc 4.2",
        "title": "Trích xuất và phân tích định dạng dữ liệu thô trả về từ module định vị"
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
        "title": "Bóc tách tọa độ kinh tuyến, vĩ tuyến tự động",
        "exerciseCode": "Lab4-03b_GPS_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-03b_GPS_Library"
      },
      {
        "id": "video-4-5",
        "type": "video",
        "label": "Video 4.5",
        "title": "Tương tác, gửi lệnh chụp ảnh và thu thập hình ảnh từ module Máy ảnh",
        "videoUrl": ""
      },
      {
        "id": "Lab4-04a_Camera_UART",
        "type": "practice",
        "label": "Thực hành 04a",
        "title": "Gửi tập lệnh điều khiển máy ảnh qua UART",
        "exerciseCode": "Lab4-04a_Camera_UART",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-04a_Camera_UART"
      },
      {
        "id": "Lab4-04b_Camera_Library",
        "type": "practice",
        "label": "Thực hành 04b",
        "title": "Chụp ảnh và hiển thị về màn hình",
        "exerciseCode": "Lab4-04b_Camera_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-04b_Camera_Library"
      },
      {
        "id": "Lab4-05_Read_All_Sensors",
        "type": "practice",
        "label": "Thực hành 05",
        "title": "Tổng hợp đọc tất cả cảm biến",
        "exerciseCode": "Lab4-05_Read_All_Sensors",
        "repositoryUrl": "https://github.com/PTITCube/Lab4-05_Read_All_Sensors"
      },
      {
        "id": "summary-4",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 4",
        "description": "Xây dựng thành công hệ thống thu thập dữ liệu đa cảm biến toàn diện."
      }
    ]
  },
  "5": {
    "objective": "Truyền nhận dữ liệu tầm xa giữa Vệ tinh và Trạm mặt đất bằng sóng vô tuyến.",
    "lessons": [
      {
        "id": "video-5-1",
        "type": "video",
        "label": "Video 5.1",
        "title": "Giới thiệu về phân hệ Giao tiếp Viễn thông không dây",
        "videoUrl": ""
      },
      {
        "id": "document-5-1",
        "type": "document",
        "label": "Doc 5.1",
        "title": "Sóng vô tuyến và module truyền phát tín hiệu tầm xa"
      },
      {
        "id": "video-5-2",
        "type": "video",
        "label": "Video 5.2",
        "title": "Hướng dẫn cấu hình các tham số vật lý của sóng vô tuyến",
        "videoUrl": ""
      },
      {
        "id": "document-5-2",
        "type": "document",
        "label": "Doc 5.2",
        "title": "Đóng gói bản tin và kiến trúc Trạm mặt đất"
      },
      {
        "id": "Lab5-01a_Send_Telemetry_UART",
        "type": "practice",
        "label": "Thực hành 01a",
        "title": "Cấu hình thanh ghi LoRa và phát dữ liệu qua UART",
        "exerciseCode": "Lab5-01a_Send_Telemetry_UART",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-01a_Send_Telemetry_UART"
      },
      {
        "id": "Lab5-01b_Send_Telemetry_Library",
        "type": "practice",
        "label": "Thực hành 01b",
        "title": "Đóng gói packet Telemetry hoàn chỉnh",
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
        "title": "Giải mã lệnh (Command) từ Trái Đất",
        "exerciseCode": "Lab5-02b_Receive_Command_Library",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-02b_Receive_Command_Library"
      },
      {
        "id": "video-5-3",
        "type": "video",
        "label": "Video 5.3",
        "title": "Xây dựng Trạm mặt đất để thu phát tín hiệu",
        "videoUrl": ""
      },
      {
        "id": "Lab5-03_Satellite_Comm_System",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Xây dựng hệ thống liên lạc vệ tinh và trạm mặt đất",
        "exerciseCode": "Lab5-03_Satellite_Comm_System",
        "repositoryUrl": "https://github.com/PTITCube/Lab5-03_Satellite_Comm_System"
      },
      {
        "id": "summary-5",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 5",
        "description": "Thiết lập thành công luồng giao tiếp vô tuyến hai chiều giữa vệ tinh và mặt đất."
      }
    ]
  },
  "6": {
    "objective": "Lắp ráp khung vệ tinh, chuyển đổi sang lập trình đa nhiệm, sử dụng cơ chế khóa và Bộ định thời bảo vệ vệ tinh không bị treo.",
    "lessons": [
      {
        "id": "video-6-1",
        "type": "video",
        "label": "Video 6.1",
        "title": "Giới thiệu về cơ khí và cấu trúc bảo vệ vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-6-1",
        "type": "document",
        "label": "Doc 6.1",
        "title": "Khái quát về vật liệu và cấu trúc cơ khí của vệ tinh"
      },
      {
        "id": "video-6-2",
        "type": "video",
        "label": "Video 6.2",
        "title": "Hướng dẫn lắp ráp khung vệ tinh cơ khí",
        "videoUrl": ""
      },
      {
        "id": "video-6-3",
        "type": "video",
        "label": "Video 6.3",
        "title": "Tại sao phần mềm vệ tinh cần Hệ điều hành?",
        "videoUrl": ""
      },
      {
        "id": "document-6-2",
        "type": "document",
        "label": "Doc 6.2",
        "title": "Khái niệm cơ bản về Tác vụ, Độ ưu tiên và Bộ điều phối trong Hệ điều hành Thời gian thực"
      },
      {
        "id": "document-6-3",
        "type": "document",
        "label": "Doc 6.3",
        "title": "Tranh chấp tài nguyên và cơ chế khóa bảo vệ"
      },
      {
        "id": "Lab6-01_Multitasking_Scheduler",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Chạy song song nháy đèn, đọc cảm biến, gửi thông tin",
        "exerciseCode": "Lab6-01_Multitasking_Scheduler",
        "repositoryUrl": "https://github.com/PTITCube/Lab6-01_Multitasking_Scheduler"
      },
      {
        "id": "video-6-4",
        "type": "video",
        "label": "Video 6.4",
        "title": "Thực hành gỡ lỗi treo hệ thống bằng Bộ định thời",
        "videoUrl": ""
      },
      {
        "id": "document-6-4",
        "type": "document",
        "label": "Doc 6.4",
        "title": "Bộ định thời Watchdog Timer trong hàng không vũ trụ"
      },
      {
        "id": "Lab6-02_Watchdog_And_Event",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Kích hoạt tự động khởi động lại hệ thống khi bị treo",
        "exerciseCode": "Lab6-02_Watchdog_And_Event",
        "repositoryUrl": "https://github.com/PTITCube/Lab6-02_Watchdog_And_Event"
      },
      {
        "id": "summary-6",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 6",
        "description": "Hoàn thiện bộ khung vật lý và đảm bảo độ tin cậy tuyệt đối cho phần mềm bay."
      }
    ]
  },
  "7": {
    "objective": "Lắp ráp toàn bộ các module đã học để hình thành một phần mềm bay hoàn thiện. Giải quyết các bài toán xung đột phần cứng.",
    "lessons": [
      {
        "id": "video-7-1",
        "type": "video",
        "label": "Video 7.1",
        "title": "Giới thiệu về bài toán Tích hợp Hệ thống trên vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-7-1",
        "type": "document",
        "label": "Doc 7.1",
        "title": "Kỹ thuật ghép kênh bằng IC phần cứng"
      },
      {
        "id": "Lab7-01_Camera_Multiplexer",
        "type": "practice",
        "label": "Thực hành 01",
        "title": "Chuyển mạch luân phiên phần cứng",
        "exerciseCode": "Lab7-01_Camera_Multiplexer",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-01_Camera_Multiplexer"
      },
      {
        "id": "video-7-2",
        "type": "video",
        "label": "Video 7.2",
        "title": "Phân tích luồng dữ liệu của Phần mềm bay tổng hợp",
        "videoUrl": ""
      },
      {
        "id": "document-7-2",
        "type": "document",
        "label": "Doc 7.2",
        "title": "Kiến trúc phân lớp phần mềm Vệ tinh toàn diện"
      },
      {
        "id": "Lab7-02_Full_Satellite_Program",
        "type": "practice",
        "label": "Thực hành 02",
        "title": "Phần mềm vệ tinh hoàn chỉnh với vòng lặp tuần tự",
        "exerciseCode": "Lab7-02_Full_Satellite_Program",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-02_Full_Satellite_Program"
      },
      {
        "id": "Lab7-03_RTOS_Satellite_System",
        "type": "practice",
        "label": "Thực hành 03",
        "title": "Hệ thống vệ tinh chạy đa nhiệm RTOS",
        "exerciseCode": "Lab7-03_RTOS_Satellite_System",
        "repositoryUrl": "https://github.com/PTITCube/Lab7-03_RTOS_Satellite_System"
      },
      {
        "id": "summary-7",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 7",
        "description": "Vệ tinh đã tích hợp hoàn chỉnh và sẵn sàng cho chuyến bay thử nghiệm thực tế."
      }
    ]
  },
  "8": {
    "objective": "Áp dụng Tư duy Kỹ thuật Hệ thống để sinh viên tự thiết kế, lên ý tưởng và thực hiện một Sứ mệnh Vệ tinh mang tính sáng tạo.",
    "lessons": [
      {
        "id": "video-8-1",
        "type": "video",
        "label": "Video 8.1",
        "title": "Giới thiệu về Kỹ thuật Hệ thống trong thiết kế và chế tạo vệ tinh",
        "videoUrl": ""
      },
      {
        "id": "document-8-1",
        "type": "document",
        "label": "Doc 8.1",
        "title": "Giới thiệu lược đồ ngôn ngữ mô hình hóa trong thiết kế hệ thống"
      },
      {
        "id": "document-8-2",
        "type": "document",
        "label": "Doc 8.2",
        "title": "Gợi ý ý tưởng Đồ án (Vệ tinh khí tượng, Vệ tinh cảnh báo cháy rừng)"
      },
      {
        "id": "video-8-2",
        "type": "video",
        "label": "Video 8.2",
        "title": "Hướng dẫn cách tạo ra Dashboard trực quan hóa dữ liệu vệ tinh",
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
        "id": "summary-8",
        "type": "summary",
        "label": "Tổng hợp",
        "title": "Tổng hợp Lab 8",
        "description": "Hoàn tất đồ án, sinh viên nắm vững quy trình thiết kế và vận hành sứ mệnh vệ tinh độc lập."
      }
    ]
  }
};

const INTRO_LESSONS = [
  { id: 'overview', type: 'video', label: '01', title: 'Tổng quan bài học' },
  { id: 'document', type: 'document', label: '02', title: 'Tài liệu hướng dẫn' },
  { id: 'components', type: 'components', label: '03', title: 'Thành phần' },
];

export const LESSON_TYPE_LABELS = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', summary: 'Tổng hợp', components: 'Thành phần' };
export function getLessonsForLab(labId) { return CURRICULUM[labId]?.lessons || INTRO_LESSONS; }
export function getLessonForLab(labId, requestedId) {
  const lessons = getLessonsForLab(labId);
  return lessons.find(lesson => lesson.id === requestedId) || lessons[0];
}
export const lessonUrl = (slug, lessonId) => `/${slug}?lesson=${encodeURIComponent(lessonId)}`;
