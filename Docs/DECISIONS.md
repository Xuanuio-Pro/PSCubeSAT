# Nhật ký quyết định

## 25/11/2026 — Sửa lỗi phát hiện khi chạy thật 39 bài trên board

- Lab3-04: nút GPIO 4 chỉ được tính khi chuyển HIGH→LOW. Trên chồng bo vệ tinh GPIO 4 là chân Buck của EPS, luôn ở mức LOW; bản cũ đọc theo mức nên bo reset khoảng 6 s một lần ngay khi khởi động. Giữ GPIO 4 (không đổi chân) để PCB thí nghiệm rời vẫn chạy như upstream; trên chồng bo, sketch in hướng dẫn dùng lệnh `f`.
- Lab4-02a: ghi rõ ACCEL_CONFIG/GYRO_CONFIG về ±2 g / ±250 °/s. MPU6500 giữ dải ±8 g / ±500 °/s do thư viện đặt khi chỉ reset ESP32, nên hệ số 16384/131 cho gia tốc nhỏ đi khoảng 4 lần.
- Lab1-03_Button/Lab1-04 báo "nhấn" ngay khi khởi động chỉ vì lúc test chúng chạy trên chồng bo. Theo `lesson-reading.js`, Lab 1 chạy trên PCB rời, nên đây không phải lỗi code. Panel `lab1Io` mới có ghi chú về việc này.
- Trực quan: thêm panel `lab1Io` (trạng thái LED/nút cho Lab1-01, 1-03_Button, 1-04, 1-07, lấy từ dòng log). Lab4-06 in trạng thái GPS chưa fix và gửi ảnh về qua Serial. Lab7-01/7-02 in `[LORA TX] n goi telemetry` sau mỗi đợt phát; dòng này là yêu cầu phát ở OBC, không phải ACK của trạm mặt đất. Lab7-01 gửi `gps.valid=false` khi chưa fix. Bộ giải mã phát sự kiện `gps:waiting` khi JSON báo chưa fix, để System Check có bằng chứng GPS.
- V4–V11: các thông tin không có trong schema telemetry (hướng la bàn, số vệ tinh, SOC/tốc độ sạc/chế độ nguồn, tiến độ nhận ảnh, chu kỳ task khai báo, dòng `[BOOT]`) được truyền bằng sự kiện activity, không thêm trường vào `shared/telemetry.schema.json`. Lý do: schema dùng chung với backend và MQTT, còn các giá trị này chỉ phục vụ hiển thị trong bài thực hành.
- Panel 3D chỉ dùng chế độ "số đếm thô" của Lab4-02a khi log thật sự có dòng `raw_accel:` (bản nháp cũ). Sketch hiện tại in m/s² như Lab4-02b, nên trước đó panel luôn ở trạng thái "chờ IMU".
- Lab7-02 bỏ panel camera: lệnh `f` chỉ lưu ảnh vào SD, không gửi ảnh về; kết quả chụp vẫn hiện ở "Kết quả thực hành".
- Bản nháp C++/Blockly của sinh viên lưu trong trình duyệt không tự cập nhật khi mã mẫu đổi (quy tắc 3: không xóa bản nháp). Ai đã dán Lab4-02a cũ phải tải lại mã mẫu để có bản sửa dải đo.

## 25/11/2026 — Gỡ 8 bài thực hành cũ khỏi catalog

- Xóa `Lab2-01_Detect_Battery_Voltage`, `Lab3-01_Save_To_MicroSD`, `Lab4-01_Detect_Environment`, `Lab4-02_Detect_IMU_Attitude`, `Lab4-03_Detect_GPS_Rawdata`, `Lab4-04_Camera_Snapshot`, `Lab5-01_Send_Telemetry`, `Lab5-02_Receive_Command` (file `.cpp` và mục trong `catalog.json`; catalog còn 39 bài, trùng với các bài trong `seed.json`).
- Đây là ngoại lệ có chủ đích với quy tắc 3 (giữ ID bài thực hành), theo yêu cầu của Xuân. Nó thay quyết định "giữ nguyên ID 8 bài cha" ở mục ngày 25/11 bên dưới. Lý do: upstream PTITCube đã xóa các repo này ngày 24/11, các bài không còn trong `seed.json`, và báo cáo kiểm tra code tìm ra lỗi ở 2 bài (Lab2-01 đọc điện áp đứng yên, Lab5-02 không in lệnh nhận được).
- Rủi ro còn lại: các ID này nằm trong giáo trình từ 11/11 đến 18/11/2026. Lớp nào xuất bản trong khoảng đó trên server mà còn ghim phiên bản giáo trình cũ sẽ không tải được mã mẫu cho các bài này (`GET /api/curriculum/exercises/{id}` trả 404). DB dev không có tham chiếu nào; DB server chưa được kiểm tra. Tiến độ `lab_progress` và bản nháp trình duyệt không bị xóa. Biên dịch vẫn chạy với mã người dùng gửi lên.

## 25/11/2026 — Sửa dứt điểm lỗi "Compiler sandbox chưa sẵn sàng hoặc trả dữ liệu không hợp lệ"

- Nguyên nhân thật là image compiler và backend lệch phiên bản cấu hình build. Backend băm `build_config.py` (pin thư viện, revision override) và chỉ nhận artifact từ image build với đúng cấu hình đó. Hai đường gây lệch:
  - Hai `dev.py` cùng nghe cổng 8005 (Windows cho bind trùng), bản cũ vẫn trả lời request.
  - `setup-local` chỉ build image compiler khi chưa có image. Container backend local được build lại nhưng `pscubesat-compiler:1` vẫn cũ, hoặc ngược lại.
- Sửa:
  - `setup-local.ps1/.sh` luôn build image compiler, dùng `--provenance=false`. Cache lớp làm lần build không đổi mất vài giây (cả lần cài lại khoảng 25 s), và ID image giữ nguyên nên `catalog.json` ghi được ID ổn định.
  - `dev.py` từ chối khởi động khi cổng 8005 đã có backend.
  - Lỗi lệch cấu hình có mã riêng `COMPILER_VERSION_MISMATCH` kèm hướng dẫn, thay cho thông báo chung chung.
  - `prepare.py` không chép `README.md` override vào thư viện, `.dockerignore` loại file này để sửa tài liệu không làm hỏng cache image.
- Stack local `pscubesat-local` được dựng lại bằng `compose down` (giữ volume) và `setup-local.ps1 install`. Kiểm tra:
  - 47/47 sketch biên dịch trong chính container backend local.
  - Thư viện trong image khớp từng file với `74065b6` cùng override.
  - `catalog.json` ghi image `sha256:c5122d4e…`.
- Đã xóa image `pscubesat-compiler:v6-backup`, cùng bản v8 tạm và các image backend/frontend cũ. Giữ `pscubesat-compiler:v7-candidate` để quay lui.
- `deploy/initialize-cubesat.sh` (server) vốn đã build image compiler ở mỗi lần triển khai, nên không đổi. Không thêm `--provenance` ở đó vì chưa biết bản Docker trên server.

## 25/11/2026 — Cập nhật PTITCube-Library `74065b6` và 39 sketch theo các repo PTITCube (24/11)

- Thư viện: ghim `PTITCube-Library@74065b64f670…`, cũng là bản mà mọi repo Lab vendor trong `lib/PTITCube`. Bố cục mới `CDH/{Scheduler,Storage,WDT}`, `MUX/{MUX,Camera,GPS}`, nên override được dựng lại theo đường dẫn mới, revision compiler **v8** (`compiler/overrides/README.md`). Upstream đã tự nhận các bản vá CDH (console ESP32-S3, timeout WiFi) và MPU6500, nên bỏ override tương ứng.
- Giữ các bản vá vẫn còn cần: UART2 dùng một instance và đổi baud tại chỗ; camera không MUX giữ 115200; kiểm tra JPEG khi chụp; GPS fix tối đa 5 s; Storage đếm byte ghi (sửa luôn `touch`); cảm biến trả NaN thay vì giá trị cũ.
- Thêm bản vá mới: mutex bus dạng **đệ quy**. Thư viện tự khóa I2C/SPI trong `Sensor::update()`/`logData()`, còn Lab7-02 đã giữ khóa đó khi gọi, nên mỗi lần gọi lại chờ 100 ms rồi chạy mà không có khóa.
- Đơn vị từ trường của thư viện đổi từ Gauss sang **µT**: sketch không nhân 100 nữa; nhãn `[TELEMETRY] Mag` trên giao diện dùng hệ số 1.
- Sketch: merge 3 chiều (base = commit upstream cũ trong `catalog.json`, ours = bản local, theirs = upstream 24/11), giữ nguyên ID bài (quy tắc 3) dù upstream đổi tên repo:
  - Lab 1 đánh số lại 01–11.
  - Lab3-04 → `Lab3-04_Watchdog_Timer`; Lab5-03 → `Lab5-03_Ground_Station_Demo`.
  - Lab4-05/06 đổi chỗ (`Lab4-05_Read_All_Sensors` ↔ repo `Lab4-06_Read_All_Sensors`).
  - `repositoryUrl` trỏ tới repo mới.
- Theo upstream về logic, API và log; chỉ giữ hoặc thêm bản vá an toàn và trung thực:
  - GPS chỉ in tọa độ khi `hasFix()` (Lab4-03c, đọc tổng hợp, Lab5-03); upstream in 0,0 khi chưa fix.
  - Lab4-02a đọc byte cao/thấp tách riêng.
  - Lab4-01a không in số rác khi thiếu BMP280.
  - Camera: kiểm tra JPEG, tên ảnh không ghi đè, gửi ảnh về Camera Viewer.
  - Thẻ nhớ: báo lưu theo kết quả ghi thật.
  - Lab3-05 khôi phục debounce.
  - Lab5-01a kiểm tra AUX.
  - Lab7-02: cờ atomic, khóa LoRa/UART2, JSON `null` cho NaN.
- Lab7-02 upstream bỏ MQTT và lệnh dạng chữ, chuyển sang lệnh 1 ký tự `a`–`f`/`p`/`r` qua LoRa. Làm theo upstream: panel `network` bỏ, thêm `groundStation`. MQTT cho Lab 7 làm lại theo `Docs/MQTT_PLAN_2026-11-18.md`.
- Giao diện: bộ đọc log (`src/telemetry/practice.js`) nhận cả định dạng log mới lẫn cũ (bản nháp cũ của sinh viên vẫn hiển thị). Shell Lab3-02: thư viện trả chuỗi rỗng khi thành công, sketch in `OK`. Lệnh nhanh: Lab3-04 `f`, Lab3-02 `rmdir demo`, Lab4-06 `p`.
- `camera-slave` nhận thêm `capture`/`photo` (mọi kiểu chữ) như ESP32_CAM_Firmware upstream. Phần còn lại của firmware camera upstream (đèn flash PWM, ngủ khi rảnh) chưa merge.
- Bài "cha" không còn repo upstream (8 bài) giữ nguyên ID, biên dịch lại với thư viện mới.
- Đối chiếu log ↔ trực quan hóa: `tests/practice-firmware-logs.test.js` liệt kê mọi dòng mà 39 sketch và thư viện in ra (kể cả nhánh lỗi), kèm dữ liệu panel phải đọc được. Test cũng kiểm tra mỗi panel của bài đều có nguồn dữ liệu từ log, và mọi chuỗi in trong sketch đều có trong danh mục. Quy ước:
  - Điện áp MAX17048 ≤ 0,5 V coi là chưa đọc được (cùng ngưỡng với Lab 7), không hiển thị 0 V.
  - "Hello World #n" của Lab 3 không còn bị tính là sự kiện Serial của Lab 1.
  - Lab 3.5 có thẻ Dispatcher; System Check của Lab 7.2 bỏ hàng WiFi/MQTT.
- Tiêu đề bài ("Yêu cầu thực hành") sửa cho khớp code: 4.1b, 4.2a, 4.6, 5.1a (không cấu hình thanh ghi), 5.1b (không đóng gói CRC), 5.2b (chỉ nhận và in lệnh).
- Chưa làm, cần nhóm chốt:
  - Đổi thứ tự 4.5/4.6 trong giáo trình (ảnh hưởng thứ tự mở khoá và phiên bản khóa học của lớp).
  - Đối chiếu tên bài và mô tả mới của README `PTITCube/.github` (commit `3ba1246`).
  - Kiểm thử trên phần cứng thật.

## 19/11/2026 — Áp giao diện mới của Quân (`quanna1402:fix/frontend-v1`)

- Commit của Quân gộp 282 file trên nền `main` cũ. Phần thay đổi thực, tính so với `develop` (`2adb3ab`), được áp bằng 3-way merge. Chỉ lấy đúng phạm vi: trang loading, sidebar các lab, giao diện Lab 0 (nền, thẻ có tab nổi, icon, font) và các asset đi kèm.
- Không lấy: bỏ `require_lms_enabled` ở API quản lý tài khoản (thay đổi phân quyền phía server, không phải UI), `AdminDashboardPage` (giao diện admin chưa sửa), chỉnh `dev.py`/`scripts/python.mjs` theo máy cá nhân, xoá các file thừa của template Vite.
- Có lấy endpoint `POST /api/progress/{lab}/lessons/{lesson}/reset` (kèm test), vì nút "Đã hoàn thành" của giao diện mới dùng để đặt lại bài. Endpoint chỉ đổi tiến độ của chính người gọi về chưa hoàn thành, nằm trong router legacy nên chịu `require_legacy_allowed`. Sinh viên lớp pilot không dùng được, và endpoint không mở khoá thêm bài nào.
- Mở rộng "các phần giống thế": `LabFigView` dựng được mọi loại mục (video, tài liệu, 3D, thực hành, câu hỏi, tổng hợp, Lab Test, lắp ráp, bài đang khoá). Giao diện này dùng cho Lab 0–8 ở đường cũ và cho trang học theo lớp (`ClassLearningPage`). Header kiểu mới bật ở mọi trang học.
- Trang học theo lớp giữ nguyên nghiệp vụ: % tiến độ lấy từ backend, hoàn thành gửi sự kiện có idempotency key và chờ đủ 60 giây, không có nút đặt lại tiến độ.
- Tiến độ trên trang và sidebar chỉ đếm bài tuần tự (không tính câu hỏi/Lab Test), theo `isSequentialLesson`.
- Bổ sung responsive cho màn hình hẹp (≤720px), vì giao diện Lab 0 gốc chỉ thiết kế cho desktop.

## 18/11/2026 — Gộp nhánh cấu trúc lab (Xuân) với quiz theo bài (Trung, PR #4)

- Lab 0 và Lab 1 theo mô hình quiz theo bài của Trung: `quiz-0-1`…`quiz-0-3`, `quiz-1-1`…`quiz-1-13` là bài `quiz` thật trong course model, có ngân hàng câu hỏi riêng và chấm ở server. Các trang checkpoint tự ôn cũ của Lab 0/1 (`quiz-doc-*`, `quiz-practice-*`) bị bỏ. Hai nhánh này chưa từng phát hành nên không có tiến độ nào trỏ vào chúng.
- Lab 2–8 giữ cấu trúc của Xuân. Các trang câu hỏi có `checkpointId` chỉ là trang tự ôn ở giao diện cũ, không xuất vào course model. Lý do: chưa có ngân hàng câu hỏi, và nếu bật chúng thì việc xuất bản cấu hình lớp sẽ bị chặn (`QUIZ_BANK_NOT_READY`).
- Lab 1 giữ bài `Lab1-03_PWM_LED` (đứng sau `Lab1-02`, nhóm "LED") và trang Lab Test của Xuân. Thứ tự và ID doc/video lấy theo Trung (`doc-1-3`…`doc-1-8`, `video-1-5`). Phần đọc theo chủ đề trong `lesson-reading.js` được chuyển sang ID mới.
- Exporter chỉ dùng file nội dung phía server (`firmware/curriculum/lab0|lab1/*.md`) khi file đó có nội dung. Khi file còn rỗng thì dùng phần đọc sẵn có, để tài liệu Lab 0/1 hiện tại không bị trống. Seed có 135 bài: 119 bài cũ cộng 16 bài quiz.
- Migration `0019_merge_reset_and_quiz` gộp hai head `0015_password_reset_tokens` và chuỗi `0015_lesson_type_quiz`…`0018_quiz_reveal_after_pass`, không thay đổi schema. Điểm merge không dùng được `downgrade -1`; muốn lùi thì lùi về từng parent.
- Rollback theo hướng của Trung (19/11/2026): khi đã có bài quiz hoặc ngân hàng quiz theo bài, `0015`/`0016` từ chối downgrade. Alembic chạy toàn bộ lệnh trong một transaction, nên lệnh bị từ chối không thay đổi gì và DB ở nguyên head. Các test PostgreSQL opt-in kiểm tra đúng hành vi này qua `cli_refused`: lệnh lùi phải thất bại, `alembic_version` và dữ liệu không đổi. Riêng `test_backfill_keeps_old_published_path` mô phỏng DB cũ bằng seed không có bài quiz, nên vẫn lùi về `0009_quizzes` được. Muốn lùi một DB thật qua 0015 thì phải xoá các phiên bản giáo trình có bài quiz và ngân hàng quiz theo bài trước.

## 13/11/2026 — Cấp lại mật khẩu khi người dùng quên

- Kế hoạch không mô tả luồng quên mật khẩu và hệ thống chưa có hạ tầng gửi email (SMTP), nên chọn phương án an toàn nhất về quyền: chỉ quản trị viên cấp lại, qua `POST /api/admin/users/{user_id}/reset-password` (role đọc từ DB, theo cờ `LMS_CLASS_MODE` như các API `/api/admin/users` khác).
- Server tự sinh mật khẩu tạm ngẫu nhiên, chỉ trả về một lần cho quản trị viên; không nhận mật khẩu từ client, không ghi mật khẩu vào log hay `audit_logs` (chỉ ghi `user.password_reset`, actor, target).
- Không cấp lại cho chính mình (dùng đổi mật khẩu ở trang Hồ sơ) và không cấp lại cho tài khoản admin khác, tránh chiếm quyền quản trị. Giảng viên không có quyền này.
- Giả định/rủi ro còn lại: JWT đã phát trước đó vẫn hiệu lực đến khi hết hạn (chưa có cơ chế thu hồi toàn bộ phiên theo người dùng); chưa bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp; tự đặt lại qua email là phần mở rộng khi có SMTP.
## 18/11/2026 — Cấu trúc Lab 1 theo khung Lab 0 (LAB1-01)

- Lab 1 có 36 mục: Video 1.1-1.3, Doc 1.1-1.8, 13 mục `quiz` (`quiz-1-1`…`quiz-1-13`) sau từng doc và từng nhóm thực hành, 10 bài thực hành, `summary-1` và `labtest-1`. Doc, tổng hợp và video là khung rỗng ở `fastapi-backend/app/firmware/curriculum/lab1/` (giảng viên bổ sung sau); quiz và Lab Test chỉ là khung (mặc định tắt, câu hỏi do giảng viên soạn).
- Giữ nguyên 10 ID thực hành `Lab1-01`…`Lab1-10` cùng mã nguồn; danh sách yêu cầu có thêm `Lab1-03_PWM_LED` và đánh số lại, nhưng chưa có mã và đổi ID sẽ mất tiến độ nên chưa thêm. PWM được dạy trong Doc 1.3 như kiến thức mở rộng. Bài 74HC595 vẫn là `Lab1-05_7_Segment_LED` (điều khiển trực tiếp 7 chân), Doc 1.5 giải thích cách chuyển sang 74HC595.
- ID mới: `doc-1-3`…`doc-1-8` và `video-1-5` (Video 1.3 về WiFi) để không đổi nghĩa `document-1-3`, `document-1-4`, `video-1-3`, `video-1-4` cũ; các ID cũ này không còn trong phiên bản giáo trình mới. Lớp đã ghim phiên bản cũ không bị ảnh hưởng; nâng lớp lên cấu trúc mới cần script nâng cấp riêng (chưa làm), tiến độ doc/video cũ không chuyển sang ID mới.
- Lab Test của Lab 1 hướng tới 10 câu (giảng viên cấu hình trong ngân hàng, không còn ràng buộc cứng số câu).

## 18/11/2026 — Quiz theo bài và nâng cấp lớp lên Lab 0 mới (LAB0-02)

- Mỗi bài `quiz` có ngân hàng câu hỏi và chính sách riêng, khoá theo `lesson_id` (migration `0016_lesson_quiz_banks`; bank và chính sách cũ được gán `labtest-<lab>`). Giảng viên soạn, duyệt, xuất bản câu hỏi và đặt số câu mỗi lượt (1-20), điểm đạt, thời gian, số lượt ngay trong Cấu hình chương trình. Lab Test giữ nguyên: đúng 20 câu đã duyệt, mỗi lượt rút 5 câu.
- Quiz theo bài chỉ hoàn thành bằng cách đạt điểm (`finalize`), không có nút "Hoàn thành". Bật một bài quiz chưa có ngân hàng đã xuất bản bị chặn khi xuất bản cấu hình (`QUIZ_BANK_NOT_READY`), vì bài quiz không thể hoàn thành sẽ khoá mọi bài sau nó trong lab.
- Lớp đã xuất bản bị ghim vào một phiên bản giáo trình; không có đường nâng cấp trên giao diện. Thêm `fastapi-backend/scripts/upgrade_class_course_version.py`: một giao dịch tạo cấu hình lớp mới, trỏ lại tiến độ, lượt thi, ngân hàng câu hỏi sang phiên bản mới và xuất bản. Mặc định chỉ thay Lab 0 (tạo phiên bản giáo trình lai: Lab 1-8 của lớp giữ nguyên, Lab 0 lấy từ bản mới nhất), vì lớp 1 đang dùng bản giáo trình trước khi cấu trúc lại Lab 1-8 và nhiều ID bài đã đổi tên.
- Bài mới của Lab 0 được chép vào lớp ở trạng thái TẮT để sinh viên đã hoàn thành Lab 0 không mất hoàn thành và Lab 1+ không bị khoá; giảng viên bật sau khi thêm nội dung. Lớp 1 đã được nâng cấp ngày 18/11/2026 trên cơ sở dữ liệu dev (40 dòng tiến độ giữ nguyên), có sao lưu `pg_dump` trước đó.
- Xem trước công khai cho khách vẫn chỉ gồm `components`; không mở thêm bài nào.
- Cập nhật cùng ngày (migration `0017_quiz_all_approved`): bỏ ràng buộc "đúng 20 câu, rút 5" của Lab Test và "số câu mỗi lượt" của quiz. Mỗi lượt làm bài gồm toàn bộ câu đã duyệt (xáo trộn); giảng viên thêm bao nhiêu câu thì sinh viên làm bấy nhiêu. Xuất bản cần ít nhất 1 câu đã duyệt. Điểm đạt được giới hạn không vượt số câu của lượt khi bắt đầu.
- Công bố đáp án mới `after_pass` (migration `0018_quiz_reveal_after_pass`), thành mặc định: lượt nộp đạt điểm tối thiểu thấy giải thích ngay; lượt chưa đạt vẫn ẩn đến khi hết lượt để còn làm lại. Sau khi đáp án đã được công bố thì khóa làm lại. Giải thích hiện ngay dưới từng lựa chọn (khóa theo id lựa chọn, đúng cả khi đề bị xáo thứ tự); trước đây nhãn "Phương án A-D" dùng id gốc nên lệch với thứ tự hiển thị. Chính sách cũ `after_attempts` được chuyển sang `after_pass`; các lượt đã làm giữ chính sách đã chụp.

## 17/11/2026 — Khung rỗng Lab 0 và loại bài mới `quiz` (LAB0-01)

- Lab 0 có 10 mục: Video 0.1 (`overview`), Doc 0.1 (`document`), câu hỏi `quiz-0-1`, Doc 0.2 (`document-0-2`), câu hỏi `quiz-0-2`, Video 0.2 (`video-0-2`), Thực hành 3D (`components`), câu hỏi `quiz-0-3`, Tổng hợp (`summary-0`) và `labtest-0`. Giữ nguyên ID cũ `overview`, `document`, `components` để không mất tiến độ đã lưu.
- Thêm loại bài `quiz` (migration `0015_lesson_type_quiz`) thay vì gắn câu hỏi vào bài cha, vì người dùng muốn mỗi bộ câu hỏi là một mục riêng trên menu. Việc này lệch kế hoạch LMS (4 loại bài), nên ghi lại tại đây. `quiz` mặc định tắt, không bắt buộc, không thể tự hoàn thành bằng sự kiện `complete` từ client, và không có đáp án trong dữ liệu seed.
- Đáp án chỉ lưu ở server: `fastapi-backend/app/firmware/curriculum/lab0/quiz-*.json` và `labtest-0.json` là chỗ dự trữ, exporter không đọc nên không vào `seed.json` hay bundle. Bộ nạp câu hỏi/chấm quiz theo bài chưa làm.
- Xem trước công khai giữ nguyên ranh giới cũ: chỉ `components` có `preview_allowed=true`; khách không thấy các mục mới của Lab 0. Downgrade `0015` từ chối chạy nếu còn bài `quiz`, tránh làm mất dữ liệu.
- Chưa làm: mô hình 3D WebGL, nội dung video/tài liệu/câu hỏi. Các lab 1-8 không đổi.

## 08/11/2026 — Mở rộng soạn đề Lab Test 4 dạng câu hỏi & đề mẫu tham khảo (QUIZ-01/02)

- Hỗ trợ 4 dạng câu hỏi theo cấu trúc đề mẫu: `single_choice` (Phần I: 1 đáp án đúng), `multiple_choice` (Phần II: nhiều đáp án đúng `a|b|d`), `true_false` (Phần III: Đúng/Sai 4 mệnh đề `a:Đ|b:S|c:S|d:Đ`, hỗ trợ tiền tố `[0,1,2,...]` điều khiển thứ tự đảo mệnh đề khi sinh đề), và `short_answer` (Phần IV: trả lời ngắn).
- Cho phép giảng viên mở và soạn câu hỏi/đáp án trực tiếp ngay tại mục Lab Test trên trang Cấu hình chương trình (`ClassCurriculumPage`) hoặc trang Ngân hàng câu hỏi (`QuestionBankPage`), tự động khởi tạo ngân hàng nếu lớp chưa lưu nháp lần đầu.
- Bổ sung bộ đề mẫu tham khảo tải về (`/templates/labtest-sample-exam.txt`, `/templates/question-bank.xlsx`, `/templates/answer-sheet-sample.csv`) và hỗ trợ nhập câu hỏi từ tệp `.xlsx`, `.csv`, `.txt`/`.md`, `.json` hoặc dán trực tiếp văn bản đề mẫu.

## 07/11/2026 — Nhập danh sách sinh viên hàng loạt từ Excel/CSV (CLASS-02)

- Giữ nguyên chức năng thêm từng sinh viên bằng email (`POST /api/classes/{class_id}/members`) và bổ sung `POST /api/classes/{class_id}/members/import` (cùng mẫu tải về `/templates/class-students.xlsx`, `/templates/class-students.csv` và `GET /api/classes/templates/students?format=xlsx|csv`).
- Cấu trúc mẫu gồm cột `email` (bắt buộc) và `full_name` (tùy chọn để giảng viên đối chiếu, không tự ý ghi đè họ tên tài khoản đã đăng ký). Hỗ trợ cả `.xlsx` và `.csv` (tối đa 1 MB, 500 dòng/lần, kiểm tra chống XML entity/zip bomb).
- Xử lý theo từng dòng hợp lệ (theo lựa chọn của người yêu cầu): thêm mới hoặc khôi phục membership `student` cho các email đã có tài khoản `active` (kèm `audit_logs`), giữ nguyên sinh viên đang active, và trả về danh sách chi tiết các dòng bị bỏ qua (`NOT_REGISTERED`, `ACCOUNT_LOCKED`, `IS_TEACHER`, `INVALID_EMAIL`, `DUPLICATE_IN_FILE`, `EMPTY_EMAIL`).

## 26/10/2026 — Dashboard, migration, pilot (Sprint 5)

- Cờ theo lớp (người yêu cầu chọn): `LMS_CLASS_MODE` vẫn là công tắc tổng; mỗi lớp có `lms_mode` = `enabled` | `read_only` | `off`, chỉ Admin đổi, bắt buộc lý do, có audit. Lớp mới và lớp có trước migration 0010 mặc định `enabled` để giữ hành vi đã chạy dưới cờ tổng.
- Đường legacy (`/api/progress`, compile không ngữ cảnh lớp, `/api/curriculum/legacy|exercises|source`, mã mẫu Lab 1) bị chặn theo **từng user**: chỉ SV đang thuộc lớp `enabled`/`read_only` (lớp chưa lưu trữ). User ngoài pilot giữ luồng cũ như trước (kế hoạch 10.5). Đây là thay đổi so với Sprint 2–4, khi cờ tổng bật thì chặn mọi user. Request có `class_id`/`lesson_id` luôn đi đường kiểm quyền lớp.
- Rollback lớp (người yêu cầu chọn): `read_only` chặn mọi request ghi của lớp (`CLASS_READ_ONLY`, GET vẫn đọc được), SV vẫn bị chặn đường legacy và được hướng tới nội dung trải nghiệm. `off` mới đưa SV của lớp về luồng cũ. Worker vẫn chấm lượt thi hết giờ theo đáp án đã lưu trong lúc lớp chỉ-đọc.
- URL cũ `/labN?lesson=`: lớp hợp lệ = SV active, lớp active + `enabled`, có chương trình đã xuất bản bật lab (và bài nếu có `lesson`). Một lớp → vào lớp; nhiều lớp → chọn lớp; không lớp → luồng cũ nếu user ngoài pilot, trải nghiệm nếu là SV pilot.
- SV hoạt động 7/30 ngày = có `progress_event` không phải thao tác của GV (`override`), hoặc bắt đầu lượt Lab Test trong khoảng thời gian. Đăng nhập không được tính. Tỷ lệ hoàn thành lab tính trên SV active của lớp active, lớp không `off`, có lab đó được bật. Điểm Lab Test trung bình = trung bình điểm cao nhất mỗi SV.
- Báo cáo/CSV chỉ cho GV/Admin của lớp. CSV có BOM UTF-8 và chặn công thức (ô bắt đầu `= + - @`). Lịch sử `lab_progress.compiled_at` chỉ hiển thị, không tính hoàn thành; GV công nhận bằng miễn bài có lý do.
- Migration dữ liệu: không bảng mới cho legacy (lab_progress đã là lịch sử). Công cụ `app.services.legacy_migration` chạy chỉ-đọc khi báo cáo/dry-run; nhập lớp pilot dùng lại service tạo lớp/thêm SV (audit, khôi phục membership), chỉ từ danh sách email cụ thể, dừng nếu danh sách có lỗi.
- Kiểm thử tải: Sprint 1 chưa chốt con số, dùng mặc định 300 SV đồng thời trong một lớp, một worker như production. E2E/tải ở mức API, không thêm Playwright/Locust (người yêu cầu chọn).

## 22/10/2026 — Tiến độ và lộ trình (Sprint 3)

- lesson_version = course_version_id + '/' + lesson_id. Membership phân tách lớp; đổi enabled/required/order trong revision cấu hình không xóa kết quả bài. Course version gốc bất biến, đổi course cần migration riêng. Kết quả completed/waived đã có được giữ khi sửa params; submission lưu rubric/policy tại thời điểm nộp để đối soát.
- Chính sách bản đầu: miễn bài có lý do của GV được tính thỏa yêu cầu (allow_waivers=true). Unlock lab chỉ miễn điều kiện truy cập, không tạo hoàn thành. Các override được ghi riêng cùng actor/lý do và audit; không nhập điểm giả. Không import lab_progress legacy thành kết quả LMS.
- Mở khóa thủ công chỉ áp dụng revision cấu hình đã cấp; xuất bản cấu hình mới cần GV cấp lại nếu vẫn phù hợp. Kết quả completed/waived gắn lesson_version vẫn được giữ.
- Prerequisites lưu theo class_id + config version; backfill snapshot đã xuất bản theo đúng dữ liệu cũ, không tự đổi lộ trình lớp đang học. Template mới dùng phân nhánh mục 5.2; GV có thể áp dụng tuần tự hoặc sửa thủ công trong bản nháp.
- Ghi tiến độ chỉ cho membership student active của chính người gọi; GV/Admin xem thử không ghi sự kiện. Nội dung lab khóa chỉ trả metadata và lý do, API mã mẫu/compile/events/submissions cùng kiểm điều kiện. API progress legacy bị chặn khi LMS_CLASS_MODE bật.
- Video native HTML5 đo các đoạn phát; server dùng duration_seconds và watch_ratio đã cấu hình, hợp nhất đoạn không trùng, mỗi đoạn tối đa 60 giây. Không tin duration/%/status gửi từ client. Nguồn iframe không đo được chỉ cho xác nhận khi GV bật confirmation_allowed. Sự kiện trình duyệt là chỉ báo học tập, không phải cơ chế chống gian lận tuyệt đối.
- Bài nộp lưu phiên bản code, rubric, membership và lesson_version. Chỉ bản nộp mới nhất được chấm để thay đổi kết quả; pending_review chưa đạt, yêu cầu sửa quay về in_progress. Nộp lại sau completed/waived không thu hồi thành quả trước đó. Lớp archived chỉ đọc.
- Event/submission/override dùng idempotency key và transaction. Cùng key khác nội dung/ngữ cảnh trả VERSION_CONFLICT. Membership được khóa khi ghi để tuần tự hóa cập nhật; không ghi đè % từ frontend.
- Giữ khóa localStorage cũ; scoped editor chỉ nhập bản cũ khi người dùng chọn nút phục hồi. Không tự đọc legacy key khi mở bài học. UI tiếp tục skill frontend-design: màu/font hiện có, sơ đồ lab với khóa/lý do, thanh tiến độ và dashboard bảng SV × lab; không thêm trang trí không phục vụ việc học.

## 22/10/2026 — Giáo trình và cấu hình theo lớp (Sprint 2)

- ID lab 0–8 và ID lesson hiện có được giữ nguyên; khóa DB gồm course_version_id + ID để lưu nhiều phiên bản mà không đổi định danh bài. Seed tạo snapshot xuất bản, kiểm hash nguồn và từ chối ghi đè snapshot đã đổi; nội dung thiếu là TODO, không tự tạo hướng dẫn kỹ thuật hay câu hỏi.
- Lớp có các revision cấu hình; chỉ revision published mới được SV đọc, draft là bản làm việc riêng. Mỗi revision gắn một course version đã published. GV chọn course version khi lưu nháp đầu tiên; không tự gán giáo trình cho lớp. Không cho chuyển course version sau lần xuất bản đầu (chuyển phiên bản lớp đang học cần quy trình migration riêng).
- Settings API nhận toàn bộ labs/lessons và expected_version để chống ghi đè. Params chỉ cho phép trường được định nghĩa theo loại bài; không nhận đáp án/giải thích/câu hỏi test. Video/document có thể được GV bổ sung qua params của lớp; không sửa course version gốc. Lab có enabled/prerequisites trong snapshot để kiểm phụ thuộc và chu trình.
- Seed giữ 84 ID cũ (81 mục Lab 1–8 và 3 mục Lab 0), thêm 9 slot labtest chưa có ngân hàng và để disabled/optional mặc định. Summary giữ ID, đổi type=document, title=Tổng kết; components giữ ID, đổi practice tùy chọn. Video URL trống/URL mẫu Lab 0 không được coi là sẵn sàng. Labtest chưa triển khai thi được chặn nếu đặt required.
- Preview là đường API riêng, chỉ trả preview_allowed từ snapshot course đã xuất bản; không cấp quyền quản trị lớp. Thành viên removed vẫn bị chặn trên đường theo lớp, không tự fallback sang preview. Preview GV dùng cấu hình draft và không gửi bất kỳ event tiến độ/compile.
- Gỡ nội dung tĩnh khỏi toàn bộ import graph browser (kể cả flag tắt) và cung cấp legacy qua API khi flag tắt. Flag bật thì /labN chuyển sang lớp/preview, API legacy bị chặn; không dựa vào biến build frontend để bảo vệ học liệu. JS seed vẫn nằm trong repo nhưng không được đóng gói vào assets production.
- Khi bật flag, compile yêu cầu class_id + lesson_id đã bật trong bản published, kiểm membership; compile không ghi completed_at. Preview không được compile. Cờ tắt vẫn hỗ trợ công cụ cũ; compiled_at chỉ là lịch sử build, không tạo hoàn thành mới. Không xóa kết quả legacy đã có. Đây là thay đổi cần thiết để đường cũ không vượt quyền lớp và tuân thủ Compile ≠ hoàn thành.
- UI tiếp tục dùng skill frontend-design đã đọc: màu và font của Sprint 1, danh sách lab có thể mở rộng, hàng bài với bật/tắt/bắt buộc, form tham số theo loại, lỗi đặt cạnh bài và xác nhận tác động trước xuất bản. Khung xem thử ghi rõ “Xem như sinh viên”, không có nút ghi tiến độ.

## 22/10/2026 — Phạm vi Sprint 1

- Chỉ triển khai tài khoản và quản trị lớp. Theo chỉ đạo trực tiếp, giữ nguyên progress/compiler/curriculum, kể cả quy tắc compile legacy. Lớp Sprint 1 chưa gán giáo trình hoặc có khóa tiến trình; không công bố đây là pilot khóa học hoàn chỉnh.
- `LMS_CLASS_MODE=false` mặc định, kiểm tra phía server cho API mới; GET `/api/lms/config` trả cờ cho frontend đã đăng nhập. Khóa tài khoản áp dụng cho mọi API đăng nhập bất kể flag. Không dùng cờ frontend độc lập để cấp quyền.
- Admin quản lý được mọi lớp. GV cần đồng thời role hệ thống teacher và membership teacher active của lớp. Thu hồi teacher về user vô hiệu quyền quản trị ngay; membership được giữ để bảo toàn dữ liệu, chỉ Admin có thể phục hồi năng lực quản trị.
- Admin tạo lớp phải chỉ định GV active; GV tự tạo lớp thì tự làm GV lớp. Thêm/xóa member trong Sprint 1 chỉ quản lý SV; không cho đổi membership teacher qua endpoint thêm SV.
- GET lớp chỉ hiện lớp có quyền; SV chỉ xem lớp active/archived, không xem draft hoặc danh sách email SV khác. GV không thuộc lớp nhận 403. DELETE lớp là lưu trữ, không xóa dữ liệu; lớp archived chỉ đọc, không sửa metadata/thành viên. Không khôi phục archived trong bản đầu.
- PATCH `/api/admin/users` nhận user_id và role/status cần đổi; không cấp admin qua API, không sửa tài khoản admin bằng API này để tránh khóa quản trị viên cuối cùng. Hỗ trợ PATCH theo ID cũng dùng chung nghiệp vụ. Thay đổi và audit commit cùng transaction, không ghi password/token vào audit.
- Mã lớp chuẩn hóa uppercase/strip; email thành viên lower/strip. Thêm lặp là no-op; phục hồi dùng đúng bản ghi membership cũ, cập nhật added_by/added_at và xóa removed_at. Audit giữ dấu vết thay đổi.
- Migration rollback giữ bảng/cột/enum đã thêm để bảo toàn dữ liệu; downgrade chỉ lùi revision. Upgrade sau rollback kiểm tra đối tượng đã tồn tại. Không chạy binary cũ không hiểu role teacher; dùng feature flag tắt module để rollback chức năng. Sẽ kiểm chứng dữ liệu mới còn nguyên qua downgrade/upgrade trên DB thử.
- UI dùng màu hiện có: nền #f8fafc, bề mặt #ffffff, chữ #0f172a, navy #0a4174, đường viền #e2e8f0; font Inter. Bố cục căn trái, thanh điều hướng quản lý, bảng danh sách có bộ lọc và form rõ nhãn. Không thêm dashboard số liệu chưa có trong scope. Trạng thái lỗi/rỗng và bàn phím/mobile được xử lý cùng luồng chính.

# 2026-10-22 — Lab Test: snapshot, quyền và trải nghiệm

- Ngân hàng theo lớp/lab, xuất bản bất biến; bản sửa sao chép ID logic của câu và ID lựa chọn. Thu hồi câu ngừng cấp đề mới đến khi xuất bản bản sửa, không tự đổi điểm lịch sử; báo số lượt bị ảnh hưởng để GV quyết định cấp lượt/override có lý do.
- Thi ở cuối lab: hoàn thành hoặc được miễn các bài bắt buộc khác trước khi bắt đầu. Một lượt active theo membership + phiên bản bài; mọi start/save/submit khóa lớp rồi membership/lượt thi, có unique index bảo vệ thêm ở DB.
- Đồng hồ server, hết giờ chấm đáp án đã lưu kể cả membership vừa bị thu hồi (worker nội bộ); API vẫn từ chối người đã mất quyền. Reveal mặc định sau khi hết lượt; đã xem đáp án không được cấp/start thêm lượt trên cùng bài test.
- Policy chụp lúc bắt đầu. Cấu hình lớp đã xuất bản có thể ghi đè thời gian/điểm đạt/số lượt; thay đổi không sửa lượt đang thi. Score rule highest; pass không bị mất khi lần sau điểm thấp hơn.
- AI chỉ nhận snapshot tài liệu document được GV chọn trong lab, không đọc user/điểm vào payload. Reserve chi phí trước mỗi lần gọi, kể cả retry thất bại; giới hạn theo ước tính tối đa/call do quản trị cấu hình, không thay thế hạn mức hóa đơn của nhà cung cấp. Worker gián đoạn không tự gọi lại để tránh tính phí hai lần.
- UI giữ hệ thiết kế hiện có: navy #0a4174 cho thao tác, #0f172a chữ, #ffffff nội dung, #f8fafc nền phụ, #e2e8f0 đường phân chia, #b91c1c lỗi. Inter cho nhãn/nội dung, căn trái; câu hỏi có chiều rộng đọc vừa phải. GV dùng danh sách câu + form biên tập, SV dùng các lựa chọn lớn và thanh thời gian/trạng thái lưu luôn rõ. Không thêm hình trang trí hay animation vào màn hình thi.
- Phác thảo: GV `[Lab / trạng thái / số đã duyệt] [danh sách câu | nội dung + duyệt]`; SV `[thời gian | đã lưu] [câu + 4 lựa chọn] [nộp bài]`. Đã đối chiếu với luồng học CubeSAT: ưu tiên nguồn tham chiếu, duyệt và trạng thái lưu hơn các thẻ thống kê chung chung.

# 2026-11-11 — Cấu trúc lại Lab1, 3, 4, 6, 7 theo tổ chức PTITCube

- Làm theo cấu trúc repo hiện tại của PTITCube. Lab 6 giữ lại chỉ với lắp ráp cơ khí vì không còn bài code nào trên GitHub; số Lab vẫn là 0–8.
- Các repo "ví dụ cha" (Lab2-01, Lab3-01, Lab4-01 đến 04, Lab5-01/02) được thêm thành bài thực hành riêng, đứng đầu nhóm bài a/b tương ứng.
- Đổi ID bài cũ sang ID mới bằng migration `0013_curriculum_restructure` (có downgrade). Tiến độ và bản nháp của `Lab2-01a_Battery_GPIO` chuyển sang `Lab2-01a_Battery_I2C`; nội dung bài vẫn là đo ADC.
- Compiler vẫn ghim PTITCube-Library `218d2b6` kèm overrides. Thư viện upstream đã tiến tới `41f19ba` (EPS dùng MAX17048). Các sketch upstream đã đổi nhiều và cần thư viện mới được giữ ở bản local đã kiểm chứng, ghi rõ trong `notes` của `catalog.json`. Nâng thư viện và rebase overrides là việc riêng, chưa làm.
- Bài mới từ upstream không thêm log Serial; panel trực quan chỉ hiện dữ liệu sketch tự in.
- Video bài mới của Lab 1 để trống (TODO GV); tài liệu Doc 1.3 tóm lược từ README upstream.
- Cập nhật cùng ngày: nhóm xác nhận kit vẫn đo pin bằng ADC qua cầu chia áp. Giữ PTITCube-Library `218d2b6` (không nâng lên `41f19ba`/MAX17048); `Lab2-01a_Battery_I2C` dùng lại bản ADC đã kiểm chứng, chỉ đổi ID theo tên repo.

# 2026-11-13 — Xác thực Google, nút xem mật khẩu và luồng cấp lại mật khẩu

- **Clock skew cho Google Sign-In (`_GOOGLE_CLOCK_SKEW_SECONDS = 60`):** `verify_google_credential` truyền `clock_skew_in_seconds=60` vào `id_token.verify_oauth2_token` (Google ID token sống 3600s) vì đồng hồ máy chủ/máy local lệch nhẹ vài giây sau giờ UTC của Google sẽ gây lỗi `InvalidValue("Token used too early")`, khiến người dùng thấy thông báo nhầm là token hết hạn. Mọi lỗi xác thực vẫn được từ chối 401 và chỉ log loại lỗi/lý do đã lọc, không log raw credential.
- **Mở khóa quản trị tài khoản & cấp lại mật khẩu khỏi `LMS_CLASS_MODE`:** `/api/admin/users`, `PATCH /api/admin/users*`, `/api/admin/users/{id}/reset-password` và `/api/admin/users/{id}/reset-link` luôn hoạt động khi `LMS_CLASS_MODE=false` để Admin quản lý khóa/mở tài khoản và xử lý quên mật khẩu ở mọi chế độ vận hành; quyền `admin` vẫn kiểm tra từ DB ở mỗi request. Các API lớp học (`/api/classes*`, `/api/admin/classes/*`) tiếp tục phụ thuộc `LMS_CLASS_MODE`.
- **Luồng cấp lại mật khẩu kết hợp Email (SMTP) + Hàng chờ Admin:**
  - `POST /api/auth/forgot-password` luôn trả HTTP 200 với thông điệp trung tính (không lộ email có tồn tại hay không).
  - Khi cấu hình `SMTP_HOST`, server tạo token ngẫu nhiên 1 lần (lưu hash SHA-256 trong `password_reset_tokens`, TTL mặc định 30 phút, dựng URL từ `FRONTEND_URL`/`ALLOWED_ORIGINS` đã kiểm duyệt) và gửi qua email; nếu SMTP lỗi hoặc chưa cấu hình, yêu cầu tự chuyển sang trạng thái `pending` để Admin cấp liên kết tự đặt lại 1 lần hoặc mật khẩu tạm tại `/admin/users`.
  - Token đặt lại chỉ dùng 1 lần (`WITH FOR UPDATE`), tự hết hạn, đặt lại sẽ xóa khóa brute-force theo cả `email` và cặp `email:ip`, thu hồi các yêu cầu cũ và chỉ ghi hành động vào `audit_logs` (không lưu token/mật khẩu). Migration `0015_password_reset_tokens` dùng `IF NOT EXISTS` và giữ bảng khi `downgrade` để bảo toàn lịch sử thu hồi token.

# 2026-11-17 — Đồng bộ bài thực hành với PTITCube (thư viện v1.1.0) và trang câu hỏi cuối Lab

- Kiểm tra lại: 44 bài hiện có đều biên dịch qua với compiler v6, nhưng cả 48 repo Lab và PTITCube-Library đã có commit mới (thư viện v1.1.0, `57cf1c3`). Theo yêu cầu "đồng bộ đầy đủ": merge 3 chiều (bản ghim cũ / bản local đã vá / upstream mới) cho từng sketch, giữ các bản vá an toàn local (giới hạn input Serial, kiểm tra số byte ghi SD, JPEG SOI/EOI, tên ảnh không ghi đè, `hasFix()` thay cho tọa độ 0,0, chân LoRa theo `PTIT_COM`).
- Lấy upstream khi upstream viết lại theo README: Lab2-01a (MAX17048 qua Wire), Lab2-02 (power gating GPIO 4), Lab3-03, Lab3-04 (TWDT thuần — bỏ bài phát hiện rơi/quá nhiệt và `scripts/test-firmware-logic.py`), Lab4-02a (burst 14 byte), Lab4-03b (NMEA + checksum), Lab4-04a (lưu ảnh vào SD), Lab7-01.
- Sửa lỗi upstream: đơn vị từ trường Lab4-02/02b (Gauss in nhãn uT), Lab4-01 chia áp suất hai lần, Lab4-05/4-03c coi "có vệ tinh" là có fix, chân M1=GPIO35 (chỉ vào) ở Lab5-01a/02a, `PTIT_CDH` không biên dịch trên ESP32-S3, camera không MUX kẹt ở 9600 baud.
- Thêm 3 bài: `Lab1-03_PWM_LED`, `Lab3-05_Event_Driven_Queue`, `Lab4-03c_GPS_PTITCube`. Không thêm `Lab3-04_Watchdog_Timer` vì trùng nội dung `Lab3-04_Watchdog_And_Event` (README ghi "hoặc"). ID cũ giữ nguyên; nhãn Lab 1 đánh số lại 01–11 theo README.
- Compiler: overrides rebase lên v1.1.0, revision v7; lệnh chụp ảnh đổi `CAPTURE` → `p` (camera-slave local nhận cả hai).
- **Xung đột cần nhóm chốt:** mục 2026-11-11 ghi kit đo pin bằng ADC và cố ý không dùng MAX17048. Thư viện v1.1.0 và README mới dùng MAX17048. Nếu kit thực tế không có MAX17048, Lab2-01a/01b/02 và EPS trong Lab7 sẽ không đọc được pin — khi đó cần override `PTIT_EPS` về ADC và giữ sketch ADC cho Lab2-01a.
- Trang câu hỏi cuối Lab (`/labN/questions`): khung trống theo các mục "❓ Câu hỏi kiểm tra" của README, dữ liệu tại `src/data/lab-questions.js`. File này nằm trong bundle nên chỉ được chứa đề và lựa chọn; đáp án/giải thích phải ở ngân hàng Lab Test phía server (quy tắc 5). Trang không ghi tiến độ và đi qua cùng cổng `LabEntry` như `/labN`.

# 2026-11-17 (bổ sung) — Đội phần cứng chốt 5 điểm sau đồng bộ v1.1.0

Nguồn: "Báo cáo phản hồi và xác nhận đồng bộ phần cứng PTITCube v1.1.0" (17/11/2026). Thay thế ghi chú "kit đo pin bằng ADC" của mục 2026-11-11.

- **Pin (phương án A):** EPS chỉ dùng MAX17048 qua I2C 0x36, không còn ADC GPIO 34. Giữ thư viện v1.1.0 và các sketch Lab2-01/01a/01b/02 hiện tại; sửa chú thích "ADC" còn sót ở Lab2-01 và mô tả Lab 2 trong `labs.js`. Xung đột ghi ở mục trên coi như đã đóng.
- **Camera:** UART0 (GPIO 1/3) của ESP32-CAM chỉ để nạp code/debug PC; giao thức với OBC chạy trên UART2 (TX GPIO 14, RX GPIO 15, 115200), lệnh `p`. `firmware/camera-slave` chuyển giao thức sang UART2, log debug vẫn in ở UART0; vẫn nhận `CAPTURE` cho sketch cũ.
- **LoRa E32:** RX26/TX25 (UART1), AUX27, M0=32, M1=33 theo `PTITCube.h` — trùng bản đã sửa ở Lab5-01a/02a, không đổi thêm.
- **GPIO 4:** Lab 1 chạy trên PCB thí nghiệm rời, không nối với chân Buck của EPS. Thêm lưu ý vào Doc 1.1.
- **GPIO 12:** xác nhận khởi động/nạp ổn định với MUX 74HC4066 (mức LOW lúc boot nhờ pull-down nội của MTDI). Không đổi code.
- Upstream (PTITCube-Library, Lab2-01, Lab5-01a/02a) chưa có commit mới sau `57cf1c3`; không cần đồng bộ lại.

# 2026-11-17 — Tái cấu trúc trình tự bài học theo README PTITCube/.github

- Mỗi Lab 0–8 theo đúng thứ tự README: Video → Doc → Câu hỏi kiểm tra Doc → … → Thực hành → Câu hỏi kiểm tra Thực hành → Tổng hợp → **Lab Test**. Lab 0 có đủ Video 0.1/0.2, Doc 0.1/0.2, khám phá mô hình 3D và 3 phần câu hỏi.
- Trang câu hỏi (`quiz-<checkpoint>`) và trang `labtest-N` là khung trống: nội dung lấy từ `src/data/lab-questions.js` (chỉ đề và lựa chọn, không đáp án). Chúng **không** chặn bài tiếp theo, không nằm trong mẫu số tiến độ và không thể "Hoàn thành bài học" qua `/api/progress/.../complete` (`LESSON_NOT_SELF_COMPLETABLE`), vì kết quả phải do server chấm (quy tắc 5, 6). Nếu không loại ra, sinh viên sẽ kẹt ở trang chưa có câu hỏi.
- Kế hoạch LMS chỉ cho 4 loại bài và "không tạo loại bài thứ năm": `quiz` chỉ tồn tại ở chế độ học cũ (`seed.legacy`); mô hình khóa học (`seed.labs`) bỏ qua `quiz` và vẫn tự thêm `labtest-N`. Bài lắp ráp Lab 6 (`assembly-6`) là `practice` với `mode: "assembly"`, không có mã mẫu, không bắt buộc mặc định.
- ID: giữ nguyên mọi ID bài thực hành và ID bài cũ khi chủ đề khớp README (đổi nhãn số, ví dụ `document-1-4` → Doc 1.7, `document-4-2` → Doc 4.4, `document-5-2` → Doc 5.3, `document-8-2` → Doc 8.3, `video-1-4` → Video 1.3, `video-4-5` → Video 4.5 về xung đột UART). Doc có chủ đề mới dùng ID mới (`document-1-button`, `-74hc595`, `-uart`, `-millis`, `document-3-cli`, `document-4-imu`, `-gnss`, `-camera`, `-sensors`, `document-5-lora`, `document-6-2`, `-6-3`, `document-7-1`, `-7-3`, `document-8-widgets`, `document-0-2`, `video-0-2`).
- Bỏ khỏi danh sách: `video-1-3` (video GPIO, README không còn, chưa có URL) và `document-3-2` (nội dung Task/scheduler gộp vào Doc 3.3). Tiến độ đã lưu của hai ID này vẫn còn trong `lab_progress.lesson_progress`, không bị xóa.
- Giữ các bài thực hành "ví dụ cha" (Lab2-01, Lab3-01, Lab4-01…04, Lab5-01/02) dù README không liệt kê, để không mất bài đã biên dịch kiểm chứng và tiến độ/bản nháp của sinh viên; đặt chúng đầu nhóm a/b tương ứng.
- Sinh viên đang học dở: các Doc mới chèn vào giữa lab trở thành bài chưa hoàn thành, nên phải đọc chúng trước khi tiếp tục; lab đã hoàn thành (`completed_at`) không bị ảnh hưởng. Mô hình khóa học có phiên bản mới (hash nguồn đổi); lớp đang dùng phiên bản cũ không đổi cho đến khi GV chọn phiên bản mới.

## 2026-11-18 — Bỏ bài thực hành "cha", gọn khung thực hành và gợi ý code
- Quyết định: khi một bài có bản a/b (Lab2-01, Lab3-01, Lab4-01..04, Lab5-01/02) thì bỏ bài cha khỏi danh sách bài học, trang câu hỏi và seed; chỉ còn 39 bài thực hành (lớp học: 29 bài từ Lab 2). Mã nguồn và mục catalog của bài cha được giữ để bản nháp trình duyệt cũ và đường dẫn cũ vẫn biên dịch được; `lab_progress` không bị đổi.
- Lab3-01a/b chỉ hiển thị Serial Monitor (không bảng SD, không "Kết quả thực hành").
- Lab3-02: bảng "Kết quả lệnh" ghép mỗi lệnh `User> ...` với phản hồi (OK/ERR/pwd), không chỉ lệnh lỗi. Chỉ đọc log Serial, không suy ra thao tác thành công nếu thiết bị không phản hồi.
- Gợi ý code Monaco chỉ gồm hàm và biến (hàm Arduino, API PTITCube v1.1.0, khai báo trong chính file); tắt gợi ý từ khóa, snippet, từ lấy từ chú thích/chuỗi.
- Blockly: các stack gốc chồng nhau được tự dời xuống theo chiều cao thật; bố cục không chồng của sinh viên được giữ nguyên.
- Rủi ro: sinh viên đang ở giữa bài cha sẽ không còn thấy bài đó trong danh sách; tiến độ cũ vẫn nằm trong DB.

## 2026-11-18 — Sửa Lab 4: IMU 4.2a, GPS 4.3c, Serial Monitor, tên bài 4.4b
- Lab4-02a: `(Wire.read() << 8) | Wire.read()` có thứ tự đánh giá không xác định trong C++, nên byte thấp có thể bị đọc trước và số liệu IMU sai. Sửa bằng `readInt16()` đọc byte cao rồi byte thấp; cập nhật sha/verified_build trong `catalog.json`. Định dạng log giữ nguyên như 4.2b nên viewer 3D không đổi.
- Lab4-03c: bộ giải mã ghép thêm các dòng riêng "Vĩ độ … Bắc/Nam", "Kinh độ … Đông/Tây", "Cao độ (altitude)" thành vị trí có dấu, để bản đồ vẫn có điểm khi thiếu dòng "Tọa độ (Vĩ độ, Kinh độ)". Chưa tái hiện được lỗi trên bo thật; cần log Serial thật nếu bản đồ vẫn trống.
- Serial Monitor: gom dòng nhận được và cập nhật giao diện mỗi 80 ms (bộ giải mã vẫn nhận từng dòng ngay); thêm Tạm dừng/Tiếp tục, Sao chép, tự cuộn theo vị trí cuộn và nút "↓ Cuối". Áp dụng cho mọi bài.
- Lab4-04b đổi tên: "Chụp ảnh bằng thư viện PTIT_Camera, lưu thẻ SD và gửi ảnh về trình duyệt qua Serial". ID không đổi.
- Hiển thị ảnh camera qua MQTT: hoãn, kế hoạch riêng ở `Docs/MQTT_PLAN_2026-11-18.md`.

## 2026-11-25 — Lab 7: System Check thay bảng SD / "Kết quả thực hành", widget trong cửa sổ Trạm mặt đất
- Lab7-01/02: thẻ "🛰️ Trạm mặt đất" nằm ngay sau Serial Monitor; bỏ bảng "Thẻ SD / Hệ thống tệp" và "Kết quả thực hành". Trạng thái và log 5 dòng gần nhất của Thẻ nhớ SD và Đường truyền LoRa hiển thị trong System Check.
- Mỗi dòng System Check là Active (xanh) khi có số đo hoặc báo cáo của phân hệ trong 10 giây gần nhất, Inactive (xám) khi không có, Lỗi (đỏ) khi báo cáo mới nhất là lỗi. 10 giây vì Lab 7 phát mỗi 4 giây và tạm dừng viễn trắc khi đang xử lý lệnh. Ảnh lưu bằng lệnh f và log lệnh b (ghi/đọc pin trên SD) được tính là hoạt động của thẻ SD.
- Lab 7 không làm mờ (opacity) các bảng khi chưa có dữ liệu mới; System Check thể hiện độ mới thay cho việc làm mờ. Các lab khác giữ nguyên.
- Cửa sổ Trạm mặt đất (`/groundstation?lesson=Lab7-…`) có bản sao các widget (tư thế 3D, GPS, điện áp, môi trường, System Check), lấy dữ liệu **chỉ từ cổng USB-TTL của trạm mặt đất** (gói LoRa thu được), không chia sẻ dữ liệu từ cổng USB của vệ tinh. Lý do: cửa sổ trạm mặt đất phải phản ánh đúng những gì đường truyền LoRa mang về. Ở trạm mặt đất mọi dòng nhận được đều tính là RX của LoRa; gói downlink rút gọn nên có thể thiếu trường (ví dụ Lab7-01 không gửi gia tốc trong gói định kỳ).

## 2026-11-25 — Lab 8: kích thước widget dashboard
- Mỗi loại widget có kích thước mặc định và tối thiểu (đơn vị lưới, 1 hàng = 60 px); không kéo nhỏ hơn mức tối thiểu được. Lưới nhỏ nhất giữ 4 cột để vừa chiều rộng tối thiểu.
- Đồ thị, bản đồ, mô hình 3D và Terminal lấp đầy ô widget theo chiều cao còn lại thay vì cao cố định 300–350 px. Bản đồ tự đo lại kích thước khi widget đổi cỡ và luôn hiển thị (tâm mặc định PTIT Hà Đông) khi chưa có fix GPS.
- Dashboard Lab 8 không làm mờ panel khi chưa có mẫu mới, giống Lab 7.
- Đồ thị, Gauge, Cảnh báo ngưỡng và Bảng số liệu chọn được trường dữ liệu (⚙ trên tiện ích): điện áp, nhiệt độ, độ ẩm, áp suất, gia tốc/con quay/từ trường X·Y·Z, độ cao, vĩ độ/kinh độ. Một đồ thị chỉ vẽ các trường cùng đơn vị (một trục Y); chọn trường khác đơn vị sẽ thay bằng đồ thị mới. Danh sách trường lấy từ schema telemetry, không có trường "ảo".
- Bảng tiện ích bổ sung các panel của các lab trước (Môi trường, System Check, LoRa, Trạm mặt đất, WiFi/MQTT, Thẻ SD, Kết quả lệnh, Phát hiện sự cố, LED/Nút nhấn, Bảng lệnh). Bỏ khỏi bảng: WiFi/MQTT, LED/Nút nhấn, Thẻ SD; bỏ trường độ ẩm (bộ cảm biến PTITCube không có).
- Bố cục dashboard lưu theo tài khoản trong trình duyệt (`localStorage`, khóa `ptit:dashboard:v1:user:<id>`), cùng cách lưu bản nháp code; không lưu cho khách. Không lưu ở server để không thêm bảng/migration cho một tùy chọn giao diện; đổi máy thì về bố cục mặc định. Khi đọc lại, khối đã bị gỡ khỏi bảng và cấu hình không hợp lệ được bỏ qua hoặc trả về mặc định.
- Bảng lệnh mặc định: ping, status, uptime, get_sensor, get_eps, get_gps, capture, pause, resume, help; học viên chọn thêm/bớt từ danh sách gợi ý hoặc gõ lệnh riêng.

## 2026-11-25 — Ảnh camera chỉ lưu trên thẻ SD, không hiện trên trình duyệt
- Nguyên nhân gặp thực tế: bản nháp Lab4-04a viết từ phiên bản code cũ (giống upstream PTITCube) chỉ ghi ảnh vào SD và in "Camera: Saved ...", không gọi `sendImageOverSerial()`, nên không có `IMG_BEGIN/IMG_CHUNK/IMG_END`. Trình duyệt không thể đọc thẻ SD của OBC; ảnh chỉ đến được nếu firmware gửi lại qua Serial (hoặc MQTT).
- Không tự sửa bản nháp của học viên và không cài việc gửi ảnh vào thư viện (các bài 4-04b/4-06 đã tự gửi, sẽ bị gửi trùng). Thay vào đó Camera Viewer phát hiện "đã lưu trên thiết bị nhưng sau 4 giây không có IMG_BEGIN", giải thích lý do và cho xem/sao chép hàm `sendImageOverSerial()` cùng chỗ cần gọi.
- Bộ giải mã phát sự kiện tiến độ khi đang nhận ảnh qua Serial (mỗi ~3 KB) và đánh dấu ảnh đã thật sự về trình duyệt (`browser: true`) để phân biệt với dòng "Saved" của firmware.

## 2026-11-25 — Ảnh camera lên trình duyệt qua MQTT, ẩn khỏi code học viên
Thay cho mục "Ảnh camera chỉ lưu trên thẻ SD" ở trên (bỏ hướng dẫn tự chép hàm `sendImageOverSerial()`).
- Học viên chỉ code chụp và lưu ảnh vào `/photos` trên thẻ SD. Việc đẩy ảnh lên máy chủ nằm trong lớp nền của thư viện (`compiler/overrides/CDH/PTITCloud.*`, bản build v9), chạy ở mọi bài: một task ưu tiên thấp quét `/photos` mỗi 2 giây và publish mỗi JPEG mới (kích thước ổn định qua 2 lần quét, có SOI/EOI, ≤ 2 MB) lên `sensors/<uid>/image`. Ảnh có sẵn trên thẻ lúc bo khởi động không gửi lại.
- Cấu hình WiFi + MQTT do web app gửi qua Serial và bo lưu trong NVS (không nằm trong mã nguồn hay file .bin). Khi `cdh.begin()`, bo in `[CLOUD] CFG? v1 uid=… ssid=…` và chờ 2 giây (0,6 giây nếu đã có cấu hình). Web app trả `@PTITCLOUD KEEP` nếu bo đã đúng thiết bị/WiFi của tài khoản; nếu không thì gọi `POST /api/devices/cloud/provision` rồi gửi cấu hình. Bo của tài khoản khác bị xóa cấu hình (`CLEAR`) để ảnh không lọt sang tài khoản đó. Dòng cấu hình không hiện trong Serial Monitor, và `cdh.read()` không bao giờ trả các dòng `@PTITCLOUD` cho sketch.
- Mỗi tài khoản có một thiết bị "CubeSat của tôi (ảnh camera)" (model `ptitcube-cloud`), tạo khi cấp cấu hình lần đầu. `per_device`: mỗi lần cấp sẽ rotate secret riêng `dev_<uid>`. `shared` (HiveMQ demo hiện tại): mọi bo dùng chung `DEVICE_MQTT_USERNAME/PASSWORD`, không có phân quyền theo thiết bị. Đây là rủi ro đã chấp nhận cho demo: một bo có thể publish vào topic của bo khác, nhưng backend vẫn chỉ lưu ảnh cho thiết bị đã đăng ký và chỉ chủ thiết bị xem được.
- WiFi lấy từ `DEVICE_WIFI_SSID/PASSWORD` (WiFi phòng lab); nếu trống thì Camera Viewer cho học viên nhập WiFi (chỉ giữ trong bộ nhớ trang, bo lưu vào NVS). Lớp nền chỉ bật WiFi khi sketch chưa tự bật WiFi, và không gửi khi sketch đang phát AP.
- Camera Viewer tải ảnh của thiết bị này cả khi đang dùng Serial, tải ngay khi bo báo `[CLOUD] PHOTO SENT`, và bỏ bản trùng với ảnh đã nhận qua Serial (cùng số byte; các bài mẫu 4-04a/4-04b/4-06 vẫn gửi qua Serial).
- Rủi ro còn lại: TLS dùng `setInsecure()` (chưa kiểm tra chứng chỉ). Đọc thẻ SD song song với sketch dựa vào khóa FATFS của ESP-IDF và khóa bus SPI của thư viện. Một bo chạy sẵn khi mở cổng (không reset) chỉ nhận cấu hình nếu sketch đọc `cdh`; nếu không thì phải nhấn RST. Bo chưa cấu hình sẽ chậm khởi động thêm 2 giây. Chưa thử trên phần cứng.
- Sửa sau thử phần cứng (19:08): bản Lab4-04a cũ luôn đặt lại bộ đếm sau khi khởi động và ghi đè `/photos/uart_img_0.jpg`, nên lớp nền coi tệp là "đã có lúc khởi động" và không gửi. Giờ tệp đã biết mà đổi kích thước được coi là ảnh mới (ghi đè cùng kích thước vẫn bị bỏ qua, hiếm gặp). Bo in `[CLOUD] READY photos=<n>` khi bắt đầu theo dõi thẻ SD. Camera Viewer báo rõ nếu sau 30 giây bo vẫn chưa gửi ảnh. Bo chưa từng cấu hình không còn in lỗi `nvs_open failed`.
