import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authorizedFetch } from '../contexts/auth-api';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';
import EmptyState from '../components/common/EmptyState';
import { usePageTitle } from '../utils/page-title';
import LoadError from '../components/common/LoadError';

const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';

export default function ClassReportPage() {
  usePageTitle('Báo cáo lớp');
  const { classId } = useParams();
  const url = `/api/classes/${classId}/reports`;
  const { data, error, errorInfo, loading, reload } = useLmsResource(url);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function exportCsv() {
    setBusy(true); setFailure('');
    try {
      const response = await authorizedFetch(`${url}?format=csv`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không xuất được báo cáo.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob());
      link.download = `bao-cao-lop-${classId}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Đang tổng hợp báo cáo lớp…</p>;
  if (error) return <LoadError error={error} info={errorInfo} onRetry={reload} home={`/classes/${classId}`} homeLabel="Về lớp học" />;
  const labs = data.students[0]?.labs || [];
  return <>
    <header className="lms-heading"><div><h1>Báo cáo lớp</h1><p>Cập nhật lúc {dateTime(data.generated_at)}. {data.activity_definition}</p></div><div className="lms-actions"><Link to={`/classes/${classId}`}>Về lớp học</Link><Link to={`/classes/${classId}/progress`}>Chấm bài và miễn trừ</Link></div></header>
    <dl className="report-summary">
      <div><dt>Sinh viên đang học</dt><dd>{data.summary.active_students}</dd></div>
      <div><dt>Tiến độ trung bình</dt><dd>{data.summary.average_percent}%</dd></div>
      <div><dt>Bài chờ duyệt</dt><dd>{data.summary.pending_reviews}</dd></div>
      <div><dt>Số lab được bật</dt><dd>{data.summary.total_labs}</dd></div>
    </dl>
    <div className="lms-actions"><button className="lms-primary" disabled={busy || !data.students.length} onClick={exportCsv}>{busy ? 'Đang xuất…' : 'Xuất CSV'}</button><button disabled={busy} onClick={reload}>Cập nhật</button></div>
    <Notice error={failure} />
    {!data.students.length ? <EmptyState icon="people" text="Lớp chưa có sinh viên nên chưa có số liệu báo cáo." action={<Link to={`/classes/${classId}`}>Thêm sinh viên</Link>} /> : <div className="lms-table-wrap report-table"><table>
      <caption className="sr-only">Tiến độ, điểm Lab Test và hoạt động của từng sinh viên</caption>
      <thead><tr><th>Sinh viên</th><th>Tiến độ</th><th>Lab đạt</th><th>Lượt thi</th><th>Chờ duyệt</th><th>Hoạt động gần nhất</th>{labs.length > 0 && <th>Lab Test<span className="lms-secondary">điểm cao nhất, Lab {labs[0].id}–{labs[labs.length - 1].id}</span></th>}</tr></thead>
      <tbody>{data.students.map(student => <tr key={student.membership_id}>
        <th scope="row"><strong>{student.full_name || student.email}</strong><span className="lms-secondary report-email" title={student.email}>{student.email}{student.membership_status === 'removed' ? ' · Đã xóa khỏi lớp' : ''}</span>
          {student.legacy_compiled_labs.length > 0 && <span className="lms-secondary">Lịch sử biên dịch cũ: Lab {student.legacy_compiled_labs.join(', ')} (không tính hoàn thành)</span>}</th>
        <td>{student.percent}%</td>
        <td>{student.completed_labs}/{student.total_labs}</td>
        <td>{student.attempts_total}</td>
        <td>{student.pending_reviews}</td>
        <td>{dateTime(student.last_activity_at)}</td>
        {student.labs.length > 0 && <td><ol className="report-scores">{student.labs.map(lab => {
          const label = `Lab ${lab.id}: ${lab.best_score === null ? 'chưa thi' : `${lab.best_score}/5`}${lab.attempts > 0 ? `, ${lab.attempts} lượt` : ''}${lab.completed ? ', đã đạt lab' : ''}`;
          return <li key={lab.id} className={lab.completed ? 'is-done' : lab.best_score === null ? 'is-empty' : ''} title={label} aria-label={label}>
            <small aria-hidden="true">{lab.id}</small><b aria-hidden="true">{lab.best_score === null ? '—' : lab.best_score}</b>
          </li>;
        })}</ol></td>}
      </tr>)}</tbody>
    </table></div>}
    <p className="lms-secondary">Lịch sử biên dịch từ hệ thống cũ chỉ để tham khảo. Nếu SV đã hoàn thành tương đương, dùng “Miễn một bài” kèm lý do ở trang chấm bài.</p>
  </>;
}
