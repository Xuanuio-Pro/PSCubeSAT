import test from 'node:test';
import assert from 'node:assert/strict';
import { LAB_QUESTION_SETS, getLabQuestionSet, labQuestionsUrl } from '../src/data/lab-questions.js';
import { CURRICULUM, getExercisesForLab } from '../src/data/curriculum.js';

const practiceIds = labId => getExercisesForLab(labId).map(item => item.id);

test('every lab 0-8 has an end-of-lab question outline with doc and practice checkpoints', () => {
  for (let labId = 0; labId <= 8; labId++) {
    const set = getLabQuestionSet(labId);
    assert.ok(set, `Lab ${labId} has no question set`);
    assert.ok(set.summary.length > 10);
    assert.ok(set.checkpoints.some(item => item.kind === 'doc'), `Lab ${labId} lacks a doc checkpoint`);
    assert.ok(set.checkpoints.some(item => item.kind === 'practice'), `Lab ${labId} lacks a practice checkpoint`);
    const ids = set.checkpoints.map(item => item.id);
    assert.equal(new Set(ids).size, ids.length, `Lab ${labId} has duplicate checkpoint ids`);
    for (const item of set.checkpoints) {
      assert.match(item.label, /^Câu hỏi kiểm tra /);
      assert.ok(item.topics.length > 20, `${item.id} needs topic text`);
    }
  }
  assert.equal(getLabQuestionSet(9), null);
  assert.equal(labQuestionsUrl(3), '/lab3/questions');
});

test('practice checkpoints reference real exercises of the same lab and cover each exercise once', () => {
  for (let labId = 1; labId <= 8; labId++) {
    const expected = practiceIds(labId);
    const referenced = LAB_QUESTION_SETS[labId].checkpoints.flatMap(item => item.exercises);
    for (const id of referenced) assert.ok(expected.includes(id), `Lab ${labId}: ${id} is not an exercise of this lab`);
    assert.deepEqual([...referenced].sort(), [...expected].sort(), `Lab ${labId}: exercises missing from or repeated in checkpoints`);
  }
});

test('question outline never carries answers or explanations into the browser bundle', () => {
  const forbidden = /^(correct|answer|answers|answer_key|correct_answer|explanation|solution|is_correct)$/i;
  const walk = (value, path) => {
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        assert.doesNotMatch(key, forbidden, `${path}.${key} must stay on the server`);
        walk(child, `${path}.${key}`);
      }
    }
  };
  walk(LAB_QUESTION_SETS, 'LAB_QUESTION_SETS');
});
