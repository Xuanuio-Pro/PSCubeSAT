import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginDestination } from '../contexts/auth-session';
import AuthLayout from '../components/common/AuthLayout';
import PasswordInput from '../components/common/PasswordInput';
import PasswordRequirements from '../components/common/PasswordRequirements';
import { validatePassword } from '../utils/passwordPolicy';
import { useAuth } from '../contexts/auth-api';
import GoogleSignIn from '../components/common/GoogleSignIn';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    /** @type {Record<string, string>} */
    const next = {};
    if (!fullName.trim()) next.fullName = 'Vui lòng nhập họ và tên';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    const passwordError = validatePassword(password);
    if (passwordError) next.password = passwordError;
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
      navigate(loginDestination(location.state?.from), { replace: true });
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

      <GoogleSignIn signup />

      <div className="auth-divider">Hoặc</div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="fullName">Họ và tên</label>
          <div className={`auth-input-wrap ${errors.fullName ? 'has-error' : ''}`}>
            <input
              id="fullName"
              required
              autoComplete="name"
              maxLength={200}
              type="text"
              placeholder="Nguyễn Văn A"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'signup-fullname-error' : undefined}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          {errors.fullName && <div id="signup-fullname-error" className="auth-error-text" role="alert">⚠ {errors.fullName}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <div className={`auth-input-wrap ${errors.email ? 'has-error' : ''}`}>
            <input
              id="email"
              required
              maxLength={200}
              autoComplete="username"
              type="email"
              placeholder="sinhvien@ptit.edu.vn"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signup-email-error' : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {errors.email && <div id="signup-email-error" className="auth-error-text" role="alert">⚠ {errors.email}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Mật khẩu</label>
          <PasswordInput
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="********"
            hasError={Boolean(errors.password)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'signup-password-requirements signup-password-error' : 'signup-password-requirements'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordRequirements id="signup-password-requirements" value={password} />
          {errors.password && <div id="signup-password-error" className="auth-error-text" role="alert">⚠ {errors.password}</div>}
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
          <PasswordInput
            id="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="********"
            hasError={Boolean(errors.confirmPassword)}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'signup-confirm-error' : undefined}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {errors.confirmPassword && <div id="signup-confirm-error" className="auth-error-text" role="alert">⚠ {errors.confirmPassword}</div>}
        </div>

        <button type="submit" className="auth-submit-btn auth-submit-spaced" disabled={submitting}>
          {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
      </form>

      <p className="auth-footer-text">
        Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập ngay</Link>
      </p>
    </AuthLayout>
  );
}
