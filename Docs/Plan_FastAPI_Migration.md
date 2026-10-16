# 🛰️ Kế Hoạch Chuyển Đổi Backend: Node.js → FastAPI + Mosquitto MQTT Self-Hosted

**Phiên bản:** 2.0  
**Ngày soạn:** 2026-07-21  
**Tài liệu tham khảo:** [Huong_dan_trien_khai_IoT_ESP32_MQTT.md](./Huong_dan_trien_khai_IoT_ESP32_MQTT.md)

---

## 1. LÝ DO CHUYỂN SANG MOSQUITTO SELF-HOSTED

| Tiêu chí | HiveMQ Cloud (cũ) | Mosquitto Self-Hosted (mới) |
|---|---|---|
| **Quản lý user** | Mỗi người dùng phải tự đăng ký HiveMQ → không thể mở rộng | Backend tự cấp `device_id` + `device_secret` cho từng ESP32 |
| **Chi phí** | Free tier giới hạn kết nối đồng thời | Tự host, không giới hạn |
| **ACL (phân quyền topic)** | Phụ thuộc HiveMQ config | Mosquitto ACL tự cấu hình hoàn toàn |
| **Kiểm soát** | Phụ thuộc bên thứ 3 | Toàn quyền kiểm soát |
| **Phù hợp mở rộng** | ❌ Không | ✅ Có |

---

## 2. KIẾN TRÚC MỚI (CÓ MOSQUITTO)

### 2.1 Sơ Đồ Tổng Thể

```
ESP32 của Người Dùng A          ESP32 của Người Dùng B
   device_id: "uuid-aaa"           device_id: "uuid-bbb"
   device_secret: "xxx"            device_secret: "yyy"
        │                               │
        │  MQTT over TLS — port 8883    │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌─────────────────────────────┐
        │   Mosquitto MQTT Broker     │  ← self-hosted trong Docker
        │   (port 1883 nội bộ)        │
        │   (port 8883 public TLS)    │
        │                             │
        │   ACL: uuid-aaa chỉ được   │
        │   publish topic của chính  │
        │   nó, không đọc topic khác │
        └──────────────┬──────────────┘
                       │
                       │  Subscribe: sensors/#
                       ▼
        ┌──────────────────────────────────────────────────┐
        │                 FastAPI Backend                  │
        │                  (port 8000)                     │
        │                                                  │
        │  ┌──────────────────┐   ┌─────────────────────┐  │
        │  │  MQTT Consumer   │   │  Compiler Router    │  │
        │  │  (aiomqtt)       │   │  POST /api/compile  │  │
        │  └────────┬─────────┘   └─────────────────────┘  │
        │           │                                      │
        │           ├──────────────────────┐               │
        │           │                      │               │
        │  ┌────────▼────────┐  ┌──────────▼───────────┐   │
        │  │   Redis Cache   │  │   WebSocket /ws      │   │
        │  │  latest state   │  │   broadcast realtime │   │
        │  └────────┬────────┘  └──────────────────────┘   │
        │           │                                      │
        │  ┌────────▼────────┐   ┌──────────────────────┐  │
        │  │   PostgreSQL    │   │  Device Registry     │  │
        │  │   telemetry     │   │  (cấp device creds)  │  │
        │  └─────────────────┘   └──────────────────────┘  │
        └──────────────────────────────────────────────────┘
                       │
                       │  REST API + WebSocket
                       ▼
        React Frontend — Vite (port 5173)
           (Dashboard của nhiều người dùng)
```

### 2.2 Vai Trò Từng Thành Phần

| Thành phần | Vai trò |
|---|---|
| **Mosquitto** | MQTT Broker tự host — nhận kết nối từ mọi ESP32, enforce ACL |
| **FastAPI Device Registry** | Tạo `device_id` (UUID) + `device_secret` → trả cho người dùng nạp vào ESP32 |
| **FastAPI MQTT Consumer** | Subscribe `sensors/#` từ Mosquitto nội bộ, validate, broadcast WS, lưu DB |
| **Mosquitto ACL** | Mỗi thiết bị chỉ được publish topic của chính nó |
| **Redis** | Latest state mỗi thiết bị — đọc O(1) |
| **PostgreSQL** | Lịch sử telemetry + bảng `devices` (Device Registry) |
| **FastAPI WebSocket `/ws`** | Đẩy data realtime đến Frontend của từng người dùng |

---

## 3. THIẾT KẾ MOSQUITTO

### 3.1 Cấu Hình Mosquitto (`mosquitto.conf`)

```
# Lắng nghe nội bộ (không TLS, chỉ dùng trong Docker network)
listener 1883 0.0.0.0
protocol mqtt

# Lắng nghe public (TLS, dành cho ESP32 kết nối từ Internet)
listener 8883 0.0.0.0
protocol mqtt
cafile   /mosquitto/certs/ca.crt
certfile /mosquitto/certs/server.crt
keyfile  /mosquitto/certs/server.key

# Bắt buộc xác thực — không cho phép anonymous
allow_anonymous false
password_file /mosquitto/config/passwd
acl_file      /mosquitto/config/acl
```

### 3.2 Hệ Thống Xác Thực Thiết Bị

Mỗi ESP32 khi kết nối Mosquitto sẽ dùng:
- **Username** = `device_uuid` (do Backend sinh ra)
- **Password** = `device_secret` (do Backend sinh ra, trả về 1 lần duy nhất)

### 3.3 ACL (Access Control List)

```
# Thiết bị uuid-aaa: chỉ được publish topic của chính nó
user uuid-aaa
topic write sensors/uuid-aaa/#
topic write status/uuid-aaa

# Thiết bị uuid-bbb: tương tự
user uuid-bbb
topic write sensors/uuid-bbb/#
topic write status/uuid-bbb

# Backend service account: được subscribe tất cả
user backend-service
topic read sensors/#
topic read status/#
topic write cmd/#
```

> **Lưu ý:** File `passwd` và `acl` được FastAPI tự động cập nhật khi có thiết bị mới đăng ký, sau đó gọi `mosquitto_passwd` và reload Mosquitto config.

### 3.4 Topic Convention (Multi-Tenant)

| Topic | Hướng | Mô tả |
|---|---|---|
| `sensors/{device_uuid}/mpu6500` | ESP32 → Broker | Telemetry cảm biến IMU |
| `sensors/{device_uuid}/gps` | ESP32 → Broker | Dữ liệu GPS |
| `sensors/{device_uuid}/#` | Backend subscribe | Nhận mọi sensor của thiết bị |
| `sensors/#` | Backend subscribe | Nhận tất cả mọi thiết bị |
| `status/{device_uuid}` | ESP32 → Broker | Online/offline heartbeat |
| `cmd/{device_uuid}` | Backend → ESP32 | Gửi lệnh điều khiển |

---

## 4. DEVICE REGISTRY (ĐĂNG KÝ THIẾT BỊ)

### 4.1 Bảng `devices` (PostgreSQL)

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | SERIAL PK | Auto-increment |
| `owner_id` | INT FK | ID người dùng sở hữu |
| `device_uuid` | UUID UNIQUE | ID thiết bị (dùng làm MQTT username) |
| `secret_hash` | VARCHAR | Bcrypt hash của device_secret |
| `name` | VARCHAR | Tên thiết bị (do người dùng đặt) |
| `status` | ENUM | `active` / `inactive` |
| `created_at` | TIMESTAMPTZ | Thời điểm tạo |
| `last_seen` | TIMESTAMPTZ | Lần cuối kết nối |

### 4.2 Flow Đăng Ký Thiết Bị Mới

```
Người dùng (Web)                FastAPI                  Mosquitto
     │                              │                         │
     │  POST /api/devices/register  │                         │
     │ ─────────────────────────►  │                         │
     │                              │  1. Sinh device_uuid    │
     │                              │  2. Sinh device_secret  │
     │                              │  3. Hash secret → lưu DB│
     │                              │  4. Thêm vào passwd file│
     │                              │  5. Thêm vào ACL file   │
     │                              │  6. Reload Mosquitto    │
     │                              │ ───────────────────────►│
     │  { device_uuid,              │                         │
     │    device_secret }  ◄──────  │                         │
     │  (trả về 1 lần duy nhất)     │                         │
     │                              │                         │
     │  Nạp vào ESP32 firmware      │                         │
```

### 4.3 API Endpoints Device Registry

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/devices/register` | Đăng ký thiết bị mới, trả về credentials |
| `GET` | `/api/devices` | Danh sách thiết bị của người dùng |
| `DELETE` | `/api/devices/{uuid}` | Thu hồi thiết bị (xoá khỏi ACL) |
| `GET` | `/api/devices/{uuid}/status` | Trạng thái online/offline |

---

## 5. SCHEMA CƠ SỞ DỮ LIỆU ĐẦY ĐỦ

### Bảng `users`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | SERIAL PK | |
| `email` | VARCHAR UNIQUE | |
| `password_hash` | VARCHAR | Bcrypt |
| `created_at` | TIMESTAMPTZ | |

### Bảng `devices`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | SERIAL PK | |
| `owner_id` | INT FK → users.id | |
| `device_uuid` | UUID UNIQUE | MQTT username |
| `secret_hash` | VARCHAR | Bcrypt hash |
| `name` | VARCHAR | Tên đặt bởi user |
| `status` | VARCHAR | active / inactive |
| `created_at` | TIMESTAMPTZ | |
| `last_seen` | TIMESTAMPTZ | |

### Bảng `telemetry`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `device_id` | UUID FK → devices.device_uuid | |
| `received_at` | TIMESTAMPTZ | |
| `acc_x/y/z` | FLOAT | g |
| `gyro_x/y/z` | FLOAT | dps |
| `temperature` | FLOAT | °C |
| `voltage` | FLOAT | V |
| `gps_lat/lon/alt` | FLOAT NULLABLE | |
| `raw_payload` | JSONB | Payload gốc MQTT |

Index: `(device_id, received_at DESC)`

### Redis Keys

```
telemetry:{device_uuid}:latest   →  JSON string, TTL 60s
device:{device_uuid}:online      →  "1", TTL 30s (heartbeat)
```

---

## 6. CẤU TRÚC THƯ MỤC ĐẦY ĐỦ

```
PTIT-STEM-CUBE/
├── src/                              # React Frontend
├── compiler-backend/                 # Node.js cũ (xoá sau khi xong)
│
├── fastapi-backend/                  # ← Backend chính
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   │   ├── health.py             # GET /api/health
│   │   │   ├── compiler.py           # POST /api/compile
│   │   │   ├── telemetry.py          # GET /api/telemetry/...
│   │   │   ├── devices.py            # POST/GET/DELETE /api/devices/...
│   │   │   └── auth.py               # POST /api/auth/login, /register
│   │   ├── services/
│   │   │   ├── mqtt_consumer.py      # Subscribe Mosquitto nội bộ
│   │   │   ├── compiler_svc.py       # PlatformIO async
│   │   │   ├── redis_svc.py          # Cache latest state
│   │   │   └── mosquitto_mgr.py      # Cập nhật passwd + ACL + reload
│   │   ├── websocket/
│   │   │   └── ws_manager.py
│   │   ├── models/
│   │   │   ├── telemetry.py
│   │   │   ├── device.py
│   │   │   └── user.py
│   │   └── db/
│   │       └── database.py
│   ├── .env
│   ├── .env.example
│   ├── requirements.txt
│   └── Dockerfile
│
├── mosquitto/                        # ← Mosquitto config
│   ├── config/
│   │   ├── mosquitto.conf
│   │   ├── passwd                    # Được FastAPI cập nhật động
│   │   └── acl                       # Được FastAPI cập nhật động
│   └── certs/
│       ├── ca.crt
│       ├── server.crt
│       └── server.key
│
├── docker-compose.yml
└── Docs/
    ├── Huong_dan_trien_khai_IoT_ESP32_MQTT.md
    └── Plan_FastAPI_Migration.md
```

---

## 7. KẾ HOẠCH TRIỂN KHAI — 8 BƯỚC

```
Bước 1 ──► Bước 2 ──► Bước 3 ──► Bước 4 ──► Bước 5 ──► Bước 6 ──► Bước 7 ──► Bước 8
FastAPI    Compile    Mosquitto  MQTT Con   WebSocket   Redis      PostgreSQL  Docker
                     + Certs    + Registry + Auth      Cache      + History   Compose
   ▲          ▲         ▲           ▲           ▲
   └──────────┴─────────┴───────────┴───────────┘
                    MVP — demo được đầy đủ
```

---

### 📦 BƯỚC 1 — Khởi tạo FastAPI

**Mục tiêu:** Server FastAPI cơ bản chạy được.

Công việc:
- Tạo `fastapi-backend/` với `requirements.txt`, `app/main.py`, `app/config.py`
- CORS middleware (cho phép `localhost:5173` và Ngrok URL)
- `GET /api/health` kiểm tra PlatformIO CLI

**Kiểm tra:** `curl http://localhost:8000/api/health` → `{"status": "online"}`

---

### ⚙️ BƯỚC 2 — Di Chuyển Compiler PlatformIO

**Mục tiêu:** Biên dịch C++ async thay thế Node.js, tối ưu tốc độ bằng Persistent Build Cache.

#### ⚡ Vấn Đề Tốc Độ Build

| Tình huống | Thời gian |
|---|---|
| Lần đầu tiên (download toolchain ESP32) | ⏳ 5–15 phút |
| Build thông thường (tạo thư mục tạm mới mỗi lần) | ⏳ 60–120 giây |
| **Build incremental (giữ cache `.pio/build/`)** | ✅ **10–20 giây** |

**Vấn đề gốc rễ của thiết kế cũ (Node.js):** Mỗi request tạo thư mục tạm mới → PlatformIO
không có cache → compile lại toàn bộ framework ESP32 từ đầu mỗi lần.

#### 🚀 Giải Pháp: Persistent Build Directory

Thay vì xoá thư mục sau mỗi build, dùng **thư mục cố định theo loại board**:

```
fastapi-backend/
└── build_cache/
    ├── esp32s3/            ← Project PlatformIO cố định cho ESP32-S3
    │   ├── platformio.ini
    │   ├── src/
    │   │   └── main.cpp    ← Chỉ thay file này mỗi lần build
    │   └── .pio/build/     ← Cache object files — KHÔNG XOÁ
    └── esp32/              ← Tương tự cho ESP32 Standard
```

PlatformIO sẽ chỉ recompile `main.cpp` (file thay đổi), toàn bộ framework đã
compile sẵn trong cache → **10–20 giây** thay vì 60–120 giây.

#### 🔒 Xử Lý Đồng Thời: Board Lock

Nhiều user build cùng lúc → cần lock per board để tránh race condition:

```python
import asyncio

_board_locks = {
    "esp32s3": asyncio.Lock(),
    "esp32":   asyncio.Lock(),
}

async def compile(code, board):
    async with _board_locks[board]:  # 1 build/board tại một thời điểm
        # Ghi main.cpp → pio run → đọc firmware.bin
        ...
```

Nếu sau này cần build song song, nâng cấp lên **pool thư mục**
(ví dụ `esp32s3_1/`, `esp32s3_2/`, `esp32s3_3/` → 3 request đồng thời/board).

#### Công Việc Cụ Thể

- `services/compiler_svc.py`:
  - Khởi tạo `build_cache/esp32s3/` và `build_cache/esp32/` khi server start lần đầu
  - `asyncio.create_subprocess_exec("pio", "run", ...)` với `board_lock`
  - Chỉ ghi đè `main.cpp`, KHÔNG xoá thư mục sau build
- `routers/compiler.py`: `POST /api/compile` nhận `{ code, board }`
- Cập nhật `.env` frontend: `VITE_COMPILER_BACKEND_URL=http://localhost:8000`

**Kiểm tra:** Build lần 1 ~90 giây. Build lần 2 cùng board ~15 giây.

---

### 📡 BƯỚC 3 — Mosquitto Self-Hosted + TLS Certificates

**Mục tiêu:** MQTT Broker tự host chạy trong Docker, có TLS.

Công việc:
1. Tạo thư mục `mosquitto/config/` và `mosquitto/certs/`
2. Sinh TLS certificates (self-signed hoặc Let's Encrypt):
   - `ca.crt`, `server.crt`, `server.key`
3. Viết `mosquitto.conf`:
   - Port 1883 nội bộ (không TLS, chỉ trong Docker network)
   - Port 8883 public (TLS, cho ESP32 kết nối từ Internet)
   - `allow_anonymous false`
4. Tạo tài khoản `backend-service` trong `passwd` file (cho FastAPI subscribe)
5. Thêm Mosquitto vào `docker-compose.yml`

**Kiểm tra:** `mosquitto_pub -h localhost -p 1883 -u backend-service -P xxx -t test -m hello` → Mosquitto nhận được.

---

### 🔑 BƯỚC 4 — Device Registry + MQTT Consumer

**Mục tiêu:** Backend cấp credentials cho ESP32, tự subscribe Mosquitto nội bộ.

Công việc:

**Device Registry:**
1. Tạo bảng `devices` trong PostgreSQL (Alembic migration)
2. `services/mosquitto_mgr.py`:
   - `add_device(uuid, secret)`: ghi vào `passwd` + `acl`, gọi `mosquitto_passwd`, reload Mosquitto
   - `remove_device(uuid)`: xoá khỏi `passwd` + `acl`, reload
3. `routers/devices.py`:
   - `POST /api/devices/register` → sinh UUID + secret → hash → lưu DB → cập nhật Mosquitto → trả credentials
   - `GET /api/devices` → danh sách thiết bị của user
   - `DELETE /api/devices/{uuid}` → thu hồi

**MQTT Consumer:**
4. `services/mqtt_consumer.py` kết nối Mosquitto **nội bộ port 1883** (không TLS, trong Docker network)
5. Subscribe `sensors/#` → parse JSON → validate Pydantic → broadcast WS

**Kiểm tra:** Đăng ký thiết bị mới → nạp credentials vào ESP32 → ESP32 kết nối Mosquitto thành công.

---

### 🔌 BƯỚC 5 — WebSocket Realtime

**Mục tiêu:** Frontend nhận data qua WebSocket, xoá MQTT trực tiếp.

**Phía Backend:**
1. `websocket/ws_manager.py`: `ConnectionManager` — `connect/disconnect/broadcast`
2. Route `WebSocket /ws`
3. MQTT Consumer gọi `ws_manager.broadcast()` sau parse

**Phía Frontend:**
1. Xoá `src/hooks/useMqtt.ts`
2. Tạo `src/hooks/useWebSocket.ts`:
   - Kết nối `wss://<backend-ngrok>/ws`
   - Nhận JSON → cập nhật `useTelemetryStore`
   - Auto-reconnect

**Kiểm tra:** Trang Trực Quan 3D tự cập nhật khi ESP32 publish — không cần bấm "Kết Nối MQTT".

---

### 🔴 BƯỚC 6 — Redis Cache

**Mục tiêu:** Latest state mỗi thiết bị đọc O(1).

Công việc:
- `services/redis_svc.py`: `set_latest(device_uuid, data)` TTL 60s
- MQTT Consumer gọi `set_latest()` mỗi message
- `GET /api/telemetry/latest/{device_uuid}` đọc từ Redis

---

### 🗄️ BƯỚC 7 — PostgreSQL Lịch Sử

**Mục tiêu:** Lưu toàn bộ lịch sử telemetry.

Công việc:
- Model `Telemetry` (SQLAlchemy async) + Alembic migration
- MQTT Consumer: **batch insert mỗi 5 giây**
- `GET /api/telemetry/history?device_id=&limit=100&from=&to=`

---

### 🐳 BƯỚC 8 — Docker Compose Toàn Hệ Thống

**Mục tiêu:** `docker compose up -d` khởi động tất cả.

| Service | Image | Port Public |
|---|---|---|
| `mosquitto` | `eclipse-mosquitto:2` | `8883` (TLS cho ESP32) |
| `fastapi` | Dockerfile Python 3.12-slim | `8000` |
| `postgres` | `postgres:16-alpine` | nội bộ |
| `redis` | `redis:7-alpine` | nội bộ |

Cập nhật `ngrok.yml`: tunnel `8000` (FastAPI) và `8883` (Mosquitto TLS cho ESP32).

---

## 8. SO SÁNH 3 PHƯƠNG ÁN

| Tiêu chí | HiveMQ Cloud (cũ) | Mosquitto Self-Hosted (mới) |
|---|---|---|
| Cấp credentials thiết bị | ❌ Người dùng tự đăng ký | ✅ Backend tự cấp |
| Mở rộng nhiều người dùng | ❌ Không | ✅ Có |
| Phân quyền topic (ACL) | Phụ thuộc HiveMQ | ✅ Tự cấu hình hoàn toàn |
| Chi phí | Free tier giới hạn | ✅ Tự host, không giới hạn |
| Phức tạp triển khai | Thấp | Trung bình (thêm TLS certs) |
| Phụ thuộc bên thứ 3 | Cao | ✅ Không có |

---

## 9. BIẾN MÔI TRƯỜNG `.env`

```env
# FastAPI
PORT=8000

# Mosquitto (nội bộ Docker network — không TLS)
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_USERNAME=backend-service
MQTT_PASSWORD=<strong-password>
MQTT_TOPIC=sensors/#

# Redis
REDIS_URL=redis://redis:6379

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://cubesat:password@postgres:5432/cubesat_db

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://<ngrok-frontend-url>

# JWT Secret (cho xác thực người dùng sau)
JWT_SECRET=<random-secret>
JWT_EXPIRE_MINUTES=1440
```

---

## 10. CHIẾN LƯỢC TRIỂN KHAI (DEPLOYMENT STRATEGY)

### 10.1 Vấn Đề Đặc Thù Của Dự Án Này

Dự án có **2 yêu cầu kỹ thuật đặc biệt** khiến nhiều platform cloud thông thường không phù hợp:

| Yêu cầu | Lý do |
|---|---|
| **PlatformIO CLI** (`pio` binary ~500MB, toolchain C++) | Cần cài vào môi trường server, không chạy được trên serverless (Vercel, Netlify, Render free tier) |
| **Mosquitto TCP port 8883** | Cần expose TCP port tùy chỉnh — hầu hết platform miễn phí chỉ cho HTTP/HTTPS |

---

### 10.2 Lộ Trình Deploy Theo Giai Đoạn

```
Giai đoạn 1          Giai đoạn 2              Giai đoạn 3
(Dev / Demo)         (Production nhỏ)          (Mở rộng)
     │                     │                       │
Cloudflare Tunnel    VPS + Tên miền           Kubernetes /
(miễn phí)          (~$6–10/tháng)           Cloud managed
     │                     │                       │
Thay Ngrok,          docker compose           Khi có hàng
URL cố định          up -d là xong            trăm user
```

---

### 10.3 Giai Đoạn 1 — Cloudflare Tunnel (Thay Thế Ngrok)

**Phù hợp:** Dev, demo, thử nghiệm với số ít user.  
**Chi phí:** **Miễn phí hoàn toàn**, URL cố định không đổi mỗi lần restart.

#### So Sánh Ngrok vs Cloudflare Tunnel

| Tiêu chí | Ngrok Free | Cloudflare Tunnel Free |
|---|---|---|
| URL cố định | ❌ Thay đổi mỗi lần | ✅ Cố định |
| Giới hạn request | Có | Không |
| Chạy như systemd service | ✅ (đã làm) | ✅ Tương tự |
| TCP tunnel (Mosquitto 8883) | ❌ Chỉ plan trả phí | ✅ Có (cloudflared) |
| Chi phí | $0 (giới hạn) / $10/tháng | **$0 hoàn toàn** |

#### Cách Cài Cloudflare Tunnel

```bash
# 1. Cài cloudflared
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# 2. Đăng nhập (mở browser)
cloudflared tunnel login

# 3. Tạo tunnel
cloudflared tunnel create cubesat

# 4. Cấu hình routes
cloudflared tunnel route dns cubesat api.yourdomain.com   # FastAPI
cloudflared tunnel route dns cubesat app.yourdomain.com   # Frontend
```

> **Lưu ý:** Cloudflare Tunnel yêu cầu có tên miền do Cloudflare quản lý DNS.  
> Nếu chưa có tên miền, dùng `trycloudflare.com` (không cần đăng ký, URL random nhưng ổn định hơn Ngrok).

---

### 10.4 Giai Đoạn 2 — VPS + Tên Miền (Production Thật)

**Phù hợp:** Khi có người dùng thật, cần uptime ổn định 24/7.

#### Lựa Chọn VPS Gợi Ý

| Provider | Gói | RAM | CPU | Giá | Ghi chú |
|---|---|---|---|---|---|
| **Hetzner** (khuyến nghị) | CX22 | 4 GB | 2 vCPU | **€3.79/tháng** | Rẻ nhất, datacenter EU |
| DigitalOcean | Basic | 2 GB | 1 vCPU | $6/tháng | Phổ biến, nhiều tutorial |
| Vultr | Cloud Compute | 2 GB | 1 vCPU | $6/tháng | Có datacenter Singapore |
| Linode (Akamai) | Nanode | 1 GB | 1 vCPU | $5/tháng | Đơn giản |

> **Khuyến nghị:** Hetzner CX22 (4GB RAM) đủ chạy FastAPI + Mosquitto + Redis + PostgreSQL + Vite build. Chọn datacenter **Nuremberg** hoặc **Singapore** tùy latency.

#### Lựa Chọn Tên Miền

| Registrar | Ví dụ | Giá/năm | Ghi chú |
|---|---|---|---|
| Namecheap | `cubesat-ptit.com` | ~$12 | Phổ biến, rẻ |
| Porkbun | `cubesat-ptit.com` | ~$10 | Rẻ nhất |
| **Việt Nam** | `.vn` qua PA Vietnam / Mắt Bão | ~200k–500k | Tên miền nội địa |

---

### 10.5 Quy Trình Deploy Lên VPS

#### Bước A — Chuẩn Bị VPS

```bash
# Trên VPS (Ubuntu 24.04 LTS)
sudo apt update && sudo apt upgrade -y

# Cài Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Cài Certbot (Let's Encrypt TLS)
sudo apt install certbot -y
```

#### Bước B — Clone Project & Cấu Hình

```bash
git clone https://github.com/your-repo/PTIT-STEM-CUBE.git
cd PTIT-STEM-CUBE

# Tạo .env từ mẫu
cp fastapi-backend/.env.example fastapi-backend/.env
nano fastapi-backend/.env   # Điền thông tin thật
```

#### Bước C — TLS Certificate Cho Mosquitto (Let's Encrypt)

```bash
# Sinh cert cho tên miền mqtt.yourdomain.com
sudo certbot certonly --standalone -d mqtt.yourdomain.com

# Copy cert vào mosquitto/certs/
sudo cp /etc/letsencrypt/live/mqtt.yourdomain.com/fullchain.pem mosquitto/certs/server.crt
sudo cp /etc/letsencrypt/live/mqtt.yourdomain.com/privkey.pem   mosquitto/certs/server.key
sudo cp /etc/letsencrypt/live/mqtt.yourdomain.com/chain.pem     mosquitto/certs/ca.crt
```

#### Bước D — Khởi Động Toàn Hệ Thống

```bash
docker compose up -d

# Kiểm tra
docker compose ps
docker compose logs -f fastapi
```

#### Bước E — Nginx Reverse Proxy (HTTPS)

Nginx đứng trước FastAPI để:
- Terminate TLS (HTTPS) cho REST API và WebSocket
- Serve Frontend static files
- Rate limiting để bảo vệ `/api/compile`

```nginx
# /etc/nginx/sites-available/cubesat
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # REST API
    location /api/ {
        proxy_pass http://localhost:8000;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 443 ssl;
    server_name app.yourdomain.com;

    # Serve Vite build
    root /var/www/cubesat-frontend;
    index index.html;
    try_files $uri /index.html;  # SPA routing
}
```

---

### 10.6 Cấu Trúc DNS Đề Xuất

```
yourdomain.com
├── app.yourdomain.com    →  VPS IP  (Frontend)
├── api.yourdomain.com    →  VPS IP  (FastAPI REST + WebSocket)
└── mqtt.yourdomain.com   →  VPS IP  (Mosquitto TCP 8883 cho ESP32)
```

Cấu hình trong firmware ESP32:
```cpp
const char* MQTT_HOST = "mqtt.yourdomain.com";
const uint16_t MQTT_PORT = 8883;
```

---

### 10.7 Firewall VPS (UFW)

```bash
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP (redirect → HTTPS)
sudo ufw allow 443     # HTTPS (Nginx)
sudo ufw allow 8883    # MQTT over TLS (Mosquitto, cho ESP32)
sudo ufw enable
```

> **Không mở port 8000** (FastAPI) và **5432** (PostgreSQL) ra ngoài — chỉ truy cập nội bộ qua Nginx.

---

### 10.8 Tóm Tắt Chi Phí Ước Tính

#### Giai Đoạn 1 — Cloudflare Tunnel
| Khoản | Chi phí |
|---|---|
| Cloudflare Tunnel | **$0** |
| Tên miền (nếu cần) | $10–12/năm |
| **Tổng** | **$0 – $1/tháng** |

#### Giai Đoạn 2 — VPS Production
| Khoản | Chi phí |
|---|---|
| Hetzner CX22 VPS | €3.79/tháng (~$4.2) |
| Tên miền `.com` | ~$1/tháng (quy ra) |
| Let's Encrypt TLS | **$0** |
| **Tổng** | **~$5–6/tháng** |
