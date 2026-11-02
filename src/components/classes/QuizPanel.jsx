import { useCallback, useEffect, useRef, useState } from 'react';
import { request, useAuth } from '../../contexts/auth-api';
import { Notice } from './LmsCommon';
import { acknowledge, quizCacheKey, quizTabId, readQuizCache } from './quiz-storage';
import './quiz.css';

export default function QuizPanel({ classId, labId, onRefresh, policySummary }) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState({});
  const [conflict, setConflict] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [tabId] = useState(() => quizTabId(sessionStorage));
  const state = useRef({ attempt: null, dirty: {}, pending: null, conflict: false, working: false, deadline: 0, lastSync: 0 });
  const startKey = useRef(null);
  const base = `/api/classes/${classId}/labs/${labId}/attempts`;
  const cacheKey = useCallback(id => quizCacheKey(user.id, classId, id, tabId), [user.id, classId, tabId]);
  const persist = useCallback(() => {
    const current = state.current;
    if (!current.attempt) return;
    setDirty({ ...current.dirty });
    try {
      if (current.attempt.status !== 'active') localStorage.removeItem(cacheKey(current.attempt.id));
      else localStorage.setItem(cacheKey(current.attempt.id), JSON.stringify({ dirty: current.dirty, pending: current.pending }));
    } catch { setNotice({ error: 'Trình duyệt không lưu được bản dự phòng. Giữ trang mở cho đến khi server xác nhận lưu.' }); }
  }, [cacheKey]);
  const receive = useCallback(next => {
    state.current.attempt = next;
    state.current.lastSync = performance.now();
    state.current.deadline = performance.now() + Date.parse(next.expires_at) - Date.parse(next.server_now);
    setSeconds(Math.max(0, Math.ceil((Date.parse(next.expires_at) - Date.parse(next.server_now)) / 1000)));
    if (next.status !== 'active') {
      state.current.dirty = {}; state.current.pending = null;
    }
    setAttempt(next); persist();
  }, [persist]);
  useEffect(() => {
    let alive = true;
    request(base).then(async rows => {
      const last = rows.find(row => row.status === 'active') || rows.at(-1);
      if (!last) return;
      const result = await request(`/api/attempts/${last.id}/result`);
      if (!alive) return;
      if (result.status === 'active') {
        const cache = readQuizCache(localStorage, cacheKey(result.id), result);
        state.current.dirty = cache.dirty; state.current.pending = cache.pending;
        if (Object.keys(cache.dirty).length || cache.pending) setNotice({ message: 'Đã khôi phục lựa chọn trên thiết bị. Đang đồng bộ với server…' });
      }
      receive(result);
    }).catch(error => { if (alive) setNotice({ error: error.message }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [base, cacheKey, receive]);

  const flush = useCallback(async () => {
    const current = state.current;
    if (current.conflict || !current.attempt || current.attempt.status !== 'active') return false;
    while (current.pending || Object.keys(current.dirty).length) {
      if (!current.pending) current.pending = { idempotency_key: crypto.randomUUID(), expected_revision: current.attempt.answer_revision, answers: { ...current.dirty } };
      persist();
      const sent = current.pending;
      try {
        const next = await request(`/api/attempts/${current.attempt.id}/answers`, { method: 'PUT', body: JSON.stringify(sent) });
        current.dirty = acknowledge(current.dirty, sent.answers); current.pending = null;
        receive(next); setNotice({});
        if (next.status !== 'active') return false;
      } catch (error) {
        if (error.code === 'VERSION_CONFLICT') {
          current.conflict = true; setConflict(true);
          setNotice({ error: 'Lượt thi đã được cập nhật ở tab khác. Chọn cách xử lý bên dưới trước khi tiếp tục.' });
        } else if (error.code === 'ATTEMPT_EXPIRED') {
          receive(await request(`/api/attempts/${current.attempt.id}/result`)); onRefresh();
          setNotice({ message: 'Đã hết giờ. Server chấm các lựa chọn đã lưu trước hạn.' });
        } else setNotice({ error: error.status ? error.message : 'Mất kết nối. Lựa chọn được giữ trên thiết bị và sẽ gửi lại khi có mạng.' });
        return false;
      }
    }
    return true;
  }, [persist, receive, onRefresh]);

  useEffect(() => {
    const tick = async () => {
      const current = state.current;
      if (!current.attempt || current.attempt.status !== 'active') return;
      const remaining = Math.max(0, Math.ceil((current.deadline - performance.now()) / 1000));
      setSeconds(remaining);
      if (current.working || current.conflict && remaining > 0) return;
      current.working = true;
      try {
        if (remaining === 0 || !current.pending && !Object.keys(current.dirty).length && performance.now() - current.lastSync > 10000) {
          const next = await request(`/api/attempts/${current.attempt.id}/result`);
          receive(next); if (next.status !== 'active') onRefresh();
        } else if (navigator.onLine) await flush();
      } catch (error) { setNotice({ error: error.status ? error.message : 'Đang chờ kết nối để lấy kết quả từ server.' }); }
      finally { current.working = false; }
    };
    const timer = setInterval(tick, 1000);
    window.addEventListener('online', tick);
    return () => { clearInterval(timer); window.removeEventListener('online', tick); };
  }, [flush, receive, onRefresh]);

  async function start() {
    if (state.current.working) return;
    state.current.working = true; setBusy(true); setNotice({});
    if (!startKey.current) startKey.current = crypto.randomUUID();
    try {
      const next = await request(base, { method: 'POST', body: JSON.stringify({ idempotency_key: startKey.current }) });
      receive(next); startKey.current = null;
      setSeconds(Math.max(0, Math.ceil((Date.parse(next.expires_at) - Date.parse(next.server_now)) / 1000)));
    } catch (error) { setNotice({ error: error.message }); }
    finally { state.current.working = false; setBusy(false); }
  }
  function choose(id, choice) {
    state.current.dirty = { ...state.current.dirty, [id]: choice }; persist();
  }
  async function submit() {
    if (state.current.working || state.current.conflict) return;
    state.current.working = true; setBusy(true);
    try {
      if (!await flush()) return;
      receive(await request(`/api/attempts/${state.current.attempt.id}/submit`, { method: 'POST' }));
      onRefresh(); setNotice({ message: 'Đã nộp bài. Điểm và tiến độ đã được ghi nhận.' });
    } catch (error) { setNotice({ error: error.message || 'Chưa nhận được phản hồi. Bấm nộp lại để kiểm tra cùng lượt thi.' }); }
    finally { state.current.working = false; setBusy(false); }
  }
  async function resolve(keepLocal) {
    if (state.current.working) return;
    state.current.working = true; setBusy(true);
    try {
      const next = await request(`/api/attempts/${state.current.attempt.id}/result`);
      state.current.pending = null;
      if (!keepLocal) state.current.dirty = {};
      state.current.conflict = false; setConflict(false); receive(next); setNotice({});
    } catch (error) { setNotice({ error: error.message }); }
    finally { state.current.working = false; setBusy(false); }
  }
  if (loading) return <p role="status">Đang khôi phục lượt thi…</p>;
  const active = attempt?.status === 'active';
  const selections = { ...attempt?.answers, ...dirty };
  return <section className="quiz-panel" aria-label={`Bài kiểm tra Lab ${labId}`}>
    <Notice {...notice} />
    {!attempt && <><h3>Kiểm tra cuối Lab {labId}</h3><p>Đề gồm 5 câu, thời gian {policySummary.time_limit_minutes} phút, đạt từ {policySummary.pass_score}/5 điểm. Số lượt tiêu chuẩn: {policySummary.max_attempts}.</p><p>Thời gian bắt đầu tính ngay khi bạn mở đề; tải lại trang sẽ giữ nguyên lượt thi.</p><button className="lms-primary" onClick={start} disabled={busy}>Bắt đầu làm bài</button></>}
    {attempt && <>
      <div className="quiz-status"><div><strong>Lượt {attempt.number}</strong><p>Đạt từ {attempt.policy.pass_score}/5 · Còn {attempt.remaining_attempts} lượt sau lượt này</p></div>
        {active ? <div><strong className="quiz-clock" aria-label="Thời gian còn lại">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong><p role="status">{Object.keys(dirty).length ? 'Đang chờ lưu…' : 'Đã lưu trên server'}</p></div>
          : <div><strong className="quiz-score">{attempt.score}/5</strong><p>{attempt.passed ? 'Đã đạt' : 'Chưa đạt'} · Cao nhất {attempt.highest_score}/5</p></div>}
      </div>
      {conflict && <div className="lms-confirm"><p>Giữ lựa chọn vừa sửa trên thiết bị này hay tải lựa chọn đã lưu từ tab khác?</p><div className="lms-actions"><button disabled={busy} onClick={() => resolve(true)}>Giữ lựa chọn trên thiết bị</button><button disabled={busy} onClick={() => resolve(false)}>Dùng bản đã lưu trên server</button></div></div>}
      {!active && <p>{attempt.status === 'expired' ? 'Hết thời gian làm bài. ' : ''}{attempt.revealed ? 'Đáp án được công bố theo cấu hình của giảng viên.' : 'Đáp án và giải thích chưa được công bố.'}</p>}
      {attempt.items.map((item, index) => <fieldset className="quiz-question" key={item.id} disabled={!active || busy || conflict || seconds === 0}>
        <legend><span>Câu {index + 1}</span> {item.prompt}</legend>
        {item.choices.map(choice => <label className={`quiz-choice${selections[item.id] === choice.id ? ' selected' : ''}`} key={choice.id}>
          <input type="radio" name={item.id} checked={selections[item.id] === choice.id} onChange={() => choose(item.id, choice.id)} />
          <span>{choice.text}</span>{item.correct_choice_id === choice.id && <strong>Đáp án đúng</strong>}
        </label>)}
        {item.explanation && <div className="quiz-explanation"><p>{item.explanation}</p><small>Nguồn: {item.source_reference}</small></div>}
      </fieldset>)}
      {active ? <div className="quiz-footer"><p>Đã chọn {Object.keys(selections).length}/5 câu. Hết giờ, server chấm phần đã lưu.</p><button className="lms-primary" disabled={busy || conflict || seconds === 0} onClick={submit}>{busy ? 'Đang nộp…' : 'Nộp bài'}</button></div>
        : <div className="lms-actions"><button disabled={busy} onClick={() => resolve(false)}>Cập nhật kết quả</button>{attempt.remaining_attempts > 0 && !attempt.revealed && <button onClick={start} disabled={busy}>Làm lượt tiếp theo</button>}</div>}
    </>}
  </section>;
}
