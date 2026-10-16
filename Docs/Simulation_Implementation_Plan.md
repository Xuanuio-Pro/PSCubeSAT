# Kế hoạch triển khai mô phỏng CubeSat/ESP32

## 1. Mục tiêu

Xây dựng chế độ mô phỏng cho người dùng không có phần cứng, nhưng giữ nguyên đường truyền telemetry của hệ thống thật:

```text
Simulator → MQTT → FastAPI MQTT Consumer → WebSocket → React Frontend
ESP32 thật ────────────────────────────────────────────────┘
```

Frontend không phân biệt dữ liệu đến từ ESP32 thật hay simulator. Sự khác biệt chỉ nằm ở `source` và trạng thái thiết bị.

## 2. Phạm vi

### Bao gồm

- Mô phỏng một thiết bị CubeSat/ESP32.
- Mô phỏng MPU6500: accelerometer và gyroscope.
- Mô phỏng BMP280: nhiệt độ, áp suất, độ cao.
- Sinh dữ liệu telemetry theo thời gian thực.
- Điều khiển Start, Pause, Resume, Reset và tốc độ mô phỏng.
- Hiển thị mô hình 3D, biểu đồ và vị trí trên bản đồ.
- Đánh giá khả năng tích hợp Wokwi sau khi MVP ổn định.

### Chưa bao gồm trong giai đoạn đầu

- Chạy nguyên firmware ESP32 thật trong browser.
- Mô phỏng Bluetooth, camera, flash và toàn bộ ngoại vi ESP32.
- Mô phỏng vật lý chính xác cấp phòng thí nghiệm.
- Cho phép người dùng chạy mã tùy ý trên server.

## 3. Nguyên tắc kiến trúc

1. Chỉ có một telemetry contract cho hardware và simulator.
2. Simulator publish MQTT như một thiết bị thật.
3. Backend consumer là nơi normalize, validate, cache và broadcast.
4. FE chỉ nhận telemetry qua WebSocket backend.
5. Simulator không được publish trực tiếp vào WebSocket.
6. Mọi phiên mô phỏng có device UID riêng và thuộc user hiện tại.

## 4. Telemetry contract

Payload chuẩn đề xuất:

```json
{
  "device_id": "sim_cube_001",
  "source": "simulator",
  "seq": 120,
  "timestamp": 1785149000,
  "acc": { "x": 0.02, "y": -0.01, "z": 1.01 },
  "gyro": { "x": 0.3, "y": -0.1, "z": 0.05 },
  "temperature": 25.4,
  "voltage": 3.78,
  "gps": { "lat": 21.0285, "lon": 105.8542, "alt": 10.0 }
}
```

Backend normalize thành format WebSocket hiện có: `accX`, `accY`, `accZ`, `gyroX`, `gyroY`, `gyroZ`, `temperatureC`, `voltageV`, `gpsLat`, `gpsLon`, `gpsAlt`.

Các trường bắt buộc cần kiểm tra:

- `device_id`: định danh thiết bị.
- `source`: `hardware` hoặc `simulator`.
- `seq`: số thứ tự gói tin.
- `timestamp`: thời điểm đo hoặc thời điểm simulator tạo gói.
- `acc`, `gyro`: dữ liệu IMU.
- `temperature`, `voltage`: dữ liệu môi trường và nguồn.

## 5. Giai đoạn 1 — Simulator MVP

### 5.1. Thành phần backend

Tạo module `fastapi-backend/app/services/simulation/` gồm:

- `manager.py`: quản lý lifecycle phiên mô phỏng.
- `scenario.py`: các kịch bản chuyển động.
- `sensor_model.py`: sinh dữ liệu IMU/BMP280.
- `mqtt_publisher.py`: publish telemetry vào `sensors/{device_uid}/telemetry`.

API đề xuất:

```text
POST /api/simulations
POST /api/simulations/{id}/start
POST /api/simulations/{id}/pause
POST /api/simulations/{id}/resume
POST /api/simulations/{id}/reset
POST /api/simulations/{id}/stop
GET  /api/simulations/{id}
```

Trạng thái phiên:

```text
STOPPED → STARTING → RUNNING → PAUSED
                         ↓
                       ERROR
```

### 5.2. Mô hình chuyển động

MVP chỉ cần mô phỏng có kiểm soát, không cần solver vật lý phức tạp:

- `idle`: accelerometer gần `0, 0, 1`, gyro gần 0.
- `roll`: thay đổi roll theo sin hoặc tốc độ góc cố định.
- `pitch`: thay đổi pitch theo sin.
- `yaw`: quay đều quanh trục Z.
- `shake`: thêm nhiễu ngẫu nhiên có biên độ giới hạn.
- `thermal`: nhiệt độ tăng/giảm theo thời gian.
- `battery_drain`: điện áp giảm dần.

Mỗi tick mô phỏng nên chạy 20–50 Hz. Backend có thể publish 10–20 Hz cho FE; không cần vẽ 100 Hz ở browser.

### 5.3. Cô lập phiên

Mỗi simulator cần có:

- `simulation_id`;
- `device_uid` dạng `sim_{user_id}_{short_id}`;
- user owner;
- scenario;
- simulation speed;
- last activity;
- maximum lifetime.

Khi user logout, xóa thiết bị mô phỏng khỏi active state và dừng task tương ứng.

## 6. Giai đoạn 1 — Frontend

### 6.1. Mô hình 3D

Dùng React Three Fiber và `@react-three/drei` cho:

- thân CubeSat;
- solar panel;
- module MPU6500/BMP280;
- anten;
- đèn trạng thái;
- camera orbit;
- hiển thị roll/pitch/yaw.

Mô hình nên nhận một object duy nhất:

```ts
type SimulationViewState = {
  rotation: { roll: number; pitch: number; yaw: number };
  sensors: TelemetryData;
  status: 'running' | 'paused' | 'stopped';
};
```

Không để component 3D tự tạo dữ liệu cảm biến. Dữ liệu phải đến từ Zustand store sau WebSocket.

### 6.2. Wokwi Elements

Dùng `@wokwi/elements` cho sơ đồ mạch 2D, pin, LED, button và module sensor. Thư viện này chỉ là lớp hiển thị Web Components, không phải engine mô phỏng CPU hay firmware.

Có thể dùng hai chế độ hiển thị:

- `3D mode`: React Three Fiber.
- `circuit mode`: Wokwi Elements.

### 6.3. Biểu đồ

Dùng Chart.js cho nhiệt độ, điện áp, gyro, accelerometer và lịch sử ngắn.

Quy tắc realtime:

- Giới hạn 300–1000 điểm mỗi series.
- FE nhận 10–20 mẫu/giây.
- Tắt animation dài khi stream realtime.
- Downsample dữ liệu trước khi render.
- Dữ liệu dài hạn lấy từ API lịch sử, không giữ toàn bộ trong Zustand.

### 6.4. Bản đồ

Dùng Leaflet cho:

- marker CubeSat;
- ground station;
- đường bay;
- popup telemetry;
- vùng phủ sóng đơn giản.

R3F chỉ xử lý mô hình 3D; Leaflet xử lý bản đồ địa lý.

## 7. Giai đoạn 1 — Docker và vận hành

Thêm service `simulator` hoặc chạy simulator như task trong FastAPI. Với MVP, nên bắt đầu bằng task trong FastAPI để giảm số container và dễ debug.

Khi cần scale nhiều phiên, tách thành service riêng:

```text
fastapi → simulation manager → simulator workers → MQTT
```

Cần có giới hạn:

- tối đa số phiên/user;
- timeout phiên không hoạt động;
- giới hạn tốc độ publish;
- không cho publish topic ngoài namespace của user;
- không cho chạy code người dùng trực tiếp trong process backend.

## 8. Kiểm thử nghiệm thu MVP

MVP được xem là đạt khi:

- User tạo được simulated device.
- Start simulator tạo được MQTT telemetry.
- MQTT consumer nhận và normalize đúng.
- FE nhận qua WebSocket, không kết nối MQTT trực tiếp.
- Đổi thiết bị không trộn dữ liệu cũ.
- Pause làm dừng telemetry.
- Reset đưa sensor về trạng thái ban đầu.
- Mất WebSocket tự reconnect.
- Biểu đồ không tăng bộ nhớ vô hạn.
- Simulator không làm ảnh hưởng thiết bị thật.

## 9. Giai đoạn 2 — Đánh giá tích hợp Wokwi

Chỉ đánh giá Wokwi sau khi simulator MVP và telemetry contract đã ổn định.

### 9.1. Các câu hỏi cần kiểm chứng

1. Có chạy được đúng board ESP32 đang dùng không?
2. Có chạy được Arduino Core và các thư viện firmware hiện tại không?
3. Có mô phỏng được MPU6500 và BMP280 cần dùng không?
4. Có kết nối được MQTT broker của hệ thống không?
5. Có kiểm soát được project, firmware và device UID theo user không?
6. Có chạy headless/server-side được không?
7. Chi phí và giới hạn phiên đồng thời như thế nào?
8. Có thể tự host hoặc cần dịch vụ bên ngoài?

### 9.2. Proof of Concept Wokwi

POC chỉ cần một firmware nhỏ:

- đọc MPU6500 giả lập;
- đọc BMP280 giả lập;
- publish payload chuẩn;
- nhận một command reset;
- xuất serial log;
- chạy được trong một session độc lập.

Kết quả POC phải đo:

- thời gian khởi động;
- tần suất telemetry;
- độ trễ MQTT;
- độ ổn định khi reconnect;
- CPU/RAM theo phiên;
- khả năng chạy nhiều phiên đồng thời.

### 9.3. Tiêu chí quyết định

Chọn Wokwi làm engine chính nếu:

- chạy được firmware thực tế hoặc bản firmware gần tương đương;
- mô phỏng đủ các sensor cần thiết;
- kết nối được MQTT theo mô hình bảo mật;
- có cách kiểm soát session và chi phí phù hợp;
- không làm thay đổi pipeline backend/FE.

Nếu không đạt, giữ simulator MVP làm chế độ chính và dùng Wokwi ở chế độ học tập/POC hoặc link project riêng.

## 10. Lộ trình đề xuất

### Sprint 1

- Chốt telemetry contract.
- Sửa schema backend và test normalize.
- Tạo simulation manager tối thiểu.

### Sprint 2

- Hoàn thiện motion/sensor scenarios.
- Publish MQTT và điều khiển lifecycle.
- Thêm simulated device vào Device Registry.

### Sprint 3

- Tích hợp màn hình mô phỏng vào FE.
- Xây dựng scene R3F.
- Thêm Chart.js và Leaflet cho simulator mode.

### Sprint 4

- Test reconnect, authorization, isolation và performance.
- Viết POC Wokwi.
- Đánh giá kết quả theo bộ tiêu chí ở trên.

## 11. Kết luận

Phương án nên triển khai là:

```text
Bước 1: Simulator service nội bộ, publish MQTT chuẩn
Bước 2: FE 3D/map/chart dùng chung WebSocket với phần cứng thật
Bước 3: POC Wokwi chạy firmware thật hoặc gần thật
Bước 4: Chỉ tích hợp Wokwi sâu nếu POC đạt các tiêu chí kỹ thuật
```

Cách này cho phép sản phẩm có chế độ mô phỏng sớm, không phụ thuộc ngay vào khả năng chạy ESP32 của Wokwi, đồng thời vẫn mở đường để đánh giá firmware simulation một cách có kiểm soát.

## Tài liệu tham khảo

- [Wokwi ESP32 Simulation](https://docs.wokwi.com/guides/esp32)
- [Wokwi Elements](https://github.com/wokwi/wokwi-elements)
- [React Three Fiber Events](https://r3f.docs.pmnd.rs/api/events)
- [Leaflet Quick Start](https://leafletjs.com/examples/quick-start/)
- [Chart.js Animations](https://www.chartjs.org/docs/latest/configuration/animations.html)
