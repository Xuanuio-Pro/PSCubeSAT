import { cloneElement, isValidElement, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import CourseSidebar from './CourseSidebar';
import VideoPlayer from '../common/VideoPlayer';
import DocViewer from '../common/DocViewer';
import { useAuth } from '../../contexts/auth-api';
import TelemetryControls from '../groundstation/TelemetryControls';
import { getLessonsForLab, getLessonForLab, LESSON_TYPE_LABELS } from '../../data/curriculum';
import { lessonReadingContent } from '../../data/lesson-reading';

function LabStateTitle({ lab, lesson, position }) {
  return <header className="lab-state-title lab-state-title--compact">
    <div className="lab-state-meta"><span className="lab-state-number">Lab {lab.id} · Phần {position}</span><span className="lab-state-section">{lesson.label}</span></div>
    <h1 className="lab-state-copy">{lab.id === 0 && lesson.type === 'video' ? lab.title : lesson.title}</h1>
    {lesson.exerciseCode && <code className="lesson-exercise-code">{lesson.exerciseCode}</code>}
  </header>;
}

export default function LabLayout({ lab, editorPanel, visualizationPanel, practiceActions = null, practiceVariant = 'split' }) {
  const mainRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, markVideoWatched, markDocViewed } = useAuth();
  const lessons = getLessonsForLab(lab?.id ?? 0);
  const lesson = getLessonForLab(lab?.id ?? 0, searchParams.get('lesson'));
  const lessonIndex = lessons.indexOf(lesson);
  const firstPractice = lessons.find(item => item.type === 'practice');
  const videoUrl = lab?.id === 0 ? lab.videoUrl : lesson.videoUrl;
  const selectLesson = id => setSearchParams(current => { const next = new URLSearchParams(current); next.set('lesson', id); return next; });

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [lab?.id, lesson.id]);
  useEffect(() => {
    if (!isAuthenticated || !lab) return;
    // The server currently stores lab-level flags, not lesson completion.
    if (lesson.type === 'video' && videoUrl) markVideoWatched(lab.id).catch(() => {});
    if (lesson.type === 'document') markDocViewed(lab.id).catch(() => {});
  }, [isAuthenticated, lab, lesson.type, videoUrl, markVideoWatched, markDocViewed]);

  if (!lab) return <div>Lab không tồn tại</div>;
  const scopedEditor = isValidElement(editorPanel) ? cloneElement(editorPanel, {
    key: lesson.id, exerciseId: lesson.type === 'practice' ? lesson.id : '', legacyFallback: lesson.id === firstPractice?.id,
  }) : editorPanel;

  return <div className="player-layout">
    <CourseSidebar currentLabId={lab.id} activeLesson={lesson.id} onSelectLesson={selectLesson} />
    <div className="player-main" ref={mainRef}>
      <TelemetryControls />
      {lab.id === 0 ? <nav className="lab-mobile-lessons" aria-label="Nội dung Lab 0">
        {lessons.map(item => <button key={item.id} type="button" className={lesson.id === item.id ? 'active' : ''} aria-current={lesson.id === item.id ? 'page' : undefined} onClick={() => selectLesson(item.id)}>{item.title}</button>)}
      </nav> : <div className="lab-mobile-lessons lab-mobile-lessons--curriculum">
        <label htmlFor={`lab-${lab.id}-lesson`}>Nội dung Lab {lab.id} · {lessons.length} phần</label>
        <select id={`lab-${lab.id}-lesson`} value={lesson.id} onChange={event => selectLesson(event.target.value)}>
          {lessons.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.label} · {item.exerciseCode || item.title}</option>)}
        </select>
      </div>}

      <div className="lab-course-view animate-fadeInUp" key={`${lab.id}:${lesson.id}`}>
        <LabStateTitle lab={lab} lesson={lesson} position={lessonIndex + 1} />
        {lesson.type === 'video' && <>
          <section className="lab-workspace lab-video-workspace" aria-label={`${lesson.label}: ${lesson.title}`}>
            <span className="lab-workspace-badge lab-play-badge" aria-hidden="true">▶</span>
            <div className="lab-video-surface"><VideoPlayer url={videoUrl} /></div>
          </section>
          <section className="lesson-reading-card"><h2>Mục tiêu Lab {lab.id}</h2><p>{lab.description}</p><p>Nội dung phần này: {lesson.title}.</p></section>
        </>}
        {lesson.type === 'document' && <section className="lab-workspace lab-doc-workspace" aria-label={`${lesson.label}: ${lesson.title}`}>
          <span className="lab-workspace-badge" aria-hidden="true">▤</span>
          <div className="lab-doc-surface"><DocViewer key={lesson.id} docPath={lab.id === 0 ? lab.docPath : undefined} content={lab.id === 0 ? '' : lessonReadingContent(lab, lesson)} /></div>
        </section>}
        {lesson.type === 'components' && <section className="lab-workspace lab-components-workspace" aria-label="Khám phá các phân hệ CubeSat">{visualizationPanel}</section>}
        {lesson.type === 'practice' && <>
          <section className="lesson-practice-brief" aria-label="Yêu cầu bài thực hành">
            <div><h2>Yêu cầu thực hành</h2><p>{lesson.title}.</p><p>Tự viết C++ hoặc kéo thả Blockly, biên dịch đúng board và đối chiếu kết quả qua Serial/bảng dữ liệu. Mỗi bài có bản lưu riêng trên trình duyệt.</p></div>
            <a href={lesson.repositoryUrl} target="_blank" rel="noreferrer">Hướng dẫn trên PTITCube ↗</a>
          </section>
          <section className={`lab-workspace lab-practice-workspace lab-practice-workspace--${practiceVariant}`} aria-label={`Không gian thực hành ${lesson.exerciseCode}`}>
            <div className={`lab-practice-panels lab-practice-panels--${practiceVariant}`}>
              <div className="lab-practice-editor">
                <div className="lab-practice-editor-frame">{scopedEditor}</div>
                {practiceVariant !== 'split' && <div className="lab-practice-actions lab-practice-actions--inline" aria-label="Thao tác thực hành" key={lesson.id}>{practiceActions}</div>}
              </div>
              <div className="lab-practice-visualization">{visualizationPanel}</div>
            </div>
            {practiceVariant === 'split' && <div className="lab-practice-actions" aria-label="Thao tác thực hành" key={lesson.id}>{practiceActions}</div>}
          </section>
        </>}
        {lesson.type === 'summary' && <section className="lesson-reading-card">
          <h2>Kết quả cần đạt</h2><p>{lesson.description}</p>
          <h2>Đối chiếu các bài thực hành</h2><p>Kiểm tra mã biên dịch, lưu lại kết quả quan sát và giải thích cách chương trình đáp ứng yêu cầu của từng bài.</p>
          <ul className="lesson-summary-list">{lessons.filter(item => item.type === 'practice').map(item => <li key={item.id}><button type="button" onClick={() => selectLesson(item.id)}><code>{item.exerciseCode}</code><span>{item.title}</span></button></li>)}</ul>
          <p>Lưu mã .ino, file Blockly và kết quả kiểm thử để đưa vào báo cáo Lab {lab.id}.</p>
        </section>}
        {lab.id > 0 && <p className="lesson-source">Lộ trình và bài thực hành: <a href="https://github.com/PTITCube" target="_blank" rel="noreferrer">PTITCube</a>. Video được hiển thị khi có đường dẫn bài giảng.</p>}
        <nav className="lesson-pagination" aria-label="Chuyển phần học">
          <button type="button" disabled={lessonIndex === 0} onClick={() => selectLesson(lessons[lessonIndex - 1].id)}>← Phần trước</button>
          <span>{lessonIndex + 1} / {lessons.length} · {LESSON_TYPE_LABELS[lesson.type]}</span>
          <button type="button" disabled={lessonIndex === lessons.length - 1} onClick={() => selectLesson(lessons[lessonIndex + 1].id)}>Phần tiếp theo →</button>
        </nav>
      </div>
    </div>
  </div>;
}
