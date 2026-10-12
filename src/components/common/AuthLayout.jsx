import logo from '../../assets/logo.svg';

export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <img src={logo} alt="PTIT CubeSat LMS" className="auth-visual-logo" />
      </div>
      <div className="auth-panel">
        <div className="auth-form-wrap">{children}</div>
      </div>
    </div>
  );
}
