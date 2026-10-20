import { useEffect, useState, useCallback } from 'react';
import { AuthContext, request } from './auth-api';
import { getAuthToken, saveAuthToken, clearAuthToken } from './auth-storage';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    request('/api/auth/me')
      .then(currentUser => { if (active && getAuthToken() === token) setUser(currentUser); })
      .catch(error => { if (active && getAuthToken() === token && error.status === 401) clearAuthToken(); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password, remember = false) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveAuthToken(data.access_token, remember);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName || undefined }),
    });
    saveAuthToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginGoogle = useCallback(async (credential, remember = false) => {
    const data = await request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    saveAuthToken(data.access_token, remember);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Lỗi thu hồi token phía server không quan trọng bằng việc xoá phiên cục bộ
    } finally {
      clearAuthToken();
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
