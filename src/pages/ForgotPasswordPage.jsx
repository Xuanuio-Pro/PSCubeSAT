import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/common/AuthLayout';
import { request } from '../contexts/auth-api';
import { usePageTitle } from '../utils/page-title';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  usePageTitle('Quên mật khẩu');
  const [email, setEmail] = useState('');
  const [smtpEnabled, setSmtpEnabled] = useState(null);
  const [ttlMinutes, setTtlMinutes] = useState(30);
  const [requestMode, setRequestMode] = useState('email');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    request('/api/auth/password-reset/config')
      .then((cfg) => {
        if (!active) return;
        setSmtpEnabled(Boolean(cfg?.smtp_enabled));
        if (cfg?.token_ttl_minutes) setTtlMinutes(cfg.token_ttl_minutes);
      })
      .catch(() => { if (active) setSmtpEnabled(false); });
    return () => { active = false; };
  }, []);

  const isAdminMode = smtpEnabled === false || requestMode === 'admin';

  function switchMode(nextMode) {
    setRequestMode(nextMode);
    setResult(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const clean = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(clean)) {
      setError('Email không hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await request('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: clean, channel: isAdminMode ? 'admin' : 'email' }),
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  const adminFollowUpNote = (
    <p style={{ marginTop: '8px', fontWeight: 400 }}>
      Quản trị viên sẽ cấp liên kết đặt lại dùng một lần hoặc mật khẩu tạm tại trang Quản lý tài khoản.
      Nếu tài khoản dùng Gmail, bạn vẫn có thể chọn “Đăng nhập bằng Google”.
    </p>
  );

  return (
    <AuthLayout>
      <h1 className="auth-title">Quên mật khẩu</h1>
      <p className="auth-subtitle">
        {smtpEnabled === null && 'Nhập email tài khoản của bạn để yêu cầu cấp lại mật khẩu.'}
        {smtpEnabled !== null && isAdminMode && 'Nhập email tài khoản để gửi yêu cầu cấp lại mật khẩu tới quản trị viên hệ thống.'}
        {smtpEnabled === true && !isAdminMode && 'Nhập email tài khoản để nhận liên kết tự đặt lại mật khẩu qua email.'}
      </p>

      {result ? (
        result.delivery_mode === 'smtp_error' ? (
          <div className="auth-warning-notice" role="status">
            <p>{result.message}</p>
            {adminFollowUpNote}
          </div>
        ) : (
          <div className="auth-success-notice" role="status">
            <p>{result.message}</p>
            {result.delivery_mode === 'email' && (
              <>
                <p style={{ marginTop: '8px', fontWeight: 400 }}>
                  Hãy kiểm tra cả thư rác (spam). Liên kết chỉ dùng được một lần và hết hạn sau {ttlMinutes} phút.
                </p>
                <div className="auth-inline-help" style={{ marginTop: '10px', textAlign: 'left' }}>
                  Không nhận được thư sau vài phút hoặc lỗi gửi email?{' '}
                  <button
                    type="button"
                    className="auth-inline-toggle"
                    onClick={() => switchMode('admin')}
                  >
                    Gửi yêu cầu tới quản trị viên
                  </button>
                </div>
              </>
            )}
            {result.delivery_mode === 'admin' && adminFollowUpNote}
          </div>
        )
      ) : (
        <>
          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="forgot-email">Email tài khoản</label>
              <div className={`auth-input-wrap ${error ? 'has-error' : ''}`}>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  maxLength={200}
                  autoComplete="username"
                  placeholder="sinhvien@ptit.edu.vn"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'forgot-email-error' : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <div id="forgot-email-error" className="auth-error-text" role="alert">⚠ {error}</div>}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={submitting}>
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu cấp lại mật khẩu'}
            </button>
          </form>

          {smtpEnabled === true && (
            <div className="auth-inline-help">
              {isAdminMode ? (
                <>
                  Muốn tự đặt lại qua email?{' '}
                  <button
                    type="button"
                    className="auth-inline-toggle"
                    onClick={() => switchMode('email')}
                  >
                    Nhận liên kết qua email
                  </button>
                </>
              ) : (
                <>
                  Không nhận được email hoặc lỗi gửi thư?{' '}
                  <button
                    type="button"
                    className="auth-inline-toggle"
                    onClick={() => switchMode('admin')}
                  >
                    Gửi yêu cầu tới quản trị viên
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <p className="auth-footer-text">
        Đã nhớ mật khẩu? <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
