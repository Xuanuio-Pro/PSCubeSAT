import { useEffect, useState } from 'react';
import { request } from '../../contexts/auth-api';

const COOLDOWN_SECONDS = 60;

export default function ResendVerification({ email, initialCooldown = 0 }) {
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    setSending(true);
    setError('');
    setMessage('');
    try {
      const data = await request('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message || 'Không gửi lại được email. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button type="button" className="auth-link-btn" onClick={handleResend} disabled={sending || cooldown > 0 || !email}>
        {sending ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại email (${cooldown}s)` : 'Gửi lại email xác minh'}
      </button>
      {message && <div className="auth-success-notice" role="status" style={{ marginTop: '8px' }}>{message}</div>}
      {error && <div className="auth-error-text" role="alert" style={{ marginTop: '8px' }}>⚠ {error}</div>}
    </div>
  );
}
