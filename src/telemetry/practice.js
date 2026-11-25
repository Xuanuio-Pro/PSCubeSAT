import { acceptsSerialMetadata, adaptSerialLine, explicitNullMeasurements } from './adapters.js';
import { reduceNetworkReport } from './network-report.js';

// Panels per exercise, matched to what the reference sketch actually prints. First match wins.
/** @type {Array<[RegExp, string[]]>} */
const EXERCISE_PANELS = [
  [/^Lab1-(09|1[01])/, ['lab1Connection']],
  [/^Lab2-/, ['voltage']],
  // Lab3-01a/b only log to the SD card: the Serial Monitor is the whole view.
  [/^Lab3-01/, []],
  // Lab3-02 pairs every typed command with the shell's reply.
  [/^Lab3-02/, ['shell']],
  [/^Lab4-01/, ['environment']],
  [/^Lab4-02/, ['attitude']],
  [/^Lab4-03/, ['gps']],
  [/^Lab4-04/, ['camera']],
  [/^Lab4-05/, ['gps', 'camera']],
  [/^Lab5-01/, ['radio']],
  // Uplink commands are sent from the separate ground-station window, not from the OBC's USB port.
  [/^Lab5-0[23]/, ['radio', 'groundStation']],
  // Lab3-04 (watchdog) and Lab3-05 (event queue) report events, not measurements: activity log only.
  [/^Lab3-0[45]/, []],
  [/^Lab4-06/, ['environment', 'attitude', 'gps']],
  [/^Lab7-01/, ['attitude', 'gps', 'voltage', 'environment', 'storage', 'system']],
  [/^Lab7-02/, ['attitude', 'gps', 'voltage', 'camera', 'environment', 'storage', 'network', 'system']],
  [/^Lab8-/, ['dashboard']],
];

// Profiles describe the shipped examples, not capabilities discovered on a board.
export function practiceProfile(id = '') {
  const lab = Number(/^Lab(\d+)-/.exec(id)?.[1] ?? 0);
  const scheduler = id.startsWith('Lab3-03');
  const serialOnly = id.startsWith('Lab3-01');
  const panels = [...(EXERCISE_PANELS.find(([pattern]) => pattern.test(id))?.[1] ?? [])];
  let commands = [];
  if (id.startsWith('Lab1-08')) commands = ['1', '0'];
  if (id.startsWith('Lab3-02')) commands = ['pwd', 'ls', 'mkdir demo', 'cd demo', 'touch note.txt', 'rm note.txt', 'cd ..', 'rm demo'];
  if (id.startsWith('Lab3-04')) commands = ['h'];
  if (id.startsWith('Lab3-05')) commands = ['A'];
  if (id.startsWith('Lab4-04')) commands = ['p'];
  if (id.startsWith('Lab7-02')) commands = ['ping', 'status', 'uptime', 'get_sensor', 'get_eps', 'get_gps', 'pause', 'resume', 'capture', 'help'];
  const note = scheduler
    ? 'Lab3-03 sinh gói viễn trắc giả lập (điện áp, nhiệt độ ngẫu nhiên) và tác vụ tự chẩn đoán trên Core 0. Các số liệu [HK-TELEM] là minh họa, không phải phép đo; LED nhịp tim không có log.'
    : id.startsWith('Lab3-04') ? 'Gửi h (hoặc nhấn nút GPIO 4) để mô phỏng treo: tác vụ ngừng nạp Watchdog, TWDT reset bo sau khoảng 3 giây và log khởi động báo nguyên nhân TASK WATCHDOG RESET.'
      : id.startsWith('Lab3-05') ? 'Mọi sự kiện (nút nhấn GPIO 4, cảnh báo nhiệt độ giả lập > 30°C, ký tự gửi qua Serial) đi qua FreeRTOS Queue tới tác vụ Dispatcher. Nhiệt độ là số giả lập, không phải phép đo.'
      : lab === 5 ? 'Log phát LoRa chỉ xác nhận yêu cầu gửi tại OBC. Cần phản hồi từ trạm mặt đất để xác nhận nhận thành công; Lệnh uplink gửi từ cửa sổ Trạm mặt đất (USB-TTL + LoRa), không gửi qua USB Serial của OBC.'
      : lab === 8 ? 'Mẫu Lab8 là khung chương trình. Hãy bổ sung nhiệm vụ và xuất JSON telemetry để dashboard có dữ liệu.'
        : /^Lab4-02a/.test(id) ? 'Bản mẫu đọc burst 14 byte và quy đổi theo dải mặc định ±2g / ±250°/s. Nếu cấu hình thanh ghi khác dải này, giá trị m/s² và rad/s sẽ sai tỷ lệ.'
          : /^Lab4-04|^Lab4-05/.test(id) ? 'Ảnh lưu trên thẻ SD chỉ hiện ở đây khi firmware gửi lại ảnh về trình duyệt (IMG_BEGIN/IMG_CHUNK/IMG_END — Lab4-04a, Lab4-04b) hoặc imageData.'
            : 'Hiển thị theo dữ liệu thực nhận. Trường không được xuất hoặc quá hạn sẽ hiện —; log khởi tạo chưa chứng minh toàn bộ hệ thống hoạt động.';
  return { id, lab, scheduler, serialOnly, panels, commands, note };
}

// `radio` holds running totals: `events` is a bounded window (120), so counts must not be derived from it.
export const emptyActivity = () => ({ events: [], tasks: {}, subsystems: {}, radio: { sent: 0, received: 0, error: 0, lastAt: {} }, lineCount: 0, lastLineAt: null });

export function reduceActivity(state, event) {
  const next = { ...state, events: [...state.events, event].slice(-120) };
  if (event.group === 'radio' && ['sent', 'received', 'error'].includes(event.phase)) {
    const radio = state.radio ?? emptyActivity().radio;
    next.radio = { ...radio, [event.phase]: radio[event.phase] + 1, lastAt: { ...radio.lastAt, [event.phase]: event.at } };
  }
  if (event.group === 'task') {
    const previous = state.tasks[event.name] ?? { count: 0, startedAt: null, durationMs: null };
    const durationMs = event.phase === 'done' && previous.startedAt !== null ? (event.at >= previous.startedAt ? event.at - previous.startedAt : null) : previous.durationMs;
    next.tasks = { ...state.tasks, [event.name]: { ...previous, ...event, durationMs,
      count: previous.count + (event.phase === 'sample' || event.phase === 'done' ? 1 : 0),
      startedAt: event.phase === 'start' ? event.at : event.phase === 'done' ? null : previous.startedAt } };
  } else if (event.group !== 'serial') next.subsystems = { ...state.subsystems, [event.group]: event.group === 'network'
    ? { ...event, report: reduceNetworkReport(state.subsystems.network?.report, event) } : event };
  return next;
}

const NUMBER = '([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?)';
const valueAfter = (line, label) => new RegExp(`${label}\\s*[:=]\\s*${NUMBER}`, 'iu').exec(line);
const fold = line => line.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();

function nmeaPosition(line) {
  const match = /^\$(G[PNLBA](?:GGA|RMC)),([^*]+)\*([\dA-Fa-f]{2})$/.exec(line);
  if (!match) return null;
  const body = `${match[1]},${match[2]}`;
  let checksum = 0;
  for (const char of body) checksum ^= char.charCodeAt(0);
  if (checksum !== parseInt(match[3], 16)) return null;
  const fields = body.split(',');
  const gga = fields[0].endsWith('GGA');
  const valid = gga ? /^[1-8]$/.test(fields[6]) : fields[2] === 'A';
  if (!valid) return { valid: false };
  const coordinate = (text, hemisphere, width, allowed) => {
    if (!new RegExp(`^\\d{${width + 2}}(?:\\.\\d+)?$`).test(text) || !allowed.includes(hemisphere)) return NaN;
    const minutes = Number(text.slice(width));
    if (minutes >= 60) return NaN;
    return (Number(text.slice(0, width)) + minutes / 60) * ('SW'.includes(hemisphere) ? -1 : 1);
  };
  const offset = gga ? 2 : 3;
  const lat = coordinate(fields[offset], fields[offset + 1], 2, ['N', 'S']);
  const lng = coordinate(fields[offset + 2], fields[offset + 3], 3, ['E', 'W']);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { valid: true, lat, lng, ...(gga && fields[9] !== '' && fields[10] === 'M' ? { alt: Number(fields[9]) } : {}) };
}

/** Stateful only for explicit multiline IMU headers; discarded on source/session/lesson changes. */
export function createPracticeDecoder(exerciseId = '') {
  let axes = '';
  let image = null; // chunked Serial JPEG in flight: { size, chunks, bytes }
  let pendingLat = null; // Lab4-03c latitude line waiting for its longitude line
  let shell = null; // Lab3-02 command awaiting its reply: { command, entries }
  const profile = practiceProfile(exerciseId);
  return (entry, deviceId = 'serial-local') => {
    const result = { frame: null, events: [], invalidate: [] };
    if (entry.type !== 'rx' || entry.origin !== 'serial' || typeof entry.text !== 'string' || entry.text.length > 65536) return result;
    const line = entry.text.trim();
    const lower = fold(line);
    const at = entry.receivedAt ?? Date.now();
    const event = (group, phase, extra = {}) => result.events.push({ group, phase, at, text: line.slice(0, 600), ...extra });
    // Lab3-02 echoes "User> <command>" and then answers with "OK: ...", "ERR: ..." or, for pwd, the path.
    // Pair them so every command gets a result, not only the ones that fail.
    if (profile.panels.includes('shell')) {
      const typed = /^User>\s*(.+)$/.exec(line);
      if (typed) shell = { command: typed[1].trim().slice(0, 140), entries: 0 };
      else if (shell) {
        const verb = shell.command.split(/\s+/)[0].toLowerCase();
        if (/^(?:📁|📄)|^\[(?:DIR|FILE)\]/u.test(line)) shell.entries++;
        const reply = /^(OK|ERR):/.exec(line);
        if (reply || (verb === 'pwd' && /^\/\S*$/.test(line))) {
          event('shell', reply?.[1] === 'ERR' ? 'error' : 'ok', { command: shell.command, verb, reply: line.slice(0, 300), entries: verb === 'ls' ? shell.entries : null });
          shell = null;
        }
      }
    }
    // Lab4-03b prints "[NMEA RAW] [OK  ] [GGA (...)] $GPGGA,...": decode the embedded sentence (checksum re-verified).
    const embedded = /^\[NMEA RAW\]\s+\[OK\s*\].*\s(\$G[PNLBA](?:GGA|RMC),\S+)$/.exec(line);
    if (line.startsWith('$') || embedded) {
      const fix = nmeaPosition(embedded ? embedded[1] : line);
      if (!fix) return result;
      event('gps', fix.valid ? 'sample' : 'waiting');
      if (fix.valid) result.frame = adaptSerialLine(JSON.stringify(fix), deviceId, at);
      else result.invalidate.push('gpsLat', 'gpsLon', 'gpsAlt');
      return result;
    }

    // Chunked Serial image (Lab4-04b): IMG_BEGIN:<bytes>, IMG_CHUNK:<base64>..., IMG_END. Any inconsistency drops the whole image.
    const begin = /^IMG_BEGIN:(\d{1,6})$/.exec(line);
    if (begin) { image = { size: Number(begin[1]), chunks: [], bytes: 0 }; return result; }
    if (line.startsWith('IMG_CHUNK:') || line === 'IMG_END') {
      if (!image) return result;
      if (line === 'IMG_END') {
        const complete = image;
        image = null;
        const data = complete.chunks.join('');
        const tail = atob(complete.chunks.at(-1) ?? '');
        if (complete.bytes !== complete.size || !data.startsWith('/9j/') || tail.charCodeAt(tail.length - 2) !== 0xff || tail.charCodeAt(tail.length - 1) !== 0xd9) { event('camera', 'error'); return result; }
        event('camera', 'saved', { text: `Đã nhận ảnh ${complete.size} byte qua Serial` });
        result.frame = adaptSerialLine(`data:image/jpeg;base64,${data}`, deviceId, at);
        return result;
      }
      const chunk = line.slice(10);
      const length = chunk.length / 4 * 3 - (chunk.endsWith('==') ? 2 : chunk.endsWith('=') ? 1 : 0);
      if (!/^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(chunk) || image.bytes + length > image.size) { image = null; event('camera', 'error'); return result; }
      image.chunks.push(chunk);
      image.bytes += length;
      return result;
    }
    if (/^ERROR:IMG_/.test(line)) { image = null; event('camera', 'error'); return result; }

    // Task logs are illustrative in the reference sketch; never promote them to hardware measurements.
    if ((profile.scheduler && /^\[(Sensor|Network)\]/.test(line)) || /^\[Sensor\] Đang đọc dữ liệu\.\.\. Nhiệt độ: 28\.5C$/.test(line)) {
      const name = line.startsWith('[Sensor]') ? 'Sensor' : 'Network';
      const phase = name === 'Sensor' ? 'sample' : lower.includes('bat dau') ? 'start' : lower.includes('da gui xong') ? 'done' : 'log';
      const match = valueAfter(lower, 'nhiet do');
      event('task', phase, { name, illustrative: true, value: match ? Number(match[1]) : null });
      return result;
    }
    // Lab3-03 (library v1.1.0): simulated housekeeping packets and a Core 0 diagnostic task.
    if (profile.scheduler && /^\[(HK-TELEM|DIAGNOSTIC)\]/.test(line)) {
      if (line.startsWith('[HK-TELEM]')) {
        const match = /nhiet do c&dh:\s*([-+]?\d+(?:\.\d+)?)/.exec(lower);
        event('task', 'sample', { name: 'TelemGen', illustrative: true, value: match ? Number(match[1]) : null });
      } else {
        const phase = lower.includes('bat dau') ? 'start' : lower.includes('hoan thanh') ? 'done' : 'log';
        event('task', phase, { name: 'SysDiag', illustrative: false });
      }
      return result;
    }
    // Lab3-04 heartbeat feeds the watchdog; Lab3-05 dispatcher handles queued events. Neither is a measurement.
    if (/^\[obc heartbeat\]/.test(lower)) { event('task', 'sample', { name: 'Heartbeat', illustrative: false }); return result; }
    if (/^\[dispatcher\]/.test(lower)) { event('task', 'sample', { name: 'Dispatcher', illustrative: /canh bao vien trac/.test(lower) }); return result; }
    if (/\[su co\b|emergency:|freefall detected|overheat\s*\(|watchdog.*(?:triggered|timed out)|task_wdt.*(?:error|failed)|guru meditation|backtrace:|\bpanic\b/.test(lower)) event('alert', 'error');
    if (/^\[event\] no current anomaly|^\[fdir\].*phuc hoi/.test(lower)) event('alert', 'recovered');
    if (/^\[event\] anomaly state unknown/.test(lower)) event('alert', 'waiting');
    if (/^led (on|off)$/i.test(line)) event('led', 'ok', { value: /on$/i.test(line) });
    if (profile.scheduler && /^led (on|off)$/i.test(line)) event('task', 'sample', { name: 'LED', value: /on$/i.test(line), illustrative: false });
    if (/^(?:\[raw\] )?raw_accel:/i.test(line)) {
      const values = ['x', 'y', 'z'].map(axis => Number(valueAfter(lower, `\\b${axis}`)?.[1]));
      if (values.every(value => Number.isInteger(value) && value >= -32768 && value <= 32767)) event('raw-imu', 'sample', { values });
    }
    if (/^hello /i.test(line)) event('serial', 'sample');
    if (/^echo:/i.test(line)) { event('serial', 'received'); return result; }
    if (/\b(no (?:valid )?fix)\b|chua (chot|khoa)|dang (cho fix|quet tim ve tinh)/.test(lower)) {
      event('gps', 'waiting'); result.invalidate.push('gpsLat', 'gpsLon', 'gpsAlt');
    }
    if (/uu tien (camera|gps)/.test(lower)) event('mux', 'sample');
    if (/lora aux busy|\[com\] lora config failed/.test(lower)) event('radio', 'error');
    else if (/\[tx\]|\[lora tx\]|dang phat xuong mat dat|send requested|dang gui qua lora|^\[com\] da gui/.test(lower)) event('radio', 'sent');
    // RX needs "nhận" (received) or "received": "nhắn" in "[COM] Đã gửi tin nhắn" folds to "nhan" and is a TX log, not a reception.
    else if (/\[rx\]|\[lora rx\]|\[com\].*(received|nhận)/.test(line.normalize('NFC').toLowerCase())) event('radio', 'received');
    if (/mqtt connected|wifi connected|http server started|ap ip address|ip address:|^\d{1,3}(?:\.\d{1,3}){3}$|so luong thiet bi dang ket noi/.test(lower)) event('network', 'reported');
    if (/^\[mqtt\] connected$/.test(lower)) event('network', 'reported');
    if (/^\[mqtt\].*(?:not configured|remains offline)/.test(lower)) event('network', 'waiting');
    if (/^\[mqtt\] publish submitted/.test(lower)) event('network', 'sent');
    if (/deep sleep|di ngu thoi|vua thuc day|thoi gian ngu|^\[eps-buck\]|tiet kiem dien trong/.test(lower)) event('power', 'reported');
    if (/jpeg saved and validated|da luu anh:|da luu anh vao the nho:|^photo captured!/.test(lower)) event('camera', 'saved');
    else if (/capture failed|error:capture|chup anh that bai|camera.*(unavailable|khong san sang|init co loi)|^\[uart-cam\] loi|^\[loi\] (?:timeout|du lieu|ghi the)/.test(lower)) event('camera', 'error');
    else if (/dang chup|chup anh bang camera|gui lenh chup anh/.test(lower)) event('camera', 'start');
    if (/sd write ok|\[sd\] telemetry saved|sd card da san sang|da ghi noi dung/.test(lower)) event('storage', 'saved');
    else if (/\[sd\] (?:log saved|saved to )/.test(lower)) event('storage', 'saved');
    else if (/sd.*(failed|not ready|chua san sang)|khong tim thay the (sd|nho)|khong the.*(the nho|file)|khong the mo file|^err: (?:directory|sd|mkdir|rmdir|rm\b|touch)/.test(lower) || (profile.lab === 3 && /^err:/.test(lower))) event('storage', 'error');
    else if (/^ok: (?:cd|ls|mkdir|rmdir|rm|touch)\b/.test(lower)) event('storage', 'reported');
    else if (/^user>|^\[dir\]|^\[file\]|^\[storage\]|^(?:📁|📄)|^\/(?:[\w.\-/]*)$|^current directory:/u.test(lower)) event('storage', 'reported');
    if (/\[sensor\].*(unavailable|not found)|khong tim thay bmp|(?:mpu|bmp280|qmc).*(?:failed|short read|khong tim thay)/.test(lower)) event('sensor', 'error');
    else if (/(?:wifi|mqtt).*(?:timed out|failed|disconnected)/.test(lower)) event('network', 'error');
    else if (/^\[error\]|^err:/.test(lower) && result.events.length === 0) event('system', 'error');

    // Only explicitly labelled local snapshots are unwrapped. TX / command / arbitrary prefixes are not telemetry.
    const wrapped = /^\[TELEMETRY\]\s+(EPS|Env|Acc|Gyro|Mag|GPS):\s*(\{.*\})$/.exec(line);
    // Lab7-01 (upstream 2026-11) prints the whole local snapshot as "[TELEM] {json}".
    const snapshot = /^\[TELEM\]\s+(\{.*\})$/.exec(line);
    let json;
    try { if (wrapped || snapshot || line.startsWith('{')) json = JSON.parse(wrapped ? wrapped[2] : snapshot ? snapshot[1] : line); } catch { /* A partial/malformed JSON line is not a sample. */ }
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      if (!acceptsSerialMetadata(json, deviceId)) return result;
      const noFix = json.valid === false || json.gps?.valid === false;
      if (noFix) result.invalidate.push('gpsLat', 'gpsLon', 'gpsAlt');
      const normalized = { ...json };
      // Full-satellite nested snapshot has explicit SI field names.
      if (json.eps || json.env || json.imu) {
        normalized.voltage = json.eps?.batt_v ?? json.eps?.v;
        normalized.temperature = json.env?.temp;
        normalized.pressure = json.env?.press;
        for (const [axis, letter] of [['X', 'x'], ['Y', 'y'], ['Z', 'z']]) {
          if (json.imu?.[`a${letter}_ms2`] !== undefined) normalized[`acc${axis}`] = typeof json.imu[`a${letter}_ms2`] === 'number' ? json.imu[`a${letter}_ms2`] / 9.80665 : json.imu[`a${letter}_ms2`];
          if (json.imu?.[`g${letter}_rads`] !== undefined) normalized[`gyro${axis}`] = typeof json.imu[`g${letter}_rads`] === 'number' ? json.imu[`g${letter}_rads`] * 180 / Math.PI : json.imu[`g${letter}_rads`];
        }
        if (json.gps) normalized.gps = { ...json.gps, lon: json.gps.lng ?? json.gps.lon };
      }
      // The RTOS labels identify Sensor library units: m/s², rad/s, Gauss.
      if (wrapped) for (const [prefix, factor] of Object.entries({ acc: 1 / 9.80665, gyro: 180 / Math.PI, mag: 100 })) {
        for (const axis of ['x', 'y', 'z']) if (typeof normalized[`${prefix}_${axis}`] === 'number') normalized[`${prefix}_${axis}`] *= factor;
      }
      if (noFix) { normalized.lat = null; normalized.lng = null; normalized.gps = null; }
      result.invalidate.push(...explicitNullMeasurements(normalized));
      result.frame = adaptSerialLine(JSON.stringify(normalized), deviceId, at);
      return result;
    }
    result.frame = adaptSerialLine(line, deviceId, at);
    if (result.frame) return result;
    if (/\[tx\]|\[rx\]|\[lora |\[cmd\]|^user>|dang phat xuong mat dat/.test(lower)) return result;
    const data = {};
    const add = (key, label, factor = 1) => { const match = valueAfter(lower, label); if (match) data[key] = Number(match[1]) * factor; };
    // Recognize labelled measurements with units, never arbitrary numbers in boot/error messages.
    if (!/\[error\]|\[loi\]|warning|canh bao/.test(lower)) {
      if (/nhiet do|temperature/.test(lower) && /(?:°|\*|\s|\d)c\b/.test(lower)) add('temperature', '(?:nhiet do(?: \\(temperature\\))?|temperature)');
      if (/ap suat|pressure/.test(lower) && /hpa\b/.test(lower)) add('pressure', '(?:ap suat(?: \\(pressure\\))?|pressure)');
      if (/battery voltage|dien ap (?:pin|thuc)|dien ap\s*[:=]/.test(lower) && /v\b/.test(lower)) add('voltage', '(?:battery voltage|dien ap(?: (?:pin(?: hien tai)?|thuc))?)');
      if (/^sensor: temp=/.test(lower)) { add('temperature', 'temp'); add('pressure', 'press'); }
      if (/^eps: battery=/.test(lower)) add('voltage', 'battery');
      if (/^status: up /.test(lower)) { add('voltage', 'bat'); const up = /up (\d+)s/.exec(lower); if (up) data.uptime_ms = Number(up[1]) * 1000; }
      add('uptime_ms', '\\[uptime', 1000);
      if (/gia toc|accelerometer/.test(lower)) axes = 'acc';
      if (/goc quay|gyroscope|con quay|toc do goc/.test(lower)) axes = 'gyro';
      if (/tu truong|magnetometer/.test(lower)) axes = 'mag';
      const xyz = ['x', 'y', 'z'].map(axis => valueAfter(lower, `\\b${axis}`));
      let prefix = '';
      let factor = 1;
      if (/m\/s(?:\^?2|²)/.test(lower)) { prefix = 'acc'; factor = 1 / 9.80665; }
      else if (/rad\/s/.test(lower)) { prefix = 'gyro'; factor = 180 / Math.PI; }
      else if (/gauss/.test(lower)) { prefix = 'mag'; factor = 100; }
      else if (axes === 'mag' && /\bg\b/.test(lower)) { prefix = 'mag'; factor = 100; }
      else if (/\but\b|µt/.test(lower)) prefix = 'mag';
      else if (/deg\/s|°\/s/.test(lower)) prefix = 'gyro';
      if (prefix && xyz.every(Boolean) && (!axes || axes === prefix)) {
        xyz.forEach((match, index) => { data[`${prefix}_${'xyz'[index]}`] = Number(match[1]) * factor; });
      }
      const coords = new RegExp(`(?:toa do \\((?:vi do, kinh do|lat, lng)\\)\\s*:\\s*|lat[:=]\\s*)${NUMBER}\\s*(?:,\\s*(?:(?:lng|lon)[:=]\\s*)?|[-|]?\\s*(?:lng|lon)[:=])\\s*${NUMBER}`, 'iu').exec(lower);
      if (coords) { data.lat = Number(coords[1]); data.lng = Number(coords[2]); }
      if (/cao do so voi mat bien/.test(lower)) add('alt', 'cao do so voi mat bien');
      // Lab4-03c prints each coordinate on its own labelled line. Pair them (same frame) so a lost
      // "Toa do" line, or a different order, still draws the map. Hemisphere gives the sign.
      const latLine = /^\W*vi do \(latitude\)\s*:\s*([\d.]+)\D*(bac|nam)/.exec(lower);
      const lngLine = /^\W*kinh do \(longitude\)\s*:\s*([\d.]+)\D*(dong|tay)/.exec(lower);
      if (latLine) pendingLat = Number(latLine[1]) * (latLine[2] === 'nam' ? -1 : 1);
      if (lngLine && pendingLat !== null) { data.lat = pendingLat; data.lng = Number(lngLine[1]) * (lngLine[2] === 'tay' ? -1 : 1); pendingLat = null; }
      if (/^\W*cao do \(altitude\)/.test(lower)) add('alt', 'cao do [(]altitude[)]');
      if (/^led (on|off)$/i.test(line)) data.led_on = /on$/i.test(line);
    }
    result.frame = adaptSerialLine(JSON.stringify(data), deviceId, at);
    // Explicit unavailable values invalidate only their own subsystem, not the rest of the snapshot.
    if (/nan|unavailable|not found/.test(lower)) {
      if (/bmp280/.test(lower)) result.invalidate.push('temperatureC', 'pressureHpa');
      if (/mpu/.test(lower)) result.invalidate.push('accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ');
      if (/qmc/.test(lower)) result.invalidate.push('magX', 'magY', 'magZ');
      if (/nhiet do|temperature/.test(lower)) result.invalidate.push('temperatureC');
      if (/ap suat|pressure/.test(lower)) result.invalidate.push('pressureHpa');
      if (/m\/s(?:\^?2|²)/.test(lower)) result.invalidate.push('accX', 'accY', 'accZ');
      if (/rad\/s/.test(lower)) result.invalidate.push('gyroX', 'gyroY', 'gyroZ');
      if (/gauss|\but\b/.test(lower)) result.invalidate.push('magX', 'magY', 'magZ');
    }
    return result;
  };
}
