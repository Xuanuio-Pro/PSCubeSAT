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
## 🚀 Chạy dự án trên máy dev (Developer Quickstart)

Triển khai server không dùng các bước này: xem [SERVER_STARTUP.md](Docs/SERVER_STARTUP.md) và [RUNBOOK_RELEASE.md](Docs/RUNBOOK_RELEASE.md).

### Yêu cầu
- Node.js 20.19+ hoặc 22.12+ và npm (yêu cầu của Vite 8)
- Python 3.11 (khuyên dùng `.venv` trong `fastapi-backend/`; `scripts/python.mjs` tự tìm `.venv`, conda env đang bật, hoặc biến `PSCUBESAT_PYTHON`)
- Docker (PostgreSQL/Redis/Mosquitto cho dev và image compiler)

### Lần đầu
```bash
git clone https://github.com/Xuanuio-Pro/PSCubeSAT.git && cd PSCubeSAT
npm install

cd fastapi-backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env          # giá trị mặc định khớp DB dev bên dưới
cp ../.env.example ../.env    # biến frontend (tùy chọn)
docker build -f compiler/Dockerfile -t pscubesat-compiler:1 .   # chỉ cần khi thử biên dịch firmware
cd ..

npm run dev:db:docker         # PostgreSQL 16 dev tại 127.0.0.1:5432 (user cubesat / cubesat_dev)
npm run db:migrate            # alembic upgrade head
npm run curriculum:seed       # nạp giáo trình Lab 0–8 vào DB
```

### Hằng ngày
```bash
npm run dev:db:docker   # nếu container DB chưa chạy (Windows có PostgreSQL portable: npm run dev:db)
npm run dev             # tự chạy Redis/Mosquitto dev + migrate, rồi FE http://localhost:5173 và BE :8005
```
`npm run dev:fe` / `npm run dev:be` chạy riêng từng phần. Vite proxy `/api` và `/ws` sang BE.

### Tài khoản và chế độ lớp học (LMS)
- Đăng ký tài khoản trên giao diện (luôn là `user`). Không có API công khai tạo Admin; trên DB dev:
  ```bash
  docker compose -f docker-compose.dev.yml exec postgres \
    psql -U cubesat -d cubesat -c "UPDATE users SET role='admin' WHERE email='you@example.com';"
  ```
- Bật học theo lớp: `LMS_CLASS_MODE=true` trong `fastapi-backend/.env`, khởi động lại BE. Hướng dẫn thao tác Admin/GV/SV: [USER_GUIDE.md](Docs/USER_GUIDE.md).

### Kiểm tra trước khi push
```bash
npm run check             # lint, typecheck, test FE (node --test), ruff + unittest BE (SQLite)
npm run build
npm run test:be:postgres  # migration/khóa đồng thời trên PostgreSQL thật; cần POSTGRES_PASSWORD và POSTGRES_ADMIN_PASSWORD trong fastapi-backend/.env
```
Migration mới phải qua `python -m alembic upgrade head` trên DB sạch và `python -m alembic downgrade -1 && python -m alembic upgrade head` (chạy trong `fastapi-backend/`). Format Python: `python scripts/check_backend.py --fix`.

---

## 📡 API & Services

API (trừ đăng ký/đăng nhập) yêu cầu `Authorization: Bearer <access_token>`; WebSocket kiểm token và quyền sở hữu thiết bị. Tài liệu OpenAPI khi chạy dev: `http://localhost:8005/docs`.

| Nhóm | Endpoint chính |
|---|---|
| Hệ thống, compiler | `GET /api/health`, `POST /api/compile`, artifact/flash, `GET /api/devices`, `GET /api/telemetry/latest`, `WS /ws` |
| Admin | `/api/admin/users`, `GET /api/admin/dashboard`, `PATCH /api/admin/classes/{id}/lms-mode` |
| Lớp học | `/api/classes`, `/api/classes/{id}/members`, `/api/lms/config`, `/api/lms/lab-entry` |
| Chương trình, tiến độ | `/api/classes/{id}/curriculum`, `/api/classes/{id}/learning-path`, sự kiện học, nộp/chấm thực hành |
| Lab Test | ngân hàng câu hỏi (nhập JSON/CSV, duyệt, xuất bản), bắt đầu/lưu/nộp lượt thi |
| Báo cáo | `GET /api/classes/{id}/reports?format=json\|csv` |

Lỗi nghiệp vụ LMS trả `{ "code", "message", "details" }` với mã ổn định (`MEMBERSHIP_REQUIRED`, `PREREQUISITE_NOT_MET`, `CLASS_READ_ONLY`, ...).

---

## 📂 Cấu trúc thư mục

```text
PSCubeSAT/
├── src/                      # React + Vite frontend
│   ├── pages/                # Màn hình (Lab0–8, Classes*, QuestionBank, AdminDashboard, ClassReport...)
│   ├── components/           # layout, editor (C++/Blockly), serial/flash, classes (LMS dùng chung)
│   ├── contexts/             # AuthContext, TelemetryContext
│   └── data/                 # Giáo trình tĩnh: curriculum.js, labs.js, lesson-reading.js
├── fastapi-backend/          # FastAPI backend — xem fastapi-backend/README.md
│   ├── app/routers/          # HTTP: chỉ validate + gọi service
│   ├── app/services/         # Use case, transaction, phân quyền (permissions.py), báo cáo
│   ├── app/models/           # ORM: tables.py, curriculum.py, learning.py, quiz.py
│   ├── app/tests/            # unittest/pytest; *_postgres.py chạy khi PSCUBESAT_TEST_POSTGRES=1
│   ├── alembic/versions/     # Migration đánh số 0001…; downgrade không xóa dữ liệu
│   └── scripts/              # check_backend.py, load_test.py, công cụ vận hành
├── tests/                    # Test frontend (node --test)
├── scripts/                  # Tiện ích npm: python.mjs, export-curriculum.mjs, local-db
├── public/templates/         # Mẫu nhập ngân hàng câu hỏi (JSON/CSV)
├── Docs/                     # Kế hoạch, quyết định, runbook, hướng dẫn
├── docker-compose.dev.yml    # Dịch vụ dev: postgres, redis, mqtt
└── docker-compose.server.yml # Triển khai server (xem Docs/SERVER_STARTUP.md)
```

---

## 👥 Hướng dẫn đóng góp

- Quy tắc bắt buộc của dự án nằm ở [AGENTS.md](AGENTS.md); nghiệp vụ LMS theo [LMS_DEVELOPMENT_PLAN](Docs/LMS_DEVELOPMENT_PLAN_2026-10-22.md); giả định đã chốt ghi ở [DECISIONS.md](Docs/DECISIONS.md).
- **Phân quyền ở server**: endpoint lớp dùng `require_class_member(...)` trong `app/services/permissions.py`; không dựa vào việc ẩn nút ở frontend.
- **Thêm endpoint**: schema trong `app/schemas/`, logic + transaction trong `app/services/`, router mỏng trong `app/routers/`, đăng ký ở `app/application.py`; test API/phân quyền cùng lúc.
- **Đổi schema DB**: sửa model + thêm migration Alembic mới (idempotent, downgrade giữ dữ liệu); `test_migrations.py` so khớp schema với ORM.
- **Đổi giáo trình tĩnh** (`src/data/*`): chạy `npm run curriculum:export` để cập nhật `seed.json`; `npm run check` báo lệch.
- Backend log bằng `loguru` (không `print`); không commit `.env`, secret, dữ liệu DB.
- Không sửa thủ công `mosquitto/config/passwd`/`acl`; dùng API thiết bị.
