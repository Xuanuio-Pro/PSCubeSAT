# ☁️ Hướng Dẫn Kỹ Thuật: Triển Khai Frontend & Backend Lên Cloudflare (Cloudflare Tunnel)

> **Tài liệu hướng dẫn chi tiết cách đưa Web Frontend (Vite/React), FastAPI Backend và WebSocket lên Internet thông qua Cloudflare Tunnel (`cloudflared`) hoàn toàn miễn phí, có mã hóa HTTPS/WSS tự động và không cần mở Port Router.**

---

## 📌 1. Bức Tranh Tổng Quan Kiến Trúc Triển Khai (Deployment Topology)

```
                                  🌐 INTERNET
                                       │
                    ┌──────────────────┴──────────────────┐
                    │      Cloudflare Edge Network        │
                    │   (Bảo vệ WAF, SSL HTTPS/WSS)       │
                    └──────────────────┬──────────────────┘
                                       │ Cloudflare Tunnel (Mã hóa Outbound)
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             YOUR LOCAL / CLOUD SERVER                            │
│                                                                                  │
│   ┌────────────────────┐                                                         │
│   │ cloudflared daemon │                                                         │
│   └─────────┬──────────┘                                                         │
│             │                                                                    │
│             ├── HTTP localhost:5173 ──────> [ Frontend React/Vite ]              │
│             ├── HTTP localhost:8003 ──────> [ FastAPI Backend ]                  │
│             └── WS   localhost:8003/ws ───> [ WebSocket Realtime Stream ]        │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 2. Ưu Điểm Khi Sử Dụng Cloudflare Tunnel

1. **Không cần Mở Port Router (No Port Forwarding)**: Dịch vụ `cloudflared` tạo một đường ống bảo mật outbound kết nối thẳng từ server của bạn tới Cloudflare.
2. **Có sẵn HTTPS / SSL miễn phí**: Tất cả domain đều tự động có chứng chỉ SSL chính chủ từ Cloudflare.
3. **Ẩn IP gốc của Server**: Tránh hoàn toàn nguy cơ bị tấn công DDoS hoặc dò quét port server.
4. **Hỗ trợ mượt mà WebSocket (`wss://`)**: Dữ liệu telemetry truyền từ FastAPI xuống Frontend chạy ổn định 24/7.

---

## 🛠️ 3. Các Bước Triển Khai Chi Tiết

### Bước 1: Chuẩn Bị Tên Miền Trên Cloudflare
1. Bạn cần sở hữu 1 tên miền (Domain) và đã thêm tên miền đó vào quản lý trên [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Ví dụ tên miền của bạn là: `ptit-stem-cube.edu.vn`.

### Bước 2: Cài Đặt `cloudflared` Trên Server
Chạy các lệnh sau trên Server Linux (Ubuntu/Debian) nơi đặt dự án:

```bash
# Tải và thêm repository của Cloudflare
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /etc/apt/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/etc/apt/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Cài đặt cloudflared CLI
sudo apt-get update && sudo apt-get install -y cloudflared

# Kiểm tra cài đặt thành công
cloudflared --version
```

### Bước 3: Đăng Nhập & Tạo Tunnel
```bash
# 1. Đăng nhập tài khoản Cloudflare (Sẽ mở 1 link browser để ủy quyền)
cloudflared tunnel login

# 2. Tạo một Tunnel mới dành riêng cho dự án
cloudflared tunnel create cubesat-tunnel

# Sau khi tạo thành công, hệ thống sẽ trả về 1 UUID Tunnel (vd: a1b2c3d4-e5f6-7890-abcd-1234567890ab)
```

### Bước 4: Cấu Hình File `config.yml` Cho Tunnel
Tạo file cấu hình điều hướng đường đi cho Tunnel tại `~/.cloudflared/config.yml`:

```bash
cat << 'EOF' > ~/.cloudflared/config.yml
tunnel: YOUR_TUNNEL_UUID_HERE
credentials-file: /root/.cloudflared/YOUR_TUNNEL_UUID_HERE.json

ingress:
  # 1. Frontend Web App (Vite React)
  - hostname: groundstation.ptit-stem-cube.edu.vn
    service: http://localhost:5173

  # 2. FastAPI Backend APIs
  - hostname: api.ptit-stem-cube.edu.vn
    service: http://localhost:8003

  # 3. FastAPI WebSocket Realtime
  - hostname: ws.ptit-stem-cube.edu.vn
    service: http://localhost:8003

  # Catch-all rule (Bắt buộc phải có ở cuối)
  - service: http_status:404
EOF
```

> ⚠️ *Lưu ý: Thay `YOUR_TUNNEL_UUID_HERE` và các sub-domain bằng tên miền thực tế của bạn.*

### Bước 5: Tạo DNS Route & Khởi Động Service
```bash
# Tạo các bản ghi DNS tự động trên Cloudflare
cloudflared tunnel route dns cubesat-tunnel groundstation.ptit-stem-cube.edu.vn
cloudflared tunnel route dns cubesat-tunnel api.ptit-stem-cube.edu.vn
cloudflared tunnel route dns cubesat-tunnel ws.ptit-stem-cube.edu.vn

# Cài đặt cloudflared chạy dưới dạng Systemd Background Service (tự khởi động cùng Server)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

---

## ⚙️ 4. Cập Nhật Cấu Hình Trong Code Dự Án

Sau khi đưa lên Cloudflare, bạn cần cập nhật file cấu hình môi trường `.env` của Frontend để gọi tới các Domain mới HTTPS/WSS:

### Cập nhật file `.env` (Trên Frontend Server):
```env
# ── Server Production Domain (Cloudflare) ──
VITE_COMPILER_BACKEND_URL=https://api.ptit-stem-cube.edu.vn
VITE_WS_URL=wss://ws.ptit-stem-cube.edu.vn/ws
```

### Build Frontend Cho Production:
```bash
cd PTIT-STEM-CUBE
npm run build
# Chạy Frontend Production server (hoặc dùng preview / Nginx serve dist)
npm run preview -- --host 0.0.0.0 --port 5173
```

---

