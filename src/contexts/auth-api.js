import { createContext, useContext } from 'react';
import { getAuthToken } from './auth-storage';

export const AuthContext = createContext(null);

export async function request(path, options = {}) {
  const token = getAuthToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
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
