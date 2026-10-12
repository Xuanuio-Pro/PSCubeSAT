import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSerial } from '../../contexts/SerialContext';
import { useAuth } from '../../contexts/AuthContext';
import { getLabBySlug } from '../../data/labs';
import logoSvg from '../../assets/logo.svg';
import {
  HomeIcon,
  SearchIcon,
  BellIcon,
  MessageIcon,
  UserIcon,
  ChevronDownIcon,
} from '../common/HeaderIcons';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected, connect, disconnect } = useSerial();
  const { user, logout } = useAuth();
  const lab = getLabBySlug(location.pathname.replace('/', ''));

  const accountAvatar = (
    <span className="header-avatar" aria-hidden="true">
      <UserIcon size={17} />
    </span>
  );

  return (
    <header className={`header${lab ? ' is-lab-route' : ''}`}>
      <Link to="/" className="header-logo" aria-label="PTIT CubeSat LMS — Trang chủ">
        <img src={logoSvg} alt="" />
        <span className="header-wordmark"><strong>CubeSAT</strong><small>PTIT LMS</small></span>
      </Link>

      <label className="header-search">
        <span className="sr-only">Tìm kiếm khóa học</span>
        <SearchIcon size={15} className="header-search-svg" />
        <input type="search" placeholder={lab ? 'Search' : 'Tìm kiếm...'} />
      </label>

      <div className="header-actions">
        <Link to="/" className="header-icon-action header-route-action" aria-label="Trang chủ" title="Trang chủ">
          <HomeIcon size={17} />
        </Link>
        <Link to="/lab0" className="header-icon-action header-route-action header-secondary-action" aria-label="Lộ trình học" title="Lộ trình học">LAB</Link>
        <a href="#" className="header-icon-action header-route-action header-secondary-action" aria-label="Tài liệu API" title="Tài liệu API">API</a>
        {lab && (
          <span className="header-lab-tools">
            <button type="button" className="header-icon-action header-lab-alert" aria-label="Thông báo" title="Thông báo">
              <BellIcon size={18} />
            </button>
            <button
              type="button"
              className={`header-icon-action header-lab-message ${isConnected ? 'is-connected' : ''}`}
              onClick={() => isConnected ? disconnect() : connect()}
              aria-label={isConnected ? 'Ngắt kết nối Web Serial' : 'Kết nối mạch qua Web Serial'}
              title={isConnected ? 'Serial đã kết nối' : 'Kết nối Web Serial'}
            >
              <MessageIcon size={18} />
              <span className="header-serial-indicator" aria-hidden="true" />
            </button>
          </span>
        )}
        {!lab && (
          <button
            type="button"
            className={`header-icon-action header-serial-action ${isConnected ? 'is-connected' : ''}`}
            onClick={() => isConnected ? disconnect() : connect()}
            aria-label={isConnected ? 'Ngắt kết nối Web Serial' : 'Kết nối mạch qua Web Serial'}
            title={isConnected ? 'Serial đã kết nối' : 'Kết nối Web Serial'}
          >
            <span className="header-serial-dot" />
          </button>
        )}

        {user ? (
          lab ? (
            <details className="header-account-menu">
              <summary className="header-user">
                {accountAvatar}
                <span className="header-user-name">{user.full_name || user.email}</span>
                <ChevronDownIcon size={12} className="header-account-chevron-svg" />
              </summary>
              <div className="header-account-popover">
                <Link to="/profile">Hồ sơ</Link>
                <button type="button" onClick={() => logout().then(() => navigate('/'))}>Đăng xuất</button>
              </div>
            </details>
          ) : (
            <div className="header-user">
              <Link to="/profile" className="header-avatar"><UserIcon size={17} /></Link>
              <Link to="/profile" className="header-user-name">{user.full_name || user.email}</Link>
              <button type="button" className="header-logout" onClick={() => logout().then(() => navigate('/'))}>Đăng xuất</button>
            </div>
          )
        ) : (
          <Link to="/login" className="header-user header-login-link" aria-label="Đăng nhập">
            {accountAvatar}
            <span className="header-login-label">Đăng nhập</span>
            {lab && <ChevronDownIcon size={12} className="header-account-chevron-svg" />}
          </Link>
        )}
        {lab && <span className="sr-only">Đang học: Lab {lab.id}</span>}
      </div>
    </header>
  );
}
