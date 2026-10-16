# 📘 Thiết Kế Hệ Thống Xử Lý Lỗi Tập Trung (Global Exception Handling)
> **Dự án**: PTIT-STEM-CUBE (FastAPI Backend & React Frontend)

---

## 1. MỤC TIÊU HỆ THỐNG
1. **Toàn vẹn thông tin lỗi**: Đảm bảo mọi lỗi phát sinh từ Backend (từ lỗi nghiệp vụ như `ValueError`, lỗi cấp phát dữ liệu `HTTPException`, đến lỗi hệ thống 500 bất ngờ) đều được bắt lại tập trung.
2. **Chuẩn hóa Response Format**: Tất cả phản hồi lỗi từ API trả về cho Frontend đều chung 1 cấu trúc JSON nhất quán.
3. **Trải nghiệm người dùng (UX)**: Frontend bắt được đúng thông điệp lỗi và hiển thị popup/toast notification dễ hiểu thay vì treo ứng dụng hoặc im lặng.

---

## 2. KIẾN TRÚC VÀ ĐỊNH DẠNG DỮ LIỆU (ERROR RESPONSE SPEC)

Tất cả các API khi gặp lỗi sẽ trả về HTTP Status Code tương ứng (400, 401, 403, 404, 422, 500) kèm Body JSON theo định dạng chuẩn:

```json
{
  "success": false,
  "error_code": "BAD_REQUEST",
  "message": "Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.",
  "details": null,
  "timestamp": "2026-07-26T17:35:00Z"
}
```

---

## 3. THIẾT KẾ PHÍA BACKEND (FastAPI Global Exception Handlers)

Trong file `app/main.py` (hoặc module `app/core/exceptions.py`), khai báo 3 Exception Handlers tập trung:

### A. Bắt lỗi `ValueError` (Lỗi Nghiệp Vụ từ Service Layer)
Khi `AuthService` hoặc `DeviceService` bắn ra `raise ValueError("Thông báo lỗi")`:

```python
from fastapi import Request, status
from fastapi.responses import JSONResponse
from datetime import datetime, timezone

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "error_code": "BAD_REQUEST",
            "message": str(exc),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
```

### B. Bắt lỗi `HTTPException` (Lỗi HTTP chuẩn của FastAPI)
Bắt các lỗi như 401 Unauthorized, 403 Forbidden, 404 Not Found:

```python
from fastapi.exceptions import HTTPException

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_code": f"HTTP_{exc.status_code}",
            "message": exc.detail if isinstance(exc.detail, str) else "Lỗi yêu cầu HTTP",
            "details": exc.detail if not isinstance(exc.detail, str) else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
```

### C. Bắt lỗi `Exception` không lường trước (Unhandled 500 Server Error)
Giúp ứng dụng không bị lộ thông tin nhạy cảm (như stack trace SQL, secret keys) nhưng vẫn ghi log lỗi chuyên nghiệp:

```python
from loguru import logger

@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"[GLOBAL ERROR] Unhandled Exception at {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
```

---

## 4. THIẾT KẾ PHÍA FRONTEND (React API Client & Toast Notification)

### A. Hàm Helper xử lý Fetch tập trung (`src/service/apiClient.ts`)
Tạo wrapper cho `fetch` để tự động đính kèm Token và trích xuất thông điệp lỗi:

```typescript
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Ưu tiên lấy message từ response JSON chuẩn của Backend
    const errorMessage = data.message || data.detail || `Lỗi máy chủ (${response.status})`;
    throw new Error(errorMessage);
  }

  return data as T;
}
```

### B. Hiển thị thông báo trên UI (Toast / Alert System)
Khi gọi API trong Component hay Custom Hook, dùng khối `try...catch`:

```typescript
try {
  await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  // Thành công...
} catch (error: any) {
  // Hiển thị trực tiếp câu thông báo lỗi chuẩn từ Backend
  setErrorMsg(error.message);
}
```

---

## 5. TÓM TẮT LUỒNG HOẠT ĐỘNG (FLOW SUMMARY)

```text
[ User thao tác trên FE ]
           │
           ▼
[ Call apiFetch() ] ── (Gửi Request) ──► [ FastAPI Router ]
                                                │
                                                ▼
                                         [ AuthService ]
                                                │
                                                ▼
                                    (Phát sinh lỗi / Raise ValueError)
                                                │
                                                ▼
                                   [ Global Exception Handler ]
                                                │
                                    (Chuyển đổi sang JSON chuẩn)
                                                │
[ Hiển thị Error Alert ] ◄── (Nhận HTTP 400 JSON) ┘
```
