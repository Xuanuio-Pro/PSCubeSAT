import { acceptsSerialMetadata, adaptSerialLine, explicitNullMeasurements } from './adapters.js';
import { reduceNetworkReport } from './network-report.js';

// Panels per exercise, matched to what the reference sketch actually prints. First match wins.
/** @type {Array<[RegExp, string[]]>} */
const EXERCISE_PANELS = [
  [/^Lab1-(09|1[01])/, ['lab1Connection']],
  // Lab1 sketches that log the LED / button state; 1-02, 1-03_PWM and 1-05 print nothing (the LEDs are the evidence).
  [/^Lab1-(01|04_Button|05|08)/, ['lab1Io']],
  [/^Lab2-/, ['voltage']],
  // Lab3-01a/b only log to the SD card: the Serial Monitor is the whole view.
  [/^Lab3-01/, []],
  // Lab3-02 pairs every typed command with the shell's reply.
  [/^Lab3-02/, ['shell']],
  [/^Lab4-01/, ['environment']],
  [/^Lab4-02/, ['attitude']],
  [/^Lab4-03/, ['gps']],
  [/^Lab4-04/, ['camera']],
  [/^Lab4-06/, ['environment', 'attitude', 'gps']],
  [/^Lab5-01/, ['radio']],
  // Uplink commands are sent from the separate ground-station window, not from the OBC's USB port.
  [/^Lab5-0[23]/, ['radio', 'groundStation']],
  // Lab3-04 (watchdog) and Lab3-05 (event queue) report events, not measurements: activity log only.
  [/^Lab3-0[45]/, []],
  [/^Lab4-05/, ['gps', 'camera']],
  // Lab7 (PTITCube 2026-11-24) takes its single-letter commands over LoRa, from the ground-station window.
  // The ground-station link comes right after the Serial Monitor; SD and LoRa evidence live in System Check.
  [/^Lab7-01/, ['groundStation', 'attitude', 'gps', 'voltage', 'environment', 'system']],
  // Lab7-02 saves photos to SD only (command f over LoRa), so a camera panel would never show an image.
  [/^Lab7-02/, ['groundStation', 'attitude', 'gps', 'voltage', 'environment', 'system']],
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
  if (id.startsWith('Lab3-02')) commands = ['pwd', 'ls', 'mkdir demo', 'cd demo', 'touch note.txt', 'rm note.txt', 'cd ..', 'rmdir demo'];
  if (id.startsWith('Lab3-04')) commands = ['f'];
  if (id.startsWith('Lab3-05')) commands = ['A'];
  if (id.startsWith('Lab4-04') || id.startsWith('Lab4-05')) commands = ['p'];
  const note = scheduler
    ? 'Lab3-03 sinh gói viễn trắc giả lập (điện áp, nhiệt độ ngẫu nhiên) và tác vụ tự chẩn đoán trên Core 0. Các số liệu TELEM là minh họa, không phải phép đo; LED nhịp tim không có log.'
    : id.startsWith('Lab3-04') ? 'Gửi f (hoặc nhấn nút GPIO 4 trên PCB thí nghiệm rời; trên chồng bo vệ tinh GPIO 4 là chân Buck nên nút không dùng được) để mô phỏng treo: tác vụ ngừng nạp Watchdog, TWDT reset bo sau khoảng 3 giây và log khởi động báo nguyên nhân Task Watchdog Reset.'
      : lab === 7 ? 'Lệnh một ký tự gửi qua LoRa từ cửa sổ Trạm mặt đất: a (ACK), b (ghi/đọc pin trên SD), c (gia tốc), d (con quay), e (GPS), f (chụp ảnh), p/r (tạm dừng/tiếp tục viễn trắc). OBC không nhận lệnh này qua USB Serial.'
      : id.startsWith('Lab3-05') ? 'Mọi sự kiện (nút nhấn GPIO 4, cảnh báo nhiệt độ giả lập > 30°C, ký tự gửi qua Serial) đi qua FreeRTOS Queue tới tác vụ Dispatcher. Nhiệt độ là số giả lập, không phải phép đo.'
      : lab === 5 ? 'Log phát LoRa chỉ xác nhận yêu cầu gửi tại OBC. Cần phản hồi từ trạm mặt đất để xác nhận nhận thành công; Lệnh uplink gửi từ cửa sổ Trạm mặt đất (USB-TTL + LoRa), không gửi qua USB Serial của OBC.'
      : lab === 8 ? 'Mẫu Lab8 là khung chương trình. Hãy bổ sung nhiệm vụ và xuất JSON telemetry để dashboard có dữ liệu.'
        : /^Lab4-02a/.test(id) ? 'Bản mẫu đọc burst 14 byte và quy đổi theo dải mặc định ±2g / ±250°/s. Nếu cấu hình thanh ghi khác dải này, giá trị m/s² và rad/s sẽ sai tỷ lệ.'
          : /^Lab4-04|^Lab4-05/.test(id) ? 'Ảnh lưu vào thư mục /photos trên thẻ SD được bo tự gửi lên máy chủ qua MQTT và hiện ở đây, không cần viết code gửi ảnh. Lần đầu, giữ kết nối Serial khi bo khởi động để trình duyệt cấu hình WiFi cho bo.'
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
  // GGA field 7 = satellites in use; shown while searching, never turned into a position.
  const satellites = gga && /^\d{1,2}$/.test(fields[7]) ? Number(fields[7]) : undefined;
  if (!valid) return { valid: false, satellites };
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
  return { valid: true, lat, lng, satellites, ...(gga && fields[9] !== '' && fields[10] === 'M' ? { alt: Number(fields[9]) } : {}) };
}

/**
 * Stateful only for explicit multiline IMU headers; discarded on source/session/lesson changes.
 * `groundStation`: the port is the ground station's USB-TTL, so every line it reads is a LoRa reception
 * and raw JSON lines are the satellite's downlink chunks.
 */
export function createPracticeDecoder(exerciseId = '', { groundStation = false } = {}) {
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
    if (groundStation && line) event('radio', 'received');
    // Hidden photo uplink in the platform library (compiler/overrides/CDH/PTITCloud.cpp): never sketch output.
    if (line.startsWith('[CLOUD] ')) {
      const sent = /^\[CLOUD\] PHOTO SENT (\S+) (\d+)$/.exec(line);
      const failed = /^\[CLOUD\] PHOTO FAIL (\S+) (\S+)$/.exec(line);
      if (sent) event('camera', 'uploaded', { path: sent[1], size: Number(sent[2]), text: `Đã gửi ảnh ${sent[1]} lên máy chủ` });
      else if (failed) event('camera', 'upload-error', { path: failed[1], reason: failed[2], text: `Gửi ảnh ${failed[1]} lên máy chủ thất bại (${failed[2]})` });
      return result;
    }
    // Lab3-02 echoes the command ("> cmd", older sketches "User> cmd") and then answers with "OK" / "OK: ...",
    // "ERR: ..." or, for pwd, the path. Pair them so every command gets a result, not only the ones that fail.
    if (profile.panels.includes('shell')) {
      const typed = /^(?:User)?>\s*(.+)$/.exec(line);
      if (typed) shell = { command: typed[1].trim().slice(0, 140), entries: 0 };
      else if (shell) {
        const verb = shell.command.split(/\s+/)[0].toLowerCase();
        if (/^(?:📁|📄)|^\[(?:DIR|FILE)\]|^(?:DIR|FILE):/u.test(line)) shell.entries++;
        const reply = /^(OK|ERR)(?::|$)/.exec(line);
        const unknown = /^command not recognized/i.test(line);
        // cat / df / help answer with their output instead of OK.
        const output = ['cat', 'df', 'help', '?'].includes(verb) && !/^(?:DIR|FILE):/.test(line);
        if (reply || unknown || output || (verb === 'pwd' && /^\/\S*$/.test(line))) {
          event('shell', reply?.[1] === 'ERR' || unknown ? 'error' : 'ok', { command: shell.command, verb, reply: line.slice(0, 300), entries: verb === 'ls' ? shell.entries : null });
          shell = null;
        }
      }
    }
    // Lab4-03b prints "NMEA RAW: OK   (GGA) $GPGGA,..." (older: "[NMEA RAW] [OK  ] [GGA (...)] $GPGGA,...").
    // Decode the embedded sentence; its checksum is re-verified here.
    const embedded = /^(?:\[NMEA RAW\]\s+\[OK\s*\]|NMEA RAW:\s+OK\b).*\s(\$G[PNLBA](?:GGA|RMC),\S+)$/.exec(line);
    if (line.startsWith('$') || embedded) {
      const fix = nmeaPosition(embedded ? embedded[1] : line);
      if (!fix) return result;
      const { satellites, ...position } = fix;
      event('gps', fix.valid ? 'sample' : 'waiting', satellites === undefined ? {} : { satellites });
      if (fix.valid) result.frame = adaptSerialLine(JSON.stringify(position), deviceId, at);
      else result.invalidate.push('gpsLat', 'gpsLon', 'gpsAlt');
      return result;
    }

    // Chunked Serial image (Lab4-04b): IMG_BEGIN:<bytes>, IMG_CHUNK:<base64>..., IMG_END. Any inconsistency drops the whole image.
    const begin = /^IMG_BEGIN:(\d{1,6})$/.exec(line);
    if (begin) {
      image = { size: Number(begin[1]), chunks: [], bytes: 0 };
      // `transfer`: progress of the copy to the browser, distinct from the camera → OBC transfer.
      event('camera', 'progress', { received: 0, total: image.size, transfer: 'browser', text: `Đang nhận ảnh ${image.size} byte qua Serial…` });
      return result;
    }
    if (line.startsWith('IMG_CHUNK:') || line === 'IMG_END') {
      if (!image) return result;
      if (line === 'IMG_END') {
        const complete = image;
        image = null;
        const data = complete.chunks.join('');
        const tail = atob(complete.chunks.at(-1) ?? '');
        if (complete.bytes !== complete.size || !data.startsWith('/9j/') || tail.charCodeAt(tail.length - 2) !== 0xff || tail.charCodeAt(tail.length - 1) !== 0xd9) { event('camera', 'error'); return result; }
        event('camera', 'saved', { text: `Đã nhận ảnh ${complete.size} byte qua Serial`, browser: true });
        result.frame = adaptSerialLine(`data:image/jpeg;base64,${data}`, deviceId, at);
        return result;
      }
      const chunk = line.slice(10);
      const length = chunk.length / 4 * 3 - (chunk.endsWith('==') ? 2 : chunk.endsWith('=') ? 1 : 0);
      if (!/^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(chunk) || image.bytes + length > image.size) { image = null; event('camera', 'error'); return result; }
      image.chunks.push(chunk);
      image.bytes += length;
      // One progress update per ~3 KB keeps the 120-event activity window for other subsystems.
      if (image.chunks.length % 8 === 0) event('camera', 'progress', { received: image.bytes, total: image.size, transfer: 'browser', text: `Đang nhận ảnh qua Serial: ${image.bytes} / ${image.size} byte` });
      return result;
    }
    if (/^ERROR:IMG_/.test(line)) { image = null; event('camera', 'error'); return result; }

    // Lab4-04a transfer progress: "Camera: Da nhan 5640 / 17276 bytes".
    const progress = /^camera: da nhan (\d+) \/ (\d+) bytes/.exec(lower);
    if (progress) { event('camera', 'progress', { received: Number(progress[1]), total: Number(progress[2]) }); return result; }
    // Firmware-computed attitude "Roll: 4.3, Pitch: -1.5, Head: 6.8" (Lab4-02a/b): the heading comes from the magnetometer.
    const euler = new RegExp(`^roll:\\s*${NUMBER},\\s*pitch:\\s*${NUMBER},\\s*head:\\s*${NUMBER}$`).exec(lower);
    if (euler) {
      const [roll, pitch, heading] = euler.slice(1).map(Number);
      if ([roll, pitch, heading].every(Number.isFinite)) event('attitude', 'sample', { roll, pitch, heading });
      return result;
    }
    // "Scheduler: Đã đăng ký task: Telemetry (chu kỳ 2000ms, Core 1, Priority 1)": the declared period, before any run.
    const registered = /^scheduler: da dang ky task: (\S+) \(chu ky (\d+)ms, core (\d+), priority (\d+)\)/.exec(lower);
    if (registered && profile.scheduler) {
      // Lab3-03 logs its tasks under other names: TELEM lines are TelemGen, DIAG lines SysDiag.
      const name = { telemetry: 'TelemGen', diagnostic: 'SysDiag', heartbeat: 'Heartbeat' }[registered[1]] ?? registered[1];
      event('task', 'registered', { name, periodMs: Number(registered[2]), core: Number(registered[3]), priority: Number(registered[4]) });
      return result;
    }
    // "[BOOT] ... ready": the OBC started even before any command or measurement arrives.
    if (/^\[boot\]/.test(lower)) event('system', 'boot');

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
    // Lab3-03 (PTITCube 2026-11-24): "TELEM: #0001 | V: 3.70V | T: 24.5C | ..." is simulated; "DIAG: ..." is the Core 0 task.
    if (profile.scheduler && /^(TELEM|DIAG):/.test(line)) {
      if (line.startsWith('TELEM:')) {
        const match = /\bt:\s*([-+]?\d+(?:\.\d+)?)\s*c\b/.exec(lower);
        event('task', 'sample', { name: 'TelemGen', illustrative: true, value: match ? Number(match[1]) : null });
      } else event('task', 'sample', { name: 'SysDiag', illustrative: false });
      return result;
    }
    // Lab3-04 heartbeat feeds the watchdog; Lab3-05 dispatcher handles queued events. Neither is a measurement.
    if (/^\[obc heartbeat\]/.test(lower)) { event('task', 'sample', { name: 'Heartbeat', illustrative: false }); return result; }
    if (/^\[dispatcher\]/.test(lower)) { event('task', 'sample', { name: 'Dispatcher', illustrative: /canh bao vien trac/.test(lower) }); return result; }
    // Lab3-05 (2026-11-24): "Event: Button ...", "Event: Temp Alert: 33 C ..." (simulated), "Event: Cmd: 'A' ...".
    if (/^event: (?:button|temp alert|cmd)\b/.test(lower)) { event('task', 'sample', { name: 'Dispatcher', illustrative: /temp alert/.test(lower) }); return result; }
    if (/\[su co\b|emergency:|freefall detected|overheat\s*\(|watchdog.*(?:triggered|timed out)|task_wdt.*(?:error|failed)|guru meditation|backtrace:|\bpanic\b|^wdt: treo/.test(lower)) event('alert', 'error');
    if (/^\[event\] no current anomaly|^\[fdir\].*phuc hoi|twdt da tu phuc hoi/.test(lower)) event('alert', 'recovered');
    if (/^\[event\] anomaly state unknown/.test(lower)) event('alert', 'waiting');
    if (/^led:? (on|off)$/i.test(line)) event('led', 'ok', { value: /on$/i.test(line) });
    if (/^button: (pressed|released)$/i.test(line)) event('button', 'ok', { value: /pressed$/i.test(line) });
    if (profile.scheduler && /^led:? (on|off)$/i.test(line)) event('task', 'sample', { name: 'LED', value: /on$/i.test(line), illustrative: false });
    if (/^(?:\[raw\] )?raw_accel:/i.test(line)) {
      const values = ['x', 'y', 'z'].map(axis => Number(valueAfter(lower, `\\b${axis}`)?.[1]));
      if (values.every(value => Number.isInteger(value) && value >= -32768 && value <= 32767)) event('raw-imu', 'sample', { values });
    }
    // Lab1 Serial greeting/echo. "Hello World #n" in Lab3 is a log entry, not a Serial round trip.
    if (profile.lab === 1 && /^hello /i.test(line)) event('serial', 'sample');
    if (/^echo:/i.test(line)) { event('serial', 'received'); return result; }
    if (/\b(no (?:valid )?fix)\b|waiting for fix|chua (chot|khoa)|dang (cho fix|quet tim ve tinh)/.test(lower)) {
      const sats = /(\d{1,2})\s*sats\b/.exec(lower);
      event('gps', 'waiting', sats ? { satellites: Number(sats[1]) } : {}); result.invalidate.push('gpsLat', 'gpsLon', 'gpsAlt');
    } else {
      // Lab4-03c with a fix: "GPS: 8 sats | Lat: ..." (the position itself is parsed below).
      const sats = /^gps: (\d{1,2}) sats \|/.exec(lower);
      if (sats) event('gps', 'sample', { satellites: Number(sats[1]) });
    }
    if (/uu tien (camera|gps)/.test(lower)) event('mux', 'sample');
    if (/lora aux busy|\[com\] lora config failed/.test(lower)) event('radio', 'error');
    else if (groundStation) { /* already counted as a reception above */ }
    else if (/\[tx\]|\[lora tx\]|^tx: |dang phat xuong mat dat|send requested|dang gui qua lora|^\[com\] da gui/.test(lower)) event('radio', 'sent');
    // RX needs "nhận" (received) or "received": "nhắn" in "[COM] Đã gửi tin nhắn" folds to "nhan" and is a TX log, not a reception.
    // "CMD: <cmd> -> <reply>" (Lab5-03) and "Received command: x" (Lab7) are uplink commands the OBC received.
    else if (/\[rx\]|\[lora rx\]|^rx: |^cmd: .* -> |^received command: |\[com\].*(received|nhận)/.test(line.normalize('NFC').toLowerCase())) event('radio', 'received');
    if (/mqtt connected|wifi connected|http server started|ap ip address|ip address:|^\d{1,3}(?:\.\d{1,3}){3}$|so luong thiet bi dang ket noi/.test(lower)) event('network', 'reported');
    if (/^\[mqtt\] connected$/.test(lower)) event('network', 'reported');
    if (/^\[mqtt\].*(?:not configured|remains offline)/.test(lower)) event('network', 'waiting');
    if (/^\[mqtt\] publish submitted/.test(lower)) event('network', 'sent');
    if (/deep sleep|di ngu thoi|vua thuc day|thoi gian ngu|^\[eps-buck\]|tiet kiem dien trong|^eps: (?:power saving|normal) mode|power saving mode (?:enabled|disabled)/.test(lower)) event('power', 'reported');
    if (/jpeg saved and validated|da luu anh:|da luu anh vao the nho:|^photo captured!|^camera: saved |photo captured and saved/.test(lower)) event('camera', 'saved');
    else if (/capture failed|error:capture|chup anh that bai|^camera: (?:chup that bai|capture invalid|timeout|loi|esp32-cam bao loi|invalid size|size khong hop le|ghi the|du lieu|khong the|the nho chua|sd |mkdir failed|open file failed)|camera.*(unavailable|khong san sang|init co loi|disabled)|^\[uart-cam\] loi|^\[loi\] (?:timeout|du lieu|ghi the)/.test(lower)) event('camera', 'error');
    else if (/dang chup|chup anh bang camera|gui lenh chup anh|^capturing photo/.test(lower)) event('camera', 'start');
    if (/sd write ok|\[sd\] telemetry saved|sd card da san sang|da ghi noi dung/.test(lower)) event('storage', 'saved');
    else if (/(?:\[sd\]|^sd:) (?:log saved|saved to )/.test(lower)) event('storage', 'saved');
    else if (/sd.*(failed|not ready|chua san sang|short write)|khong tim thay the (sd|nho)|khong the.*(the nho|file)|khong the mo file|^err: (?:directory|sd|mkdir|rmdir|rm\b|touch)/.test(lower) || (profile.lab === 3 && /^err:/.test(lower))) event('storage', 'error');
    else if (/^ok: (?:cd|ls|mkdir|rmdir|rm|touch)\b/.test(lower)) event('storage', 'reported');
    // Lab7 command b (battery log written to and read back from the SD card), also relayed over LoRa.
    else if (profile.lab === 7 && /saving battery data to sd card|reading from sd card|^\[\d\/5\] bat: /.test(lower)) event('storage', 'reported');
    else if (/^user>|^>\s|^\[dir\]|^\[file\]|^(?:dir|file):|^\[storage\]|^(?:📁|📄)|^\/(?:[\w.\-/]*)$|^current directory:/u.test(lower)) event('storage', 'reported');
    if (/\[sensor\].*(unavailable|not found)|khong tim thay bmp|(?:mpu|bmp280|qmc).*(?:failed|short read|khong tim thay|unavailable)|sensor not detected/.test(lower)) event('sensor', 'error');
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
      // An explicit "no fix" is evidence the GPS answers (System Check), unlike a snapshot without a gps key.
      if (noFix) { result.invalidate.push('gpsLat', 'gpsLon', 'gpsAlt'); event('gps', 'waiting'); }
      // Lab7-01 "imu.yaw" is the library's magnetometer heading; its LoRa chunk names it "head".
      const heading = json.imu?.yaw ?? json.imu?.head;
      if ([json.imu?.roll, json.imu?.pitch, heading].every(value => typeof value === 'number' && Number.isFinite(value))) {
        event('attitude', 'sample', { roll: json.imu.roll, pitch: json.imu.pitch, heading });
      }
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
      // The RTOS labels carry Sensor library units: m/s², rad/s, µT (PTITCube library 74065b6; earlier releases used Gauss).
      // Lab7-02 downlinks the same payloads unlabelled, so at the ground station a raw chunk carries the same units.
      if (wrapped || (groundStation && profile.id.startsWith('Lab7-02'))) for (const [prefix, factor] of Object.entries({ acc: 1 / 9.80665, gyro: 180 / Math.PI, mag: 1 })) {
        for (const axis of ['x', 'y', 'z']) if (typeof normalized[`${prefix}_${axis}`] === 'number') normalized[`${prefix}_${axis}`] *= factor;
      }
      if (noFix) { normalized.lat = null; normalized.lng = null; normalized.gps = null; }
      result.invalidate.push(...explicitNullMeasurements(normalized));
      result.frame = adaptSerialLine(JSON.stringify(normalized), deviceId, at);
      return result;
    }
    result.frame = adaptSerialLine(line, deviceId, at);
    if (result.frame) return result;
    // Radio payloads and command replies describe the satellite, not this board's own measurement stream.
    if (/\[tx\]|\[rx\]|\[lora |\[cmd\]|^tx: |^rx: |^cmd: |^received command|^ack: |^user>|^>\s|dang phat xuong mat dat/.test(lower)) return result;
    const data = {};
    const add = (key, label, factor = 1) => { const match = valueAfter(lower, label); if (match) data[key] = Number(match[1]) * factor; };
    // Recognize labelled measurements with units, never arbitrary numbers in boot/error messages.
    if (!/\[error\]|\[loi\]|warning|canh bao/.test(lower)) {
      if (/nhiet do|temperature/.test(lower) && /(?:°|\*|\s|\d)c\b/.test(lower)) add('temperature', '(?:nhiet do(?: \\(temperature\\))?|temperature)');
      if (/ap suat|pressure/.test(lower) && /hpa\b/.test(lower)) add('pressure', '(?:ap suat(?: \\(pressure\\))?|pressure)');
      if (/battery voltage|dien ap (?:pin|thuc)|dien ap\s*[:=]/.test(lower) && /v\b/.test(lower)) add('voltage', '(?:battery voltage|dien ap(?: (?:pin(?: hien tai)?|thuc))?)');
      if (/^sensor: temp=/.test(lower)) { add('temperature', 'temp'); add('pressure', 'press'); }
      // Lab4-01a/b: "Temp: 25.00 C | Press: 1008.1 hPa".
      if (/^temp: .*\bpress: .*hpa\b/.test(lower)) { add('temperature', '^temp'); add('pressure', '\\bpress'); }
      // Lab4 read-all: "TELEM: T: 25.1C | P: 1008.0hPa | Roll: .. | Pitch: .. | GPS: (lat, lng, Nsats)".
      // Lab3-03's "TELEM: #0001 | V: .. | T: .." is simulated and never reaches here (scheduler branch above).
      if (/^telem: t: /.test(lower)) {
        add('temperature', '\\bt'); add('pressure', '\\bp');
        const fix = new RegExp(`gps: \\(${NUMBER}, ${NUMBER}, \\d+\\s*sats\\)`).exec(lower);
        if (fix) { data.lat = Number(fix[1]); data.lng = Number(fix[2]); }
      }
      // Lab2 EPS (MAX17048): "V: 3.700 V | SOC: 85.0 % | Rate: .." and "EPS: Normal Mode (V: 3.70V, SOC: 85.0%)".
      if (/\bsoc:/.test(lower)) {
        add('voltage', '(?:^|\\()v');
        // The MAX17048 is powered by the cell, so ≤ 0.5 V means the gauge was not read (same threshold as Lab7).
        if (data.voltage !== undefined && data.voltage <= 0.5) { delete data.voltage; result.invalidate.push('voltageV'); }
        // SOC, charge rate and the Lab2-02 mode belong to the same gauge reading; not schema fields, so they travel as an event.
        else if (data.voltage !== undefined) {
          const soc = valueAfter(lower, '\\bsoc');
          const rate = valueAfter(lower, '\\brate');
          event('eps', 'sample', { soc: soc ? Number(soc[1]) : null, rate: rate ? Number(rate[1]) : null,
            mode: /power saving mode/.test(lower) ? 'saving' : /normal mode/.test(lower) ? 'normal' : null });
        }
      }
      // Lab7 replies "Acceleration: ax=.., ay=.., az=.. m/s^2" and "Gyroscope: gx=.., gy=.., gz=.. rad/s".
      const vector = /^(acceleration|gyroscope): /.exec(lower);
      if (vector) {
        const [prefix, letter, factor] = vector[1] === 'acceleration' ? ['acc', 'a', 1 / 9.80665] : ['gyro', 'g', 180 / Math.PI];
        const values = ['x', 'y', 'z'].map(axis => valueAfter(lower, `\\b${letter}${axis}`));
        if (values.every(Boolean)) values.forEach((match, index) => { data[`${prefix}_${'xyz'[index]}`] = Number(match[1]) * factor; });
      }
      if (/^gps:/.test(lower)) add('alt', '\\balt');
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
      if (/^led:? (on|off)$/i.test(line)) data.led_on = /on$/i.test(line);
    }
    result.frame = adaptSerialLine(JSON.stringify(data), deviceId, at);
    // Explicit unavailable values invalidate only their own subsystem, not the rest of the snapshot.
    if (/nan|unavailable|not found|read failed/.test(lower)) {
      if (/bmp280/.test(lower)) result.invalidate.push('temperatureC', 'pressureHpa');
      if (/mpu/.test(lower)) result.invalidate.push('accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ');
      if (/qmc/.test(lower)) result.invalidate.push('magX', 'magY', 'magZ');
      if (/nhiet do|temperature/.test(lower)) result.invalidate.push('temperatureC');
      if (/ap suat|pressure/.test(lower)) result.invalidate.push('pressureHpa');
      if (/m\/s(?:\^?2|²)/.test(lower)) result.invalidate.push('accX', 'accY', 'accZ');
      if (/rad\/s/.test(lower)) result.invalidate.push('gyroX', 'gyroY', 'gyroZ');
      if (/gauss|\but\b/.test(lower)) result.invalidate.push('magX', 'magY', 'magZ');
      // Short labels (Lab4-01 "Temp:/Press:", Lab4 read-all "T:/P:") invalidate only the NaN field itself.
      // No trailing word boundary: "%.1fC" prints "nanC".
      if (/(?:^temp|\bt):\s*nan/.test(lower)) result.invalidate.push('temperatureC');
      if (/(?:\bpress|\bp):\s*nan/.test(lower)) result.invalidate.push('pressureHpa');
    }
    return result;
  };
}
