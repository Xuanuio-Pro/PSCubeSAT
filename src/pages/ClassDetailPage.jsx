import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { ClassFields, Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

function Members({ classroom }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({});
  const [removing, setRemoving] = useState(null);
  const url = `/api/classes/${classroom.id}/members`;
  const { data, error, loading, reload } = useLmsResource(`${url}?page=${page}&status=${status}`);
  const writable = classroom.status !== 'archived';
  async function mutate(method, payload, message) {
    setBusy(true); setNotice({});
    try {
      await request(url, { method, body: JSON.stringify(payload) });
      setNotice({ message }); setRemoving(null); setEmail(''); reload();
    } catch (failure) {
      setNotice({ error: failure.message });
      if (failure.status === 403) reload();
    } finally { setBusy(false); }
  }
  return <section className="lms-panel"><h2>Thành viên lớp</h2>
    {writable && <form className="lms-filters" onSubmit={event => { event.preventDefault(); mutate('POST', { email }, 'Sinh viên đã có trong danh sách lớp.'); }}>
      <label>Email sinh viên<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="Email đã đăng ký tài khoản" /></label><button disabled={busy}>Thêm sinh viên</button>
    </form>}
    <label className="lms-filter-single">Hiển thị<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); setRemoving(null); }}><option value="active">Đang tham gia</option><option value="removed">Đã xóa khỏi lớp</option></select></label>
    <Notice {...notice} />
    {removing && <section className="lms-confirm"><p>Xóa <strong>{removing.email}</strong> khỏi lớp? Tài khoản sẽ mất quyền truy cập lớp; dữ liệu được giữ lại.</p><div className="lms-actions"><button disabled={busy} onClick={() => mutate('DELETE', { user_id: removing.user_id }, 'Đã xóa sinh viên khỏi lớp.')}>Xóa khỏi lớp</button><button disabled={busy} onClick={() => setRemoving(null)}>Hủy</button></div></section>}
    {loading ? <p role="status">Đang tải thành viên…</p> : error ? <><Notice error={error} /><button onClick={reload}>Thử lại</button></> : <>
      <div className="lms-table-wrap"><table><caption className="sr-only">Danh sách thành viên lớp</caption><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>{data.items.map(member => <tr key={member.id}><td><strong>{member.full_name || 'Chưa có tên'}</strong><span className="lms-secondary">{member.email}</span></td><td>{member.role === 'teacher' ? 'Giảng viên' : 'Sinh viên'}</td><td>{writable && member.role === 'student' && (status === 'active' ? <button disabled={busy} onClick={() => setRemoving(member)}>Xóa khỏi lớp</button> : <button disabled={busy} onClick={() => mutate('POST', { email: member.email }, 'Đã phục hồi sinh viên vào lớp.')}>Thêm lại</button>)}</td></tr>)}</tbody></table></div>
      {!data.items.length && <p className="lms-empty">Chưa có thành viên trong danh sách này.</p>}
      <Pagination page={page} total={data.total} onChange={setPage} disabled={busy} />
    </>}
  </section>;
}

function ClassEditor({ classroom, onSaved }) {
  const [form, setForm] = useState({ name: classroom.name, term: classroom.term || '', description: classroom.description || '', status: classroom.status });
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request(`/api/classes/${classroom.id}`, { method: archive ? 'DELETE' : 'PATCH', ...(archive ? {} : { body: JSON.stringify(form) }) });
      onSaved(archive ? 'Đã lưu trữ lớp.' : 'Đã lưu thông tin lớp.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <form className="lms-panel" onSubmit={save}><h2>Thông tin lớp</h2><ClassFields value={form} onChange={setForm} /><Notice error={error} />
    {archive && <p className="lms-confirm">Lưu trữ lớp sẽ dừng chỉnh sửa thông tin và danh sách thành viên. Thành viên còn quyền vẫn xem được lớp.</p>}
    <div className="lms-actions"><button className="lms-primary" disabled={busy}>{busy ? 'Đang lưu…' : archive ? 'Xác nhận lưu trữ' : 'Lưu thông tin'}</button><button type="button" disabled={busy} onClick={() => setArchive(!archive)}>{archive ? 'Hủy lưu trữ' : 'Lưu trữ lớp'}</button></div>
  </form>;
}

export default function ClassDetailPage() {
  const { classId } = useParams();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}`);
  const [message, setMessage] = useState('');
  return <>
    <Link to="/classes">Về danh sách lớp</Link>
    {loading ? <p role="status">Đang tải thông tin lớp…</p> : error ? <><Notice error={error} /><button onClick={reload}>Thử lại</button></> : <>
      <header className="lms-heading"><div><span className="lms-secondary">{data.code}{data.term ? ` · ${data.term}` : ''}</span><h1>{data.name}</h1><p>{data.description || 'Chưa có mô tả lớp.'}</p></div><span className={`lms-status ${data.status}`}>{{ active: 'Đang mở', draft: 'Bản nháp', archived: 'Đã lưu trữ' }[data.status]}</span></header>
      <Notice message={message} />
      <div className="lms-actions curriculum-links"><Link to={`/classes/${classId}/path`}>Lộ trình học tập</Link><Link to={`/classes/${classId}/learn`}>Mở chương trình học</Link>{data.can_manage && <><Link to={`/classes/${classId}/curriculum`}>Cấu hình chương trình</Link><Link to={`/classes/${classId}/progress`}>Tiến độ và chấm bài</Link><Link to={`/classes/${classId}/report`}>Báo cáo lớp</Link></>}</div>
      {data.lms_mode === 'read_only' && <p className="lms-notice" role="status">Lớp đang tạm dừng ghi dữ liệu. Bạn vẫn xem được lộ trình và kết quả đã có; trong thời gian này có thể <Link to="/preview">học nội dung trải nghiệm</Link>.</p>}
      {data.lms_mode === 'off' && <p className="lms-notice" role="status">Lớp chưa bật chế độ học theo lớp. Sinh viên tiếp tục dùng chương trình học hiện có.</p>}
      {data.can_manage ? <>
        {data.status !== 'archived' && <ClassEditor key={`${data.id}:${data.updated_at}`} classroom={data} onSaved={text => { setMessage(text); reload(); }} />}
        <Members key={data.id} classroom={data} />
      </> : <section className="lms-panel"><h2>Thông tin tham gia</h2><p>Bạn là sinh viên của lớp này. Liên hệ giảng viên để nhận hướng dẫn học tập.</p>{data.status === 'archived' && <p>Lớp đã được lưu trữ.</p>}</section>}
    </>}
  </>;
}
