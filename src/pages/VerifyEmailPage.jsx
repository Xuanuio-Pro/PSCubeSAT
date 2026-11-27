import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import { request } from '../contexts/auth-api';
import { usePageTitle } from '../utils/page-title';

export default function VerifyEmailPage() {
  usePageTitle('Xác minh email');
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const [state, setState] = useState(token ? 'checking' : 'error');
  const [error, setError] = useState(token ? '' : 'Thiếu mã xác minh trong liên kết.');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    request('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => { if (active) setState('done'); })
      .catch((err) => {
        if (!active) return;
        setError(err.status === 429 || err.status >= 500 ? err.message : 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
        setState('error');
      });
    return () => { active = false; };
  }, [token]);

  return (
    <AuthLayout>
      <h1 className="auth-title">Xác minh email</h1>
      {state === 'checking' && <p className="auth-subtitle" role="status">Đang xác minh email...</p>}
      {state === 'done' && (
        <div>
          <div className="auth-success-notice" role="status">
            Email đã được xác minh. Bạn có thể đăng nhập ngay bây giờ.
          </div>
          <Link to="/login" className="auth-submit-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            Đăng nhập ngay
          </Link>
        </div>
      )}
      {state === 'error' && (
        <div>
          <div className="auth-error-text" role="alert" style={{ marginBottom: '16px' }}>⚠ {error}</div>
          <p className="auth-subtitle">
            Hãy đăng nhập bằng email và mật khẩu của bạn, hệ thống sẽ cho phép gửi lại thư xác minh mới.
          </p>
          <Link to="/login" className="auth-submit-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            Đến trang đăng nhập
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
