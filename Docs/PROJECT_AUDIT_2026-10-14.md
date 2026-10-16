# Phân tích FE, BE và lộ trình hoàn thiện PSCubeSAT

Ngày đánh giá: 14/10/2026. Phạm vi: mã nguồn FE, BE, SQL, cấu hình build/deploy, MQTT và đối chiếu tài liệu trong repo. Đây là báo cáo audit; chưa sửa mã nghiệp vụ, chưa chạy migration hoặc tác động broker/database đang sử dụng.

## 1. Kết luận

Dự án có nền giao diện LMS khá rõ: Home, Lab 0–8, đăng nhập, hồ sơ, trình soạn thảo và các widget. Backend có phân lớp router/service/repository, xác thực JWT, quản lý thiết bị, compiler PlatformIO và simulator sinh telemetry. Điểm yếu lớn nhất là **các phần chưa nối thành một luồng hoạt động hoàn chỉnh**.

Hiện tại có ba nguồn hành vi khác nhau: Serial thực, dữ liệu demo tự sinh trong widget, và simulator BE qua MQTT. FE chưa có client WebSocket để nhận pipeline BE. Nút flash báo thành công bằng timer. Database tạo mới từ SQL trong repo không khớp ORM. Vì vậy build thành công chưa chứng minh học viên có thể viết code → biên dịch → nạp → đọc cảm biến thật → hoàn thành bài.

Ưu tiên: sửa tính đúng của dữ liệu và schema, chặn truy cập trái quyền, hoàn thiện một luồng E2E, sau đó mới mở rộng simulator/dashboard và tối ưu hiệu năng.

## 2. Kiến trúc và mức độ triển khai

| Mảng | Đã có | Còn thiếu / chưa hoàn chỉnh |
|---|---|---|
| FE nền tảng | React 19, Vite 8, router, lazy pages, shared LabLayout, responsive CSS, focus/skip link | TypeScript không kiểm tra JSX; ESLint không có cấu hình cho JSX |
| Auth | Register/login/me/logout/change-password; UI dùng API | Google login, quên mật khẩu và remember chỉ là UI; xử lý 401 tập trung chưa có |
| Học tập | Lab metadata, ghi progress, trang hồ sơ | Markdown bài học không có; phần lớn video trống; đánh dấu xem video khi chỉ mở tab |
| Editor | Monaco, custom Blockly toolbox | C++ generator thiếu logic/nhiều block; chưa lưu workspace; thư viện PTITCube không được cung cấp trong cấu hình build |
| Compiler | API PlatformIO, cache/lock theo board, firmware Base64 | FE cố định ESP32-S3; binary không được truyền tới flasher; quota/queue/isolation chưa có |
| Serial / flash | Request port, read/write Serial, terminal | Flash là mô phỏng; cleanup/rút USB/handoff port chưa đầy đủ |
| Telemetry | BE MQTT consumer, normalize, rooms WS theo UID | FE không dùng WS; REST không auth; thiếu history và cache Redis telemetry |
| Simulator | Lifecycle APIs, task, scenarios, MQTT publisher | FE simulator chưa có; thiếu UID riêng, quota/TTL, speed/component behavior và khóa một worker/device |
| Dashboard | Palette, các widget và state layout | API RGL lệch phiên bản, width thiếu, widget chưa bind dữ liệu/lệnh; chưa lưu layout |
| Deploy | FE Nginx, FastAPI, Redis Compose | Compose không có Postgres/Mosquitto; topology external chưa mô tả rõ; service scripts cũ |

Luồng hiện tại:

```text
FE login/device/progress ── HTTP ── FastAPI ── PostgreSQL
FE compile ── HTTP ── PlatformIO ── firmware Base64 (chưa đi tiếp tới flash)
USB Serial ── SerialContext ── widget riêng lẻ
Timer/demo ── widget riêng lẻ (có thể ghi đè Serial)
BE simulator ── MQTT ── consumer ── cache RAM / WS rooms (FE chưa kết nối)
```

## 3. Kiểm tra đã thực hiện và giới hạn

- `npm run build`: PASS. Có ba chunk lớn: LabPracticeActions khoảng 796 KB, esm khoảng 1.137 MB, GPSMap khoảng 1.176 MB trước gzip.
- `npm run lint`: PASS, nhưng `ESLint.calculateConfigForFile` cho App.jsx/AuthContext.jsx là NO CONFIG; labs.js có 0 rules; main.ts có 108 rules. Kết quả lint chưa phản ánh code ứng dụng chính.
- TypeScript config không bật `allowJs/checkJs`; entry thực là `src/main.jsx`, trong khi `src/main.ts` là mã Vite mẫu.
- 43 file Python parse cú pháp thành công; import `app.main` thành công trong Conda `stemcube`. Import module cũ `app.models.simulation` thất bại vì import Field từ typing.
- FastAPI TestClient, không chạy lifespan và thay dependency DB/auth bằng stub: GET telemetry với dữ liệu giả trong RAM, không token, trả 200. POST simulation thiếu board trả 500 do validation handler không serialize ValueError trong `ctx`.
- Kiểm tra normalize: `acc_z=0` trả `accZ=1.0`.
- Kiểm tra manager với publisher giả: hai session cùng UID có thể chạy; speed 1 và 10 cho cùng giá trị ở cùng thời điểm; reset session đang paused phát thêm frame dù status đã stopped.
- Render tĩnh ResponsiveGridLayout bằng thư viện đang cài và các props tương ứng FE: sinh `width:NaNpx`, `translate(NaNpx,10px)`.
- `docker compose config --services`: chỉ `redis`, `fastapi`, `frontend`.
- Git ban đầu sạch; `git ls-files -u` không có file unmerged; không thấy marker merge conflict trong src/BE/Docs.

Chưa chạy biên dịch firmware thật, nạp ESP32, broker MQTT thực, DB migration trên môi trường thật, kiểm thử tải hoặc QA giao diện trình duyệt trong lần audit này. Các kết luận về schema fresh-install dựa trên đối chiếu SQL/ORM; chưa kết luận schema production đang giống SQL trong repo. File test_ca.py kết nối broker ngoài và chạy loop_forever nên không dùng làm automated test.

## 4. Các lỗi cần xử lý trước

### A01 — Schema SQL lệch ORM: P1

Nguồn: `fastapi-backend/app/db/init.sql:57,97,195`; `app/models/tables.py:43,81,104,180`.

- ORM Device có `device_type`, SQL devices không có.
- ORM MQTTCredential kế thừa `deleted_at`, SQL mqtt_credentials không có.
- ORM Command kế thừa `updated_at`, `deleted_at`, SQL commands không có.
- ORM telemetry có foreign key tới devices; SQL telemetry không khai báo FK đó.
- Hai định nghĩa User với hai DeclarativeBase khác nhau: auth dùng db_models.User, các quan hệ thiết bị dùng tables.User. Chưa gây lỗi import hiện tại, nhưng dễ tạo metadata/migration lệch nhau.

Tác động: database dựng mới có thể lỗi truy vấn/tạo thiết bị; Alembic autogenerate sau này dễ lấy thiếu hoặc sai metadata.

Cách xử lý: thống nhất Base/User, tạo migration Alembic chính thức, kiểm chứng trên DB rỗng và bản sao schema đang dùng. Đừng chỉ sửa init.sql vì DB đã có users sẽ bỏ qua khởi tạo.

### A02 — REST telemetry công khai dù WS kiểm tra owner: P1

Nguồn: `app/routers/telemetry.py:8`; `app/main.py:111`.

GET latest của một thiết bị và tất cả thiết bị không có auth/ownership. Đã tái hiện anonymous 200 bằng TestClient. WS có kiểm tra owner nhưng không bảo vệ đường REST này.

Cách xử lý: dùng required user và lọc theo owner ở mọi endpoint dữ liệu riêng. `/api/devices/positions` được mô tả chủ đích công khai; cần xác định chính sách chia sẻ vị trí, giới hạn dữ liệu trả ra và đánh dấu dữ liệu stale.

### A03 — MQTT tin device_id trong payload thay vì UID từ topic: P1

Nguồn: `app/services/mqtt_consumer.py:76`.

Consumer ghi cache, gửi vào room và cập nhật GPS theo payload.device_id, không so với `sensors/{uid}/telemetry`. Một thiết bị được publish topic của mình vẫn có thể ghi device_id của thiết bị khác trong JSON. ACL topic không ngăn được giả mạo payload này.

Cách xử lý: parse topic theo cấu trúc cố định, lấy UID từ topic, reject khi payload không khớp; kiểm tra thiết bị enabled/chưa xóa; giới hạn kích thước/rate và range số liệu. Không cho device_id mặc định unknown đi vào pipeline.

### A04 — Flash báo thành công nhưng không nạp firmware: P1

Nguồn: `src/components/serial/WebFlasher.jsx:19`; `CloudCompiler.jsx:45`; `editor/LabPracticeActions.jsx:10`.

WebFlasher chỉ chạy setInterval/random; không dùng esptool-js và không nhận binary. CloudCompiler có onBinaryReady nhưng các caller không truyền callback. Kết quả compile bị bỏ lại trong component.

Cách xử lý: state/store firmware chung có board, hash code, thời gian, binary và trạng thái; chỉ cho flash artifact đúng code/board; chuyển quyền giữ Serial từ monitor sang ESPLoader rồi khôi phục monitor. Nạp đủ bộ image/offset cho lần nạp đầu; BE hiện chỉ trả application firmware.bin nên cần chốt chiến lược bootloader/partition/merged image. Chỉ báo thành công sau kết quả ghi/verify thực.

### A05 — FE chưa nhận pipeline BE và demo ghi đè dữ liệu thật: P1

Nguồn: `AttitudeViewer3D.jsx`, `GPSMap.jsx`, `TelemetryPanel.jsx`, `VoltageChart.jsx`, `EnvironmentPanel.jsx`; tìm toàn src không có WebSocket client/API simulations.

3D chạy requestAnimationFrame demo liên tục; GPS demo mỗi giây; telemetry demo mỗi 3 giây. Các timer vẫn hoạt động khi Serial có dữ liệu. Chart/environment khởi tạo giá trị demo mà không có chỉ báo nguồn. FE đọc battery_v/lat/lng/acc_x; BE trả voltageV/gpsLat/gpsLon/accX. Blockly còn in dữ liệu dạng text thay vì JSON các widget chờ.

Cách xử lý: một model telemetry thống nhất, adapter cho Serial và WS, nguồn rõ `demo | hardware | simulator`, selected device, trạng thái connected/stale, timestamp/unit và bounded history. Parse một lần trước khi phân phối; widget chỉ render. Không cho demo tự chạy ở chế độ dữ liệu thật.

### A06 — Template editor không tương thích cấu hình compiler: P1

Nguồn: `MonacoEditor.jsx:3,30`; `BlocklyEditor.jsx:22`; `app/services/compiler_svc.py:18`.

Template/include luôn dùng PTITCube.h và các lớp PTIT_*, nhưng repo không có thư viện này và lib_deps chỉ khai báo PubSubClient. Build mới theo cấu hình repo thiếu dependency. Các page khởi tạo code rỗng, Monaco hiển thị DEFAULT_CODE qua fallback nhưng state gửi compile vẫn rỗng nếu chưa sửa editor. FE luôn gửi esp32s3 dù tài liệu OBC mô tả ESP32-WROOM.

Cách xử lý: cung cấp/pin PTITCube library hoặc thay bằng template Arduino tối thiểu có thể build; khởi tạo code state bằng template thật; chọn board theo device/profile; nghiệm thu cả esp32 và esp32s3 bằng build sạch.

### A07 — Generator Blockly làm sai ý nghĩa chương trình: P1

Nguồn: `BlocklyEditor.jsx:19,43,56`; `blockly-toolbox.js`.

Generator duyệt mọi block bằng getAllBlocks thay vì đi theo graph statement/value. Toolbox có if/loop/math/text nhưng generator bỏ qua chúng; pin_mode, digital_read, analog_read, imu_read_gyro/mag, camera_capture chưa sinh code. Block rời cũng được đưa vào code; nhiều block đọc cùng cảm biến có thể khai báo trùng tên biến. Chuỗi nhập chưa escape cho C++.

Cách xử lý: generator C++ theo từng loại block với statementToCode/valueToCode và quản lý includes/definitions; bảo toàn thứ tự và scope. Kiểm tra chương trình có if, repeat, biến, nhiều sensor read và ký tự đặc biệt. Lưu workspace JSON và code theo lab; TabPanel hiện unmount editor khi chuyển tab nên workspace mất.

### A08 — Dashboard dùng props API cũ với react-grid-layout v2: P1

Nguồn: `DashboardBuilder.jsx:220`; package hiện dùng react-grid-layout 2.2.x; README/types của dependency local.

Thiếu width khiến phép tính layout sinh NaN. rowHeight/isDroppable/draggableHandle/resizeHandles đang theo API cũ trong khi entry v2 dùng gridConfig/dragConfig/resizeConfig/dropConfig. Không có đo container. Bounded state layouts mới chỉ giữ lg; thay breakpoint có thể ghi đè layout desktop.

Cách xử lý: dùng API v2 và ResizeObserver/useContainerWidth hoặc chọn legacy entry rõ ràng; lưu allLayouts theo breakpoint. Bổ sung bind device/field cho widget, editor config và persistence. ButtonWidget chưa được truyền onSend, gauge là số tĩnh, alert bật bằng click, image là placeholder. GPSMap/3D nhận height="100%" nhưng nối thêm px thành `100%px`.

### A09 — Error handler biến lỗi validation thành lỗi server: P1

Nguồn: `app/core/exceptions.py:33`.

exc.errors() của custom validator chứa ValueError trong ctx; truyền nguyên vào JSONResponse gây TypeError. Đã tái hiện POST simulation thiếu ESP32 board trả 500. HTTP handler cũng không chuyển tiếp exc.headers, làm mất WWW-Authenticate.

Cách xử lý: encode error details bằng encoder xử lý được exceptions hoặc normalize ctx thành chuỗi; giữ headers. Test body sai, component trùng ID/thiếu board, 401 và 404.

### A10 — Đăng ký MQTT mới chỉ ghi database: P1 nếu dùng broker cấu hình trong repo

Nguồn: `app/services/device.py:23`; `app/services/mosquitto_mgr.py`; `mosquitto/config/mosquitto.conf`.

DeviceService ghi mqtt_credentials/mqtt_acl nhưng không gọi mosquitto_mgr; broker trong repo dùng password_file/acl_file, không có DB auth plugin được khai báo. Vì vậy đăng ký API thành công chưa chứng minh credential được broker chấp nhận. Nếu broker external có DB auth plugin thì cần tài liệu cấu hình đó và integration test.

Cách xử lý: chọn một nguồn auth authoritative: broker DB plugin hoặc file/dynamic security provisioning. Đăng ký/xóa/disable/rotate phải có trạng thái đồng bộ và retry/compensation. Snippet firmware detail dùng WiFiClient thường với port TLS 8883; cần WiFiClientSecure, trust CA và host đúng.

### A11 — JWT/secret chưa được áp dụng nhất quán: P1/P2

Nguồn: `app/main.py:111`; `app/services/auth.py:33`; `app/core/config.py`; `mqtt_consumer.py:132`; `database.py:29`; `init.sql:220`.

- WS decode JWT trực tiếp, không kiểm tra Redis blacklist như REST; token logout có thể mở WS mới nếu vẫn còn hạn. WS đang mở không bị thu hồi hoặc kiểm tra hết hạn lại.
- WS giữ dependency session DB suốt vòng đời kết nối; truy vấn owner có thể giữ transaction/connection tới khi đóng WS.
- JWT secret có default dễ đoán, SQL tự seed admin với mật khẩu cố định. Đây là rủi ro của cấu hình/seed trong repo, chưa xác nhận secret thực tế production.
- MQTT debug log ghi password; DB normalizer có nhánh log full URL chứa credential. `logs/backend.log` và mosquitto passwd là tracked files. Chưa kiểm tra toàn bộ lịch sử Git có secret hay không.
- TLS hostname verification bị tắt cố định dù host có thể là domain.

Cách xử lý: chung một policy xác thực REST/WS, đóng DB session sau handshake, fail startup nếu secret chưa cấu hình, bỏ seed admin cố định, không log credential, kiểm tra và xử lý secret đã lộ nếu có. Cấu hình CA/SAN đúng và kiểm tra hostname.

## 5. Các cải thiện BE tiếp theo

### Simulator

Nguồn: `routers/simulations.py:51,87`; `services/simulation/manager.py:105,141,223`.

- Create chỉ chặn session đang active, nhưng session mới stopped. Có thể tạo hai session stopped rồi start cả hai; manager không khóa theo device. Đã tái hiện hai worker cùng UID.
- Cho simulator dùng bất kỳ device đang thuộc user, kể cả hardware; hai nguồn dùng chung UID/topic/cache và vị trí. Cần tạo simulated device riêng hoặc bắt buộc type simulator.
- speed, danh sách component/config được validate nhưng generator không dùng; mọi session vẫn có IMU/GPS/temp/battery.
- Reset đặt stopped và mở pause_event mà không cancel/await task; session paused có thể phát thêm một frame. Dùng stop/cancel trước rồi reset.
- source/seq sinh từ simulator bị TelemetryPayload bỏ; FE không thể phân biệt nguồn, phát hiện duplicate hoặc gap.
- Registry/cache ở RAM, không quota/TTL/cleanup theo user/device; restart mất session. Multi-worker cần distributed ownership; MVP nên tuyên bố một worker rõ ràng.
- Publisher connection loop chờ stopping event và cần kiểm tra broker disconnect/reconnect bằng test integration; không chỉ kiểm tra start thành công.

### Database và persistence

- init_db dùng engine.connect, thực thi SQL qua raw connection, không explicit commit; cần transaction rõ bằng engine.begin hoặc migration riêng. Chỉ kiểm tra bảng users nên không upgrade schema và lỗi startup bị log rồi tiếp tục.
- Chưa có migration files dù có dependency alembic. Database lỗi nhưng /health vẫn báo online/build_cache_ready=True.
- Consumer chỉ giữ telemetry RAM và ghi vị trí cuối; model/table telemetry chưa được sử dụng để lưu lịch sử. Redis hiện dùng blacklist, chưa cache telemetry.
- SQL telemetry chỉ có partition tháng 7 và 8/2026. Tại 14/10/2026, ghi bản tin mới sẽ không có partition thích hợp nếu chỉ dùng script này. Cần tạo partition tự động/default partition và retention.
- Relationship delete chưa có cascade/passive_deletes phù hợp; ORM có thể null FK trước khi DB cascade, làm credential/ACL mồ côi hoặc vướng NOT NULL telemetry. Chốt hard/soft delete và test với dữ liệu liên quan; SQL nói soft delete nhưng API đang hard delete.
- get_or_create progress và check-email-before-insert có race; xử lý unique conflict/upsert theo DB constraint.
- Validate lab_id 0–8, lat/lon, finite numbers, device_type, độ dài tên/code; password nên có giới hạn byte phù hợp bcrypt.
- close_db đã có nhưng lifespan chưa gọi.

### Compiler và luồng lệnh

- /compile dùng optional auth, code không giới hạn và không rate limit; lock chỉ tuần tự theo board, không giới hạn queue. Tách worker compiler, có quota/timeouts và môi trường hạn chế quyền/tài nguyên.
- Lock trong process không bảo vệ shared build_cache giữa nhiều worker/replica. Cần worker queue hoặc lock liên tiến trình.
- Timeout 600s nhưng log/duration lại 180s; proc.kill chưa await cleanup và shell có thể để child build tiếp tục. Xử lý cancellation và process tree.
- Firmware Base64 trả hai bản camelCase/snake_case làm response lớn gần gấp đôi cho trường binary. Chốt một schema; có thể tải binary qua artifact endpoint.
- Compiler thay hostname bằng IP hardcoded trong mã người dùng; đưa broker config vào template thay vì replace âm thầm.
- Thành công compiler rồi ghi progress lỗi có thể biến kết quả build thành 500; tách trạng thái artifact và progress rõ.
- Model Command có nhưng BE chưa có pipeline publish command/ack. CommandPanel chỉ gửi Serial; cần command_id, owner check, timeout/ack/idempotency nếu bổ sung uplink MQTT.

## 6. Các cải thiện FE tiếp theo

- SerialProvider lồng hai lần ở main.jsx/App.jsx; giữ một provider authoritative. Hiện component dùng provider trong nên chưa chứng minh có hai port được mở.
- SerialContext cần state machine disconnected/connecting/connected/flashing/error; chống connect lặp, xử lý rút USB, release reader lock, await inputDone, đóng port và cleanup khi unmount. Read loop hiện lỗi nhưng không cập nhật isConnected.
- SystemCheck dùng lines chụp từ render trước khi await nên không theo kịp response; không nhận phản hồi vẫn báo ok. Subscribe phản hồi theo command_id/thời điểm và hiển thị timeout/error.
- LabLayout ghi video_watched ngay khi vào overview, kể cả video rỗng. Lab0 có thể hoàn thành khi chỉ mở hai tab. Sidebar 0/3 cố định, Profile là dữ liệu server. Chốt tiêu chí hoàn thành và một progress source; với video dùng ended/progress API thực.
- DocViewer glob trỏ src/data/docs nhưng thư mục không có; fallback /api/docs chưa có route. Viết bài học thật và chỉ mark doc sau tải thành công. Lab0 dùng URL video mẫu; Lab1–8 trống.
- Api client chung cần status/error_code/details, xử lý 401, AbortController, cleanup khi unmount, lỗi mạng và retry phù hợp. Profile progress request chưa catch, AuthContext xóa token cả khi lỗi mạng/server.
- Monaco/Blockly code và dashboard layout cần lưu theo user/lab/version; TabPanel unmount Blockly làm mất workspace.
- 3D nên cập nhật ref trong useFrame, dùng timestamp/delta thực và orientation/quaternion/filter theo quy ước trục nhất quán. Hiện gyro tích phân với 0.1 cố định, rồi accel ghi đè pitch/roll; nhãn trục và rotation assignments cũng chưa thống nhất.
- Giới hạn số điểm/log theo bộ nhớ và tần suất render; SerialContext hiện làm toàn bộ consumer render lại mỗi dòng và parse JSON lặp ở từng widget.
- Chỉ import ECharts modules cần thiết, lazy-load Blockly/esptool/3D/map; đo bundle và thiết bị yếu. ECharts hiện notMerge mỗi update; tối ưu sau khi contract đúng. Không cần thêm Chart.js chỉ vì plan cũ nêu Chart.js.
- Hợp nhất light/dark visualization tokens; một số chart/card dùng màu dark hardcoded trong nền light. Fix `height="100%"` và gauge CSS nối hex suffix vào var(...), tạo màu CSS không hợp lệ.
- Google login/forgot password/search/bell/API link nên triển khai hoặc thể hiện trạng thái chưa khả dụng; remember checkbox hiện không thay đổi chính sách lưu token.
- Accessibility: lang="vi", liên kết label/input, lỗi form aria-describedby, keyboard tab semantics, button thay clickable div. Kiểm tra reduced-motion cho animation JS, không chỉ CSS.

## 7. Conflict thực tế và tài liệu

Không có Git merge conflict tại thời điểm audit. Có conflict về dữ liệu, cấu hình và định nghĩa:

| Hai phía | Conflict | Quyết định cần chốt |
|---|---|---|
| FE widget ↔ BE telemetry | snake_case/flat/JSON text ↔ camelCase normalized/nested | Một schema versioned + adapter |
| Demo ↔ Serial thật | Timer ghi đè dữ liệu thiết bị | Mode nguồn tường minh, một pipeline |
| Simulator ↔ hardware | Cùng device UID/topic/cache | Device simulator riêng |
| DB SQL ↔ ORM | Thiếu columns, metadata/User trùng | Một model/Base + migrations |
| Registry DB ↔ Mosquitto files | Credential trong DB chưa đi tới broker file auth | Một cơ chế auth broker authoritative |
| FE board ↔ hardware metadata | Compiler luôn ESP32-S3, OBC mô tả WROOM | Device profile/board selector |
| Dashboard code ↔ dependency | Props legacy trên RGL v2 | API v2 hoặc legacy entry |
| Progress UI ↔ BE | 0/3 cố định, xem tab = xem video, compile = hoàn thành | Tiêu chí học tập và server source |
| README ↔ source | README React18/TS/hooks/store/App.tsx,/ws và full Compose | Cập nhật theo React19/JSX,/ws/devices/uid, external infra |
| Scripts ↔ môi trường | package hardcode Windows Conda; systemd port8088; proxy8005; service Node cũ | Dev/prod config và commands portable |
| .env FE ↔ code | VITE_WS/COMPILER/HIVEMQ vars chưa được sử dụng | Xóa config thừa hoặc hỗ trợ rõ |

Docker build context ở root còn chứa fastapi-backend/.env vì .dockerignore chỉ có .env tại root và không loại toàn bộ secrets; Dockerfile BE COPY . . không có .dockerignore riêng. Cần loại .env/.env.*, logs, passwd/private keys khỏi build context, sau đó cấp config runtime. Docker socket được mount nhưng manager hiện không được gọi; bỏ mount nếu không cần, hoặc tách provisioning khỏi API/compiler.

`Docs/PERSONALIZED_INVITATION_CHECKPOINT.md` thuộc PMail và đánh dấu wrong repository; không phải yêu cầu sản phẩm CubeSat. `UI_IMPLEMENTATION_MAP.md` mô tả một số flow là live nhưng cũng ghi chưa test phần cứng/compile; phân biệt hoàn thành UI với nghiệm thu chức năng. Các plan mô phỏng là mục tiêu, không phải bằng chứng FE store/hooks đã tồn tại.

## 8. Thứ tự nên làm tiếp

### Đợt 1 — Làm nền tảng đúng và kiểm chứng được

1. Mở rộng ESLint tới JS/JSX; typecheck phần app thật bằng migration TS từng bước hoặc checkJs có kế hoạch. Thêm CI build/lint/BE tests.
2. Hợp nhất Base/User; migration sửa schema; bỏ admin seed cố định; test fresh-install + upgrade.
3. Sửa REST ownership, topic/payload validation, WS token revocation, secret logging và validation handler.
4. Chốt contract telemetry + board profile + error envelope; tạo typed API client và telemetry adapters.

Nghiệm thu: DB rỗng chạy register/login/register-device được; user B không đọc/sửa/subscribe device A; invalid config trả 422; telemetry số 0 giữ nguyên; topic giả mạo bị từ chối.

### Đợt 2 — Hoàn thiện một lab có phần cứng thật

1. Chọn Lab1 làm luồng mẫu, template blink/Serial build được với board thật.
2. Nối compile artifact → flash thật; xử lý bootloader/partition và Serial handoff.
3. Hoàn thiện Serial lifecycle, code persistence, generator Blockly cơ bản và JSON output phù hợp adapter.
4. Thêm một telemetry widget bằng dữ liệu thật, không có timer demo tự ghi đè.

Nghiệm thu: đổi code → build → flash → reset board → thấy Serial đúng code; lỗi build/flash/rút USB không báo thành công; chuyển tab không mất workspace.

### Đợt 3 — Nối simulator BE với FE

1. Device simulator riêng; khóa một active worker/UID; quota/TTL; reset/stop/pause đúng; speed/component behavior thực.
2. Store/session API + WS hook reconnect; bảo toàn source/seq và không trộn hardware.
3. Toolbar create/start/pause/resume/reset/stop rồi gắn 3D/chart/map qua cùng telemetry model.

Nghiệm thu: pause không phát thêm frame, reset về baseline, stop không task nền, mất broker/WS hiển thị lỗi/reconnecting, user khác không điều khiển được session.

### Đợt 4 — Hoàn thiện học liệu và dashboard

1. Viết video/docs/objectives từng lab, tiêu chí progress đúng và sidebar đồng bộ.
2. Sửa RGL v2/width; bind widget field/device; command ack; lưu layouts theo breakpoint/user.
3. Thêm history API/cache/retention nếu bài học cần truy xuất dữ liệu cũ.

### Đợt 5 — Hiệu năng và vận hành

1. MQTT processing queue/batch DB writes, hạn chế log mỗi packet, WS send timeout/backpressure; tránh client chậm giữ consumer dù đã gather song song.
2. Worker compiler riêng và build cache có kiểm soát; kiểm thử nhiều user/board.
3. Bundle splitting/import chọn lọc; 3D refs/render throttle; đo CPU/RAM/memory growth.
4. Readiness thực cho DB/Redis/MQTT/compiler, Compose healthchecks, phiên bản image/dependency pin, backup và telemetry partitions tự động.

Chưa nên bắt đầu tích hợp mô phỏng firmware phức tạp trước khi luồng telemetry, isolation và lifecycle MVP ổn định. Tài liệu Wokwi hiện là kế hoạch; dự án hiện mô phỏng giá trị cảm biến, chưa chạy code C++ người dùng.

## 9. Bộ kiểm thử tối thiểu cần bổ sung

| Nhóm | Test mang lại giá trị |
|---|---|
| DB | Migration empty DB/upgrade; ORM columns tương thích; delete không mồ côi credential/ACL/history |
| Auth | Register/login/401/logout blacklist; REST/WS owner isolation; password change/session policy |
| Telemetry | nested/flat/zero/null/non-finite; topic mismatch; source/seq; stale/offline |
| Simulator | start duplicate UID, pause/reset/stop, speed, quota/TTL, publisher disconnect |
| Compiler | invalid board/size/quota; same-board concurrent builds; timeout/cancel; artifact code hash |
| FE | Lab code default đúng; tabs giữ workspace; demo/real không trộn; 401/error; dashboard drop/layout responsive |
| E2E hardware | Compile → flash → Serial → sensor widget; USB disconnect/reconnect |

Tiêu chí quản lý tiến độ nên là từng luồng được nghiệm thu, thay vì số màn hình đã có hoặc chỉ build/lint PASS.
