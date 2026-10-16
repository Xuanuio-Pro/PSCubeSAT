# Kế hoạch triển khai Backend MVP — ESP/CubeSat Simulator

## 1. Mục tiêu

Backend cung cấp một simulator không cần firmware người dùng. Backend nhận cấu hình linh kiện và scenario, tạo simulated device, sinh telemetry rồi publish vào MQTT.

```text
FE config → FastAPI Simulation API → Simulation Worker
                                      ↓
                         MQTT sensors/{device_uid}/telemetry
                                      ↓
                         MQTT Consumer → WebSocket → FE
```

Simulator phải đi qua cùng MQTT consumer với ESP thật để đảm bảo hai nguồn dữ liệu có cùng behavior.

## 2. Phạm vi MVP

### Có trong MVP

- Tạo một simulator cho mỗi session.
- Một board `esp32-devkit`.
- MPU6500, BMP280, LED, Button và Battery ở mức dữ liệu.
- Scenario idle, rotation, shake, thermal và battery drain.
- Publish telemetry MQTT định kỳ.
- Start, Pause, Resume, Reset và Stop.
- Xác thực user và kiểm tra quyền session.
- Giới hạn số session và tự dừng session hết hạn.
- Cache trạng thái mới nhất để WebSocket init packet hoạt động.

### Chưa có trong MVP

- Chạy code C++ do user nhập.
- Compile hoặc upload firmware.
- CPU emulation.
- Mô phỏng chính xác Arduino Core.
- Mô phỏng đầy đủ GPIO/SPI/UART/WiFi.
- Chạy code user trực tiếp trong backend process.

## 3. Telemetry contract

Simulator publish payload canonical:

```json
{
  "device_id": "sim_7_a1b2c3",
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

MQTT topic:

```text
sensors/{device_uid}/telemetry
```

Backend phải validate `device_id` với device UID trong topic, không tin mù payload.

## 4. Module backend

Tạo cấu trúc:

```text
fastapi-backend/app/
├── routers/simulations.py
├── schemas/simulation.py
├── services/simulation/
│   ├── manager.py
│   ├── worker.py
│   ├── scenario.py
│   ├── sensor_model.py
│   └── mqtt_publisher.py
├── repository/simulation.py
└── models/simulation.py
```

## 5. Database model

Có thể bắt đầu bằng in-memory registry, nhưng nên chuẩn bị model database:

```text
simulation_sessions
- id
- user_id
- device_uid
- status
- config_json
- scenario
- speed
- started_at
- stopped_at
- last_activity
- created_at
```

Không tạo device simulator trùng với device hardware. Nên dùng prefix `sim_` để dễ phân biệt.

## 6. Schema cấu hình

```python
class SimulationComponent(BaseModel):
    id: str
    type: Literal[
        "esp32-devkit", "mpu6500", "bmp280",
        "led", "button", "battery"
    ]
    config: dict[str, str | int | float | bool] = {}

class SimulationConfig(BaseModel):
    board: Literal["esp32-devkit"]
    components: list[SimulationComponent]
    scenario: Literal[
        "idle", "rotation", "shake",
        "thermal", "battery_drain"
    ]
    speed: float = Field(default=1.0, ge=0.1, le=10.0)
```

Validation tối thiểu:

- phải có board ESP32;
- không quá một board;
- component type không nằm ngoài allowlist;
- MPU6500 không trùng I2C address;
- speed nằm trong giới hạn;
- số component không vượt giới hạn.

## 7. Simulation Manager

`SimulationManager` chịu trách nhiệm:

- tạo session;
- tạo `asyncio.Task`;
- start/pause/resume/reset/stop;
- publish telemetry;
- dọn task khi user logout hoặc timeout;
- không cho user truy cập session của user khác.

Pseudo-flow:

```python
async def run_session(session):
    while session.status == "running":
        telemetry = scenario_engine.next_frame()
        await mqtt_publisher.publish(session.device_uid, telemetry)
        await asyncio.sleep(0.05)
```

MVP có thể tick 20 Hz và publish 10–20 Hz. Không cần 100 Hz vì browser không cần render ở tốc độ đó.

## 8. Scenario engine

### idle

```text
acc = (0, 0, 1)
gyro = (0, 0, 0)
temperature = 25
voltage = 3.8
```

### rotation

Dùng hàm sin hoặc angular velocity cố định để tạo roll/pitch/yaw.

### shake

Thêm nhiễu giới hạn vào acc và gyro. Nhiễu phải deterministic nếu session có seed để dễ test.

### thermal

Nhiệt độ thay đổi theo ramp hoặc sin wave, có giới hạn min/max.

### battery_drain

Điện áp giảm theo thời gian và không thấp hơn ngưỡng an toàn.

## 9. API

```text
POST /api/simulations
POST /api/simulations/{id}/start
POST /api/simulations/{id}/pause
POST /api/simulations/{id}/resume
POST /api/simulations/{id}/reset
POST /api/simulations/{id}/stop
GET  /api/simulations/{id}
GET  /api/simulations
```

Response tạo session:

```json
{
  "id": "sim-session-123",
  "device_uid": "sim_7_a1b2c3",
  "status": "stopped",
  "config": {}
}
```

## 10. MQTT integration

Simulator dùng lại MQTT settings hiện có. Không để simulator publish WebSocket trực tiếp.

Các điểm cần triển khai:

- MQTT publisher dùng cùng broker với consumer.
- Dùng topic `sensors/{device_uid}/telemetry`.
- `device_id` trong payload phải bằng `device_uid`.
- Consumer nhận `source=simulator`.
- Cache latest state theo device UID.
- WebSocket room chỉ nhận dữ liệu của device đang được xem.

Cần sửa schema backend để nhận canonical nested payload và tránh dùng biểu thức `value or default`, vì giá trị 0 là giá trị hợp lệ.

## 11. Lifecycle và lỗi

```text
STOPPED
  ↓ start
STARTING → RUNNING → PAUSED
    ↓                   ↓ resume
  ERROR                RUNNING

RUNNING/PAUSED → reset → STOPPED hoặc PAUSED
RUNNING/PAUSED → stop  → STOPPED
```

Khi publisher lỗi:

- ghi log session;
- chuyển status thành `error`;
- đóng task;
- không làm crash FastAPI;
- FE nhận trạng thái lỗi qua API hoặc WebSocket event.

## 12. Bảo mật và giới hạn

- Mọi API cần JWT hiện tại.
- Chỉ owner được xem/điều khiển session.
- Device UID simulator phải không đoán dễ dàng hoặc phải gắn user ID.
- Giới hạn số session trên user.
- Giới hạn tuổi thọ session.
- Giới hạn tốc độ publish.
- Không chạy C++/Python user trong process backend.
- Không cho user tự chọn MQTT topic tùy ý.

## 13. Docker triển khai

### MVP

Chạy simulator worker bên trong FastAPI bằng `asyncio.Task`. Cách này phù hợp giai đoạn đầu vì không cần thêm container.

### Khi cần scale

Tách worker thành service riêng:

```text
fastapi API → Redis queue → simulator worker → MQTT
```

Worker riêng phù hợp khi cần nhiều session đồng thời hoặc cần restart simulator độc lập với API.

## 14. Kiểm thử backend

### Unit test

- Scenario tạo đúng giá trị.
- Reset trả về trạng thái ban đầu.
- Pause không publish frame mới.
- Speed thay đổi đúng tick interval.
- Voltage/temperature không vượt range.
- Payload validate đúng schema.

### Integration test

- POST tạo session.
- Start tạo MQTT message.
- Consumer normalize được message.
- WebSocket nhận init packet.
- WebSocket nhận realtime packet.
- Stop dừng publish.
- User khác không truy cập được session.

### Load test nhỏ

- 1 user / 1 session.
- 5 user / 5 session.
- 20 session trong thời gian ngắn.
- Theo dõi CPU, RAM, MQTT rate và số WebSocket.

## 15. Tiêu chí nghiệm thu BE

- Tạo được simulated device từ config FE.
- Session publish telemetry vào đúng topic.
- Backend consumer nhận được và broadcast đúng room.
- Payload simulator và ESP thật dùng cùng normalization.
- Session không ảnh hưởng device hardware.
- Stop không còn task chạy nền.
- Restart backend không để task zombie.
- Không thể truy cập session của user khác.
- Log có session ID, device UID và trạng thái lifecycle.

## 16. Thứ tự triển khai BE

### Bước 1

Chuẩn hóa `TelemetryPayload`, thêm `source`, `seq` và test normalize.

### Bước 2

Tạo schema/config và API tạo session.

### Bước 3

Tạo scenario engine và MQTT publisher.

### Bước 4

Tích hợp lifecycle manager với FastAPI lifespan.

### Bước 5

Kết nối WebSocket và latest state.

### Bước 6

Thêm authorization, quota, timeout và cleanup.

### Bước 7

Viết integration/load tests và chuẩn bị đánh giá Wokwi.

## 17. Điều kiện chuyển sang đánh giá Wokwi

Chỉ bắt đầu POC Wokwi khi:

- telemetry contract đã ổn định;
- simulator MVP chạy qua MQTT/WS;
- FE không còn phụ thuộc MQTT trực tiếp;
- lifecycle session đã có;
- có test phân biệt hardware và simulator;
- đã đo được giới hạn CPU/RAM của simulator MVP.

POC Wokwi cần kiểm tra board ESP32, Arduino Core, sensor, MQTT, session isolation, khả năng chạy nhiều session và mô hình chi phí.
