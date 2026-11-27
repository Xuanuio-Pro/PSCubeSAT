import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SerialContext } from '../../contexts/serial-api';
import { useAuth } from '../../contexts/auth-api';
import { getLabBySlug } from '../../data/lab-metadata';
import { searchLabs } from './header-search';
import '../classes/classes.css';
import logoSvg from '../../assets/logo.svg';
import notificationIcon from '../../assets/lab-ui/Notification 1.svg';
import {
  HomeIcon,
  SearchIcon,
  BellIcon,
  MessageIcon,
  UserIcon,
  ChevronDownIcon,
  MenuIcon,
  CloseIcon,
} from '../common/HeaderIcons';

// Pages outside a SerialProvider (404) still draw the header, just without the board-connection button.
const NO_SERIAL = { isConnected: false, connect() {}, disconnect() {}, serialSupport: { available: false, message: '' }, missing: true };

function SerialConnectButton({ className, isConnected, serialSupport, onToggle, children }) {
  return (
    <button
      type="button"
      className={`header-icon-action ${className} ${isConnected ? 'is-connected' : ''}`}
      onClick={onToggle}
      aria-label={isConnected ? 'Ngắt kết nối mạch (Web Serial)' : 'Kết nối mạch qua Web Serial'}
      disabled={!isConnected && !serialSupport.available}
      title={isConnected ? 'Đã kết nối mạch — bấm để ngắt' : serialSupport.available ? 'Chưa kết nối mạch — bấm để kết nối' : serialSupport.message}
    >
      {children}
    </button>
  );
}

function HeaderSearch({ className = '', placeholder, onPick = undefined }) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchLabs(query), [query]);
  const go = lab => { setQuery(''); setOpen(false); onPick?.(); navigate(`/${lab.slug}`); };
  return (
    <form
      role="search"
      className={`header-search ${className}`}
      onSubmit={event => { event.preventDefault(); if (results[0]) go(results[0]); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    >
      <SearchIcon size={15} className="header-search-svg" />
      <input
        type="search"
        maxLength={120}
        placeholder={placeholder}
        aria-label="Tìm bài lab"
        aria-controls={listId}
        aria-expanded={open && query.trim() !== ''}
        value={query}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.blur(); } }}
      />
      {open && query.trim() !== '' && (
        <div className="header-search-results" id={listId}>
          {results.length ? results.map(lab => (
            <button type="button" key={lab.id} onClick={() => go(lab)}>
              <strong>Lab {lab.id} · {lab.title}</strong>
              <small>{lab.subtitle}</small>
            </button>
          )) : <p>Không tìm thấy lab phù hợp với “{query.trim()}”.</p>}
        </div>
      )}
    </form>
  );
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const serial = useContext(SerialContext) || NO_SERIAL;
  const { isConnected, connect, disconnect, serialSupport } = serial;
  const { user, logout, classMode } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const lab = getLabBySlug(location.pathname.replace('/', ''));
  const isClassLearningRoute = /^\/(?:classes\/\d+\/learn|preview)\/?$/.test(location.pathname);
  const isLearningRoute = Boolean(lab || isClassLearningRoute);
  // Every page outside the learning player shares the floating pill header (auth screens draw none).
  const isLmsRoute = !isLearningRoute;

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    const onPointer = event => { if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [menuOpen]);

  const accountAvatar = (
    <span className="header-avatar" aria-hidden="true">
      <UserIcon size={17} />
    </span>
  );

  const toggleSerial = () => (isConnected ? disconnect() : connect());
  const serialProps = { isConnected, serialSupport, onToggle: toggleSerial };
  const signOut = () => logout().then(() => navigate('/'));

  return (
    <header className={`header${isLearningRoute ? ' is-lab-route is-fig' : ''}${isLmsRoute ? ' is-lms' : ''}`}>
      <Link to="/" className="header-logo" aria-label="PTIT CubeSat LMS — Trang chủ">
        <img src={logoSvg} alt="" />
        <span className="header-wordmark"><strong>CubeSAT</strong><small>PTIT LMS</small></span>
      </Link>

      <HeaderSearch placeholder={lab ? 'Tìm bài lab…' : 'Tìm lab (vd. GPS, năng lượng)…'} />

      <div className="header-actions">
        {classMode && <Link to="/classes" className="header-class-link header-desktop-only">Lớp học</Link>}
        {!classMode && user?.role === 'admin' && <Link to="/admin/users" className="header-class-link header-desktop-only">Tài khoản</Link>}
        <Link to="/" className="header-icon-action header-route-action" aria-label="Trang chủ" title="Trang chủ">
          <HomeIcon size={17} />
        </Link>
        <Link to="/lab0" className="header-text-action header-route-action header-secondary-action header-desktop-only" title="Danh sách bài lab">Bài Lab</Link>
        {lab && !serial.missing && (
          <span className="header-lab-tools">
            {lab.id === 0 ? (
              <SerialConnectButton className="header-lab-message" {...serialProps}>
                <img src={notificationIcon} alt="" className="header-notification-icon" draggable="false" />
                <span className="header-serial-indicator" aria-hidden="true" />
              </SerialConnectButton>
            ) : (
              <>
                <button type="button" className="header-icon-action header-lab-alert" aria-label="Thông báo" title="Thông báo">
                  <BellIcon size={18} />
                </button>
                <SerialConnectButton className="header-lab-message" {...serialProps}>
                  <MessageIcon size={18} />
                  <span className="header-serial-indicator" aria-hidden="true" />
                </SerialConnectButton>
              </>
            )}
          </span>
        )}
        {!isLearningRoute && !serial.missing && (
          <SerialConnectButton className="header-serial-action" {...serialProps}>
            <span className="header-serial-dot" />
          </SerialConnectButton>
        )}

        {user ? (
          isLearningRoute ? (
            <details className="header-account-menu">
              <summary className="header-user" aria-label="Tài khoản">
                {accountAvatar}
                <span className="header-user-name">{user.full_name || user.email}</span>
                <ChevronDownIcon size={12} className="header-account-chevron-svg" />
              </summary>
              <div className="header-account-popover">
                <Link to="/">Trang chủ</Link>
                {classMode && <Link to="/classes">Lớp học của tôi</Link>}
                <Link to="/profile">Hồ sơ</Link>
                <button type="button" onClick={signOut}>Đăng xuất</button>
              </div>
            </details>
          ) : (
            <div className="header-user header-desktop-only">
              <Link to="/profile" className="header-avatar" aria-label="Hồ sơ"><UserIcon size={17} /></Link>
              <Link to="/profile" className="header-user-name">{user.full_name || user.email}</Link>
              <button type="button" className="header-logout" onClick={signOut}>Đăng xuất</button>
            </div>
          )
        ) : (
          <Link to="/login" className={`header-user header-login-link${isLearningRoute ? '' : ' header-desktop-only'}`} aria-label="Đăng nhập">
            {accountAvatar}
            <span className="header-login-label">Đăng nhập</span>
            {lab && <ChevronDownIcon size={12} className="header-account-chevron-svg" />}
          </Link>
        )}
        {lab && <span className="sr-only">Đang học: Lab {lab.id}</span>}

        {!isLearningRoute && (
          <div className="header-menu" ref={menuRef}>
            <button
              type="button"
              className="header-icon-action header-menu-toggle"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menuOpen}
              aria-controls="header-mobile-menu"
              onClick={() => setMenuOpen(open => !open)}
            >
              {menuOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
            {menuOpen && (
              <nav id="header-mobile-menu" className="header-mobile-menu" aria-label="Menu chính">
                <HeaderSearch className="header-search--menu" placeholder="Tìm lab…" onPick={() => setMenuOpen(false)} />
                {user && <p className="header-mobile-user">{user.full_name || user.email}</p>}
                <Link to="/">Trang chủ</Link>
                {classMode && user && <Link to="/classes">Lớp học của tôi</Link>}
                {!classMode && user?.role === 'admin' && <Link to="/admin/users">Tài khoản</Link>}
                <Link to="/lab0">Bài Lab</Link>
                {user ? <>
                  <Link to="/profile">Hồ sơ</Link>
                  <button type="button" onClick={signOut}>Đăng xuất</button>
                </> : <>
                  <Link to="/preview">Học thử miễn phí</Link>
                  <Link to="/login">Đăng nhập</Link>
                </>}
              </nav>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
