import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request, useAuth } from '../contexts/auth-api';
import { ClassFields, Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

const statusLabels = { draft: 'Bản nháp', active: 'Đang mở', archived: 'Đã lưu trữ' };

function TeacherPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error } = useLmsResource(`/api/admin/users?role=teacher&status=active&search=${encodeURIComponent(query)}`);
  return <div className="lms-teacher-picker">
    <label>Tìm giảng viên<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc email giảng viên" /></label>
    <button type="button" onClick={() => { setQuery(search); onChange(''); }}>Tìm giảng viên</button>
    <label>Giảng viên phụ trách<select required value={value} onChange={event => onChange(event.target.value)} disabled={loading}>
      <option value="">{loading ? 'Đang tải…' : 'Chọn giảng viên'}</option>
      {data?.items.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email} — {user.email}</option>)}
    </select></label>
    <Notice error={error} />
    {data?.total > 20 && <p>Đang hiển thị 20 kết quả. Nhập email để tìm đúng giảng viên.</p>}
  </div>;
}

export default function ClassesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = ['admin', 'teacher'].includes(user.role);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', term: '', status: 'draft' });
  const [teacher, setTeacher] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const { data, error, loading, reload } = useLmsResource(`/api/classes?page=${page}`);
  async function create(event) {
    event.preventDefault(); setBusy(true); setFailure('');
    try {
      const created = await request('/api/classes', { method: 'POST', body: JSON.stringify({ ...form, ...(user.role === 'admin' ? { teacher_id: Number(teacher) } : {}) }) });
      navigate(`/classes/${created.id}`);
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <header className="lms-heading"><div><h1>{canCreate ? 'Lớp học' : 'Lớp của tôi'}</h1><p>{canCreate ? 'Quản lý lớp phụ trách và danh sách sinh viên.' : 'Các lớp bạn đang tham gia và thông tin từ giảng viên.'}</p></div>
      {canCreate && <button className="lms-primary" onClick={() => setCreating(!creating)}>{creating ? 'Đóng biểu mẫu' : 'Tạo lớp học'}</button>}
    </header>
    {creating && <form className="lms-panel" onSubmit={create}><h2>Tạo lớp học</h2><ClassFields value={form} onChange={setForm} creating />
      {user.role === 'admin' && <TeacherPicker value={teacher} onChange={setTeacher} />}
      <Notice error={failure} /><button className="lms-primary" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo lớp'}</button>
    </form>}
    {loading ? <p role="status">Đang tải lớp học…</p> : error ? <><Notice error={error} /><button onClick={reload}>Thử lại</button></> : <>
      {!data.items.length ? <section className="lms-empty"><h2>{canCreate ? 'Chưa có lớp học' : 'Bạn chưa tham gia lớp nào'}</h2><p>{canCreate ? 'Tạo lớp đầu tiên để thêm sinh viên đã đăng ký tài khoản.' : 'Gửi email tài khoản của bạn cho giảng viên để được thêm vào lớp.'}</p></section> :
        <div className="lms-class-list">{data.items.map(item => <article key={item.id} className="lms-class-row"><div><span className="lms-secondary">{item.code}{item.term ? ` · ${item.term}` : ''}</span><h2><Link to={`/classes/${item.id}`}>{item.name}</Link></h2><p>{item.description || 'Chưa có mô tả lớp.'}</p></div><div className="lms-class-meta"><span className={`lms-status ${item.status}`}>{statusLabels[item.status]}</span><Link to={`/classes/${item.id}`}>{item.can_manage ? 'Quản lý lớp' : 'Xem lớp'}</Link></div></article>)}</div>}
      <Pagination page={page} total={data.total} onChange={setPage} />
    </>}
  </>;
}
