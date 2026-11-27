import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import PasswordInput from '../components/common/PasswordInput';
import { request, useAuth } from '../contexts/auth-api';
import { usePageTitle } from '../utils/page-title';

export default function AdminLoginPage() {
  usePageTitle('Đăng nhập quản trị');
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // The bootstrap "create admin" link only makes sense before the first admin exists.
  const [signupOpen, setSignupOpen] = useState(false);
  useEffect(() => {
    let active = true;
    request('/api/admin/signup/status').then(data => { if (active) setSignupOpen(Boolean(data.signup_open)); }, () => {});
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu quản trị.');
      return;
    }
    setSubmitting(true);
    try {
      const currentUser = await loginAdmin(email.trim().toLowerCase(), password);
      if (currentUser?.role !== 'admin') {
        throw new Error('Tài khoản không có quyền quản trị.');
      }
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout variant="admin">
      <div className="admin-auth-header">
        <h1 className="auth-title">Đăng nhập quản trị</h1>
        <p className="auth-subtitle">Truy cập tổng quan lớp học, tài khoản và báo cáo hệ thống.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="admin-email">Email quản trị</label>
          <div className="auth-input-wrap">
            <input
              id="admin-email"
              type="email"
              required
              maxLength={200}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@ptit.edu.vn"
              autoComplete="username"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'admin-login-error' : undefined}
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="admin-password">Mật khẩu</label>
          <PasswordInput
            id="admin-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            hasError={Boolean(error)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'admin-login-error' : undefined}
          />
        </div>

        <div className="auth-row-between">
          <span />
          <Link to="/forgot-password" className="auth-link-btn">
            Quên mật khẩu?
          </Link>
        </div>

        {error && <div id="admin-login-error" className="auth-error-text" role="alert">{error}</div>}

        <button type="submit" className="auth-submit-btn" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>

      {signupOpen && <p className="auth-footer-text">
        Hệ thống chưa có quản trị viên? <Link to="/admin/signup">Tạo tài khoản quản trị đầu tiên</Link>
      </p>}
    </AuthLayout>
  );
}
