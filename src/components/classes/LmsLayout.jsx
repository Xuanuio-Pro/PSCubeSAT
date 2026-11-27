import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-api';
import LoadError from '../common/LoadError';
import './classes.css';

export default function LmsLayout({ roles = null, publicPreview = false, nested = false }) {
  const { user, classMode } = useAuth();
  const location = useLocation();
  const isLearningPage = /^\/classes\/\d+\/learn$/.test(location.pathname);
  const isAdminUsers = location.pathname === '/admin/users';
  // The preview is the same full-screen player as /classes/:id/learn; the app Header carries home/login.
  if (publicPreview) return <div className="lms-shell is-learning-shell"><Outlet /></div>;
  if (classMode === null) return <div className="lms-shell" role="status">Đang tải lớp học…</div>;
  if (!classMode && !(isAdminUsers && user?.role === 'admin')) {
    return <div className="lms-shell"><LoadError error="Học theo lớp chưa được bật. Vui lòng liên hệ quản trị viên để biết thời gian mở lớp." info={{ status: 409, code: 'LMS_OFF' }} home="/" homeLabel="Về trang chủ" /></div>;
  }
  if (roles && !roles.includes(user?.role)) return <div className="lms-shell"><LoadError error={roles.includes('teacher') ? 'Trang này chỉ dành cho giảng viên và quản trị viên.' : 'Trang này chỉ dành cho quản trị viên.'} info={{ status: 403, code: 'FORBIDDEN_ROLE' }} /></div>;
  // A role guard nested inside another LmsLayout only checks the role; the parent already draws the shell and nav.
  if (nested) return <Outlet />;
  return <div className={`lms-shell${isLearningPage ? ' is-learning-shell' : ''}`}>
    {/* Students usually belong to a single class, so they get no class-list tab (the header keeps a link). */}
    {!isLearningPage && user.role !== 'user' && <nav className="lms-nav" aria-label="Quản lý học tập">
      {classMode && <NavLink to="/classes">Lớp học</NavLink>}
      {user.role === 'admin' && <>{classMode && <NavLink to="/admin/dashboard">Tổng quan</NavLink>}<NavLink to="/admin/users">Tài khoản</NavLink></>}
    </nav>}
    <Outlet />
  </div>;
}
