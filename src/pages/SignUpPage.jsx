import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import { EyeIcon } from '../components/common/AuthIcons';
import { useAuth } from '../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Vui lòng nhập họ và tên';
    if (!EMAIL_PATTERN.test(email)) next.email = 'Email không hợp lệ';
    if (password.length < 6) next.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    if (confirmPassword !== password) next.confirmPassword = 'Mật khẩu không khớp';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim());
      navigate('/');
    } catch (err) {
      setErrors({ email: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Tạo tài khoản mới</h1>
      <p className="auth-subtitle">Vui lòng điền thông tin để bắt đầu.</p>

      <div className="auth-divider">Hoặc</div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="fullName">Họ và tên</label>
          <div className={`auth-input-wrap ${errors.fullName ? 'has-error' : ''}`}>
            <input
              id="fullName"
              type="text"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          {errors.fullName && <div className="auth-error-text">⚠ {errors.fullName}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <div className={`auth-input-wrap ${errors.email ? 'has-error' : ''}`}>
            <input
              id="email"
              type="email"
              placeholder="email@vi-du.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {errors.email && <div className="auth-error-text">⚠ {errors.email}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Mật khẩu</label>
          <div className={`auth-input-wrap ${errors.password ? 'has-error' : ''}`}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-toggle-visibility"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Hiện/ẩn mật khẩu"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
          {errors.password && <div className="auth-error-text">⚠ {errors.password}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
          <div className={`auth-input-wrap ${errors.confirmPassword ? 'has-error' : ''}`}>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {errors.confirmPassword && <div className="auth-error-text">⚠ {errors.confirmPassword}</div>}
        </div>

        <button type="submit" className="auth-submit-btn auth-submit-spaced" disabled={submitting}>
          {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
      </form>

      <p className="auth-footer-text">
        Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
      </p>
    </AuthLayout>
  );
}
