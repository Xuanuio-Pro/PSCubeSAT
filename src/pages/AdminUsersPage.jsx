import { useState } from 'react';
import { request } from '../contexts/auth-api';
import { Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

const roleLabels = { admin: 'Quản trị viên', teacher: 'Giảng viên', user: 'Người dùng' };

export default function AdminUsersPage() {
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({});
  const query = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
  const { data, loading, error, reload } = useLmsResource(`/api/admin/users?${query}`);
  const filter = (key, value) => { setFilters(current => ({ ...current, [key]: value })); setPage(1); setPending(null); };
  async function save() {
    setBusy(true); setNotice({});
    try {
      await request('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ user_id: pending.user.id, ...pending.change }) });
      setNotice({ message: `Đã cập nhật tài khoản ${pending.user.email}.` }); setPending(null); reload();
    } catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  return <>
    <header className="lms-heading"><h1>Quản lý tài khoản</h1><p>Cấp quyền giảng viên và quản lý trạng thái truy cập của người dùng.</p></header>
    <form className="lms-filters" onSubmit={event => { event.preventDefault(); filter('search', search.trim()); }}>
      <label>Tìm tài khoản<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc email" maxLength={200} /></label>
      <label>Vai trò<select value={filters.role} onChange={event => filter('role', event.target.value)}><option value="">Tất cả vai trò</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Trạng thái<select value={filters.status} onChange={event => filter('status', event.target.value)}><option value="">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select></label>
      <button type="submit">Tìm kiếm</button>
    </form>
    <Notice {...notice} />
    {pending && <section className="lms-confirm" aria-label="Xác nhận thay đổi tài khoản">
      <p><strong>{pending.label}</strong> tài khoản {pending.user.email}?</p>
      <p>Quyền truy cập sẽ được cập nhật ngay với các phiên đang đăng nhập.</p>
      <div className="lms-actions"><button disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button><button disabled={busy} onClick={() => setPending(null)}>Hủy</button></div>
    </section>}
    {loading ? <p role="status">Đang tải tài khoản…</p> : error ? <><Notice error={error} /><button onClick={reload}>Thử lại</button></> : <>
      <div className="lms-table-wrap"><table><caption className="sr-only">Danh sách tài khoản</caption><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{data.items.map(user => <tr key={user.id}>
          <td><strong>{user.full_name || 'Chưa có tên'}</strong><span className="lms-secondary">{user.email}</span></td>
          <td>{roleLabels[user.role]}</td><td><span className={`lms-status ${user.status}`}>{user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td>
          <td>{user.role === 'admin' ? <span className="lms-secondary">Tài khoản quản trị</span> : <div className="lms-actions">
            <button disabled={busy} onClick={() => { setNotice({}); setPending({ user, change: { role: user.role === 'teacher' ? 'user' : 'teacher' }, label: user.role === 'teacher' ? 'Thu hồi quyền giảng viên của' : 'Cấp quyền giảng viên cho' }); }}>{user.role === 'teacher' ? 'Thu hồi quyền GV' : 'Cấp quyền GV'}</button>
            <button disabled={busy} onClick={() => { setNotice({}); setPending({ user, change: { status: user.status === 'active' ? 'locked' : 'active' }, label: user.status === 'active' ? 'Khóa' : 'Mở khóa' }); }}>{user.status === 'active' ? 'Khóa' : 'Mở khóa'}</button>
          </div>}</td>
        </tr>)}</tbody></table></div>
      {!data.items.length && <p className="lms-empty">Không có tài khoản phù hợp. Hãy thử tên, email hoặc bộ lọc khác.</p>}
      <Pagination page={page} total={data.total} onChange={setPage} disabled={busy} />
    </>}
  </>;
}
