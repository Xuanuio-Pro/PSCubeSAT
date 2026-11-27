import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getLabById } from '../data/lab-metadata';
import { getLabQuestionSet } from '../data/lab-questions';
import NotFoundPage from './NotFoundPage';
import { CheckpointCard } from '../components/lessons/LabCheckpoint';
import LegacyQuizPanel from '../components/lessons/LegacyQuizPanel';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';
import './lab-questions.css';

const lessonUrl = (slug, lessonId) => `/${slug}?lesson=${encodeURIComponent(lessonId)}`;

export default function LabQuestionsPage({ labId }) {
  const lab = getLabById(labId);
  const set = getLabQuestionSet(labId);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const { data, error, loading } = useLmsResource(
    lab ? `/api/curriculum/legacy/labs/${lab.id}/questions` : null,
  );
  if (!lab || !set) return <NotFoundPage withChrome={false} />;

  const serverLessons = data?.lessons || [];
  const activeItem = serverLessons.find(item => item.lesson_id === activeLessonId) || null;
  const checkpointsById = new Map(set.checkpoints.map(cp => [cp.id, cp]));

  return (
    <div className="lab-questions-page">
      <nav className="lab-questions-back"><Link to={`/${lab.slug}`}>← Quay lại Lab {lab.id}</Link></nav>
      <header className="lab-state-title lab-state-title--compact">
        <div className="lab-state-meta">
          <span className="lab-state-number">Lab {lab.id} · Câu hỏi kiểm tra</span>
          <span className="lab-state-section">{lab.title}</span>
        </div>
        <h1 className="lab-state-copy">Câu hỏi kiểm tra cuối Lab {lab.id}</h1>
      </header>

      {error && <Notice error={error} />}
      {loading && <p role="status">Đang tải danh sách bộ câu hỏi…</p>}

      {serverLessons.length > 0 && (
        <section className="lab-questions-summary">
          <h2>Bộ đề ôn tập trực tuyến (chấm trên máy chủ)</h2>
          <ul className="lab-questions-list">
            {serverLessons.map(item => (
              <li key={item.lesson_id} className="lab-questions-checkpoint">
                <header>
                  <span className={`lab-questions-kind${item.type === 'labtest' ? ' lab-questions-kind--practice' : ''}`}>
                    {item.type === 'labtest' ? 'Lab Test cuối Lab' : 'Quiz bài học'}
                  </span>
                  <h2>{item.title}</h2>
                </header>
                <p className="lab-questions-topics">
                  Rút ngẫu nhiên <strong>{item.num_questions}</strong>/{item.total_pool} câu · Đạt từ {item.pass_score}/{item.num_questions} câu ({item.time_limit_minutes} phút)
                </p>
                <div className="lab-questions-exercises">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setActiveLessonId(current => (current === item.lesson_id ? null : item.lesson_id))}
                  >
                    {activeLessonId === item.lesson_id ? 'Ẩn đề kiểm tra' : 'Làm đề ngẫu nhiên'}
                  </button>
                </div>
                {activeLessonId === item.lesson_id && activeItem && (
                  <div className="lab-questions-body">
                    <LegacyQuizPanel
                      key={activeItem.lesson_id}
                      labId={lab.id}
                      lessonId={activeItem.lesson_id}
                      title={activeItem.title}
                      kind={activeItem.type === 'labtest' ? 'labtest' : 'quiz'}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {checkpointsById.size > 0 && (
        <section className="lab-questions-summary">
          <h2>Mục tiêu từng phần câu hỏi</h2>
          <ol className="lab-questions-list">
            {set.checkpoints.map((checkpoint, index) => (
              <CheckpointCard
                key={checkpoint.id}
                checkpoint={checkpoint}
                index={index}
                renderExercise={id => <Link to={lessonUrl(lab.slug, id)}><code>{id}</code></Link>}
              />
            ))}
          </ol>
        </section>
      )}

      <section className="lesson-reading-card lab-questions-summary">
        <h2>📝 Tổng hợp Lab {lab.id}</h2>
        <p>{set.summary}</p>
      </section>
    </div>
  );
}
