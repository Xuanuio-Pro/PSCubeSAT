// Lab3-02 shell replies, read in Vietnamese. Pure so the decoder tests can cover it.
const ERRORS = {
  'ERR: SD not ready': 'Thẻ SD chưa sẵn sàng',
  'ERR: Directory not found': 'Không tìm thấy thư mục',
  'ERR: Unknown command': 'Lệnh không được hỗ trợ',
  'ERR: Cannot remove root directory': 'Không thể xóa thư mục gốc',
  'ERR: Command exceeds 128 bytes': 'Lệnh quá dài (tối đa 128 byte)',
};

// PTITCube library 74065b6 replies "ERR: <reason>: <path>"; older sketches used "ERR: <reason>".
const ERROR_PREFIXES = [
  ['ERR: Not a directory', 'Đường dẫn không phải thư mục'],
  ['ERR: Directory not found', 'Không tìm thấy thư mục'],
  ['ERR: Path not found', 'Không tìm thấy đường dẫn'],
  ['ERR: File not found', 'Không tìm thấy file'],
  ['ERR: Directory already exists', 'Thư mục đã tồn tại'],
  ['ERR: Cannot remove directory', 'Không xóa được thư mục (có thể chưa rỗng)'],
  ['ERR: Cannot create', 'Không tạo được file / thư mục'],
  ['ERR: Cannot remove file', 'Không xóa được file'],
];

/** Vietnamese reading of the shell reply. The raw reply is always shown next to it. */
export function describeShellResult(event) {
  const reply = event.reply ?? event.text ?? '';
  if (event.phase === 'error') {
    if (ERRORS[reply]) return ERRORS[reply];
    const prefix = ERROR_PREFIXES.find(([start]) => reply.startsWith(start));
    if (prefix) return prefix[1];
    if (/is a directory/.test(reply)) return 'Đây là thư mục, hãy dùng rmdir';
    if (/^Command not recognized/i.test(reply)) return 'Lệnh không được hỗ trợ (gõ help để xem danh sách)';
    if (/^ERR: \w+ <path>$/.test(reply)) return 'Thiếu tên file / thư mục';
    return 'Thiết bị báo lỗi, lệnh không thực hiện được';
  }
  // "OK: cd /demo" (older sketches) carries the path; a bare "OK" means the typed argument succeeded.
  const argument = (event.command ?? '').trim().split(/\s+/).slice(1).join(' ');
  const path = /^OK:/.test(reply) ? reply.replace(/^OK:\s*\S+\s*/, '') || '/' : argument || '/';
  switch (event.verb) {
    case 'pwd': return `Thư mục hiện tại: ${reply}`;
    case 'cd': return `Đã chuyển tới ${path}`;
    case 'ls': return `Đã liệt kê ${argument || (/^OK:/.test(reply) ? path : 'thư mục hiện tại')}${event.entries != null ? ` · ${event.entries} mục` : ''}`;
    case 'mkdir': return `Đã tạo thư mục ${path}`;
    case 'rmdir': return `Đã xóa thư mục ${path}`;
    case 'rm': return `Đã xóa ${path}`;
    case 'touch': return `Đã tạo file ${path} (giữ nguyên nếu đã có)`;
    case 'cat': return 'Nội dung file hiển thị ở Serial Monitor';
    case 'df': return reply;
    default: return 'Thiết bị đã thực hiện lệnh';
  }
}
