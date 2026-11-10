import logo from '../../assets/logo.svg';

export default function AuthLayout({ children, variant = 'user' }) {
  const isAdmin = variant === 'admin';
  return (
    <div className={`auth-shell${isAdmin ? ' auth-shell--admin' : ''}`}>
      <div className={`auth-visual${isAdmin ? ' auth-visual--admin' : ''}`}>
        <div className="auth-visual-inner">
          <div className="auth-visual-header">
            <span className="auth-badge">{isAdmin ? 'CUBESAT // ADMIN CONSOLE' : 'PTIT STEM // CUBESAT 1U LMS'}</span>
            <span className="auth-status-pill">SYS NOMINAL</span>
          </div>
          <div className="auth-visual-brand">
            <img src={logo} alt="PTIT CubeSat LMS" className="auth-visual-logo" />
          </div>
          <div className="auth-visual-copy">
            <h2>{isAdmin ? 'Bảng điều khiển vận hành đào tạo' : 'Hệ thống thực hành vệ tinh CubeSat theo lớp'}</h2>
            <p>
              {isAdmin
                ? 'Quản trị tài khoản, phân quyền giảng viên và giám sát vận hành hệ thống đào tạo trong một giao diện thống nhất.'
                : 'Lộ trình 9 bài Lab từ vi điều khiển trung tâm OBC, phân hệ nguồn EPS đến trạm thu phát mặt đất và kiểm tra cuối bài.'}
            </p>
            <div className="auth-visual-specs" aria-hidden="true">
              <div><strong>OBC · ESP32</strong><span>Biên dịch C++ &amp; Blockly</span></div>
              <div><strong>WEB SERIAL</strong><span>Nạp firmware &amp; đọc mạch</span></div>
              <div><strong>TELEMETRY 3D</strong><span>Giám sát quỹ đạo thời gian thực</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className={`auth-panel${isAdmin ? ' auth-panel--admin' : ''}`}>
        <div className={`auth-form-wrap${isAdmin ? ' auth-form-wrap--admin' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
