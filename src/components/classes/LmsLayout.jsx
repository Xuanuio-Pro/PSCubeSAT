import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-api';
import './classes.css';

export default function LmsLayout({ roles = null }) {
  const { user, classMode } = useAuth();
  if (classMode === null) return <div className="lms-shell" role="status">Đang tải lớp học…</div>;
  if (!classMode) return <section className="lms-shell"><h1>Lớp học chưa được bật</h1><p>Vui lòng liên hệ quản trị viên để biết thời gian mở lớp.</p></section>;
  if (roles && !roles.includes(user?.role)) return <section className="lms-shell" role="alert"><h1>Bạn không có quyền truy cập</h1><p>Trang này chỉ dành cho quản trị viên.</p><NavLink to="/classes">Về lớp của tôi</NavLink></section>;
  return <div className="lms-shell">
    <nav className="lms-nav" aria-label="Quản lý học tập">
      <NavLink to="/classes">{user.role === 'user' ? 'Lớp của tôi' : 'Lớp học'}</NavLink>
      {user.role === 'admin' && <><NavLink to="/admin/dashboard">Tổng quan</NavLink><NavLink to="/admin/users">Tài khoản</NavLink></>}
    </nav>
    <Outlet />
  </div>;
}
