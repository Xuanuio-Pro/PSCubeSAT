import { useEffect, useState, useCallback } from 'react';
import { AuthContext, TOKEN_KEY, request } from './auth-api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    request('/api/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName || undefined }),
    });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginGoogle = useCallback(async (credential) => {
    const data = await request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Lỗi thu hồi token phía server không quan trọng bằng việc xoá phiên cục bộ
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const changePassword = useCallback((currentPassword, newPassword) => {
    return request('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }, []);

  const markVideoWatched = useCallback((labId) => {
    return request(`/api/progress/${labId}/video-watched`, { method: 'POST' });
  }, []);

  const markDocViewed = useCallback((labId) => {
    return request(`/api/progress/${labId}/doc-viewed`, { method: 'POST' });
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginGoogle, register, logout, isAuthenticated: !!user,
      changePassword, markVideoWatched, markDocViewed,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
