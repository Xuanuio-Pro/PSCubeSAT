import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM, getExercisesForLab, getLessonsForLab, getLessonForLab, lessonExercises, lessonUrl } from '../src/data/curriculum.js';
import { LABS } from '../src/data/labs.js';
import { READING_NOTES, lessonReadingContent } from '../src/data/lesson-reading.js';
import { projectKey, sourceKey, loadDraft } from '../src/components/editor/blockly-project.js';
import { buildGroupedSubmissionCode, getLessonExercises, resolveLessonAndExercise } from '../src/components/lessons/practice-exercises.js';

test('PTITCube syllabus exposes 164 ordered sections and all 39 individual exercises', () => {
  assert.deepEqual(LABS.map(lab => getLessonsForLab(lab.id).length), [10, 31, 12, 23, 35, 15, 12, 14, 12]);
  const sections = Object.values(CURRICULUM).flatMap(lab => lab.lessons);
  assert.equal(new Set(sections.map(item => item.id)).size, 164);
  assert.equal(sections.filter(item => item.type === 'practice').length, 24);
  assert.equal(Object.keys(CURRICULUM).flatMap(labId => getExercisesForLab(Number(labId))).length, 39);
  assert.equal(sections.filter(item => item.type === 'video').length, 25);
  assert.equal(sections.filter(item => item.type === 'document').length, 35);
  assert.equal(sections.filter(item => item.type === 'quiz').length, 60);
  for (const lab of LABS) {
    const lessons = getLessonsForLab(lab.id);
    assert.equal(lessons[0].type, 'video');
    // README pattern: ... -> Tổng hợp -> Lab Test, and every Doc is followed by its check questions.
    assert.deepEqual(lessons.slice(-2).map(item => [item.type, item.id]), [['summary', `summary-${lab.id}`], ['labtest', `labtest-${lab.id}`]]);
    lessons.forEach((item, index) => { if (item.type === 'document') assert.equal(lessons[index + 1].type, 'quiz', `${item.id} must be followed by a quiz`); });
    // Every quiz across Lab 0-8 is exported as a server-graded quiz; Lab 2-8 also retain `checkpointId` for legacy views.
    for (const quiz of lessons.filter(item => item.type === 'quiz')) {
      if (lab.id <= 1) assert.match(quiz.id, new RegExp(`^quiz-${lab.id}-[0-9]+$`));
      else assert.equal(quiz.id, `quiz-${quiz.checkpointId}`);
    }
    assert.equal(lab.description, CURRICULUM[lab.id].objective);
    if (lab.id === 0) continue;
    const upstreamRepos = {
      'Lab1-04_Button': 'Lab1-03_Button',
      'Lab1-05_LED_Button': 'Lab1-04_LED_Button',
      'Lab1-06_7_Segment_LED': 'Lab1-05_7_Segment_LED',
      'Lab1-07_Serial_Communication': 'Lab1-06_Serial_Communication',
      'Lab1-08_Serial_Control_LED': 'Lab1-07_Serial_Control_LED',
      'Lab1-09_WiFi_Connection': 'Lab1-08_WiFi_Connection',
      'Lab1-10_WiFi_AP_Mode': 'Lab1-09_WiFi_AP_Mode',
      'Lab1-11_Web_Server_LED': 'Lab1-10_Web_Server_LED',
      'Lab3-04_Watchdog_Timer': 'Lab3-04_Watchdog_And_Event',
      'Lab4-05_Camera_Multiplexer': 'Lab4-06_Camera_Multiplexer',
      'Lab4-06_Read_All_Sensors': 'Lab4-05_Read_All_Sensors',
      'Lab5-03_Ground_Station_Demo': 'Lab5-03_Satellite_Comm_System',
    };
    for (const ex of getExercisesForLab(lab.id)) {
      assert.equal(ex.repositoryUrl, `https://github.com/PTITCube/${upstreamRepos[ex.id] || ex.id}`);
      assert.ok(ex.id.startsWith(`Lab${lab.id}-`));
    }
  }
  const lab4 = getLessonsForLab(4);
  assert.ok(lab4.findIndex(item => item.id === 'practice-4-bmp280') < lab4.findIndex(item => item.id === 'video-4-3'));
  assert.ok(lab4.findIndex(item => item.id === 'practice-4-nmea-raw') < lab4.findIndex(item => item.id === 'video-4-5'));
  // README Lab 4 order: Multiplexer group (05) precedes All Sensors group (06).
  assert.deepEqual(
    ['video-4-5', 'document-4-3', 'quiz-doc-4-6', 'Lab4-05_Camera_Multiplexer', 'quiz-practice-4-mux', 'document-4-sensors', 'quiz-doc-4-7', 'Lab4-06_Read_All_Sensors', 'quiz-practice-4-all-sensors']
      .map(id => lab4.findIndex(item => item.id === id)),
    Array.from({ length: 9 }, (_, i) => lab4.findIndex(item => item.id === 'video-4-5') + i),
  );
  // Grouped sub-exercises stay ordered inside their README group.
  const ledSub = lessonExercises(getLessonForLab(1, 'practice-1-led')).map(item => item.id);
  assert.deepEqual(ledSub, ['Lab1-01_Blink_LED', 'Lab1-02_Control_Multiple_LEDs', 'Lab1-03_PWM_LED']);
  const next = (lab, id) => getLessonsForLab(lab)[getLessonsForLab(lab).findIndex(item => item.id === id) + 1].id;
  assert.equal(next(3, 'Lab3-04_Watchdog_Timer'), 'Lab3-05_Event_Driven_Queue');
  assert.equal(next(4, 'practice-4-nmea-raw'), 'quiz-practice-4-nmea-raw');
  assert.equal(next(4, 'quiz-doc-4-4'), 'Lab4-03c_GPS_PTITCube');
  // Practice groups are followed by their own check questions.
  assert.equal(next(1, 'practice-1-led'), 'quiz-1-4');
  assert.equal(next(3, 'Lab3-05_Event_Driven_Queue'), 'quiz-practice-3-wdt-event');
});

test('every document has topic-specific reading; video links remain explicit until supplied', () => {
  for (const lab of LABS) for (const lesson of getLessonsForLab(lab.id)) {
    if (lesson.type === 'document' && lesson.id !== 'document') { // Lab 0 Doc 0.1 renders docs/lab0-intro.
      assert.ok(READING_NOTES[lesson.id]?.length >= 3);
      assert.ok(lessonReadingContent(lab, lesson).includes(lesson.title));
    }
    if (lesson.type === 'video') assert.equal(lesson.videoUrl ?? '', '');
  }
});

test('lesson URLs restore parent and sub-exercise selection, invalid/cross-lab IDs fall back and Lab0 keeps its original IDs', () => {
  assert.deepEqual(getLessonsForLab(0).map(item => item.id), [
    'overview', 'document', 'quiz-0-1', 'document-0-2', 'quiz-0-2', 'video-0-2', 'components', 'quiz-0-3', 'summary-0', 'labtest-0',
  ]);
  const url = new URL(lessonUrl('lab4', 'Lab4-02b_IMU_Library'), 'http://localhost');
  assert.equal(getLessonForLab(4, url.searchParams.get('lesson')).id, 'practice-4-imu');
  assert.equal(getLessonForLab(1, 'Lab1-02_Control_Multiple_LEDs').id, 'practice-1-led');
  assert.equal(getLessonForLab(1, 'Lab4-02b_IMU_Library').id, 'video-1-1');
  assert.equal(getLessonForLab(4, 'missing').id, 'video-4-1');
});

test('exercise storage isolates all 39 code/workspaces while preserving legacy lab keys', () => {
  const exercises = Object.keys(CURRICULUM).flatMap(lab => getExercisesForLab(Number(lab)).map(ex => [Number(lab), ex.id]));
  assert.equal(exercises.length, 39);
  for (const key of [projectKey, sourceKey]) {
    assert.equal(new Set(exercises.map(([lab, exercise]) => key(lab, exercise))).size, 39);
    for (const [lab, exercise] of exercises) assert.notEqual(key(lab, exercise), key(lab));
  }
  assert.equal(projectKey(1), 'ptit:blockly:v1:lab:1');
  assert.equal(sourceKey(1), 'ptit:source:v1:lab:1');
});

test('practice exercise helpers resolve sub-tabs and bundle all sub-exercise drafts cleanly', () => {
  const lab1Lessons = getLessonsForLab(1);
  const resolved = resolveLessonAndExercise(lab1Lessons, 'Lab1-02_Control_Multiple_LEDs');
  assert.equal(resolved.lesson.id, 'practice-1-led');
  assert.equal(resolved.activeExercise.id, 'Lab1-02_Control_Multiple_LEDs');
  assert.equal(getLessonExercises(resolved.lesson).length, 3);

  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null };
  try {
    const scope = 'user:5:class:1';
    store.set(sourceKey(1, 'Lab1-01_Blink_LED', scope), JSON.stringify({ version: 2, code: 'void setup(){/*1*/}' }));
    const emptyBundle = buildGroupedSubmissionCode({
      exercises: resolved.exercises,
      labId: 1,
      storageScope: scope,
      activeExerciseId: 'Lab1-02_Control_Multiple_LEDs',
      activeCode: '',
    });
    assert.match(emptyBundle, /^\/\/ === Lab1-01_Blink_LED ===\nvoid setup\(\)\{\/\*1\*\/\}/);
    assert.match(emptyBundle, /\/\/ === Lab1-02_Control_Multiple_LEDs ===\n\/\/ \(Chưa có mã nguồn/);

    store.clear();
    assert.equal(
      buildGroupedSubmissionCode({
        exercises: resolved.exercises,
        labId: 1,
        storageScope: scope,
        activeExerciseId: 'Lab1-01_Blink_LED',
        activeCode: '   ',
      }),
      '',
    );
  } finally {
    delete globalThis.localStorage;
  }
});

test('drafts saved under a renamed exercise id stay readable, and new keys win over old ones', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null };
  try {
    store.set(sourceKey(6, 'Lab6-01_Multitasking_Scheduler'), 'old draft');
    assert.equal(loadDraft(sourceKey, 3, 'Lab3-03_Multitasking_Scheduler'), 'old draft');
    store.set(sourceKey(3, 'Lab3-03_Multitasking_Scheduler'), 'new draft');
    assert.equal(loadDraft(sourceKey, 3, 'Lab3-03_Multitasking_Scheduler'), 'new draft');
    store.set(sourceKey(2, 'Lab2-01a_Battery_GPIO'), 'adc draft');
    assert.equal(loadDraft(sourceKey, 2, 'Lab2-01a_Battery_I2C'), 'adc draft');
    store.set(sourceKey(1, 'Lab1-03_Button'), 'button draft');
    assert.equal(loadDraft(sourceKey, 1, 'Lab1-04_Button'), 'button draft');
    store.set(sourceKey(1, 'Lab1-02_Serial_Communication'), 'legacy serial draft');
    assert.equal(loadDraft(sourceKey, 1, 'Lab1-07_Serial_Communication'), 'legacy serial draft');
    store.set(sourceKey(3, 'Lab3-04_Watchdog_And_Event'), 'wdt draft');
    assert.equal(loadDraft(sourceKey, 3, 'Lab3-04_Watchdog_Timer'), 'wdt draft');
    store.set(sourceKey(4, 'Lab4-06_Camera_Multiplexer'), 'mux draft');
    assert.equal(loadDraft(sourceKey, 4, 'Lab4-05_Camera_Multiplexer'), 'mux draft');
    store.set(sourceKey(4, 'Lab4-05_Read_All_Sensors'), 'all sensors draft');
    assert.equal(loadDraft(sourceKey, 4, 'Lab4-06_Read_All_Sensors'), 'all sensors draft');
    store.set(sourceKey(5, 'Lab5-03_Satellite_Comm_System'), 'gs draft');
    assert.equal(loadDraft(sourceKey, 5, 'Lab5-03_Ground_Station_Demo'), 'gs draft');
    assert.equal(loadDraft(sourceKey, 1, 'Lab1-02_Control_Multiple_LEDs'), null);
  } finally { delete globalThis.localStorage; }
});
