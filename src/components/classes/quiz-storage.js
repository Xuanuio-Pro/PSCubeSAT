// Only learner selections are stored here. Question/answer keys remain on the server.
export function quizCacheKey(userId, classId, attemptId, tabId = 'default') {
  return `cubesat:quiz:${userId}:${classId}:${attemptId}:${tabId}`;
}

export function quizTabId(storage) {
  try {
    const previous = storage.getItem('cubesat:quiz-tab');
    if (previous) return previous;
    const id = crypto.randomUUID();
    storage.setItem('cubesat:quiz-tab', id);
    return id;
  } catch { return crypto.randomUUID(); }
}

export function readQuizCache(storage, key, attempt) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (!value || typeof value.dirty !== 'object' || !value.dirty) return { dirty: {}, pending: null };
    const valid = Object.fromEntries(Object.entries(value.dirty).filter(([id, choice]) =>
      attempt.items.some(item => item.id === id && item.choices.some(option => option.id === choice))));
    const pending = value.pending;
    if (pending && (typeof pending.idempotency_key !== 'string' || !Number.isInteger(pending.expected_revision)
      || !pending.answers || Object.entries(pending.answers).some(([id, choice]) =>
        !attempt.items.some(item => item.id === id && item.choices.some(option => option.id === choice))))) return { dirty: valid, pending: null };
    return { dirty: valid, pending: pending || null };
  } catch { return { dirty: {}, pending: null }; }
}

export function acknowledge(dirty, saved) {
  return Object.fromEntries(Object.entries(dirty).filter(([id, choice]) => saved[id] !== choice));
}
