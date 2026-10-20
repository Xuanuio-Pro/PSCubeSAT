import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM, getLessonsForLab, getLessonForLab, lessonUrl } from '../src/data/curriculum.js';
import { LABS } from '../src/data/labs.js';
import { READING_NOTES, lessonReadingContent } from '../src/data/lesson-reading.js';
import { projectKey, sourceKey } from '../src/components/editor/blockly-project.js';

test('PTITCube syllabus exposes 81 ordered sections and all 32 individual exercises', () => {
  assert.deepEqual(LABS.slice(1).map(lab => getLessonsForLab(lab.id).length), [13, 8, 7, 17, 11, 11, 8, 6]);
  const sections = Object.values(CURRICULUM).flatMap(lab => lab.lessons);
  assert.equal(new Set(sections.map(item => item.id)).size, 81);
  assert.equal(sections.filter(item => item.type === 'practice').length, 32);
  assert.equal(sections.filter(item => item.type === 'video').length, 23);
  assert.equal(sections.filter(item => item.type === 'document').length, 18);
  for (const lab of LABS.slice(1)) {
    const lessons = getLessonsForLab(lab.id);
    assert.equal(lessons[0].type, 'video');
    assert.equal(lessons.at(-1).type, 'summary');
    assert.equal(lab.description, CURRICULUM[lab.id].objective);
    for (const lesson of lessons.filter(item => item.type === 'practice')) {
      assert.equal(lesson.repositoryUrl, `https://github.com/PTITCube/${lesson.id}`);
      assert.ok(lesson.id.startsWith(`Lab${lab.id}-`));
    }
  }
  const lab4 = getLessonsForLab(4);
  assert.ok(lab4.findIndex(item => item.id === 'Lab4-01b_Environment_Library') < lab4.findIndex(item => item.id === 'video-4-3'));
  assert.ok(lab4.findIndex(item => item.id === 'Lab4-03b_GPS_Library') < lab4.findIndex(item => item.id === 'video-4-5'));
});

test('every document has topic-specific reading; video links remain explicit until supplied', () => {
  for (const lab of LABS.slice(1)) for (const lesson of getLessonsForLab(lab.id)) {
    if (lesson.type === 'document') {
      assert.ok(READING_NOTES[lesson.id]?.length >= 3);
      assert.ok(lessonReadingContent(lab, lesson).includes(lesson.title));
    }
    if (lesson.type === 'video') assert.equal(lesson.videoUrl, '');
  }
});

test('lesson URLs restore selection, invalid/cross-lab IDs fall back and Lab0 keeps three sections', () => {
  assert.deepEqual(getLessonsForLab(0).map(item => item.id), ['overview', 'document', 'components']);
  const url = new URL(lessonUrl('lab4', 'Lab4-02b_IMU_Library'), 'http://localhost');
  assert.equal(getLessonForLab(4, url.searchParams.get('lesson')).id, 'Lab4-02b_IMU_Library');
  assert.equal(getLessonForLab(1, 'Lab4-02b_IMU_Library').id, 'video-1-1');
  assert.equal(getLessonForLab(4, 'missing').id, 'video-4-1');
});

test('exercise storage isolates all code/workspaces while preserving legacy lab keys', () => {
  const exercises = Object.entries(CURRICULUM).flatMap(([lab, value]) => value.lessons.filter(item => item.type === 'practice').map(item => [Number(lab), item.id]));
  for (const key of [projectKey, sourceKey]) {
    assert.equal(new Set(exercises.map(([lab, exercise]) => key(lab, exercise))).size, 32);
    for (const [lab, exercise] of exercises) assert.notEqual(key(lab, exercise), key(lab));
  }
  assert.equal(projectKey(1), 'ptit:blockly:v1:lab:1');
  assert.equal(sourceKey(1), 'ptit:source:v1:lab:1');
});
