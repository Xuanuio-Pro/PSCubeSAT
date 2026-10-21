# 🛰️ PTIT-STEM-CUBE — Ground Station & CubeSat IDE Platform

> **Hệ thống Trạm Mặt Đất (Ground Station) & Trình Biên Dịch Code / Quản Lý Telemetry Realtime cho Vệ Tinh Giáo Dục CubeSat (ESP32 / ESP32-S3).**

---

## 📌 Tổng Quan Kiến Trúc (Architecture Overview)

Dự án được xây dựng theo kiến trúc **Microservices + Realtime Streaming**, cho phép kết nối hàng loạt thiết bị CubeSat (ESP32), thu thập dữ liệu cảm biến, biên dịch firmware từ xa và trực quan hóa dữ liệu vệ tinh theo thời gian thực.

```
                      ┌─────────────────────────────────────────┐
                      │    ESP32 / ESP32-S3 CubeSat Hardware    │
                      └────────────────────┬────────────────────┘
                                           │ MQTT over TLS (Port 8883)
                                           ▼
                    ┌──────────────────────────────────────────┐
                    │              Mosquitto Broker            │
                    │          (MQTT Server + TLS)             │
                    └──────────────────────┬───────────────────┘
                                           │ MQTT topics
                                           ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                                DOCKER STACK                                      │
    │                                                                                  │
    │  ┌────────────────────┐       ┌────────────────────┐       ┌──────────────────┐  │
    │  │   FastAPI Backend  │ ────> │ PostgreSQL / Redis │ ────> │ React Frontend   │  │
    │  │(MQTT Consumer/WS/  │       │ (Lịch sử & Cache)  │       │ (Ground Station) │  │
    │  │ PlatformIO Compiler)│      └────────────────────┘       └──────────────────┘  │
    └─────────────────────────────────────┬────────────────────────────────────────────┘
                                          │ WebSocket (/ws) + HTTP REST (/api)
                                          ▼
                      ┌─────────────────────────────────────────┐
                      │    React + Vite + Tailwind Frontend     │
                      │  (Trạm Mặt Đất & Web IDE Biên Dịch Code)│
                      └─────────────────────────────────────────┘
```

### 1. Mosquitto Broker
* **Role**: MQTT broker trung tâm, nhận kết nối từ ESP32 / ESP32-S3 qua TLS.
* **Port**: `8883` cho MQTT over TLS, `1883` chỉ nên dùng nội bộ hoặc dev.
* **Security**: Không bật anonymous, xác thực bằng `device_id` / `device_secret`.
* **ACL**: Giới hạn mỗi thiết bị chỉ publish/subscribe đúng topic của nó.

### 2. Backend (FastAPI Services)
* **Framework**: Python 3.11+ FastAPI (Uvicorn ASGI).
* **Logging**: `loguru` (Pretty logging, log rotation 10MB/7 ngày).
* **MQTT Consumer**: `paho-mqtt` (Subscribe `sensors/#`, broadcast dữ liệu về WebSocket).
* **Compiler Engine**: PlatformIO Core CLI (Persistent build cache per board `esp32` / `esp32s3`, build thời gian thực chỉ ~2-5 giây/lần).
* **Device Management**: Python Docker SDK (Đồng bộ tài khoản & ACL của Mosquitto tự động).

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### 1. Frontend (Trạm Mặt Đất Web App)
* **Core**: React 18, TypeScript, Vite.
* **Styling**: TailwindCSS (Cyberpunk / Dark Aerospace Theme).
* **Code Editor**: `@monaco-editor/react` (Tương tự VS Code trên web).
* **Hardware Flashing**: `esptool-js` (Nạp firmware qua Web Serial API trực tiếp trên trình duyệt).
* **Realtime**: WebSocket client (`useBackendWebSocket`).

### 2. Backend (FastAPI Services)
* **Framework**: Python 3.11+ FastAPI (Uvicorn ASGI).
* **Logging**: `loguru` (Pretty logging, log rotation 10MB/7 ngày).
* **MQTT Consumer**: `paho-mqtt` (Subscribe `sensors/#`, broadcast dữ liệu về WebSocket).
* **Compiler Engine**: PlatformIO Core CLI (Persistent build cache per board `esp32` / `esp32s3`, build thời gian thực chỉ ~2-5 giây/lần).
* **Device Management**: Python Docker SDK (Đồng bộ tài khoản & ACL của Mosquitto tự động).

### 3. Infrastructure
* **Database**: PostgreSQL 16 (Lưu trữ Telemetry dài hạn) + Redis 7 (Caching trạng thái gần nhất).

---

## 🚀 Hướng Dẫn Chạy Dự Án (Developer Quickstart)

**Triển khai server:** dùng [hướng dẫn build/chạy BE + DB](Docs/SERVER_STARTUP.md). Chọn DB `external` để giữ dữ liệu container PostgreSQL đang có, hoặc `managed` cho cài mới. Không dùng Compose mặc định bên dưới để triển khai production.

### Yêu cầu môi trường (Prerequisites)
- Docker & Docker Compose
- Miniconda / Anaconda (Python 3.11+)
- Node.js 18+ & npm

### 1. Khởi động Hạ Tầng Docker (Backend, Broker, DB)
```bash
# Clone repo & chuyển vào thư mục dự án
cd PTIT-STEM-CUBE

# Khởi chạy các container (Mosquitto, FastAPI, Redis, Postgres)
docker compose up -d

# Kiểm tra trạng thái các container
docker compose ps
```

### 2. Khởi Động Frontend (Vite Dev Server)
```bash
# Cài đặt thư viện frontend
npm install

# Chạy server phát triển Frontend (Default: http://localhost:5173)
npm run dev
```

---

## 📡 Danh Sách Endpoint APIs & Services

Triển khai thay bản cũ tại `cubesat.p-tech.xyz`: xem [quy trình chuyển server, env, backup/migration và rollback](Docs/SERVER_MIGRATION_CUBESAT.md). Dùng `docker-compose.server.yml` sau proxy hiện có; `docker-compose.production.yml` dành cho server tự chạy Caddy HTTPS.

Ứng dụng yêu cầu đăng nhập để dùng Lab và các dịch vụ. API dịch vụ (kể cả health, compiler, artifact và mã mẫu) yêu cầu `Authorization: Bearer <access_token>`; WebSocket kiểm token và quyền sở hữu thiết bị. Đăng xuất/hết phiên đóng USB và telemetry. Xem [báo cáo đăng nhập và trực quan Lab](Docs/AUTH_LAB_VISUALIZATION_2026-10-21.md).

### HTTP REST APIs (`http://localhost:8003`)
* `GET  /api/health`: Kiểm tra sức khỏe hệ thống & phiên bản PlatformIO Compiler.
* `POST /api/compile`: Gửi mã C++/Arduino để biên dịch ra file `firmware.bin` (Base64).
* `GET  /api/devices`: Lấy danh sách thiết bị CubeSat đã đăng ký.
* `POST /api/devices/register`: Đăng ký CubeSat mới (Sinh `device_id`, `device_secret`, cấu hình Mosquitto ACL & trả về C++ code template).
* `DELETE /api/devices/{device_id}`: Xoá thiết bị khỏi hệ thống & Mosquitto Auth.
* `GET  /api/telemetry/latest`: Lấy dữ liệu cảm biến mới nhất của các thiết bị.

### WebSocket Realtime Stream
* `WS /ws`: Kết nối nhận stream dữ liệu cảm biến (Telemetry) đẩy từ Mosquitto về Client theo thời gian thực.

---

## 📂 Cấu Trúc Thư Mục (Repository Structure)

```text
PTIT-STEM-CUBE/
├── fastapi-backend/         # Backend Python FastAPI
│   ├── app/
│   │   ├── routers/         # REST API Routes (health, compiler, telemetry, devices)
│   │   ├── services/        # Business logic (compiler_svc, mqtt_consumer, mosquitto_mgr)
│   │   ├── websocket/       # ConnectionManager xử lý WebSocket
│   │   └── main.py          # App entrypoint & Lifespan handler
│   ├── build_cache/         # Persistent cache của PlatformIO (esp32, esp32s3)
│   ├── Dockerfile           # Dockerfile build backend container
│   └── requirements.txt
│
├── mosquitto/               # Cấu hình & Dữ liệu Mosquitto Broker
│   ├── config/              # mosquitto.conf, passwd, acl
│   ├── data/                # Database lưu trữ mosquitto.db
│   └── log/                 # mosquitto.log
│
├── src/                     # Source code React Frontend
│   ├── components/          # React Components (WebCodeEditor, TelemetryCharts, DeviceRegistry...)
│   ├── hooks/               # Custom React Hooks (useBackendWebSocket, useWebSerial...)
│   ├── store/               # Zustand telemetry store
│   └── App.tsx              # Main App entry & routing
│
├── docker-compose.yml       # Orchestration file cho toàn bộ Docker Stack
├── vite.config.ts           # Config Vite (đã ignore build_cache để tránh reload trang)
└── README.md
```

---

## 👥 Hướng Dẫn Đóng Góp (Contribution Guidelines)
1. Mọi code thay đổi ở Backend cần sử dụng `loguru` để ghi log thay cho `print` hoặc `logging` mặc định.
2. Không sửa thủ công file `mosquitto/config/passwd` hay `acl` vì service `mosquitto_mgr.py` sẽ tự động cập nhật khi thao tác qua API `/api/devices`.
