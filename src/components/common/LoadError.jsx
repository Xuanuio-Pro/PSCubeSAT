import { Link, useNavigate } from 'react-router-dom';

const TITLES = {
  CONFIG_INVALID: 'Chưa thể mở nội dung này',
  MEMBERSHIP_REQUIRED: 'Bạn chưa thuộc lớp này',
  FORBIDDEN_ROLE: 'Bạn không có quyền xem trang này',
  LESSON_DISABLED: 'Nội dung đang tạm tắt',
  LMS_OFF: 'Lớp học chưa được bật',
};

// Page-level load failure: what went wrong + a way back. "Thử lại" only when retrying can help
// (network / server errors); a rule refusal such as an unpublished curriculum just offers the way out.
export default function LoadError({ error, info = null, onRetry = undefined, home = '/classes', homeLabel = 'Về danh sách lớp' }) {
  const navigate = useNavigate();
  const status = info?.status ?? 0;
  const retryable = !status || status >= 500 || status === 408 || status === 429;
  const title = TITLES[info?.code] || (status === 404 ? 'Không tìm thấy nội dung' : retryable ? 'Không tải được trang' : 'Chưa thể mở trang này');
  // React Router keeps the in-app history index; without an earlier in-app page, "back" goes home instead.
  const canGoBack = (window.history.state?.idx ?? 0) > 0;
  return <section className="load-error" role="alert">
    <span className="load-error-icon" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></svg>
    </span>
    <h1>{title}</h1>
    <p>{error}</p>
    <div className="load-error-actions">
      <button type="button" className="load-error-back" onClick={() => (canGoBack ? navigate(-1) : navigate(home))}>← Quay lại trang trước</button>
      <Link to={home} className="load-error-home">{homeLabel}</Link>
      {retryable && onRetry && <button type="button" className="load-error-retry" onClick={onRetry}>Thử lại</button>}
    </div>
  </section>;
}
