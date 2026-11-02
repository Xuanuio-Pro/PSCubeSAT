import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { Notice } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

const labels = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', labtest: 'Lab test' };
const fields = {
  video: [['url', 'URL video (HTTPS)', 'url'], ['watch_ratio', 'Tỷ lệ xem cần đạt (0–1)', 'number'], ['duration_seconds', 'Thời lượng video (giây)', 'number'], ['tracking_mode', 'Cách ghi nhận video', 'tracking'], ['confirmation_allowed', 'Cho phép SV xác nhận đã xem', 'boolean']],
  document: [['markdown', 'Nội dung tài liệu (Markdown)', 'textarea']],
  practice: [['instructions', 'Hướng dẫn thực hành', 'textarea'], ['rubric', 'Tiêu chí chấm', 'textarea'], ['evidence', 'Minh chứng đầu ra', 'textarea'], ['board', 'Bo mạch', 'board']],
  labtest: [['time_limit_minutes', 'Thời gian làm bài (phút)', 'number'], ['max_attempts', 'Số lượt làm tối đa', 'number'], ['pass_score', 'Số câu đúng để đạt (trên 5)', 'number']],
};

function LessonSettings({ lesson, onChange, disabled }) {
  function param(key, value) {
    const params = { ...lesson.params };
    if (value === '') delete params[key]; else params[key] = value;
    onChange({ ...lesson, params });
  }
  return <details className="curriculum-lesson">
    <summary><span><small>{labels[lesson.type]}</small><strong>{lesson.title}</strong><code>{lesson.id}</code></span><span>{lesson.enabled ? lesson.required ? 'Bắt buộc' : 'Tùy chọn' : 'Đã tắt'}</span></summary>
    <fieldset disabled={disabled}>
      <legend className="sr-only">Cấu hình {lesson.title}</legend>
      <div className="curriculum-switches">
        <label><input type="checkbox" checked={lesson.enabled} onChange={event => onChange({ ...lesson, enabled: event.target.checked })} />Bật bài học</label>
        <label><input type="checkbox" checked={lesson.required} onChange={event => onChange({ ...lesson, required: event.target.checked })} />Bắt buộc</label>
        <label>Thứ tự<input type="number" min={0} max={1000} value={lesson.order_no} onChange={event => onChange({ ...lesson, order_no: Number(event.target.value) })} /></label>
      </div>
      {lesson.content.todos?.length > 0 && <div className="curriculum-todo">{lesson.content.todos.map(todo => <p key={todo}>{todo}</p>)}</div>}
      <div className="lms-form-grid">{[...fields[lesson.type], ['estimated_minutes', 'Thời lượng dự kiến (phút)', 'number']].map(([key, label, kind]) => {
        const value = lesson.params[key] ?? lesson.content[key] ?? '';
        return <label key={key} className={kind === 'textarea' ? 'lms-wide' : ''}>{label}
          {kind === 'boolean' ? <input type="checkbox" checked={!!value} onChange={event => param(key, event.target.checked)} />
            : kind === 'tracking' ? <select value={value || 'native'} onChange={event => param(key, event.target.value)}><option value="native">Đo đoạn xem (video .mp4/.webm)</option><option value="confirmation">SV xác nhận (nguồn không đo được)</option></select>
            : kind === 'textarea' ? <textarea rows={5} value={value} onChange={event => param(key, event.target.value)} />
            : kind === 'board' ? <select value={value} onChange={event => param(key, event.target.value)}><option value="">Theo lựa chọn của người học</option><option value="esp32">ESP32</option><option value="esp32s3">ESP32-S3</option></select>
              : <input type={kind} step={key === 'watch_ratio' ? '0.05' : '1'} value={value} onChange={event => param(key, event.target.value === '' ? '' : kind === 'number' ? Number(event.target.value) : event.target.value)} />}
        </label>;
      })}</div>
    </fieldset>
  </details>;
}

function Editor({ initial, classId, onReload }) {
  const [config, setConfig] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({});
  const [errors, setErrors] = useState([]);
  const [impact, setImpact] = useState(null);
  function updateLab(id, callback) {
    setConfig(current => ({ ...current, labs: current.labs.map(lab => lab.id === id ? callback(lab) : lab) }));
    setDirty(true); setImpact(null); setErrors([]); setNotice({});
  }
  async function save() {
    setBusy(true); setNotice({}); setErrors([]); setImpact(null);
    try {
      const payload = { course_version_id: config.course_version_id, expected_version: config.version,
        labs: config.labs.map(lab => ({ lab_id: lab.id, enabled: lab.enabled, prerequisites: lab.prerequisites })),
        lessons: config.labs.flatMap(lab => lab.lessons.map(item => ({ lesson_id: item.id, enabled: item.enabled, required: item.required, order_no: item.order_no, params: item.params }))) };
      const next = await request(`/api/classes/${classId}/settings`, { method: 'PUT', body: JSON.stringify(payload) });
      setConfig(next); setDirty(false); setNotice({ message: 'Đã lưu nháp. Nội dung sinh viên đang thấy chưa thay đổi.' });
    } catch (failure) { setNotice({ error: failure.message }); setErrors(failure.details?.errors || []); }
    finally { setBusy(false); }
  }
  function applyPath(kind) {
    const branch = { 0: [], 1: [0], 2: [0], 3: [1], 4: [1], 5: [1], 6: [2, 3, 4], 7: [5, 6], 8: [7] };
    setConfig(current => ({ ...current, labs: current.labs.map((lab, i, labs) => ({ ...lab, prerequisites: kind === 'branching' ? branch[lab.id] : i ? [labs[i - 1].id] : [] })) }));
    setDirty(true); setImpact(null);
  }
  async function publish(dryRun) {
    setBusy(true); setNotice({}); setErrors([]);
    try {
      const result = await request(`/api/classes/${classId}/publish?dry_run=${dryRun}`, { method: 'POST', body: JSON.stringify({ expected_version: config.version }) });
      if (dryRun) setImpact(result);
      else { setImpact(null); setNotice({ message: `Đã xuất bản cấu hình cho ${result.affected_students} sinh viên.` }); setConfig(current => ({ ...current, status: 'published' })); }
    } catch (failure) { setNotice({ error: failure.message }); setErrors(failure.details?.errors || []); setImpact(null); }
    finally { setBusy(false); }
  }
  return <>
    <header className="lms-heading"><div><h1>Cấu hình chương trình</h1><p>Bản {config.version || 'mới'} · {config.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}{dirty ? ' · Có thay đổi chưa lưu' : ''}</p></div>
      {dirty ? <span>Lưu nháp trước khi xem thử.</span> : <Link to={`/classes/${classId}/learn?preview=true`}>Xem như sinh viên</Link>}</header>
    <p>Bật hoặc tắt bài, chọn yêu cầu hoàn thành và bổ sung học liệu cho lớp. Bài bị tắt không nằm trong chương trình của sinh viên.</p>
    <Notice {...notice} />
    <div className="lms-actions"><span>Mẫu lộ trình:</span><button disabled={busy} onClick={() => applyPath('branching')}>Phân nhánh CubeSAT</button><button disabled={busy} onClick={() => applyPath('sequential')}>Tuần tự Lab 0–8</button></div>
    {errors.length > 0 && <section className="lms-notice lms-error" role="alert"><h2>Các mục cần sửa</h2><ul>{errors.map((error, i) => <li key={i}>{error.lab_id !== undefined ? `Lab ${error.lab_id}: ` : ''}{error.lesson_id ? `${error.lesson_id}: ` : ''}{error.message}</li>)}</ul><button onClick={onReload}>Tải lại cấu hình từ server</button></section>}
    <div className="curriculum-toolbar"><button disabled={busy || !dirty && config.version > 0} onClick={save} className="lms-primary">{busy ? 'Đang xử lý…' : 'Lưu nháp'}</button><button disabled={busy || dirty || config.status !== 'draft' || !config.version} onClick={() => publish(true)}>Kiểm tra trước xuất bản</button></div>
    {impact && <section className="lms-confirm"><p>Cấu hình hợp lệ. <strong>{impact.affected_students} sinh viên</strong> sẽ nhận bản {impact.version}. Bản đã xuất bản được giữ trong lịch sử.</p><div className="lms-actions"><button disabled={busy} onClick={() => publish(false)}>Xác nhận xuất bản</button><button disabled={busy} onClick={() => setImpact(null)}>Hủy</button></div></section>}
    {config.labs.map(lab => <details key={lab.id} className="lms-panel curriculum-lab" open={lab.id === 2}>
      <summary><h2>Lab {lab.id}: {lab.title}</h2><span>{!lab.enabled && 'Lab đã tắt · '}{lab.lessons.filter(item => item.enabled).length}/{lab.lessons.length} bài đang bật</span></summary>
      <p><Link to={`/classes/${classId}/labs/${lab.id}/questions`}>Soạn ngân hàng và quản lý Lab Test</Link></p><p>{lab.objectives}</p><p><strong>Nhóm nội dung:</strong> {lab.groups.join(' → ') || 'Tổng quan'}</p><p><strong>Minh chứng đầu ra:</strong> {lab.evidence}</p>
      <fieldset disabled={busy}><legend>Cấu hình Lab {lab.id}</legend><div className="curriculum-switches"><label><input type="checkbox" checked={lab.enabled} onChange={event => updateLab(lab.id, value => ({ ...value, enabled: event.target.checked }))} />Bật lab</label>
        <label>Lab tiên quyết (giữ Ctrl để chọn nhiều)<select multiple value={lab.prerequisites.map(String)} onChange={event => updateLab(lab.id, value => ({ ...value, prerequisites: [...event.target.selectedOptions].map(option => Number(option.value)) }))}>{config.labs.filter(item => item.id !== lab.id).map(item => <option value={item.id} key={item.id}>Lab {item.id}: {item.title}</option>)}</select></label></div></fieldset>
      {lab.lessons.map(lesson => <LessonSettings key={lesson.id} lesson={lesson} disabled={busy} onChange={next => updateLab(lab.id, value => ({ ...value, lessons: value.lessons.map(item => item.id === next.id ? next : item) }))} />)}
    </details>)}
  </>;
}

export default function ClassCurriculumPage() {
  const { classId } = useParams();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}/curriculum?draft=true`);
  if (loading) return <p role="status">Đang tải cấu hình chương trình…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button><Link to={`/classes/${classId}`}>Về lớp học</Link></>;
  return <Editor key={`${classId}:${data.version}`} initial={data} classId={classId} onReload={reload} />;
}

