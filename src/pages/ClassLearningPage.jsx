import { lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { request, useAuth } from '../contexts/auth-api';
import { TelemetryContext } from '../contexts/telemetry-api';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';
import EmptyState from '../components/common/EmptyState';
import DocViewer from '../components/common/DocViewer';
import VideoPlayer from '../components/common/VideoPlayer';
import TelemetryControls from '../components/groundstation/TelemetryControls';
import { downloadFile } from '../components/editor/project-files';
import ClassCourseSidebar from '../components/classes/ClassCourseSidebar';
import { classLabEntryLesson, stateFor as classLabState } from '../components/classes/class-lab-state';
import { MobileLabPicker } from '../components/layout/SidebarShared';
import LabFigView from '../components/layout/LabFigView';
import PracticeExerciseTabs from '../components/lessons/PracticeExerciseTabs';
import {
  buildGroupedSubmissionCode,
  getLessonExercises,
  resolveLessonAndExercise,
} from '../components/lessons/practice-exercises';

const QuizPanel = lazy(() => import('../components/classes/QuizPanel'));
const IDEPanel = lazy(() => import('../components/editor/IDEPanel'));
const LabPracticeActions = lazy(() => import('../components/editor/LabPracticeActions'));
const PracticeVisualization = lazy(() => import('../components/visualization/PracticeVisualization'));
const ComponentViewer = lazy(() => import('../components/interactive/ComponentViewer'));
const types = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', quiz: 'Câu hỏi', labtest: 'Lab test' };

// Requirement, evidence, rubric and the sample download: shown in "Mục tiêu bài học" at the top of the page.
function PracticeBrief({ lesson, classId, exercises = [], activeExercise = null }) {
  const [error, setError] = useState('');
  const content = lesson.content;
  const downloadId = activeExercise?.id || content.exercise_id || lesson.id;
  async function download() {
    try {
      const response = await fetchSource(downloadId, classId);
      downloadFile(`${downloadId}.ino`, response, 'text/plain');
    } catch (failure) { setError(failure.message); }
  }
  const hasDownload = content.mode === 'hardware' && downloadId;
  // Nothing written for this lesson yet: hide the "Mục tiêu bài học" box instead of showing an internal note.
  if (!content.instructions && !activeExercise?.description && !content.evidence && !content.rubric && !hasDownload) return null;
  return <div className="fig-goal-practice">
    <div>
      {activeExercise && exercises.length > 1 && (
        <p className="practice-brief-active"><strong>Bài con đang chọn:</strong> <code>{activeExercise.id}</code> — {activeExercise.description}</p>
      )}
      {content.instructions ? <DocViewer content={content.instructions} docPath={undefined} /> : activeExercise?.description ? <p>{activeExercise.description}</p> : null}
      {content.evidence && <p><strong>Minh chứng:</strong> {content.evidence}</p>}
      {content.rubric && <details className="fig-goal-rubric"><summary>Tiêu chí chấm</summary><DocViewer content={content.rubric} docPath={undefined} /></details>}
    </div>
    {hasDownload && <div className="lesson-example-links">
      <button type="button" className="btn btn-sm btn-outline" onClick={download}>Tải mã mẫu ESP32 (.ino)</button><Notice error={error} />
    </div>}
  </div>;
}

// Device bar + two-column workspace (code and actions | live visualization), as on the lab pages.
function Practice({ lesson, labId, classId, preview, staffView, onRefresh, exercises = [], activeExercise = null, onSelectExercise }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const content = lesson.content;
  const variant = labId === 8 ? 'dashboard' : 'rich';
  const exerciseId = activeExercise?.id || lesson.id;
  const storageScope = `user:${user?.id || 'staff'}:class:${classId}`;
  if (content.mode === 'exploration') return <Suspense fallback={<p>Đang tải mô hình…</p>}><ComponentViewer /></Suspense>;
  if (content.mode === 'assembly') return <p>Bài lắp ráp cơ khí không cần viết mã: làm theo video hướng dẫn và nộp ảnh sản phẩm hoàn thiện cho giảng viên theo hướng dẫn của lớp.</p>;
  if (preview && !staffView) return <p>Chế độ xem thử chỉ hiển thị yêu cầu và tiêu chí; không biên dịch hoặc ghi tiến độ.</p>;
  return <Suspense fallback={<p>Đang tải không gian thực hành…</p>}>
    <PracticeExerciseTabs exercises={exercises} activeExercise={activeExercise} onSelect={onSelectExercise} />
    <TelemetryControls />
    <section className={`lab-workspace lab-practice-workspace lab-practice-workspace--${variant}`} aria-label={`Không gian thực hành ${exerciseId}`}>
      <div className={`lab-practice-panels lab-practice-panels--${variant}`}>
        <div className="lab-practice-editor">
          <div className="lab-practice-editor-frame">
            <IDEPanel labId={labId} exerciseId={exerciseId} storageScope={storageScope} setCode={setCode} variant="workspace" showToolbar={false} />
          </div>
          <div key={exerciseId} className="lab-practice-actions lab-practice-actions--inline" aria-label="Thao tác thực hành">
            <LabPracticeActions code={code} labId={labId} classId={Number(classId)} lessonId={lesson.id} configuredBoard={content.board || ''} />
          </div>
          {!staffView && <SubmissionPanel classId={classId} lessonId={lesson.id} labId={labId} storageScope={storageScope} exercises={exercises} activeExerciseId={exerciseId} code={code} rubric={content.rubric} onRefresh={onRefresh} />}
        </div>
        <div className="lab-practice-visualization"><PracticeVisualization /></div>
      </div>
    </section>
  </Suspense>;
}

function SubmissionPanel({ classId, lessonId, labId, storageScope, exercises = [], activeExerciseId = '', code, rubric, onRefresh }) {
  const url = `/api/classes/${classId}/lessons/${encodeURIComponent(lessonId)}/submissions`;
  const { data, error, reload } = useLmsResource(url);
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  const submissionCode = buildGroupedSubmissionCode({
    exercises,
    labId,
    storageScope,
    activeExerciseId,
    activeCode: code,
  });
  async function submit() {
    setBusy(true); setNotice({});
    if (!pending.current || pending.current.code !== submissionCode) pending.current = { code: submissionCode, idempotency_key: crypto.randomUUID() };
    try {
      await request(url, { method: 'POST', body: JSON.stringify(pending.current) });
      pending.current = null; reload(); onRefresh(); setNotice({ message: 'Đã nộp phiên bản mã nguồn. Bài đang chờ giảng viên duyệt.' });
    } catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  return <section className="submission-panel"><h3>Bài nộp của tôi</h3>
    <p>{exercises.length > 1
      ? `Biên dịch thành công chưa hoàn thành bài. Nút nộp bên dưới sẽ gộp mã nguồn từ tất cả ${exercises.length} bài con (${exercises.map(ex => ex.id).join(', ')}) đã lưu trên trình duyệt để giảng viên duyệt một lần.`
      : 'Biên dịch thành công chưa hoàn thành bài. Giảng viên sẽ duyệt theo tiêu chí đã giao.'}</p>
    <button disabled={busy || !submissionCode.trim() || !rubric} onClick={submit}>{busy ? 'Đang nộp…' : 'Nộp phiên bản mã nguồn'}</button>
    {!rubric && <p>Giảng viên cần bổ sung tiêu chí chấm trước khi bạn nộp bài.</p>}<Notice {...notice} /><Notice error={error} />
    {data?.map(item => <details key={item.id}><summary>Phiên bản {item.revision} · {{ pending_review: 'Chờ chấm', approved: 'Đã duyệt', changes_requested: 'Cần sửa' }[item.status]}</summary><p>{item.feedback || 'Chưa có nhận xét.'}</p><pre>{item.code}</pre></details>)}
  </section>;
}

function LessonContent({ lesson, labId, classId, preview, staffView = false, onRefresh, fig, exercises = [], activeExercise = null, onSelectExercise }) {
  const telemetry = useContext(TelemetryContext);
  const [notice, setNotice] = useState({});
  const isSummaryLesson = String(lesson.id || '').startsWith('summary-') || /^Tổng hợp\b/i.test(lesson.title || '');
  const [startedAt, setStartedAt] = useState(lesson.progress?.started_at || null);
  const [remainingSeconds, setRemainingSeconds] = useState(isSummaryLesson ? 0 : (lesson.progress?.remaining_seconds ?? 60));
  const openedKey = useRef(crypto.randomUUID());
  const queue = useRef(Promise.resolve());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const nextId = lesson.type === 'practice' && activeExercise?.id ? activeExercise.id : '';
    telemetry?.setActiveExerciseId(nextId);
    return () => telemetry?.setActiveExerciseId('');
  }, [telemetry, lesson.type, activeExercise?.id]);
  const event = useCallback(async (kind, values = {}, key = crypto.randomUUID()) => {
    const body = JSON.stringify({ idempotency_key: key, kind, ...values });
    // Retrying the exact key is safe if a response is lost after the server commits.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await request(`/api/classes/${classId}/lessons/${encodeURIComponent(lesson.id)}/events`, { method: 'POST', body });
        if (response.started_at) setStartedAt(response.started_at);
        if (typeof response.remaining_seconds === 'number') setRemainingSeconds(response.remaining_seconds);
        return response;
      }
      catch (failure) { if (failure.status || attempt) throw failure; }
    }
  }, [classId, lesson.id]);
  useEffect(() => {
    if (!preview && !staffView) event('opened', {}, openedKey.current).catch(failure => setNotice({ error: failure.message }));
  }, [preview, staffView, event]);
  useEffect(() => {
    if (isSummaryLesson) { setRemainingSeconds(0); return undefined; }
    if (!startedAt || ['completed', 'waived'].includes(lesson.progress?.status)) return undefined;
    const update = () => setRemainingSeconds(Math.max(0, 60 - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isSummaryLesson, startedAt, lesson.progress?.status]);
  async function confirm(kind) {
    setBusy(true); setNotice({});
    try { await event(kind); onRefresh(); setNotice({ message: 'Đã ghi nhận hoàn thành bài học.' }); }
    catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  function segment(start, end, position) {
    if (preview) return;
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        const progress = await event('video_segment', { start, end, position });
        if (progress.status === 'completed' && !['completed', 'waived'].includes(lesson.progress?.status)) onRefresh();
      } catch (failure) { setNotice({ error: failure.message }); }
    });
  }
  const completed = ['completed', 'waived'].includes(lesson.progress?.status);
  const completionLocked = busy || completed || remainingSeconds > 0;
  const elapsedSeconds = Math.max(0, 60 - remainingSeconds);
  const completionLabel = completed
    ? '✓ Đã hoàn thành bài học'
    : remainingSeconds > 0
      ? `Đã học ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} · còn ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
      : 'Hoàn thành bài học';
  const unmeasuredVideo = lesson.type === 'video' && !preview && !lesson.content.confirmation_allowed && !/\.(mp4|webm|ogg|ogv)(?:\?|#|$)/i.test(lesson.content.url || '');
  const bodyNode = lesson.type === 'practice' ? <Practice lesson={lesson} labId={labId} classId={classId} preview={preview} staffView={staffView} onRefresh={onRefresh} exercises={exercises} activeExercise={activeExercise} onSelectExercise={onSelectExercise} />
    : lesson.type === 'quiz' ? (preview || !lesson.content.bank_ready
      ? <EmptyState icon="question" compact
        text={staffView ? 'Giảng viên và quản trị viên không làm bài ở đây (không tạo lượt làm bài). Mở ngân hàng câu hỏi để xem và soạn câu hỏi của mục này.' : preview ? 'Chế độ xem thử không tạo lượt làm bài.' : 'Câu hỏi kiểm tra của mục này chưa sẵn sàng. Giảng viên sẽ bổ sung sớm.'}
        action={staffView ? <Link to={`/classes/${classId}/lessons/${encodeURIComponent(lesson.id)}/questions`}>Mở ngân hàng câu hỏi</Link> : null} />
      : <Suspense fallback={<p>Đang tải câu hỏi…</p>}><QuizPanel classId={classId} labId={labId} lessonId={lesson.id} title={lesson.title} policySummary={lesson.content} onRefresh={onRefresh} /></Suspense>)
      : lesson.type === 'labtest' ? (preview ? <EmptyState icon="question" compact
        text={`${staffView ? 'Giảng viên / quản trị viên không làm bài ở đây (không tạo lượt thi sinh viên). ' : 'Chế độ xem thử không tạo lượt thi. '}Mỗi đề gồm tối đa ${lesson.content.num_questions || 20} câu rút ngẫu nhiên · ${lesson.content.time_limit_minutes || 20} phút · đạt từ ${lesson.content.pass_score || 16} câu đúng · ${lesson.content.max_attempts == null ? 'không giới hạn lượt' : `${lesson.content.max_attempts} lượt/đợt${lesson.content.cooldown_minutes > 0 ? ` (chờ ${lesson.content.cooldown_minutes} phút khi hết lượt)` : ''}`}.`}
        action={staffView ? <Link to={`/classes/${classId}/labs/${labId}/questions`}>Mở ngân hàng câu hỏi Lab {labId}</Link> : null} /> : <Suspense fallback={<p>Đang tải bài kiểm tra…</p>}><QuizPanel classId={classId} labId={labId} policySummary={lesson.content} onRefresh={onRefresh} /></Suspense>)
        : null;
  return <LabFigView {...fig} lesson={lesson}
    noticeNode={<>{fig.noticeNode}<Notice {...notice} />
      {completed && <p className="lesson-achieved" role="status">✓ {lesson.progress.status === 'waived' ? 'Đã được miễn yêu cầu' : 'Đã hoàn thành'}</p>}
      {unmeasuredVideo && <p className="lesson-achieved" role="status">Nguồn video này chưa hỗ trợ đo đoạn xem. Giảng viên cần bật chế độ xác nhận hoặc cung cấp video đo được.</p>}</>}
    videoNode={lesson.type === 'video' ? <VideoPlayer url={lesson.content.url} initialPosition={lesson.progress?.last_position || 0} onSegment={preview ? undefined : segment} trackingMode={lesson.content.tracking_mode || 'native'} /> : null}
    docNode={lesson.type === 'document' ? <DocViewer content={lesson.content.markdown || '# Tài liệu đang được cập nhật'} docPath={undefined} /> : null}
    bodyNode={bodyNode} goalNode={lesson.type === 'practice' ? <PracticeBrief lesson={lesson} classId={classId} exercises={exercises} activeExercise={activeExercise} /> : null}
    showComplete={!preview && !staffView && lesson.type !== 'quiz'}
    canComplete={!completionLocked} completed={completed} completeLesson={() => confirm('complete')}
    completeLabel={completed ? '' : completionLabel} completeError="" remainingSeconds={remainingSeconds}
  />;
}

async function fetchSource(lessonId, classId) {
  const { authorizedFetch } = await import('../contexts/auth-api');
  const response = await authorizedFetch(`/api/curriculum/exercises/${encodeURIComponent(lessonId)}/source?class_id=${classId}`);
  if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Không tải được mã mẫu.'); }
  return response.text();
}

export default function ClassLearningPage({ experience = false }) {
  const { classId } = useParams();
  const { user } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [navigationNotice, setNavigationNotice] = useState('');
  const mainRef = useRef(null);
  const preview = experience || search.get('preview') === 'true';
  const path = experience ? '/api/curriculum/preview' : `/api/classes/${classId}/curriculum${preview ? '?draft=true&student_view=true' : '?student_view=true'}`;
  const { data, loading, error, reload } = useLmsResource(path, true);
  const isPrivileged = user?.role === 'teacher' || user?.role === 'admin' || Boolean(data && !data.learning_path && !experience);
  const allLessons = data?.labs.flatMap(lab => lab.lessons.map(lesson => ({ lab, lesson }))) || [];
  const requestedLessonParam = search.get('lesson') || '';
  const requestedExerciseParam = search.get('exercise') || '';
  const { lesson: matchedLesson, activeExercise: resolvedExerciseFromParam } = resolveLessonAndExercise(
    allLessons.map(item => item.lesson),
    requestedLessonParam,
    requestedExerciseParam,
  );
  const requestedItem = requestedLessonParam
    ? allLessons.find(item => item.lesson.id === matchedLesson?.id && (
      item.lesson.id === requestedLessonParam || getLessonExercises(item.lesson).some(ex => ex.id === requestedLessonParam)
    ))
    : null;
  const requestedLocked = Boolean(requestedItem && !isPrivileged && (requestedItem.lesson.access === 'locked' || !requestedItem.lesson.content));
  const continueItem = allLessons.find(item => item.lesson.id === data?.learning_path?.continue_lesson_id && (isPrivileged || (item.lesson.access !== 'locked' && item.lesson.content)));
  const firstAvailableItem = allLessons.find(item => isPrivileged || (item.lesson.access !== 'locked' && item.lesson.content));
  const selected = (!requestedLocked && requestedItem) || continueItem || firstAvailableItem || allLessons[0] || null;
  const selectedLabId = selected?.lab?.id;
  const selectedLessonId = selected?.lesson?.id;
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [selectedLabId, selectedLessonId]);
  useEffect(() => {
    if (requestedLocked && selected && selected.lesson.id !== search.get('lesson')) {
      setNavigationNotice('Bạn cần hoàn thành bài học trước để mở khóa bài này.');
      const next = new URLSearchParams(search);
      next.set('lesson', selected.lesson.id);
      next.delete('exercise');
      setSearch(next, { replace: true });
    }
  }, [requestedLocked, selected, search, setSearch]);
  if (loading && !data) return <p role="status">Đang tải chương trình học…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  const activeLessons = selected?.lab?.lessons || [];
  const lessonIndex = selected ? activeLessons.findIndex(lesson => lesson.id === selected.lesson.id) : -1;
  const selectedExercises = selected ? getLessonExercises(selected.lesson) : [];
  const selectedActiveExercise = (selected && matchedLesson?.id === selected.lesson.id && resolvedExerciseFromParam) || selectedExercises[0] || null;
  const selectLesson = lessonId => {
    const targetItem = allLessons.find(item => item.lesson.id === lessonId || getLessonExercises(item.lesson).some(ex => ex.id === lessonId));
    const target = targetItem?.lesson;
    if (!target || (!isPrivileged && (target.access === 'locked' || !target.content))) return;
    const targetCompleted = ['completed', 'waived'].includes(target.progress?.status);
    const sameLab = selected?.lab.id === targetItem.lab.id;
    const targetIsEarlier = sameLab && targetItem.lab.lessons.findIndex(lesson => lesson.id === target.id) < lessonIndex;
    if (selected && target.id !== selected.lesson.id && !preview && !isPrivileged && !targetCompleted && !targetIsEarlier && !['completed', 'waived'].includes(selected.lesson.progress?.status)) {
      setNavigationNotice('Hãy hoàn thành bài học hiện tại trước khi chuyển sang phần tiếp theo.');
      return;
    }
    setNavigationNotice('');
    const next = new URLSearchParams(search);
    next.set('lesson', target.id);
    if (lessonId !== target.id) next.set('exercise', lessonId);
    else next.delete('exercise');
    setSearch(next);
  };
  const selectExercise = exId => {
    const next = new URLSearchParams(search);
    if (selected?.lesson) next.set('lesson', selected.lesson.id);
    next.set('exercise', exId);
    setSearch(next);
  };
  return <div className="player-layout class-player-layout">
    <ClassCourseSidebar labs={data?.labs || []} classId={classId} homePath={experience ? '/' : `/classes/${classId}`} activeLesson={selected?.lesson.id} onSelectLesson={selectLesson} unlockedView={isPrivileged} />
    <div className="player-main" ref={mainRef}>
      {selected && <div className="lab-mobile-lessons lab-mobile-lessons--curriculum">
        <MobileLabPicker id={`class-${classId}-lab`} labs={data?.labs || []} currentLabId={selected.lab.id}
          isLocked={lab => classLabState(lab, isPrivileged).status === 'locked'}
          onPick={labId => { const lab = data.labs.find(item => item.id === labId); const target = lab && classLabEntryLesson(lab, isPrivileged); if (target) selectLesson(target.id); }} />
        <label htmlFor={`class-${classId}-lesson`}>Nội dung Lab {selected.lab.id} · {activeLessons.length} phần</label>
        <select id={`class-${classId}-lesson`} value={selected.lesson.id} onChange={event => selectLesson(event.target.value)}>
          {activeLessons.map((lesson, index) => <option key={lesson.id} value={lesson.id} disabled={!isPrivileged && (lesson.access === 'locked' || !lesson.content)}>{index + 1}. {types[lesson.type]} · {lesson.title}</option>)}
        </select>
      </div>}
      {!selected ? <div className="lab-course-view animate-fadeInUp">
        {navigationNotice && <Notice error={navigationNotice} />}
        <header className="class-learning-heading"><div><small>{experience ? 'Trải nghiệm CubeSAT' : 'Chương trình học của lớp'}</small><h1>Chương trình học của lớp</h1></div><Link to={experience ? '/classes' : `/classes/${classId}`}>Về lớp học</Link></header><p>Chưa có bài học được bật.</p>
      </div> : (() => {
        const percent = Math.round(selected.lab.percent || 0);
        const lessonKey = `${classId}:${selected.lesson.id}`;
        const fig = {
          lab: { id: selected.lab.id, title: selected.lab.title, description: selected.lab.objectives || '' },
          lessons: activeLessons, lessonIndex, selectLesson,
          showProgress: !isPrivileged, completionPercent: percent, progressText: `${percent}% tiến độ đã hoàn thành`,
          noticeNode: navigationNotice ? <Notice error={navigationNotice} /> : null,
        };
        return <>
          {!selected.lesson.content
            ? <LabFigView key={lessonKey} {...fig} lesson={selected.lesson} showComplete={false}
              lockedNode={<div className="fig-body-text"><p>Bạn cần hoàn thành bài học trước để mở khóa bài này.</p>{(selected.lesson.reason || selected.lab.reason) && <small>{selected.lesson.reason || selected.lab.reason}</small>}</div>} />
            : <LessonContent key={lessonKey} fig={fig} lesson={selected.lesson} labId={selected.lab.id} classId={classId} preview={preview || isPrivileged} staffView={isPrivileged} onRefresh={reload} exercises={selectedExercises} activeExercise={selectedActiveExercise} onSelectExercise={selectExercise} />}
          {!experience && <Link className="class-learning-path-link" to={`/classes/${classId}/path`}>Lộ trình và tiến độ học tập</Link>}
        </>;
      })()}
    </div>
  </div>;
}
