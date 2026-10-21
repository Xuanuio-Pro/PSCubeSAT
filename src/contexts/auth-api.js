import { createContext, useContext } from 'react';
import { clearAuthToken, getAuthToken } from './auth-storage';
import { AUTH_EXPIRED_EVENT } from './auth-session';

export const AuthContext = createContext(null);

export async function authorizedFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  const token = headers.has('Authorization') ? /^Bearer (.+)$/i.exec(headers.get('Authorization'))?.[1] : getAuthToken();
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, {
    ...options,
    headers,
  });
  if (res.status === 401 && token && token === getAuthToken()
    && !['/api/auth/login', '/api/auth/register', '/api/auth/google'].includes(path)) {
    clearAuthToken();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return res;
}

export async function request(path, options = {}) {
  const res = await authorizedFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item.msg).join(' ')
      : data.detail;
    throw Object.assign(new Error(data.message || detail || 'Đã có lỗi xảy ra, vui lòng thử lại.'), { status: res.status });
  }
  return data;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
