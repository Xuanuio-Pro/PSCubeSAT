# 🔐 Hướng Dẫn Kỹ Thuật: Hệ Thống Đăng Nhập & Phân Quyền (Auth & RBAC Architecture)

> **Tài liệu hướng dẫn thiết kế & triển khai luồng Đăng nhập, Đăng ký, Cấp phát Token (JWT) và Phân quyền truy cập vệ tinh cho dự án PTIT-STEM-CUBE.**

---

## 📌 1. Bức Tranh Tổng Quan Kiến Trúc Auth

Hệ thống sử dụng cơ chế **JWT (JSON Web Token) Stateless Authentication** kết hợp với **Role-Based Access Control (RBAC)** và phân quyền theo thiết bị (**Device Ownership**).

```
 ┌────────────────┐         1. POST /api/auth/login (username, password)
 │                │ ─────────────────────────────────────────────────────────► ┌────────────────┐
 │  React Client  │                                                            │                │
 │   (Frontend)   │ ◄───────────────────────────────────────────────────────── │ FastAPI Server │
 │                │         2. Trả về access_token (JWT) + user_info           │   (Backend)    │
 └───────┬────────┘                                                            └───────┬────────┘
         │                                                                             │
         │ 3. Gửi Request kèm Header:                                                  │
         │    Authorization: Bearer <access_token>                                     │
         └─────────────────────────────────────────────────────────────────────────────┘
                                                                                       │
                                                                                       ▼
                                                                             ┌──────────────────┐
                                                                             │ PostgreSQL (DB)  │
                                                                             │  - users         │
                                                                             │  - devices       │
                                                                             └──────────────────┘
```

---

## 🗄️ 2. Thiết Kế Cơ Sở Dữ Liệu (Database Schema)

### 2.1 Bảng `users`
Lưu trữ thông tin tài khoản người dùng trong hệ thống:
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'student', -- 'admin' hoặc 'student'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Bảng `devices` (Cập nhật quan hệ chủ sở hữu)
Mỗi thiết bị CubeSat bắt buộc phải thuộc sở hữu của 1 User (`owner_id`):
```sql
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL, -- vd: cube-a1b2c3d4
    device_secret VARCHAR(100) NOT NULL,    -- Pass MQTT của thiết bị
    label VARCHAR(100) NOT NULL,            -- Tên gợi nhớ
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Chủ sở hữu
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE
);
```

---

## 🚀 3. Luồng Xử Lý Backend (FastAPI Implementation)

### 3.1 Quy trình Đăng ký (`POST /api/auth/register`)
1. Backend nhận `username`, `email`, `password`, `full_name`.
2. Kiểm tra `username` và `email` xem đã tồn tại trong DB chưa.
3. Mã hóa mật khẩu bằng `passlib[bcrypt]` (`pwd_context.hash(password)`).
4. Lưu User mới vào bảng `users` với role mặc định là `student`.

### 3.2 Quy trình Đăng nhập (`POST /api/auth/login`)
1. Backend nhận Form Data hoặc JSON (`username`, `password`).
2. Tìm user theo `username`. Kiểm tra mật khẩu mã hóa (`pwd_context.verify(password, user.hashed_password)`).
3. Nếu hợp lệ, sinh chuỗi **JWT Access Token** có thời hạn (ví dụ: 24 giờ).
4. Payload của JWT gồm:
   ```json
   {
     "sub": "username_123",
     "user_id": 1,
     "role": "student",
     "exp": 1784794600
   }
   ```
5. Trả về Token cho Frontend.

### 3.3 Dependency Phân Quyền trong FastAPI (`get_current_user`)
Mọi API bảo mật sẽ inject dependency `Depends(get_current_user)` để trích xuất User từ Header `Authorization: Bearer <token>`:

* **Học sinh (`role = 'student'`)**: Chỉ có quyền xem, nạp code, xóa các vệ tinh mà mình sở hữu (`devices.owner_id == current_user.id`).
* **Quản trị viên (`role = 'admin'`)**: Có quyền xem và quản lý tất cả vệ tinh của mọi người dùng trong hệ thống.

---

## 💻 4. Luồng Xử Lý Frontend (React Implementation)

### 4.1 Quản Lý Trạng Thái (Zustand Auth Store)
Tạo `authStore.ts` để lưu trữ Token và thông tin User hiện tại:
* Lưu `token` vào `localStorage` để khi F5 trang không bị đứt phiên đăng nhập.
* Tự động đính kèm Token vào tất cả các yêu cầu HTTP `fetch` / `axios`:
  ```typescript
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  ```

### 4.2 Giao Diện Người Dùng (UI Screens)
1. **Màn hình Đăng nhập / Đăng ký (`LoginModal.tsx` hoặc `AuthPage.tsx`)**:
   * Cho phép chuyển đổi qua lại giữa Đăng nhập và Đăng ký.
   * Hiển thị lỗi rõ ràng (ví dụ: *Sai mật khẩu*, *Tên đăng nhập đã tồn tại*).
2. **Sidebar / Header**:
   * Hiển thị Avatar, Tên người dùng đang đăng nhập và Badge Role (`ADMIN` / `STUDENT`).
   * Nút **Đăng xuất (Logout)**: Xóa token trong `localStorage` và reset Auth Store.
3. **Màn hình Quản lý Thiết bị (`DeviceRegistry.tsx`)**:
   * Chỉ liệt kê các Vệ tinh thuộc sở hữu của User đó (Admin sẽ thấy tab chuyển đổi xem tất cả).

---

## 🔒 5. Bảo Mật Mosquitto MQTT Tương Ứng

Khi hệ thống có Đăng nhập:
* Mỗi khi User bấm **"Đăng ký vệ tinh mới"**, Backend tự động tạo thiết bị với `owner_id = current_user.id`.
* Backend gọi `mosquitto_mgr.py` tạo tài khoản MQTT riêng cho thiết bị đó.
* Đảm bảo học sinh A không thể gửi lệnh MQTT tới thiết bị của học sinh B.

---
