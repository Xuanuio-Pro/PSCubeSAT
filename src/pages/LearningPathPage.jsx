import { Link, useParams } from 'react-router-dom';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';
import { CheckIcon, LockIcon } from '../components/common/HeaderIcons';
import { LessonTypeIcon } from '../components/classes/LessonTypeIcon';
import { LESSON_TYPE_NAMES } from '../components/classes/lesson-types';
import { usePageTitle } from '../utils/page-title';

export default function LearningPathPage() {
  const { classId } = useParams();
  usePageTitle('Lộ trình học tập');
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}/learning-path`);
  if (loading) return <p role="status">Đang tải lộ trình…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  const lessonUrl = id => `/classes/${classId}/learn?lesson=${encodeURIComponent(id)}`;
  // Only the lab being studied starts open; the others collapse to one line so the page stays short.
  const currentLabId = data.labs.find(lab => lab.lessons.some(item => item.id === data.continue_lesson_id))?.id
    ?? data.labs.find(lab => lab.access !== 'locked' && !lab.completed)?.id;
  return <>
    <header className="lms-heading"><div><h1>Lộ trình học tập</h1><p>Hoàn thành các yêu cầu của lab để mở các bước tiếp theo.</p></div><Link to={`/classes/${classId}`}>Về lớp học</Link></header>
    <section className="lms-panel path-overview"><div><strong>{data.completed_labs}/{data.total_labs} lab đã đạt</strong><progress value={data.percent} max={100} aria-label="Tiến độ khóa học" /><span>{data.percent}% hoàn thành</span></div>
      {data.continue_lesson_id ? <Link className="path-continue" to={lessonUrl(data.continue_lesson_id)}>Tiếp tục học</Link> : <p>{data.completed_labs === data.total_labs ? 'Bạn đã hoàn thành chương trình của lớp.' : 'Các bài còn lại đang chờ đánh giá.'}</p>}
    </section>
    <ol className="learning-path-list">{data.labs.map(lab => {
      const locked = lab.access === 'locked';
      return <li key={lab.id} className={locked ? 'path-locked' : lab.completed ? 'path-completed' : ''}>
        <span className="path-state" aria-hidden="true">{lab.completed ? <CheckIcon size={20} /> : locked ? <LockIcon size={18} /> : lab.id}</span>
        <details className="path-lab" open={lab.id === currentLabId}>
          <summary>
            <span className="path-lab-head">
              <h2>Lab {lab.id}: {lab.title}</h2>
              <span className="path-lab-meta">{lab.completed ? 'Đã đạt' : locked ? 'Đang khóa' : `${lab.completed_count}/${lab.required_count} bài bắt buộc đã đạt`}</span>
            </span>
            <span className="path-chevron" aria-hidden="true" />
          </summary>
          <progress value={lab.percent} max={100} aria-label={`Tiến độ Lab ${lab.id}`} />
          {locked ? <p className="path-reason"><LockIcon size={14} /> {lab.reason ? `${lab.reason} để mở lab này.` : 'Lab này chưa được mở.'}</p>
            : <Link className="path-open-lab" to={lessonUrl(lab.lessons.find(item => item.access === 'available')?.id || lab.lessons[0]?.id || '')}>{lab.completed ? 'Ôn lại lab' : 'Mở lab'}</Link>}
          <ol className="path-lesson-list">{lab.lessons.map(lesson => <li key={lesson.id} className={`path-lesson path-lesson-${lesson.access}`}>
            <span className="path-lesson-icon" title={LESSON_TYPE_NAMES[lesson.type] || ''}><LessonTypeIcon type={lesson.type} /></span>
            {lesson.access === 'locked' ? <span>{lesson.title}</span> : <Link to={lessonUrl(lesson.id)}>{lesson.title}</Link>}
            <small>
              <span className="sr-only">{LESSON_TYPE_NAMES[lesson.type] || 'Bài học'} · </span>
              {lesson.access === 'completed' ? <><CheckIcon size={12} /> Đã hoàn thành</> : lesson.access === 'locked' ? <><LockIcon size={12} /> Chưa mở</> : lesson.status === 'pending_review' ? 'Chờ chấm' : 'Chưa học'}
            </small>
          </li>)}</ol>
          {lab.lessons.some(item => item.status === 'pending_review') && <p className="path-pending">Có bài đang chờ giảng viên chấm.</p>}
        </details>
      </li>;
    })}</ol>
  </>;
}
