import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request, useAuth } from '../../contexts/auth-api';

let scriptPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        scriptPromise = undefined;
        reject(new Error('Không tải được Google. Vui lòng tải lại trang.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function GoogleSignIn({ signup = false }) {
  const container = useRef(null);
  const { loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Đang tải Google...');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    request('/api/auth/google/config').then(async ({ client_id: clientId }) => {
      if (!active) return;
      if (!clientId) {
        setStatus('Đăng nhập Google chưa được bật.');
        return;
      }
      await loadGoogle();
      if (!active) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          if (!active) return;
          setError('');
          setStatus('Đang xác thực Google...');
          try {
            await loginGoogle(credential);
            if (active) navigate('/');
          } catch (err) {
            if (active) setError(err.message);
          } finally {
            if (active) setStatus('');
          }
        },
      });
      window.google.accounts.id.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large',
        text: signup ? 'signup_with' : 'signin_with', locale: 'vi',
        width: Math.min(container.current.clientWidth || 320, 400),
      });
      setStatus('');
    }).catch((err) => {
      if (active) {
        setError(err.message);
        setStatus('');
      }
    });
    return () => {
      active = false;
    };
  }, [loginGoogle, navigate, signup]);

  return (
    <div>
      <div ref={container} />
      {status && <p className="auth-subtitle" role="status">{status}</p>}
      {error && <p className="auth-error-text" role="alert">{error}</p>}
    </div>
  );
}
