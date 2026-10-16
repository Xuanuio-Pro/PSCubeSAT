# Kế hoạch triển khai Frontend MVP — ESP/CubeSat Simulator

## 1. Mục tiêu

Xây dựng giao diện mô phỏng cho người dùng không có phần cứng. Người dùng chọn board ESP32, chọn linh kiện, chọn kịch bản rồi chạy mô phỏng ngay trên giao diện.

MVP chưa cho phép viết hoặc nạp code firmware. Logic mô phỏng do backend cung cấp thông qua MQTT và WebSocket.

```text
Chọn linh kiện → Tạo cấu hình → Start → Nhận telemetry WebSocket → Render mô phỏng
```

## 2. Phạm vi MVP

### Có trong MVP

- Chọn ESP32 DevKit làm board chính.
- Chọn các linh kiện: MPU6500, BMP280, LED, Button, Battery.
- Hiển thị board và linh kiện trên canvas.
- Cấu hình cơ bản cho từng linh kiện.
- Chọn kịch bản chuyển động.
- Start, Pause, Resume, Reset và Stop simulation.
- Hiển thị dữ liệu realtime từ backend.
- Hiển thị mô hình CubeSat 3D.
- Hiển thị biểu đồ accelerometer, gyroscope, nhiệt độ và điện áp.
- Hiển thị trạng thái phiên mô phỏng và WebSocket.

### Chưa có trong MVP

- Code editor Arduino/C++.
- Compile firmware.
- Nạp firmware vào simulator.
- Mô phỏng đầy đủ GPIO, SPI, UART và WiFi.
- Tự do thiết kế mạch phức tạp.
- Chạy nhiều simulator trong cùng một canvas.

## 3. Luồng người dùng

```text
1. Mở trang Simulator
2. Chọn ESP32 DevKit
3. Chọn linh kiện
4. Cấu hình linh kiện nếu cần
5. Chọn scenario
6. Nhấn “Tạo mô phỏng”
7. Nhấn “Start”
8. FE kết nối WebSocket theo simulated device UID
9. Nhận telemetry và cập nhật UI
10. Pause/Reset/Stop khi cần
```

## 4. Bố cục giao diện

```text
┌────────────────────────────────────────────────────────────┐
│ Simulation Toolbar                                         │
│ Board | Scenario | Speed | Create | Start | Pause | Reset  │
├───────────────┬─────────────────────────┬──────────────────┤
│ Component      │ Circuit / ESP Canvas    │ Inspector        │
│ Palette        │                         │                  │
│               │                         │                  │
│ ESP32          │  ESP32 + sensors        │ Selected part    │
│ MPU6500        │  wires / pins           │ Pin / address    │
│ BMP280         │                         │ parameters       │
│ LED            │                         │                  │
│ Button         │                         │                  │
├───────────────┴─────────────────────────┴──────────────────┤
│ 3D CubeSat View | Charts | Event Log | Simulation Status    │
└────────────────────────────────────────────────────────────┘
```

## 5. Công nghệ và trách nhiệm

### React Three Fiber

Dùng cho mô hình CubeSat 3D và animation:

- thân vệ tinh;
- solar panel;
- sensor module;
- anten;
- roll/pitch/yaw;
- trạng thái LED và button.

Nên dùng thêm `@react-three/drei` cho camera controls, text, helpers và loading model.

### `@wokwi/elements`

Dùng cho circuit view 2D và hình ảnh board/linh kiện. Đây chỉ là lớp hiển thị, không phải simulator engine.

### Chart.js

Dùng cho biểu đồ realtime ngắn hạn:

- accelerometer;
- gyroscope;
- temperature;
- voltage.

FE chỉ vẽ khoảng 10–20 điểm/giây và giới hạn 300–1000 điểm mỗi series.

### Leaflet

Dùng cho bản đồ ground station, vị trí CubeSat và đường bay mô phỏng. Không dùng Leaflet cho mô hình 3D.

### Zustand

Dùng store hiện có để quản lý:

- simulation config;
- simulation session;
- selected component;
- latest telemetry;
- telemetry history;
- WebSocket status;
- event logs.

## 6. TypeScript model đề xuất

```ts
type ComponentType =
  | 'esp32-devkit'
  | 'mpu6500'
  | 'bmp280'
  | 'led'
  | 'button'
  | 'battery';

type SimulationScenario =
  | 'idle'
  | 'rotation'
  | 'shake'
  | 'thermal'
  | 'battery_drain';

interface SimulationComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  config: Record<string, string | number | boolean>;
}

interface SimulationConfig {
  board: 'esp32-devkit';
  components: SimulationComponent[];
  scenario: SimulationScenario;
  speed: number;
}

interface SimulationSession {
  id: string;
  deviceUid: string;
  status: 'stopped' | 'starting' | 'running' | 'paused' | 'error';
  config: SimulationConfig;
}
```

## 7. API frontend sử dụng

```text
POST /api/simulations
POST /api/simulations/{id}/start
POST /api/simulations/{id}/pause
POST /api/simulations/{id}/resume
POST /api/simulations/{id}/reset
POST /api/simulations/{id}/stop
GET  /api/simulations/{id}
```

Sau khi tạo session, FE kết nối:

```text
/ws/devices/{device_uid}?token={jwt}
```

FE không kết nối MQTT trực tiếp.

## 8. Các component cần triển khai

```text
src/components/simulator/
├── SimulationPage.tsx
├── SimulationToolbar.tsx
├── ComponentPalette.tsx
├── CircuitCanvas.tsx
├── ComponentInspector.tsx
├── Simulation3DView.tsx
├── SimulationCharts.tsx
├── SimulationMap.tsx
├── SimulationStatus.tsx
└── SimulationEventLog.tsx
```

Hooks/service:

```text
src/hooks/useSimulation.ts
src/hooks/useSimulationWebSocket.ts
src/service/simulationApi.ts
src/store/simulationStore.ts
```

## 9. State flow

```text
User chọn linh kiện
  ↓
simulationStore.config
  ↓
POST /api/simulations
  ↓
simulationStore.session
  ↓
WebSocket deviceUid
  ↓
latestTelemetry + history
  ├── CircuitCanvas
  ├── Simulation3DView
  ├── SimulationCharts
  ├── SimulationMap
  └── Status/Event Log
```

## 10. Quy tắc UX

- Chưa chọn board thì không cho tạo simulator.
- Chưa có MPU6500 thì cảnh báo accelerometer/gyro không khả dụng.
- Chỉ cho một ESP32 trong MVP.
- Khi đang chạy không cho thay đổi cấu hình phần cứng; phải Stop hoặc Reset.
- Khi WebSocket mất kết nối, hiển thị trạng thái “Reconnecting”.
- Khi Stop, xóa history của simulated device khỏi giao diện.
- Dữ liệu cũ không được trộn với device thật.

## 11. Tiêu chí nghiệm thu FE

- Người dùng tạo được cấu hình từ palette.
- Cấu hình gửi đúng JSON cho backend.
- Tạo session thành công và nhận được device UID.
- WebSocket kết nối đúng room.
- Mô hình 3D thay đổi theo gyro/acc telemetry.
- Chart cập nhật nhưng không tăng bộ nhớ vô hạn.
- Pause làm UI ngừng nhận giá trị mới.
- Reset đưa UI về trạng thái mặc định.
- Đổi page không làm mất session đang chạy.
- Refresh trang có thể tải lại session hoặc hiển thị session đã dừng theo chính sách backend.

## 12. Thứ tự triển khai FE

### Bước 1

Tạo `simulationStore`, type model và API client.

### Bước 2

Làm toolbar và palette bằng dữ liệu tĩnh.

### Bước 3

Làm circuit canvas 2D, chưa cần nối dây tự do.

### Bước 4

Kết nối API tạo/start/pause/reset/stop.

### Bước 5

Kết nối WebSocket và dùng telemetry thật từ backend.

### Bước 6

Tích hợp 3D, Chart.js và Leaflet.

### Bước 7

Thêm validation, reconnect, error state và polish UI.
