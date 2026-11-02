import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CURRICULUM, getLessonsForLab } from '../src/data/curriculum.js';
import { sourceKey, projectKey } from '../src/components/editor/blockly-project.js';
import { loginDestination } from '../src/contexts/auth-session.js';

const seed = JSON.parse(readFileSync(new URL('../fastapi-backend/app/firmware/curriculum/seed.json', import.meta.url), 'utf8'));

test('seed preserves original IDs while normalizing lesson kinds and adding disabled test slots', () => {
  const lessons = seed.labs.flatMap(lab => lab.lessons);
  const originals = [0, ...Object.keys(CURRICULUM).map(Number)].flatMap(lab => getLessonsForLab(lab));
  assert.equal(lessons.length, 93);
  for (const item of originals) assert.ok(lessons.some(lesson => lesson.id === item.id));
  assert.equal(lessons.filter(item => item.type === 'practice' && item.lab_id >= 2).length, 26);
  assert.equal(lessons.find(item => item.id === 'summary-2').title, 'Tổng kết');
  assert.equal(lessons.find(item => item.id === 'components').default_required, false);
  for (const lab of seed.labs) {
    assert.equal(lab.lessons.at(-1).type, 'labtest');
    assert.equal(lab.lessons.at(-1).default_enabled, false);
    assert.deepEqual(lab.lessons.map(item => item.order_no), lab.lessons.map((_, index) => index));
    if (lab.id >= 2) for (const lesson of lab.lessons.filter(item => item.type !== 'labtest')) assert.ok(lab.groups.includes(lesson.content.group));
  }
});

test('class drafts isolate both editors by user/class while keeping legacy keys unchanged', () => {
  for (const key of [sourceKey, projectKey]) {
    assert.notEqual(key(2, 'Lab2-01a_Battery_GPIO', 'user:1:class:2'), key(2, 'Lab2-01a_Battery_GPIO', 'user:1:class:3'));
    assert.notEqual(key(2, 'Lab2-01a_Battery_GPIO', 'user:1:class:2'), key(2, 'Lab2-01a_Battery_GPIO', 'user:2:class:2'));
    assert.notEqual(key(2, 'Lab2-01a_Battery_GPIO'), key(2, 'Lab2-01a_Battery_GPIO', 'user:1:class:2'));
  }
});

test('class curriculum routes restore after login without allowing arbitrary paths', () => {
  for (const path of ['/preview', '/classes/12/curriculum', '/classes/12/learn?lesson=document-2-1']) assert.equal(loginDestination(path), path);
  for (const path of ['/classes/12/learn/../../evil', '/classes/12/curriculum//evil', '/classes/12/unknown']) assert.equal(loginDestination(path), '/');
});
