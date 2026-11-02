// The original JS files are server seed inputs only; never import them in the UI.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { LABS } from '../src/data/labs.js';
import { getLessonsForLab } from '../src/data/curriculum.js';
import { lessonReadingContent } from '../src/data/lesson-reading.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const objectives = [
  ['', 'Tổng quan các phân hệ'], ['', 'Web IDE và kết nối OBC'],
  ['Nguồn và pin|ADC|Thư viện pin|Tiết kiệm năng lượng', 'Đọc điện áp, giải thích kết quả, minh chứng chế độ tiết kiệm năng lượng'],
  ['MicroSD/SPI|Ghi log|Quản lý file qua lệnh', 'File log đọc được, thao tác ghi/đọc, xử lý lỗi thẻ nhớ'],
  ['Môi trường|IMU|GPS|Camera|Tích hợp cảm biến', 'Dữ liệu từng cảm biến và bài tổng hợp; đối chiếu cấu hình phần cứng'],
  ['Gửi telemetry|Nhận lệnh|Liên lạc hai chiều', 'Bản tin gửi/nhận, phản hồi lệnh, xử lý tình huống mất kết nối'],
  ['Lắp ráp cơ khí|Task/scheduler|Khóa tài nguyên|Watchdog', 'Checklist lắp ráp, lịch chạy task và minh chứng phục hồi khi treo'],
  ['Multiplexer|Chương trình tổng hợp|RTOS', 'Kiểm tra tích hợp, giải thích luồng dữ liệu và kết quả nhiệm vụ'],
  ['Yêu cầu nhiệm vụ|Thiết kế|Triển khai|Báo cáo/demo', 'Mã nguồn, cấu hình dashboard, dữ liệu demo và báo cáo theo rubric'],
];
function groupFor(lab, item, index, count) {
  const groups = objectives[lab][0].split('|').filter(Boolean);
  const id = item.id;
  let group = 0;
  if (lab === 2) group = /Power_Saving|document-2-2/.test(id) ? 3 : /01b/.test(id) ? 2 : /01a|video-2-2/.test(id) ? 1 : 0;
  else if (lab === 3) group = /02_Linux/.test(id) ? 2 : /01b/.test(id) ? 1 : 0;
  else if (lab === 4) group = /Read_All/.test(id) ? 4 : /04[a-b]?_Camera|4-5/.test(id) ? 3 : /03[a-b]?_GPS|4-4|document-4-2/.test(id) ? 2 : /02[a-b]?_IMU|Detect_IMU|4-3/.test(id) ? 1 : 0;
  else if (lab === 5) group = /03_Satellite/.test(id) ? 2 : /02[a-b]?_Receive|5-3|document-5-2/.test(id) ? 1 : 0;
  else if (lab === 6) group = /Watchdog|6-4/.test(id) ? 3 : /document-6-3/.test(id) ? 2 : /Scheduler|6-3|document-6-2/.test(id) ? 1 : 0;
  else if (lab === 7) group = /03_RTOS/.test(id) ? 2 : /02_Full|7-2/.test(id) ? 1 : 0;
  else if (lab === 8) group = item.type === 'summary' ? 3 : /Custom_Mission|video-8-2/.test(id) ? 2 : /document-8/.test(id) ? 1 : 0;
  if (item.type === 'summary') group = groups.length - 1;
  return groups[Math.max(0, group)] || `Phần ${index + 1}/${count}`;
}
const legacy = LABS.map(lab => ({ ...lab, lessons: getLessonsForLab(lab.id).map(item => ({ ...item,
  reading: item.type === 'document' ? lessonReadingContent(lab, item) : '',
})) }));
const labs = LABS.map(lab => {
  const source = getLessonsForLab(lab.id);
  const lessons = source.map((item, index) => {
    const type = item.type === 'summary' ? 'document' : item.type === 'components' ? 'practice' : item.type;
    const content = { group: groupFor(lab.id, item, index, source.length), estimated_minutes: null, todos: [] };
    if (type === 'video') { content.url = lab.id === 0 ? '' : item.videoUrl || ''; content.todos.push('TODO GV: cung cấp URL video thật và thời lượng.'); }
    if (type === 'document') {
      content.markdown = item.type === 'summary' ? `# Tổng kết\n\n${item.description || lab.description}\n\n## Minh chứng đầu ra\n\n${objectives[lab.id][1]}` : lab.id === 0 ? '' : lessonReadingContent(lab, item);
      if (!content.markdown) content.todos.push('TODO GV: bổ sung tài liệu giới thiệu Lab 0.');
    }
    if (type === 'practice') {
      content.exercise_id = item.exerciseCode || '';
      content.repository_url = item.repositoryUrl || '';
      content.mode = item.type === 'components' ? 'exploration' : 'hardware';
      content.instructions = '';
      content.evidence = objectives[lab.id][1];
      content.todos.push('TODO GV: bổ sung hướng dẫn, rubric, kết quả mong đợi và lỗi thường gặp từ học liệu đã duyệt.');
    }
    return { id: item.id, lab_id: lab.id, type, order_no: index, title: item.type === 'summary' ? 'Tổng kết' : item.title,
      content, completion_rule: { kind: type === 'practice' ? 'teacher_review' : type === 'video' ? 'watched_ratio' : 'read_confirmation', ...(type === 'video' ? { ratio: 0.9 } : {}) },
      preview_allowed: item.id === 'components', default_enabled: type !== 'video', default_required: type === 'document' && !!content.markdown };
  });
  if (lab.id >= 2) {
    const groups = objectives[lab.id][0].split('|');
    lessons.sort((a, b) => groups.indexOf(a.content.group) - groups.indexOf(b.content.group));
    lessons.forEach((item, index) => { item.order_no = index; });
  }
  lessons.push({ id: `labtest-${lab.id}`, lab_id: lab.id, type: 'labtest', order_no: lessons.length, title: `Kiểm tra cuối Lab ${lab.id}`,
    content: { todos: ['TODO GV: ngân hàng 20 câu chưa được soạn/duyệt.'], bank_ready: false }, completion_rule: { kind: 'quiz_pass', pass_score: 4 }, preview_allowed: false, default_enabled: false, default_required: false });
  return { id: lab.id, order_no: lab.id, title: lab.id === 6 ? 'Cấu trúc và vận hành đa nhiệm' : lab.title,
    objectives: lab.description, estimated_minutes: 0, groups: objectives[lab.id][0].split('|').filter(Boolean), evidence: objectives[lab.id][1], lessons };
});
const sourceHash = createHash('sha256');
for (const path of ['src/data/curriculum.js', 'src/data/labs.js', 'src/data/lesson-reading.js', 'scripts/export-curriculum.mjs']) sourceHash.update(readFileSync(resolve(root, path)));
const output = JSON.stringify({ course_id: 'cubesat', course_title: 'CubeSAT Learning Platform', source_hash: sourceHash.digest('hex'), labs, legacy }, null, 2) + '\n';
const target = resolve(root, 'fastapi-backend/app/firmware/curriculum/seed.json');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Curriculum seed snapshot is stale. Run node scripts/export-curriculum.mjs');
} else writeFileSync(target, output);
console.log(`Curriculum: ${labs.length} labs, ${labs.reduce((n, lab) => n + lab.lessons.length, 0)} lessons; seed snapshot ${process.argv.includes('--check') ? 'verified' : 'exported'}.`);
