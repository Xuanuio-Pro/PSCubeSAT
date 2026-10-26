import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledge, quizCacheKey, readQuizCache } from '../src/components/classes/quiz-storage.js';

test('offline cache is scoped by user, class and attempt', () => {
  assert.notEqual(quizCacheKey(1, 2, 'a'), quizCacheKey(2, 2, 'a'));
  assert.notEqual(quizCacheKey(1, 2, 'a'), quizCacheKey(1, 3, 'a'));
  assert.notEqual(quizCacheKey(1, 2, 'a'), quizCacheKey(1, 2, 'b'));
  assert.notEqual(quizCacheKey(1, 2, 'a', 'tab1'), quizCacheKey(1, 2, 'a', 'tab2'));
});
test('a late acknowledgement cannot erase a more recent local selection', () => {
  assert.deepEqual(acknowledge({ one: 'b', two: 'a' }, { one: 'a', two: 'a' }), { one: 'b' });
});
test('reconnect preserves the original pending request key but rejects foreign selections', () => {
  const attempt = { items: [{ id: 'one', choices: [{ id: 'a' }, { id: 'b' }] }] };
  const pending = { idempotency_key: 'same-key-after-refresh', expected_revision: 3, answers: { one: 'a' } };
  const storage = { getItem: () => JSON.stringify({ dirty: { one: 'b', foreign: 'a' }, pending }) };
  assert.deepEqual(readQuizCache(storage, 'key', attempt), { dirty: { one: 'b' }, pending });
  assert.deepEqual(readQuizCache({ getItem: () => '{broken' }, 'key', attempt), { dirty: {}, pending: null });
});
