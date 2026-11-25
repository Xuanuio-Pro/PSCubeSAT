import { sourceKey, loadDraft } from '../editor/project-files.js';

export function getLessonExercises(lesson) {
  if (!lesson || lesson.type !== 'practice') return [];
  const content = lesson.content || {};
  const list = Array.isArray(lesson.exercises) && lesson.exercises.length > 0
    ? lesson.exercises
    : Array.isArray(content.exercises) && content.exercises.length > 0
      ? content.exercises
      : null;
  if (list) {
    return list.map(ex => ({
      id: ex.id,
      label: ex.label || ex.id,
      title: ex.title || ex.id,
      description: ex.description || ex.title || '',
      exerciseCode: ex.exerciseCode || ex.id,
      repositoryUrl: ex.repositoryUrl || ex.repository_url || '',
    }));
  }
  const singleId = lesson.exerciseCode || content.exercise_id || '';
  if (singleId) {
    const desc = lesson.description || content.description || '';
    return [{
      id: singleId,
      label: singleId,
      title: desc ? `${singleId}: ${desc}` : lesson.title || singleId,
      description: desc || lesson.title || '',
      exerciseCode: singleId,
      repositoryUrl: lesson.repositoryUrl || content.repository_url || '',
    }];
  }
  return [];
}

export function resolveLessonAndExercise(lessons = [], requestedLessonId = '', requestedExerciseId = '') {
  if (!lessons.length) return { lesson: null, exercises: [], activeExercise: null };
  let lesson = lessons.find(item => item.id === requestedLessonId);
  let matchedChildId = '';
  if (!lesson && requestedLessonId) {
    lesson = lessons.find(item => getLessonExercises(item).some(ex => ex.id === requestedLessonId));
    if (lesson) matchedChildId = requestedLessonId;
  }
  if (!lesson) lesson = lessons[0];
  const exercises = getLessonExercises(lesson);
  const targetExId = matchedChildId || requestedExerciseId;
  const activeExercise = exercises.find(ex => ex.id === targetExId) || exercises[0] || null;
  return { lesson, exercises, activeExercise };
}

export function readStoredCppDraft(labId, exerciseId, storageScope = '') {
  try {
    const raw = loadDraft(sourceKey, labId, exerciseId, storageScope);
    if (!raw) return '';
    const saved = JSON.parse(raw);
    if (saved?.version === 2 && typeof saved.code === 'string') return saved.code;
    if (saved?.mode === 'manual' && typeof saved.manualCode === 'string') return saved.manualCode;
  } catch {
    return '';
  }
  return '';
}

export function buildGroupedSubmissionCode({
  exercises = [],
  labId,
  storageScope = '',
  activeExerciseId = '',
  activeCode = '',
}) {
  if (!exercises.length || exercises.length === 1) return activeCode;
  const sections = [];
  let hasAnyCode = false;
  for (const ex of exercises) {
    const liveOrStored = ex.id === activeExerciseId && String(activeCode || '').trim()
      ? activeCode
      : readStoredCppDraft(labId, ex.id, storageScope);
    const trimmed = String(liveOrStored || '').trim();
    if (trimmed) hasAnyCode = true;
    sections.push(`// === ${ex.id} ===\n${trimmed ? liveOrStored : `// (Chưa có mã nguồn cho ${ex.id})`}`);
  }
  return hasAnyCode ? sections.join('\n\n') : '';
}
