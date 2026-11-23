// The original JS files are server seed inputs only; never import them in the UI.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { LABS } from '../src/data/labs.js';
import { getLessonsForLab } from '../src/data/curriculum.js';
import { lessonReadingContent } from '../src/data/lesson-reading.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Server scaffold content lives under firmware/curriculum/lab{0..8}/. Quiz and lab-test answer files are never read here.
const labDir = labId => resolve(root, `fastapi-backend/app/firmware/curriculum/lab${labId}`);
const LAB_FILES = {
  0: {
    overview: 'video-0-1.json', 'video-0-2': 'video-0-2.json', document: 'doc-0-1.md', 'document-0-2': 'doc-0-2.md',
    'summary-0': 'summary-0.md', components: 'practice-explorer.json',
  },
  1: {
    'video-1-1': 'video-1-1.json', 'video-1-2': 'video-1-2.json', 'video-1-5': 'video-1-3.json',
    'document-1-1': 'doc-1-1.md', 'document-1-2': 'doc-1-2.md', 'doc-1-3': 'doc-1-3.md', 'doc-1-4': 'doc-1-4.md',
    'doc-1-5': 'doc-1-5.md', 'doc-1-6': 'doc-1-6.md', 'doc-1-7': 'doc-1-7.md', 'doc-1-8': 'doc-1-8.md',
  },
  2: {
    'video-2-1': 'video-2-1.json', 'video-2-2': 'video-2-2.json',
    'document-2-1': 'doc-2-1.md', 'document-2-2': 'doc-2-2.md',
  },
  3: {
    'video-3-1': 'video-3-1.json', 'video-3-2': 'video-3-2.json', 'video-3-3': 'video-3-3.json', 'video-3-4': 'video-3-4.json',
    'document-3-1': 'doc-3-1.md', 'document-3-cli': 'doc-3-2.md', 'document-3-3': 'doc-3-3.md', 'document-3-4': 'doc-3-4.md',
  },
  4: {
    'video-4-1': 'video-4-1.json', 'video-4-2': 'video-4-2.json', 'video-4-3': 'video-4-3.json', 'video-4-4': 'video-4-4.json', 'video-4-5': 'video-4-5.json',
    'document-4-1': 'doc-4-1.md', 'document-4-imu': 'doc-4-2.md', 'document-4-gnss': 'doc-4-3.md', 'document-4-2': 'doc-4-4.md',
    'document-4-camera': 'doc-4-5.md', 'document-4-3': 'doc-4-6.md', 'document-4-sensors': 'doc-4-7.md',
  },
  5: {
    'video-5-1': 'video-5-1.json', 'video-5-2': 'video-5-2.json', 'video-5-3': 'video-5-3.json',
    'document-5-1': 'doc-5-1.md', 'document-5-lora': 'doc-5-2.md', 'document-5-2': 'doc-5-3.md',
  },
  6: {
    'video-6-1': 'video-6-1.json', 'video-6-2': 'video-6-2.json',
    'document-6-1': 'doc-6-1.md', 'document-6-2': 'doc-6-2.md', 'document-6-3': 'doc-6-3.md',
  },
  7: {
    'video-7-1': 'video-7-1.json', 'video-7-2': 'video-7-2.json',
    'document-7-1': 'doc-7-1.md', 'document-7-2': 'doc-7-2.md', 'document-7-3': 'doc-7-3.md',
  },
  8: {
    'video-8-1': 'video-8-1.json', 'video-8-2': 'video-8-2.json',
    'document-8-1': 'doc-8-1.md', 'document-8-widgets': 'doc-8-2.md', 'document-8-2': 'doc-8-3.md',
  },
};
const labText = (labId, id) => readFileSync(resolve(labDir(labId), LAB_FILES[labId][id]), 'utf8').replaceAll(String.fromCharCode(13), '').trim();
const labJson = (labId, id) => JSON.parse(labText(labId, id));
const hasLabFile = (labId, id) => !!LAB_FILES[labId]?.[id];
const LAB1_GROUP = { 'video-1-1': 0, 'document-1-1': 0, 'quiz-1-1': 0, 'video-1-2': 0, 'document-1-2': 0, 'quiz-1-2': 0,
  'doc-1-3': 1, 'quiz-1-3': 1, 'practice-1-led': 1, 'quiz-1-4': 1,
  'doc-1-4': 2, 'quiz-1-5': 2, 'practice-1-button': 2, 'quiz-1-6': 2,
  'doc-1-5': 3, 'quiz-1-7': 3, 'Lab1-06_7_Segment_LED': 3, 'quiz-1-8': 3,
  'doc-1-6': 4, 'quiz-1-9': 4, 'practice-1-uart': 4, 'quiz-1-10': 4 };
const objectives = [
  ['', 'Tổng quan các phân hệ'], ['Vi điều khiển và Web IDE|Component LED|Component Nút Nhấn|Component 74HC595 & LED 7 Đoạn|Component UART|Component WiFi & Web Server|Tổng hợp', 'Web IDE và kết nối OBC'],
  ['Nguồn và pin|Đo điện áp pin|Thư viện pin|Tiết kiệm năng lượng', 'Đọc điện áp, giải thích kết quả, minh chứng chế độ tiết kiệm năng lượng'],
  ['MicroSD/SPI|Ghi log|Quản lý file qua lệnh|Task/scheduler và Mutex|Watchdog và sự kiện', 'File log đọc được, xử lý lỗi thẻ nhớ, lịch chạy task và minh chứng phục hồi khi treo'],
  ['Môi trường|IMU|GPS|Camera|Tích hợp cảm biến', 'Dữ liệu từng cảm biến và bài tổng hợp; đối chiếu cấu hình phần cứng'],
  ['Gửi telemetry|Nhận lệnh|Liên lạc hai chiều', 'Bản tin gửi/nhận, phản hồi lệnh, xử lý tình huống mất kết nối'],
  ['Lắp ráp cơ khí', 'Checklist lắp ráp và minh chứng khung vệ tinh hoàn chỉnh'],
  ['Chương trình tổng hợp|RTOS', 'Kiểm tra tích hợp, giải thích luồng dữ liệu và kết quả nhiệm vụ'],
  ['Yêu cầu nhiệm vụ|Thiết kế|Triển khai|Báo cáo/demo', 'Mã nguồn, cấu hình dashboard, dữ liệu demo và báo cáo theo rubric'],
];
function groupFor(lab, item, index, count) {
  const groups = objectives[lab][0].split('|').filter(Boolean);
  const id = item.id;
  let group = 0;
  if (lab === 1) group = LAB1_GROUP[id] ?? 5;
  else if (lab === 2) group = /Power_Saving|document-2-2|quiz-doc-2-2|quiz-practice-2-power/.test(id) ? 3 : /01b|practice-2-max17048|quiz-practice-2-max17048/.test(id) ? 2 : /01a|video-2-2|Detect_Battery/.test(id) ? 1 : 0;
  else if (lab === 3) group = /Watchdog|Event_Driven|video-3-4|document-3-4|quiz-doc-3-4|quiz-practice-3-wdt/.test(id) ? 4 : /Scheduler|video-3-3|document-3-3|quiz-doc-3-3|quiz-practice-3-rtos/.test(id) ? 3 : /02_Linux|document-3-cli|quiz-doc-3-2|quiz-practice-3-cli/.test(id) ? 2 : /01b|practice-3-sd|quiz-practice-3-sd/.test(id) ? 1 : 0;
  else if (lab === 4) group = /Read_All|Camera_Multiplexer|document-4-3|document-4-sensors|video-4-5|quiz-doc-4-[67]|quiz-practice-4-(?:mux|all-sensors)/.test(id) ? 4 : /04[a-b]?_Camera|practice-4-camera|document-4-camera|quiz-doc-4-5|quiz-practice-4-camera/.test(id) ? 3 : /03[a-c]?_GPS|practice-4-nmea-raw|Detect_GPS|video-4-4|document-4-gnss|document-4-2|quiz-doc-4-[34]|quiz-practice-4-nmea/.test(id) ? 2 : /02[a-b]?_IMU|practice-4-imu|Detect_IMU|video-4-3|document-4-imu|quiz-doc-4-2|quiz-practice-4-imu/.test(id) ? 1 : 0;
  else if (lab === 5) group = /03_Ground|03_Satellite|video-5-3|document-5-2|quiz-doc-5-3|quiz-practice-5-ground/.test(id) ? 2 : /02[a-b]?_Receive|practice-5-lora|quiz-practice-5-lora/.test(id) ? 1 : 0;
  else if (lab === 7) group = /RTOS|video-7-2|document-7-[23]|quiz-doc-7-[23]|quiz-practice-7-rtos/.test(id) ? 1 : 0;
  else if (lab === 8) group = item.type === 'summary' ? 3 : /Custom_Mission|video-8-2|quiz-practice-8-capstone/.test(id) ? 2 : /document-8-(?:widgets|2)|quiz-doc-8-[23]/.test(id) ? 1 : 0;
  if (item.type === 'summary') group = groups.length - 1;
  return groups[Math.max(0, group)] || `Phần ${index + 1}/${count}`;
}
const legacy = LABS.map(lab => ({ ...lab, lessons: getLessonsForLab(lab.id).map(item => ({ ...item,
  reading: item.type === 'document' ? lessonReadingContent(lab, item) : '',
})) }));
// The legacy Lab Test page stays in the legacy view; the course model appends its own server-graded labtest below.
// All `quiz` lessons across Lab 0-8 are server-graded and exported to `/classes` while keeping `checkpointId` for legacy views.
const legacyOnly = item => item.type === 'labtest';
const labs = LABS.map(lab => {
  const source = getLessonsForLab(lab.id).filter(item => !legacyOnly(item));
  const lessons = source.map((item, index) => {
    const type = item.type === 'summary' ? 'document' : item.type === 'components' || item.type === 'assembly' ? 'practice' : item.type;
    const content = { group: groupFor(lab.id, item, index, source.length), estimated_minutes: null, todos: [] };
    if (type === 'video') {
      if (hasLabFile(lab.id, item.id)) Object.assign(content, labJson(lab.id, item.id));
      else content.url = item.videoUrl || '';
      content.url = content.url || '';
      content.todos.push('TODO GV: cung cấp URL video thật và thời lượng.');
    }
    if (type === 'document') {
      // Server scaffold files win once they have content; empty placeholders keep the existing topic reading.
      content.markdown = (hasLabFile(lab.id, item.id) && labText(lab.id, item.id)) || (item.type === 'summary' ? `# Tổng kết\n\n${item.description || lab.description}\n\n## Minh chứng đầu ra\n\n${objectives[lab.id][1]}` : item.id === 'document' ? '' : lessonReadingContent(lab, item));
      if (!content.markdown) content.todos.push(`TODO GV: bổ sung tài liệu Lab ${lab.id}.`);
    }
    if (type === 'practice') {
      const exercises = Array.isArray(item.exercises) ? item.exercises : [];
      content.exercise_id = item.exerciseCode || exercises[0]?.exerciseCode || exercises[0]?.id || '';
      content.repository_url = item.repositoryUrl || exercises[0]?.repositoryUrl || '';
      if (item.description) content.description = item.description;
      if (exercises.length > 0) {
        content.exercises = exercises.map(ex => ({
          id: ex.id,
          title: ex.title,
          description: ex.description || '',
          repository_url: ex.repositoryUrl || '',
        }));
      }
      content.mode = item.type === 'components' ? 'exploration' : item.type === 'assembly' ? 'assembly' : 'hardware';
      content.instructions = '';
      if (hasLabFile(lab.id, item.id)) Object.assign(content, labJson(lab.id, item.id));
      content.evidence = objectives[lab.id][1];
      content.todos.push('TODO GV: bổ sung hướng dẫn, rubric, kết quả mong đợi và lỗi thường gặp từ học liệu đã duyệt.');
    }
    if (type === 'quiz') {
      // Answers stay server-only; the seed carries just the slot id and readiness flag.
      content.bank_key = item.id;
      content.bank_ready = false;
      if (item.description) content.description = item.description;
      content.todos.push('TODO GV: soạn và duyệt câu hỏi kiểm tra (đáp án chỉ lưu ở server).');
    }
    const completionKind = type === 'practice' ? 'teacher_review' : type === 'video' ? 'watched_ratio' : type === 'quiz' ? 'quiz_pass' : 'read_confirmation';
    return { id: item.id, lab_id: lab.id, type, order_no: index, title: item.type === 'summary' && !hasLabFile(lab.id, item.id) ? 'Tổng kết' : item.title,
      content, completion_rule: { kind: completionKind, ...(type === 'video' ? { ratio: 0.9 } : {}), ...(type === 'quiz' ? { pass_score: null } : {}) },
      preview_allowed: item.id === 'components',
      default_enabled: type !== 'video' && type !== 'quiz', default_required: type === 'document' && !!content.markdown };
  });
  const labtestSource = getLessonsForLab(lab.id).find(item => item.type === 'labtest');
  const labtestContent = {
    todos: [`TODO GV: ngân hàng ${lab.id === 1 ? 10 : 20} câu chưa được soạn/duyệt.`],
    bank_ready: false,
    ...(labtestSource?.description ? { description: labtestSource.description } : {}),
  };
  lessons.push({ id: `labtest-${lab.id}`, lab_id: lab.id, type: 'labtest', order_no: lessons.length, title: labtestSource?.description ? labtestSource.title : `Kiểm tra cuối Lab ${lab.id}`,
    content: labtestContent, completion_rule: { kind: 'quiz_pass', pass_score: 4 }, preview_allowed: false, default_enabled: false, default_required: false });
  return { id: lab.id, order_no: lab.id, title: lab.title,
    objectives: lab.description, estimated_minutes: 0, groups: objectives[lab.id][0].split('|').filter(Boolean), evidence: objectives[lab.id][1], lessons };
});
// Hash and compare with LF endings so a Windows (autocrlf) checkout matches a Linux one.
const lf = text => text.replace(/\r\n/g, '\n');
const sourceHash = createHash('sha256');
for (const path of ['src/data/curriculum.js', 'src/data/labs.js', 'src/data/lesson-reading.js', 'scripts/export-curriculum.mjs', ...Object.entries(LAB_FILES).flatMap(([labId, files]) => Object.values(files).map(name => `fastapi-backend/app/firmware/curriculum/lab${labId}/${name}`))]) sourceHash.update(lf(readFileSync(resolve(root, path), 'utf8')));
const output = JSON.stringify({ course_id: 'cubesat', course_title: 'CubeSAT Learning Platform', source_hash: sourceHash.digest('hex'), labs, legacy }, null, 2) + '\n';
const target = resolve(root, 'fastapi-backend/app/firmware/curriculum/seed.json');
if (process.argv.includes('--check')) {
  if (lf(readFileSync(target, 'utf8')) !== output) throw new Error('Curriculum seed snapshot is stale. Run node scripts/export-curriculum.mjs');
} else writeFileSync(target, output);
console.log(`Curriculum: ${labs.length} labs, ${labs.reduce((n, lab) => n + lab.lessons.length, 0)} lessons; seed snapshot ${process.argv.includes('--check') ? 'verified' : 'exported'}.`);
