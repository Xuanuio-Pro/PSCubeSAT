import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/auth-api';
import Header from '../components/layout/Header';
import logo from '../assets/logo.svg';
import { usePageTitle } from '../utils/page-title';

// withChrome=false when the page is already inside the app layout (it then draws only the card).
export default function NotFoundPage({ withChrome = true }) {
  const { user, classMode } = useAuth();
  usePageTitle('Không tìm thấy trang');
  const card = (
    <section className="not-found-content">
      <img src={logo} alt="" className="not-found-logo" />
      <p className="not-found-code" aria-hidden="true">404</p>
      <h1 className="not-found-title">Không tìm thấy trang</h1>
      <p className="not-found-text">Đường dẫn có thể đã thay đổi, bị gõ nhầm hoặc bạn không có quyền xem trang này.</p>
      <div className="not-found-actions">
        <Link to="/" className="not-found-primary">Về trang chủ</Link>
        {user && classMode && <Link to="/classes" className="not-found-secondary">Lớp học của tôi</Link>}
        {!user && <Link to="/login" className="not-found-secondary">Đăng nhập</Link>}
      </div>
    </section>
  );
  if (!withChrome) return <div className="not-found-page">{card}</div>;
  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>
      <Header />
      <main id="main-content" className="main-content not-found-page">{card}</main>
    </div>
  );
}
