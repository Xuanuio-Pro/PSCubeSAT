import labWordmark from '../../assets/lab-ui/lab-wordmark.svg';
import iconPlay from '../../assets/lab-ui/icon-play.svg';
import iconBook from '../../assets/lab-ui/icon-book.svg';
import iconGoal from '../../assets/lab-ui/icon-goal.svg';
import iconCube from '../../assets/lab-ui/icon-cube-logo.svg';
import iconArrow from '../../assets/lab-ui/icon-circle-arrow.svg';

// Giao diện bài học theo Figma "LMS - LAB 0.x" và "Điều hướng", dùng cho mọi Lab.
// Dữ liệu, tiến độ và quy tắc hoàn thành do trang cha truyền vào; component này chỉ trình bày.
const COMPONENTS_TITLE = 'Khám phá PTIT STEM CubeSAT';

// Tab nổi phía trên thẻ nội dung cho các loại bài ngoài video / tài liệu / 3D.
const BODY_TABS = {
  practice: { icon: iconCube, label: 'Bài thực hành' },
  assembly: { icon: iconCube, label: 'Thực hành lắp ráp' },
  quiz: { icon: iconGoal, label: 'Câu hỏi kiểm tra' },
  summary: { icon: iconGoal, label: 'Tổng hợp' },
  labtest: { icon: iconGoal, label: 'Lab Test' },
};

const LESSON_KIND_LABELS = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', assembly: 'Thực hành lắp ráp', quiz: 'Câu hỏi', labtest: 'Lab Test', summary: 'Tổng hợp', components: 'Khám phá 3D' };

function Tab({ icon, label = '', small = false, square = false, flip = false }) {
  return <div className={`fig-tab${small ? ' fig-tab--small' : ''}${square ? ' fig-tab--square' : ''}`}>
    <img src={icon} alt="" className={`fig-tab-icon${flip ? ' is-flipped' : ''}`} draggable="false" />
    {label && <h2 className="fig-tab-label">{label}</h2>}
  </div>;
}

export default function LabFigView({
  lab, lesson, lessons, lessonIndex, completedCount = 0, totalCount = 0, completionPercent = 0, progressNote = '',
  progressText = '', showProgress = true, noticeNode = null, lockedNode = null,
  videoNode = null, docNode = null, componentsNode = null, bodyNode = null, goalNode = null, selectLesson,
  showComplete = true, canComplete = false, completed = false, completeLesson = undefined, resetLesson = null, completeError = '', remainingSeconds = 0,
  completeLabel = '',
}) {
  // Big number is the lab only; the lesson position is a small "Phần n/N" so it is not mistaken for a doc number.
  const partText = lessons.length > 0 && lessonIndex >= 0 ? `Phần ${lessonIndex + 1}/${lessons.length}` : '';
  const typeText = LESSON_KIND_LABELS[lesson.type] || '';
  const title = lesson.id === 'overview' ? lab.title : lesson.type === 'components' ? COMPONENTS_TITLE : lesson.title;
  const previous = lessons[lessonIndex - 1];
  const next = lessons[lessonIndex + 1];
  const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const bodyTab = lockedNode ? null : BODY_TABS[lesson.type];
  const content = lockedNode ? '' : lesson.type;
  const cardLabel = lesson.label ? `${lesson.label}: ${lesson.title}` : lesson.title;
  const canReset = completed && typeof resetLesson === 'function';

  const goal = content === 'video'
    ? goalNode ?? (lab.description
      ? <><p>{lab.description}</p><p>Nội dung phần này: {lesson.title}.</p></>
      : <p className="fig-placeholder">Tài liệu đang được cập nhật...</p>)
    : goalNode;

  return <div className="lab-course-view lab-fig animate-fadeInUp" key={`${lab.id}:${lesson.id}`}>
    <header className="fig-title">
      <img src={labWordmark} alt="" className="fig-title-lab" draggable="false" />
      <span className="fig-title-number" aria-hidden="true">{lab.id}</span>
      <div className="fig-title-copy">
        {(partText || typeText) && <p className="fig-title-part">Lab {lab.id}{partText && ` · ${partText}`}{typeText && ` · ${typeText}`}</p>}
        <h1 className="fig-title-text"><span className="sr-only">Lab {lab.id}{partText && `, ${partText}`}: </span>{title}{lesson.exerciseCode && <code className="fig-title-code">{lesson.exerciseCode}</code>}</h1>
      </div>
    </header>

    {goal && <section className="fig-card fig-card--soft fig-card--goal" aria-label="Mục tiêu bài học">
      <Tab icon={iconGoal} label="Mục tiêu bài học" small />
      <div className="fig-surface fig-surface--note">{goal}</div>
    </section>}

    {showProgress && <section className="fig-progress" aria-label="Tiến độ Lab">
      <div className="fig-progress-head">
        <div>
          <h2 className="fig-progress-title">Tiến độ Lab {lab.id}</h2>
          <p className="fig-progress-sub">{progressText || <>{completedCount}/{totalCount} bài học đã hoàn thành{progressNote && ` · ${progressNote}`}</>}</p>
        </div>
        <b className="fig-progress-percent">{completionPercent}%</b>
      </div>
      <div className="fig-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent} aria-label={`Hoàn thành ${completionPercent}% Lab ${lab.id}`}>
        <span style={{ width: `${completionPercent}%` }} />
      </div>
    </section>}
    {noticeNode}

    {lockedNode && <section className="fig-card fig-card--body fig-card--locked" aria-label={cardLabel}>
      <Tab icon={iconGoal} label="Bài học đang khóa" />
      <div className="fig-surface fig-surface--body">{lockedNode}</div>
    </section>}

    {content === 'video' && <section className="fig-card" aria-label={cardLabel}>
      <Tab icon={iconPlay} label="Video bài giảng" />
      <div className="fig-surface fig-surface--video">{videoNode}</div>
    </section>}
    {content === 'document' && <section className="fig-card" aria-label={cardLabel}>
      <Tab icon={iconBook} label="Tài liệu hướng dẫn" flip />
      <div className="fig-surface fig-surface--doc">{docNode}</div>
    </section>}
    {content === 'components' && <section className="fig-card fig-card--components" aria-label="Khám phá các phân hệ CubeSat">
      <Tab icon={iconCube} square />
      <div className="fig-components">{componentsNode}</div>
    </section>}
    {bodyTab && <section className={`fig-card fig-card--body fig-card--${lesson.type}`} aria-label={cardLabel}>
      <Tab icon={bodyTab.icon} label={bodyTab.label} />
      <div className="fig-surface fig-surface--body">{bodyNode}</div>
    </section>}

    <nav className="fig-pagination" aria-label="Điều hướng bài học">
      <button type="button" className="fig-page-button" disabled={!previous} onClick={() => previous && selectLesson(previous.id)}>
        <img src={iconArrow} alt="" className="fig-page-arrow fig-page-arrow--back" draggable="false" />
        <span>Phần trước</span>
      </button>
      {showComplete && <>
        <span className="fig-pagination-divider" aria-hidden="true" />
        <button type="button" className={`fig-complete-button${completed ? ' is-done' : ''}`}
          disabled={completed ? !canReset : !canComplete} onClick={completed ? resetLesson ?? undefined : completeLesson}
          title={canReset ? 'Nhấn để đặt lại về chưa hoàn thành' : undefined}
          aria-label={canReset ? 'Đã hoàn thành. Nhấn để đặt lại về chưa hoàn thành' : undefined}>
          {completed ? '✓ Đã hoàn thành' : completeLabel || (canComplete ? 'Hoàn thành bài học' : `Còn ${formatTime(remainingSeconds)}`)}
        </button>
      </>}
      <span className="fig-pagination-divider" aria-hidden="true" />
      <button type="button" className="fig-page-button" disabled={!next} onClick={() => next && selectLesson(next.id)}>
        <span>Phần tiếp theo</span>
        <img src={iconArrow} alt="" className="fig-page-arrow" draggable="false" />
      </button>
      <span className="sr-only" role="status">Phần {lessonIndex + 1} / {lessons.length}</span>
    </nav>
    {completeError && <p className="fig-complete-error" role="alert">{completeError}</p>}
  </div>;
}
