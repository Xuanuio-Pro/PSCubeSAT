import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginDestination } from '../../contexts/auth-session';
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

export default function GoogleSignIn({ signup = false, remember = true }) {
  const container = useRef(null);
  const rememberRef = useRef(remember);
  rememberRef.current = remember;
  const { loginGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = loginDestination(location.state?.from);
  const [status, setStatus] = useState('Đang tải Google...');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let blockedCheck;
    request('/api/auth/google/config').then(async ({ client_id: clientId }) => {
      if (!active) return;
      if (!clientId) {
        setStatus('Đăng nhập Google chưa được bật.');
        return;
      }
      await loadGoogle();
      if (!active || !container.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          if (!active) return;
          setError('');
          setStatus('Đang xác thực Google...');
          try {
            await loginGoogle(credential, rememberRef.current);
            if (active) navigate(destination, { replace: true });
          } catch (err) {
            if (active) setError(err.message);
          } finally {
            if (active) setStatus('');
          }
        },
      });
      container.current.replaceChildren();
      window.google.accounts.id.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large',
        text: signup ? 'signup_with' : 'signin_with', locale: 'vi',
        width: Math.min(container.current.clientWidth || 320, 400),
      });
      setStatus('');
      // Google gives no callback when it refuses the page origin, so only an empty button area counts
      // as blocked. GSI now draws the standard button as plain HTML (role="button") and keeps its
      // iframe at height 0 unless the button is personalised, so the iframe alone is not a signal.
      const buttonVisible = () => {
        const root = container.current;
        if (!root) return false;
        return [...root.querySelectorAll('[role="button"], iframe')].some(el => el instanceof HTMLElement && el.offsetHeight > 0);
      };
      const blockedMessage = `Google chưa cho phép đăng nhập từ ${window.location.origin}. Quản trị viên cần thêm địa chỉ này vào “Authorized JavaScript origins” của Google Client ID, hoặc bạn dùng email và mật khẩu.`;
      /** @param {number} attempt */
      const checkButton = (attempt) => {
        if (!active) return;
        if (buttonVisible()) {
          setError(current => (current === blockedMessage ? '' : current));
          return;
        }
        if (attempt === 2) setError(blockedMessage);
        // Keep watching for a slow network: the warning clears itself once the button appears.
        if (attempt < 10) blockedCheck = setTimeout(() => checkButton(attempt + 1), 2000);
      };
      blockedCheck = setTimeout(() => checkButton(1), 2000);
    }).catch((err) => {
      if (active) {
        setError(err.message);
        setStatus('');
      }
    });
    return () => {
      active = false;
      clearTimeout(blockedCheck);
    };
  }, [loginGoogle, navigate, signup, destination]);

  return (
    <div>
      <div ref={container} />
      {status && <p className="auth-subtitle" role="status">{status}</p>}
      {error && <p className="auth-error-text" role="alert">{error}</p>}
    </div>
  );
}
