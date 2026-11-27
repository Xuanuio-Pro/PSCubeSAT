import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import PasswordInput from '../components/common/PasswordInput';
import PasswordRequirements from '../components/common/PasswordRequirements';
import { validatePassword } from '../utils/passwordPolicy';
import { request } from '../contexts/auth-api';
import { usePageTitle } from '../utils/page-title';

export default function ResetPasswordPage() {
  usePageTitle('Đặt lại mật khẩu');
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setChecking(false);
      setTokenValid(false);
      setTokenError('Thiếu mã xác thực đặt lại mật khẩu trong liên kết.');
      return () => { active = false; };
    }
    request(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then(() => {
        if (active) {
          setTokenValid(true);
          setTokenError('');
        }
      })
      .catch((err) => {
        if (active) {
          setTokenValid(false);
          // A malformed token comes back as a generic 422; tell the user what it means for them.
          setTokenError(err.status === 429 || err.status >= 500 ? err.message : 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      await request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setCompleted(true);
    } catch (err) {
      setError(err.message || 'Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Đặt lại mật khẩu</h1>
      <p className="auth-subtitle">Tạo mật khẩu mới cho tài khoản CubeSAT của bạn.</p>

      {checking && <p className="auth-subtitle" role="status">Đang kiểm tra liên kết...</p>}

      {!checking && !tokenValid && !completed && (
        <div>
          <div className="auth-error-text" role="alert" style={{ marginBottom: '16px' }}>
            ⚠ {tokenError}
          </div>
          <Link to="/forgot-password" className="auth-submit-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            Yêu cầu liên kết mới
          </Link>
        </div>
      )}

      {!checking && tokenValid && completed && (
        <div>
          <div className="auth-success-notice" role="status">
            Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.
          </div>
          <Link to="/login" className="auth-submit-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
            Đăng nhập ngay
          </Link>
        </div>
      )}

      {!checking && tokenValid && !completed && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="reset-new-password">Mật khẩu mới</label>
            <PasswordInput
              id="reset-new-password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu"
              hasError={Boolean(error)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'reset-password-requirements reset-password-error' : 'reset-password-requirements'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordRequirements id="reset-password-requirements" value={newPassword} />
          </div>

          <div className="auth-field">
            <label htmlFor="reset-confirm-password">Xác nhận mật khẩu mới</label>
            <PasswordInput
              id="reset-confirm-password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              hasError={Boolean(error)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'reset-password-error' : undefined}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <div id="reset-password-error" className="auth-error-text" role="alert" style={{ marginBottom: '14px' }}>⚠ {error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={submitting}>
            {submitting ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
          </button>
        </form>
      )}

      <p className="auth-footer-text">
        <Link to="/login">Quay lại trang đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}

