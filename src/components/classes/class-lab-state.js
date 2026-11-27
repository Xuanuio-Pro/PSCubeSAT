// Sidebar / mobile picker state of one lab in a class curriculum response.
export function stateFor(lab, unlockedView = false) {
  const lessons = lab.lessons || [];
  const allLessonsLocked = lessons.length > 0 && lessons.every(item => item.access === 'locked' || !item.content);
  if (!unlockedView && (lab.access === 'locked' || allLessonsLocked)) return { status: 'locked', label: 'Đang khóa', done: 0, total: lessons.length };
  if (unlockedView) return { status: 'in-progress', label: 'Mở toàn bộ', done: lessons.filter(item => ['completed', 'waived'].includes(item.progress?.status)).length, total: lessons.length };
  const completed = lessons.filter(item => item.access !== 'locked' && ['completed', 'waived'].includes(item.progress?.status)).length;
  if (lessons.length > 0 && completed === lessons.length) return { status: 'completed', label: 'Đã hoàn thành', done: completed, total: lessons.length };
  return { status: 'in-progress', label: `Đang học (${lessons.length ? Math.round((completed / lessons.length) * 100) : 0}%)`, done: completed, total: lessons.length };
}

// First lesson to open when a lab is picked: an available one, else any unlocked one, else the first.
export function classLabEntryLesson(lab, unlockedView = false) {
  return lab.lessons?.find(item => unlockedView || (item.access === 'available' && item.content))
    || lab.lessons?.find(item => unlockedView || (item.access !== 'locked' && item.content))
    || lab.lessons?.[0];
}
