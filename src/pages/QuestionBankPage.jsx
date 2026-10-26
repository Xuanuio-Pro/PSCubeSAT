import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { Notice } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';
import '../components/classes/quiz.css';

const labels = { draft: 'Nháp', approved: 'Đã duyệt', retired: 'Đã thu hồi', published: 'Đã xuất bản', queued: 'Chờ xử lý', running: 'Đang tạo', succeeded: 'Đã tạo nháp', failed: 'Thất bại' };
function emptyQuestion() {
  return { prompt: '', choices: ['a', 'b', 'c', 'd'].map(id => ({ id, text: '' })), correct_choice_id: '', explanation: '', objective: '', difficulty: 'medium', source_reference: '' };
}
function editableQuestion(q) {
  if (!q) return emptyQuestion();
  const { prompt, choices, correct_choice_id, explanation, objective, difficulty, source_reference } = q;
  return { prompt, choices, correct_choice_id, explanation, objective, difficulty, source_reference };
}

function BankEditor({ initial, classId, labId, reload }) {
  const [bank, setBank] = useState(initial);
  const [selected, setSelected] = useState(initial.questions[0]?.id || null);
  const [question, setQuestion] = useState(() => initial.questions[0] ? editableQuestion(initial.questions[0]) : emptyQuestion());
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [retire, setRetire] = useState('');
  const [file, setFile] = useState(null);
  const guard = useRef(false);
  const base = `/api/classes/${classId}/labs/${labId}`;
  const url = base + '/question-bank';
  const draft = bank.status === 'draft';
  const edited = selected && JSON.stringify(question) !== JSON.stringify(editableQuestion(bank.questions.find(q => q.id === selected)));
  const field = key => ({ value: question[key], onChange: event => setQuestion(current => ({ ...current, [key]: event.target.value })) });
  async function mutate(path, body, method = 'POST') {
    if (guard.current) return null;
    guard.current = true; setBusy(true); setNotice({});
    try {
      const result = await request(path, { method, body: JSON.stringify(body) });
      if (result.questions) setBank(result);
      setNotice({ message: result.affected_attempts !== undefined ? `Đã tạo bản sửa. Có ${result.affected_attempts} lượt thi dùng câu bị thu hồi; lịch sử được giữ nguyên.` : 'Đã lưu thay đổi.' });
      return result;
    } catch (error) { setNotice({ error: error.message }); return null; }
    finally { guard.current = false; setBusy(false); }
  }
  function select(q) { setSelected(q?.id || null); setQuestion(q ? editableQuestion(q) : emptyQuestion()); }
  async function save(event) {
    event.preventDefault();
    const result = await mutate(url + '/questions' + (selected ? `/${selected}` : ''), { expected_revision: bank.revision, question }, selected ? 'PUT' : 'POST');
    if (result) select(null);
  }
  async function review(status) {
    if (edited) { setNotice({ error: 'Lưu nội dung đang sửa trước khi duyệt.' }); return; }
    const result = await mutate(`${url}/questions/${selected}/review`, { expected_revision: bank.revision, status });
    if (result) select(null);
  }
  async function importFile(event) {
    event.preventDefault();
    if (!file || file.size > 300000) { setNotice({ error: 'Chọn tệp JSON/CSV tối đa 300 KB.' }); return; }
    await mutate(url + '/import', { expected_revision: bank.revision, format: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json', content: await file.text() });
  }
  return <>
    <header className="lms-heading"><div><h1>Ngân hàng Lab {labId}</h1><p>Phiên bản {bank.version} · {labels[bank.status]} · {bank.approved_count}/20 câu đã duyệt</p></div><Link to={`/classes/${classId}/curriculum`}>Cấu hình chương trình</Link></header>
    <nav className="lms-actions" aria-label="Ngân hàng theo lab">{Array.from({ length: 9 }, (_, id) => <Link key={id} aria-current={id === Number(labId) ? 'page' : undefined} to={`/classes/${classId}/labs/${id}/questions`}>Lab {id}</Link>)}</nav>
    <Notice {...notice} /><div className="lms-actions"><button disabled={busy} onClick={reload}>Tải lại ngân hàng</button>{draft && <button className="lms-primary" disabled={busy || bank.approved_count !== 20} onClick={() => mutate(url + '/publish', { expected_revision: bank.revision })}>Xuất bản 20 câu đã duyệt</button>}</div>
    <p>Mỗi đề lấy 5 câu từ 20 câu đã duyệt. Câu nhập hoặc do AI tạo luôn ở trạng thái nháp; chỉnh sửa nội dung sẽ yêu cầu duyệt lại.</p>
    {!draft && <form className="lms-panel" onSubmit={async event => { event.preventDefault(); const result = await mutate(url + '/fork', { expected_revision: bank.revision, reason, retire_question_id: retire || null }); if (result) select(null); }}>
      <h2>Tạo phiên bản sửa</h2><p>Lượt đang làm và kết quả cũ giữ nguyên. Thu hồi câu sẽ tạm ngừng cấp đề mới cho đến khi xuất bản bản sửa.</p>
      <div className="lms-form-grid"><label>Câu cần thu hồi (nếu có)<select value={retire} onChange={event => setRetire(event.target.value)}><option value="">Chỉ tạo phiên bản mới</option>{bank.questions.map(q => <option key={q.id} value={q.question_id}>{q.prompt.slice(0, 100)}</option>)}</select></label><label>Lý do<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></div><button disabled={busy}>Tạo bản sửa</button>
    </form>}
    <div className="bank-workspace">
      <aside><h2>Câu hỏi ({bank.questions.length})</h2>{draft && <button disabled={busy} onClick={() => select(null)}>Thêm câu hỏi</button>}
        <div className="bank-list">{bank.questions.map((q, index) => <button key={q.id} aria-current={selected === q.id ? 'true' : undefined} onClick={() => select(q)}><small>Câu {index + 1} · {labels[q.status]}</small>{q.prompt}</button>)}</div>
        {!bank.questions.length && <p>Ngân hàng trống. Thêm câu hoặc nhập tệp do giảng viên soạn.</p>}
      </aside>
      <form onSubmit={save} className="bank-editor"><h2>{selected ? 'Nội dung câu hỏi' : 'Soạn câu mới'}</h2>
        <fieldset disabled={busy || !draft}><label>Câu hỏi<textarea {...field('prompt')} required minLength={10} maxLength={5000} rows={4} /></label>
          <p>Chọn đúng một đáp án. ID lựa chọn được giữ khi chỉnh sửa.</p>
          {question.choices.map((choice, index) => <div className="bank-choice" key={choice.id}><input type="radio" name="correct" aria-label={`Đáp án đúng là lựa chọn ${index + 1}`} required checked={question.correct_choice_id === choice.id} onChange={() => setQuestion(current => ({ ...current, correct_choice_id: choice.id }))} /><label>Lựa chọn {index + 1}<input required maxLength={2000} value={choice.text} onChange={event => setQuestion(current => ({ ...current, choices: current.choices.map(c => c.id === choice.id ? { ...c, text: event.target.value } : c) }))} /></label></div>)}
          <label>Giải thích<textarea {...field('explanation')} required minLength={5} maxLength={5000} rows={3} /></label>
          <label>Mục tiêu kiến thức<input {...field('objective')} required minLength={3} maxLength={500} /></label>
          <label>Độ khó<select {...field('difficulty')}><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></select></label>
          <label>Tham chiếu nguồn<input {...field('source_reference')} required minLength={3} maxLength={2000} placeholder="Tên tài liệu, mục hoặc trang" /></label>
        </fieldset>
        {draft && <div className="lms-actions"><button className="lms-primary" disabled={busy}>Lưu bản nháp</button>{selected && <><button type="button" disabled={busy} onClick={() => review('approved')}>Duyệt bản đã lưu</button><button type="button" disabled={busy} onClick={() => review('retired')}>Thu hồi câu nháp</button><button type="button" disabled={busy} onClick={async () => { const result = await mutate(`${url}/questions/${selected}`, { expected_revision: bank.revision }, 'DELETE'); if (result) select(null); }}>Xóa câu nháp</button></>}</div>}
        {selected && <small>Nút duyệt áp dụng nội dung đã lưu. Lưu các thay đổi trước khi duyệt.</small>}
      </form>
    </div>
    {draft && <section className="lms-panel"><h2>Nhập ngân hàng</h2><p><a href="/templates/question-bank.json" download>Tải mẫu JSON</a> · <a href="/templates/question-bank.csv" download>Tải mẫu CSV</a> · <a href="/templates/question-bank-guide.md" download>Hướng dẫn điền mẫu</a></p><form onSubmit={importFile}><label>Tệp câu hỏi<input type="file" accept=".json,.csv" onChange={event => setFile(event.target.files[0] || null)} required /></label><button disabled={busy || !file}>Kiểm tra và nhập thành câu nháp</button></form></section>}
    <PolicyForm key={bank.policy.revision} initial={bank.policy} busy={busy} onSave={value => mutate(base + '/quiz-policy', value, 'PUT')} />
    {bank.ai_available && draft && <GenerationForm classId={classId} labId={labId} revision={bank.revision} url={url} busy={busy} mutate={mutate} onReload={reload} />}
    <TeacherResults base={base} />
  </>;
}

function PolicyForm({ initial, busy, onSave }) {
  const [value, setValue] = useState(initial);
  const [close, setClose] = useState(initial.closes_at ? new Date(Date.parse(initial.closes_at) - new Date(initial.closes_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  return <details className="lms-panel"><summary><h2>Chính sách bài test</h2></summary><p>Áp dụng cho lượt mới. Tham số riêng trong cấu hình chương trình đã xuất bản được ưu tiên. Các lượt đang thi giữ chính sách ban đầu.</p>
    <form onSubmit={event => { event.preventDefault(); const { revision, ...fields } = value; onSave({ ...fields, expected_revision: revision, closes_at: close ? new Date(close).toISOString() : null }); }}><div className="lms-form-grid">
      {[['time_limit_minutes', 'Thời gian (phút)', 180], ['pass_score', 'Điểm đạt / 5', 5], ['max_attempts', 'Số lượt tối đa', 100]].map(([key, label, max]) => <label key={key}>{label}<input type="number" min={1} max={max} required value={value[key]} onChange={event => setValue(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
      <label>Công bố đáp án<select value={value.reveal_policy} onChange={event => setValue(current => ({ ...current, reveal_policy: event.target.value }))}><option value="after_attempts">Sau khi hết lượt</option><option value="after_close">Sau khi đóng bài test</option><option value="immediate">Ngay sau nộp (không thi lại sau khi xem)</option><option value="never">Không công bố</option></select></label>
      <label>Đóng bài test (giờ địa phương)<input type="datetime-local" value={close} required={value.reveal_policy === 'after_close'} onChange={event => setClose(event.target.value)} /></label>
    </div><button disabled={busy}>Lưu chính sách</button></form></details>;
}

function GenerationForm({ classId, labId, revision, url, busy, mutate, onReload }) {
  const config = useLmsResource(`/api/classes/${classId}/curriculum?draft=true`);
  const jobs = useLmsResource(url + '/generation-jobs');
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(5);
  const docs = config.data?.labs.find(lab => lab.id === Number(labId))?.lessons.filter(q => q.type === 'document' && q.content.markdown) || [];
  return <section className="lms-panel"><h2>Tạo câu nháp từ tài liệu</h2><p>Chỉ gửi tài liệu đã chọn. Mỗi lần thử lại được tính vào hạn mức; giảng viên phải kiểm tra và duyệt nội dung.</p><Notice error={config.error || jobs.error} />
    <form onSubmit={async event => { event.preventDefault(); await mutate(url + '/generation-jobs', { expected_revision: revision, lesson_ids: selected, count }); jobs.reload(); }}><div className="bank-source-list">{docs.map(doc => <label key={doc.id}><input type="checkbox" checked={selected.includes(doc.id)} onChange={event => setSelected(current => event.target.checked ? [...current, doc.id] : current.filter(id => id !== doc.id))} />{doc.title}</label>)}</div><label>Số câu nháp<input type="number" min={1} max={20} value={count} onChange={event => setCount(Number(event.target.value))} /></label><button disabled={busy || !selected.length}>Tạo câu nháp</button></form>
    <button onClick={() => { jobs.reload(); onReload(); }}>Cập nhật job và ngân hàng</button>
    {jobs.data?.map(job => <div key={job.id}><p>{labels[job.status]} · {job.count} câu · {job.tries}/3 lần gọi · Đã giữ hạn mức ${job.reserved_usd.toFixed(4)}</p>{job.error && <p>{job.error}</p>}{job.status === 'failed' && job.tries < 3 && <button disabled={busy} onClick={async () => { await mutate(`${url}/generation-jobs/${job.id}/retry`, {}); jobs.reload(); }}>Thử lại</button>}</div>)}
  </section>;
}

function TeacherResults({ base }) {
  const stats = useLmsResource(base + '/quiz-statistics');
  const [page, setPage] = useState(1);
  const members = useLmsResource(base.replace(/\/labs\/\d+$/, '') + `/members?status=active&page=${page}&page_size=20`);
  const [member, setMember] = useState('');
  const [extra, setExtra] = useState(1);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  async function grant(event) {
    event.preventDefault(); if (busy) return; setBusy(true);
    const fields = { membership_id: Number(member), extra_attempts: extra, reason };
    if (!pending.current || JSON.stringify(pending.current.fields) !== JSON.stringify(fields)) pending.current = { fields, key: crypto.randomUUID() };
    try { await request(base + '/attempt-grants', { method: 'POST', body: JSON.stringify({ ...fields, idempotency_key: pending.current.key }) }); pending.current = null; setNotice({ message: 'Đã cấp thêm lượt và lưu lý do.' }); }
    catch (error) { setNotice({ error: error.message }); }
    finally { setBusy(false); }
  }
  return <><section className="lms-panel"><h2>Cấp thêm lượt thi</h2><Notice {...notice} /><Notice error={members.error} /><form onSubmit={grant}><div className="lms-form-grid"><label>Sinh viên<select required value={member} onChange={event => setMember(event.target.value)}><option value="">Chọn sinh viên</option>{members.data?.items?.filter(m => m.status === 'active' && m.role === 'student').map(m => <option key={m.id} value={m.id}>{m.display_name || m.email}</option>)}</select></label><label>Số lượt thêm<input type="number" min={1} max={20} value={extra} onChange={event => setExtra(Number(event.target.value))} /></label><label>Lý do<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></div><button disabled={busy}>Cấp lượt</button></form></section>
    <div className="lms-actions"><button disabled={page <= 1} onClick={() => { setPage(page - 1); setMember(''); }}>Nhóm sinh viên trước</button><button disabled={page * 20 >= (members.data?.total || 0)} onClick={() => { setPage(page + 1); setMember(''); }}>Nhóm sinh viên tiếp</button></div>
    <section className="lms-panel"><h2>Tỷ lệ đúng theo phiên bản câu</h2><button onClick={stats.reload}>Cập nhật thống kê</button><Notice error={stats.error} />{!stats.data?.length ? <p>Chưa có lượt đã chấm.</p> : <div className="lms-table-wrap"><table><thead><tr><th>Câu hỏi</th><th>Lượt đúng / Tổng</th><th>Tỷ lệ đúng</th></tr></thead><tbody>{stats.data.map(row => <tr key={row.question_version_id}><td>{row.prompt}<small> {row.question_version_id.slice(0, 8)}</small></td><td>{row.correct}/{row.total}</td><td>{Math.round(row.correct_ratio * 100)}%</td></tr>)}</tbody></table></div>}</section></>;
}

export default function QuestionBankPage() {
  const { classId, labId } = useParams();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}/labs/${labId}/question-bank`);
  if (loading) return <p role="status">Đang tải ngân hàng…</p>;
  if (error) return <><Notice error={error} /><Link to={`/classes/${classId}/curriculum`}>Về cấu hình để lưu giáo trình</Link><button onClick={reload}>Thử lại</button></>;
  return <BankEditor key={`${classId}:${labId}:${data.revision}`} initial={data} classId={classId} labId={labId} reload={reload} />;
}
