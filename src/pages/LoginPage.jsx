import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginDestination } from '../contexts/auth-session';
import AuthLayout from '../components/common/AuthLayout';
import PasswordInput from '../components/common/PasswordInput';
import GoogleSignIn from '../components/common/GoogleSignIn';
import ResendVerification from '../components/common/ResendVerification';
import { useAuth } from '../contexts/auth-api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [submitting, setSubmitting] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  function validate() {
    /** @type {Record<string, string>} */
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!password) next.password = 'Vui lòng nhập mật khẩu';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setUnverifiedEmail('');
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const currentUser = await login(email.trim().toLowerCase(), password, remember);
      if (currentUser?.role === 'admin') {
        throw new Error('Tài khoản quản trị chỉ được đăng nhập từ trang quản trị.');
      }
      navigate(loginDestination(location.state?.from), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(email.trim().toLowerCase());
      setErrors({ password: err.message || 'Đăng nhập không thành công.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Chào mừng trở lại</h1>
      <p className="auth-subtitle">Vui lòng đăng nhập để truy cập Dashboard</p>

      <GoogleSignIn remember={remember} />

      <div className="auth-divider">Hoặc</div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <div className={`auth-input-wrap ${errors.email ? 'has-error' : ''}`}>
            <input
              id="email"
              type="email"
              required
              maxLength={200}
              autoComplete="username"
              placeholder="sinhvien@ptit.edu.vn"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {errors.email && <div id="login-email-error" className="auth-error-text" role="alert">⚠ {errors.email}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Mật khẩu</label>
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            placeholder="********"
            hasError={Boolean(errors.password)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <div id="login-password-error" className="auth-error-text" role="alert">⚠ {errors.password}</div>}
          {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
        </div>

        <div className="auth-row-between">
          <label className="auth-checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Lưu thiết bị này
          </label>
          <Link to="/forgot-password" className="auth-link-btn">
            Quên mật khẩu?
          </Link>
        </div>

        <button type="submit" className="auth-submit-btn" disabled={submitting}>
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <p className="auth-footer-text">
        Bạn là người dùng mới? <Link to="/signup" state={location.state}>Tạo tài khoản mới ngay</Link>
      </p>
    </AuthLayout>
  );
}
