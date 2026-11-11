# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Sinh viên (Student — ưu tiên cao nhất cùng Giảng viên):** Học theo lộ trình mở khóa theo tiến trình (Lab 0 → Lab 8) trong lớp học được phân công; xem video bài giảng, đọc tài liệu kỹ thuật, lập trình C++ (Monaco) hoặc kéo thả khối Blockly, biên dịch chương trình, nạp firmware lên bộ kit vệ tinh siêu nhỏ CubeSat 1U qua Web Serial hoặc quan sát mô phỏng 3D/telemetry thời gian thực, nộp bài thực hành theo rubric và làm bài kiểm tra cuối mỗi lab (Lab Test 5/20 câu).
- **Giảng viên (Teacher — ưu tiên cao nhất cùng Sinh viên):** Tạo và vận hành lớp học (`draft → active → archived`), quản lý danh sách sinh viên, bật/tắt hoặc cấu hình 4 loại bài học (`video`, `document`, `practice`, `labtest`) và điều kiện tiên quyết mở khóa riêng cho từng lớp, quản lý ngân hàng 20 câu hỏi/lab, chấm bài thực hành đang chờ duyệt theo rubric và theo dõi bảng tiến độ/báo cáo điểm.
- **Quản trị viên (Admin):** Quản lý tài khoản toàn hệ thống, khóa/mở khóa tài khoản, cấp hoặc thu hồi quyền giảng viên và giám sát vận hành chung qua Admin Dashboard.
- **Người dùng trải nghiệm (Guest / Trial `user`):** Tài khoản `user` chưa tham gia lớp hoặc khách truy cập xem thử nội dung mở (Lab 0, `/preview`) trước khi được giảng viên thêm vào lớp học chính thức.

## Product Purpose

CubeSAT PTIT LMS (`ptit-stem-cube`) chuyển đổi trải nghiệm thực hành công nghệ vệ tinh CubeSat 1U từ công cụ phòng lab đơn lẻ thành nền tảng quản lý học tập theo lớp có lộ trình chặt chẽ. Sản phẩm giúp sinh viên làm chủ trọn vẹn chu trình kỹ thuật vệ tinh (nguồn EPS, lưu trữ CDH, cảm biến, truyền thông, đa nhiệm cơ khí & RTOS, tích hợp hệ thống và dự án Capstone) ngay trên trình duyệt, đồng thời giúp giảng viên kiểm soát chất lượng đào tạo, tiến độ thực chất và đánh giá năng lực theo chuẩn đầu ra.

## Positioning

Khác với các LMS đại trà chỉ quản lý video/trắc nghiệm hoặc các IDE nhúng rời rạc không có quản lý lớp học, CubeSAT PTIT LMS hợp nhất trong một giao diện web duy nhất:
1. **Môi trường thực hành phần cứng & mô phỏng trực tiếp trên trình duyệt:** Soạn thảo mã C++ (Monaco Editor) song song với lập trình kéo thả Blockly, biên dịch trên server, nạp firmware trực tiếp xuống mạch ESP32 CubeSat 1U qua Web Serial (`esptool-js`) và giám sát trạm mặt đất (Ground Station telemetry, biểu đồ thời gian thực, mô phỏng vệ tinh 3D Three.js và bản đồ quỹ đạo Leaflet).
2. **Quản lý học tập theo tiến trình kỹ thuật thực chất:** Tách biệt rõ thao tác biên dịch thử nghiệm với tiêu chí hoàn thành bài học (`Compile ≠ hoàn thành`), kết hợp chấm bài thực hành theo rubric và kiểm tra cuối lab (rút ngẫu nhiên 5 câu từ ngân hàng 20 câu đã duyệt của từng lab).

## Operating Context

- **Môi trường kết hợp (Hybrid Lab & Self-study):**
  - **Tại phòng thực hành (Lab trường):** Sinh viên và giảng viên làm việc trên máy tính để bàn/laptop với trình duyệt hỗ trợ Web Serial (Chrome/Edge), kết nối trực tiếp bộ kit phần cứng CubeSat 1U qua cáp USB để nạp code, đọc log Serial và kiểm chứng cảm biến/phân hệ thật.
  - **Tự học và quản lý từ xa (Ở nhà):** Sinh viên xem video, đọc tài liệu, viết nháp C++/Blockly, chạy mô phỏng 3D/telemetry, nộp báo cáo và làm bài Lab Test trên laptop phổ thông mà không bắt buộc cắm mạch mọi lúc; giảng viên cấu hình giáo trình, duyệt bài nộp và xem báo cáo lớp.
- **Cấu trúc giáo trình chuẩn hóa (Lab 0 – Lab 8):**
  - Lab 0 (Làm quen), Lab 1 (Nền tảng), Lab 2 (Năng lượng EPS), Lab 3 (Lưu trữ/CDH), Lab 4 (Cảm biến), Lab 5 (Truyền thông), Lab 6 (Cấu trúc cơ khí và vận hành đa nhiệm RTOS), Lab 7 (Tích hợp hệ thống), Lab 8 (Capstone).

## Capabilities and Constraints

- **Ngôn ngữ & quy ước đặt tên:** Toàn bộ giao diện người dùng (UI labels, thông báo, hướng dẫn, trạng thái, báo cáo) hiển thị bằng **tiếng Việt**; tên bảng, cột cơ sở dữ liệu, biến và đường dẫn API/endpoint dùng **tiếng Anh**.
- **Bốn loại bài học cố định (`video`, `document`, `practice`, `labtest`):** Không phát sinh loại bài thứ năm; mục tổng kết (`summary`) thuộc loại `document`, mục khám phá linh kiện (`components` ở Lab 0) thuộc loại `practice` tùy chọn.
- **Bảo toàn dữ liệu & chống hồi quy:**
  - Giữ nguyên khả năng tương thích với `lab_progress`, bản nháp C++/Blockly lưu trên trình duyệt và mã định danh (ID) của 26 bài thực hành Lab 2–8 hiện có.
  - Không làm hồi quy luồng đăng nhập, trình soạn thảo C++/Blockly, trình biên dịch, tải artifact, nạp firmware (flash) và telemetry.
  - Hệ thống lớp học mới vận hành qua cờ tính năng `LMS_CLASS_MODE`; các đường dẫn lab cũ (`/lab0`..`/lab8`) phải đi qua cổng kiểm tra tiến trình (`LabEntry`), không được trở thành lối vượt khóa cho lớp đã bật chế độ LMS.
- **Bảo mật & tính toàn vẹn nghiệp vụ:**
  - Phân quyền kiểm tra tại server ở mọi request dựa trên vai trò hệ thống (`admin | teacher | user`) và tư cách thành viên lớp (`teacher | student` còn hiệu lực).
  - Đáp án và giải thích của ngân hàng câu hỏi Lab Test chỉ lưu và chấm ở server; tuyệt đối không trả về trong bundle frontend hoặc response khi sinh viên đang làm bài.
  - Tiến độ phần trăm và trạng thái mở khóa (`locked | available`, `not_started | in_progress | pending_review | completed`) do backend tính toán từ sự kiện có idempotency key; biên dịch thành công (`compile`) không bao giờ tự động tính là hoàn thành bài thực hành hay hoàn thành lab.
  - Mã lỗi nghiệp vụ trả về theo cấu trúc thống nhất (`MEMBERSHIP_REQUIRED`, `FORBIDDEN_ROLE`, `PREREQUISITE_NOT_MET`, `LESSON_DISABLED`, `ATTEMPT_LIMIT_REACHED`, `ATTEMPT_EXPIRED`, `BANK_NOT_READY`, `CONFIG_INVALID`, `VERSION_CONFLICT`).
- **Giới hạn phạm vi:** Không bao gồm thanh toán, cấp chứng chỉ, giám sát thi chống gian lận qua camera/proctoring hay ứng dụng di động riêng.

## Brand Commitments

- **Định danh sản phẩm:** **CubeSAT — PTIT LMS** (`ptit-stem-cube`), sử dụng biểu trưng vệ tinh tại `src/assets/logo.svg` và `/favicon.svg`.
- **Giọng điệu & ngôn ngữ giao diện:** Tiếng Việt chuẩn xác về thuật ngữ kỹ thuật hàng không vũ trụ/nhúng (CubeSat 1U, EPS, CDH, IMU, Telemetry, RTOS, Watchdog, Web Serial) nhưng rõ ràng, hướng dẫn trực diện từng bước cho sinh viên và giảng viên.

## Evidence on Hand

- **Tài liệu nghiệp vụ & giáo trình thực tế:**
  - Kế hoạch phát triển LMS: `Docs/LMS_DEVELOPMENT_PLAN_2026-10-22.md` và nhật ký quyết định `Docs/DECISIONS.md`.
  - Dữ liệu giáo trình, bài đọc và metadata Lab 0–8: `src/data/curriculum.js`, `src/data/labs.js`, `src/data/lab-metadata.js`, `src/data/lesson-reading.js`, `Docs/CURRICULUM.md`.
- **Tài sản kỹ thuật & giao diện hiện hữu:**
  - Logo thương hiệu (`src/assets/logo.svg`), bộ biểu tượng điều hướng (`src/components/common/HeaderIcons.jsx`).
  - Không gian thực hành Lab (`src/components/layout/LabLayout.jsx`, `src/components/lab/LabWorkspace.jsx`), điều khiển nạp mạch & trạm mặt đất (`src/components/groundstation/`), và hệ thống giao diện LMS theo lớp (`src/components/classes/`, `src/pages/ClassesPage.jsx`, `ClassDetailPage.jsx`, `ClassCurriculumPage.jsx`, `ClassLearningPage.jsx`, `LearningPathPage.jsx`, `QuestionBankPage.jsx`, `ClassProgressPage.jsx`, `ClassReportPage.jsx`, `AdminDashboardPage.jsx`).
- **Ràng buộc trung thực nội dung:** Không tự bịa đặt số liệu đánh giá, chứng nhận, khách hàng, hay giả lập phần trăm xem video đối với các nguồn phát không hỗ trợ sự kiện đo thời lượng.

## Product Principles

1. **Rõ ràng trong vận hành kỹ thuật và học tập:** Sinh viên luôn biết mình đang ở bước nào trong lộ trình, điều kiện tiên quyết nào còn thiếu để mở khóa, mạch phần cứng đã kết nối Web Serial hay chưa, và bài thực hành đang ở trạng thái bản nháp, chờ duyệt hay đã đạt.
2. **Thực chất hơn hình thức:** Tiến độ phản ánh đúng năng lực đã kiểm chứng (xem đủ ngưỡng video, đọc tài liệu, nộp minh chứng thực hành đạt rubric, vượt qua Lab Test 5/20 câu) thay vì chỉ bấm mở trang hoặc biên dịch mã mẫu.
3. **Tối ưu tốc độ thao tác cho Giảng viên và Sinh viên:** Giảng viên có thể cấu hình bài học, kiểm tra độ sẵn sàng của ngân hàng câu hỏi và chấm bài theo rubric với ít thao tác nhất; sinh viên chuyển đổi mượt mà giữa lý thuyết, trình soạn thảo C++/Blockly và trạm giám sát telemetry/3D.
4. **Thống nhất giữa phòng Lab phần cứng và tự học từ xa:** Giao diện thích ứng liền mạch khi có hoặc không có thiết bị Web Serial, cung cấp thông báo trạng thái kết nối rõ ràng và không làm gián đoạn luồng học lý thuyết hay kiểm tra ở nhà.
