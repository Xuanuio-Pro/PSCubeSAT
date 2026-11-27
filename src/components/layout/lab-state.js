import { isSequentialLesson } from '../lessons/lesson-sequence';

// Lock/progress state of a legacy /labN entry; shared with the mobile lab picker in LabLayout.
export function legacyLabState(labs, lab, progress = [], userRole) {
  const progressFor = candidate => progress.find(item => item.lab_id === candidate.id);
  const isPrivileged = userRole === 'teacher' || userRole === 'admin';
  const item = progressFor(lab);
  const sequentialTotal = (lab.lessons || []).filter(isSequentialLesson).length;
  if (item?.completed_at) return { status: 'completed', label: 'Đã hoàn thành', done: sequentialTotal, total: sequentialTotal };
  const previous = labs.find(candidate => candidate.id === lab.id - 1);
  const previousProgress = previous && progressFor(previous);
  if (previous && !isPrivileged && !previousProgress?.completed_at) return { status: 'locked', label: 'Chưa mở', done: 0, total: sequentialTotal };
  const lessons = (lab.lessons || []).filter(isSequentialLesson);
  // Lab 0 keeps honouring the older lab-level video/doc flags for its first video and document.
  const legacyFlag = id => lab.id === 0 && ((id === 'overview' && item?.video_watched) || (id === 'document' && item?.doc_viewed));
  const completedLessonsCount = lessons.filter(lesson => Boolean(item?.lessons?.[lesson.id]?.completed) || legacyFlag(lesson.id)).length;
  const percent = lessons.length > 0 ? Math.round((completedLessonsCount / lessons.length) * 100) : 0;
  return { status: 'in-progress', label: `Đang học (${percent}%)`, done: completedLessonsCount, total: lessons.length };
}
