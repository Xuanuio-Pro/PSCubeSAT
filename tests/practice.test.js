import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/practice-serial.json' with { type: 'json' };
import { CURRICULUM, getExercisesForLab } from '../src/data/curriculum.js';
import { createPracticeDecoder, emptyActivity, reduceActivity, practiceProfile } from '../src/telemetry/practice.js';
import { createTelemetryStore, currentReadings, telemetryStatus } from '../src/telemetry/store.js';
import { adaptSerialLine } from '../src/telemetry/adapters.js';
import { visualizationPlan } from '../src/telemetry/visualization-plan.js';
import { describeShellResult } from '../src/telemetry/shell-results.js';
import { ACTIVE_WINDOW_MS, SUBSYSTEMS, subsystemStatus } from '../src/telemetry/system-check.js';

const entry = (text, at = 10000) => ({ text, receivedAt: at, type: 'rx', origin: 'serial' });

test('every curriculum practice has a concrete output fixture and matching visualization profile', () => {
  const ids = Object.keys(CURRICULUM).flatMap(labId => getExercisesForLab(Number(labId)).map(ex => ex.id));
  assert.deepEqual(fixtures.map(fixture => fixture.id).sort(), ids.sort());
});

for (const fixture of fixtures) test(`reference Serial output: ${fixture.id}`, () => {
  const profile = practiceProfile(fixture.id);
  assert.deepEqual(profile.panels, fixture.panels);
  if (fixture.commands) assert.deepEqual(profile.commands, fixture.commands);
  const decode = createPracticeDecoder(fixture.id);
  const fields = {};
  const events = [];
  for (const [index, line] of fixture.lines.entries()) {
    const result = decode(entry(line, 10000 + index * 100));
    events.push(...result.events);
    if (result.frame) for (const [key, value] of Object.entries(result.frame)) if (value !== null) fields[key] = value;
  }
  if (fixture.event) assert.ok(events.some(event => event.group === fixture.event), `Missing ${fixture.event}`);
  for (const [key, value] of Object.entries(fixture.fields)) {
    if (typeof value === 'number') assert.ok(Math.abs(fields[key] - value) < 1e-8, `${key}: ${fields[key]} != ${value}`);
    else assert.equal(fields[key], value, key);
  }
  if (Object.keys(fixture.fields).length === 0) assert.deepEqual(fields, {}, 'A log/alert must not invent physical measurements');
});

test('scheduler counts observed work, pairs duration and does not claim LED or actual MQTT activity', () => {
  const decode = createPracticeDecoder('Lab3-03_Multitasking_Scheduler');
  let activity = emptyActivity();
  const lines = [entry('[Sensor] Đang đọc dữ liệu... Nhiệt độ: 28.5C'), entry('[Network] BẮT ĐẦU gửi dữ liệu lên máy chủ...', 11000), entry('[Network] ĐÃ GỬI XONG!', 11500)];
  for (const line of lines) {
    const result = decode(line);
    assert.equal(result.frame, null);
    activity = result.events.reduce(reduceActivity, activity);
  }
  assert.equal(activity.tasks.Sensor.count, 1);
  assert.equal(activity.tasks.Sensor.value, 28.5);
  assert.equal(activity.tasks.Network.count, 1);
  assert.equal(activity.tasks.Network.durationMs, 500);
  assert.equal(activity.tasks.LED, undefined);
  assert.deepEqual(activity.subsystems, {});
  const completionWithoutStart = reduceActivity(emptyActivity(), { group: 'task', name: 'Network', phase: 'done', at: 13000 });
  assert.equal(completionWithoutStart.tasks.Network.durationMs, null);
});

test('compiler, app, TX, malformed JSON, non-finite values and illustration logs cannot become real samples', () => {
  const decode = createPracticeDecoder('Lab4-01b_Environment_Library');
  for (const line of [
    { ...entry('Nhiệt độ: 28.5 °C'), origin: 'app' }, { ...entry('{"temp":28.5}'), type: 'tx' },
    entry('[TX] {"temp":28.5}'), entry('[COM] Đã gửi tin nhắn: {"temp":28.5}'), entry('User> temperature: 100 C'),
    entry('[Sensor] Đang đọc dữ liệu... Nhiệt độ: 28.5C'), entry('{bad'), entry('[RAW] Nhiệt độ: nan °C'),
    entry('[TELEMETRY] Env: {"temp":false}'), entry('{"source":"simulator","temp":28.5}'),
  ]) assert.equal(decode(line).frame, null, line.text);
});

test('sparse samples retain fresh fields, expire independently and preserve raw chart history', () => {
  let now = 10000;
  const store = createTelemetryStore(() => now);
  store.setLink('connected');
  const put = data => store.ingest(adaptSerialLine(JSON.stringify(data), 'serial-local', now));
  put({ temperature: 28, pressure: 1013 });
  now = 11000; put({ battery_v: 3.8 });
  assert.equal(currentReadings(store.getSnapshot()).temperatureC, 28);
  assert.equal(currentReadings(store.getSnapshot()).voltageV, 3.8);
  assert.equal(store.getSnapshot().history[1].temperatureC, null);
  now = 15501; store.tick();
  assert.equal(currentReadings(store.getSnapshot()).temperatureC, null);
  assert.equal(currentReadings(store.getSnapshot()).voltageV, 3.8);
  now = 16001; store.tick();
  assert.equal(currentReadings(store.getSnapshot()).voltageV, null);
  store.setLink('offline');
  assert.equal(currentReadings(store.getSnapshot()).voltageV, null);
});

test('environment frames between gyro samples do not change gyro integration interval', () => {
  let now = 10000;
  const store = createTelemetryStore(() => now);
  const put = data => store.ingest(adaptSerialLine(JSON.stringify(data), 'serial-local', now));
  put({ gyro_z: 10 }); now = 10400; put({ temp: 28 }); now = 10500; put({ gyro_z: 10 });
  assert.equal(store.getSnapshot().attitude.yaw, 5);
});

test('No Fix invalidates the marker immediately; invalid NMEA checksums never produce a fix', () => {
  const decode = createPracticeDecoder('Lab4-03a_GPS_UART');
  const line = fixtures.find(fixture => fixture.id === 'Lab4-03a_GPS_UART').lines[0];
  assert.ok(decode(entry(line)).frame);
  assert.equal(decode(entry(line.replace('*47', '*00'))).frame, null);
  assert.deepEqual(decode(entry('GPS chưa chốt được vị trí (No Fix).')).invalidate, ['gpsLat', 'gpsLon', 'gpsAlt']);
  const store = createTelemetryStore(() => 10000);
  store.setLink('connected'); store.ingest(decode(entry(line)).frame);
  assert.equal(currentReadings(store.getSnapshot()).gpsLat, 48.1173);
  const invalid = decode(entry('[TELEMETRY] GPS: {"valid":false,"lat":0,"lng":0}'));
  assert.equal(invalid.frame, null);
  store.invalidate(invalid.invalidate);
  assert.equal(currentReadings(store.getSnapshot()).gpsLat, null);
  assert.equal(currentReadings(store.getSnapshot()).gpsLon, null);
});

test('Lab4-03b NMEA RAW lines decode only checksum-verified sentences the sketch marked OK', () => {
  const decode = createPracticeDecoder('Lab4-03b_GPS_Library');
  const sentence = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
  assert.ok(decode(entry(`[NMEA RAW] [OK  ] [GGA (Global Positioning Fix)] ${sentence}`)).frame);
  assert.equal(decode(entry(`[NMEA RAW] [FAIL] [GGA (Global Positioning Fix)] ${sentence}`)).frame, null);
  assert.equal(decode(entry(`[NMEA RAW] [OK  ] [GGA (Global Positioning Fix)] ${sentence.replace('*47', '*00')}`)).frame, null);
});

test('simulated Lab3-03 / Lab3-05 values stay task evidence, never physical measurements', () => {
  const scheduler = createPracticeDecoder('Lab3-03_Multitasking_Scheduler');
  const telemetry = scheduler(entry('[HK-TELEM] Gói #0001 | Pin: 3.95V | Nhiệt độ C&DH: 27.3C | Uptime: 1s'));
  assert.equal(telemetry.frame, null);
  assert.deepEqual(telemetry.events.map(event => [event.name, event.illustrative, event.value]), [['TelemGen', true, 27.3]]);
  const queue = createPracticeDecoder('Lab3-05_Event_Driven_Queue');
  const alert = queue(entry('[DISPATCHER] Nhận sự kiện tại t = 900 ms: CẢNH BÁO VIỄN TRẮC! Nhiệt độ C&DH vượt ngưỡng: 33°C'));
  assert.equal(alert.frame, null);
  assert.deepEqual(alert.events.map(event => [event.group, event.name, event.illustrative]), [['task', 'Dispatcher', true]]);
});

test('diagnostic response formats map to the actual measurements and units', () => {
  const decode = createPracticeDecoder('Lab7-02_RTOS_Satellite_System');
  assert.equal(decode(entry('Sensor: Temp=28.50C, Press=1012.25hPa')).frame.temperatureC, 28.5);
  assert.equal(decode(entry('EPS: Battery=3.72V')).frame.voltageV, 3.72);
  assert.equal(decode(entry('GPS: Lat=21.028500, Lng=105.854200')).frame.gpsLon, 105.8542);
  assert.equal(decode(entry('STATUS: Up 123s, Bat=3.7V, SD=OK (ACTIVE)')).frame.uptimeMs, 123000);
});

test('explicit unavailable fields clear old readings without clearing unrelated sparse measurements', () => {
  const decode = createPracticeDecoder('Lab7-02_RTOS_Satellite_System');
  const store = createTelemetryStore(() => 10000);
  store.setLink('connected');
  store.ingest(adaptSerialLine('{"temp":28,"pressure":1013,"battery_v":3.8,"gyro_z":1}', 'serial-local', 10000));
  const result = decode(entry('[TELEMETRY] Env: {"temp":null,"pressure":null}'));
  assert.deepEqual(result.invalidate, ['temperatureC', 'pressureHpa']);
  store.invalidate(result.invalidate);
  assert.equal(currentReadings(store.getSnapshot()).temperatureC, null);
  assert.equal(currentReadings(store.getSnapshot()).voltageV, 3.8);
  const invalidImu = decode(entry('  X: nan rad/s | Y: nan rad/s | Z: nan rad/s'));
  store.invalidate(invalidImu.invalidate);
  assert.equal(currentReadings(store.getSnapshot()).gyroZ, null);
  assert.equal(store.getSnapshot().attitudeReceivedAt, null);
  assert.equal(store.getSnapshot().fieldReceivedAt.gyroZ, undefined);
});

test('invalid metadata or coercible nested values cannot overwrite a bound device', () => {
  const decode = createPracticeDecoder('Lab7-01_Full_Satellite_Program');
  for (const metadata of [{ device_id: 'another' }, { source: 'demo' }, { type: 'command' }, { schema_version: 2 }, { device_id: false }]) {
    const result = decode(entry(JSON.stringify({ ...metadata, valid: false, temp: null })), 'bound');
    assert.equal(result.frame, null);
    assert.deepEqual(result.invalidate, []);
  }
  for (const value of ['9.8', true, false]) assert.equal(decode(entry(JSON.stringify({ imu: { az_ms2: value } }))).frame, null);
  const result = decode(entry('{"env":{"temp":28}}'));
  assert.deepEqual(result.invalidate, []);
  assert.equal(result.frame.temperatureC, 28);
});

test('latitude and longitude from separate timestamps never form a mixed position', () => {
  let now = 10000;
  const store = createTelemetryStore(() => now);
  store.setLink('connected');
  store.ingest(adaptSerialLine('{"lat":21,"lng":105}', 'serial-local', now));
  now += 100;
  store.ingest(adaptSerialLine('{"lat":22}', 'serial-local', now));
  assert.equal(currentReadings(store.getSnapshot()).gpsLat, null);
  assert.equal(currentReadings(store.getSnapshot()).gpsLon, null);
});

test('reviewed firmware log formats preserve correct units and subsystem evidence', () => {
  const decode = createPracticeDecoder('Lab4-02b_IMU_Library');
  decode(entry('>>> LA BÀN TỪ TRƯỜNG (MAGNETOMETER) <<<'));
  assert.equal(decode(entry('  X: 0.20 G | Y: 0.30 G | Z: 0.40 G')).frame.magZ, 40);
  assert.equal(decode(entry('[ERROR] WiFi connection timed out.')).events[0].group, 'network');
  assert.equal(decode(entry('[SD] log saved')).events[0].phase, 'saved');
  assert.equal(decode(entry('[SD] log write failed/not ready')).events[0].phase, 'error');
  assert.equal(decode(entry('[WDT] Watchdog Timer đã bật (timeout: 10s)')).events.length, 0);
  assert.equal(decode(entry('E task_wdt: Task watchdog got triggered.')).events[0].phase, 'error');
  assert.equal(decode(entry('[EVENT] No current anomaly in valid measurements.')).events[0].phase, 'recovered');
  const scheduler = createPracticeDecoder('Lab3-03_Multitasking_Scheduler');
  const result = scheduler(entry('LED ON'));
  assert.equal(result.frame.ledOn, true);
  assert.ok(result.events.some(event => event.group === 'task' && event.name === 'LED' && event.illustrative === false));
});

test('only explicit snapshot prefixes unwrap JSON; old callbacks cannot alter another session', () => {
  const decode = createPracticeDecoder('Lab7-02_RTOS_Satellite_System');
  for (const prefix of ['[CMD] ', '[TX] ', '[RX] ', 'random ']) assert.equal(decode(entry(prefix + '{"temp":22}')).frame, null);
  const store = createTelemetryStore(() => 10000);
  store.setLink('connected');
  const previous = store.getSnapshot().generation;
  const events = decode(entry('[SD] telemetry write failed')).events;
  store.observe(events, 10000, previous);
  assert.equal(store.getSnapshot().activity.subsystems.storage.phase, 'error');
  assert.equal(telemetryStatus(store.getSnapshot()), 'stale');
  store.select('serial', 'serial-local');
  store.observe(events, 10000, previous);
  assert.deepEqual(store.getSnapshot().activity, emptyActivity());
  for (let i = 0; i < 300; i++) store.observe(events, 10000);
  assert.equal(store.getSnapshot().activity.events.length, 120);
  assert.equal(store.getSnapshot().latest, null);
});
test('each exercise shows only the panels its reference sketch has data for', () => {
  const expected = {
    'Lab1-01': ['lab1Io'], 'Lab1-02': [], 'Lab1-03_PWM_LED': [], 'Lab1-04': ['lab1Io'], 'Lab1-05': ['lab1Io'], 'Lab1-06': [], 'Lab1-07': [], 'Lab1-08': ['lab1Io'],
    'Lab1-09': ['lab1Connection'], 'Lab1-10': ['lab1Connection'], 'Lab1-11': ['lab1Connection'],
    'Lab2-01a': ['voltage'], 'Lab2-01b': ['voltage'], 'Lab2-02': ['voltage'],
    'Lab3-01a': [], 'Lab3-01b': [], 'Lab3-02': ['shell', 'commands'],
    'Lab3-03': [], 'Lab3-04': ['commands'], 'Lab3-05': ['commands'],
    'Lab4-01a': ['environment'], 'Lab4-01b': ['environment'],
    'Lab4-02a': ['attitude'], 'Lab4-02b': ['attitude'],
    'Lab4-03a': ['gps'], 'Lab4-03b': ['gps'], 'Lab4-03c': ['gps'],
    'Lab4-04a': ['camera', 'commands'], 'Lab4-04b': ['camera', 'commands'],
    'Lab4-05': ['gps', 'camera', 'commands'], 'Lab4-06': ['environment', 'attitude', 'gps'],
    'Lab5-01a': ['radio', 'groundStation'], 'Lab5-01b': ['radio', 'groundStation'],
    'Lab5-02a': ['radio', 'groundStation'], 'Lab5-02b': ['radio', 'groundStation'], 'Lab5-03': ['radio', 'groundStation'],
    'Lab7-01': ['groundStation', 'attitude', 'gps', 'voltage', 'environment', 'system'],
    'Lab7-02': ['groundStation', 'attitude', 'gps', 'voltage', 'environment', 'system'],
    'Lab8-01': ['groundStation', 'dashboard'],
  };
  for (const fixture of fixtures) {
    const plan = visualizationPlan(practiceProfile(fixture.id));
    // Lab1-04_Button and Lab1-03_PWM_LED share a prefix: a full ID entry wins.
    assert.deepEqual(plan.panels, expected[fixture.id] ?? expected[fixture.id.split('_')[0]], fixture.id);
    assert.ok(!plan.panels.includes('telemetry'), `${fixture.id}: raw telemetry table duplicates dedicated panels`);
  }
  assert.deepEqual(visualizationPlan(practiceProfile('Lab7-01_Full_Satellite_Program')).systemRows, ['sensor', 'gps', 'eps', 'storage', 'radio']);
});

test('LoRa logs from the raw UART and the COM library become TX/RX/error radio events', () => {
  const decode = createPracticeDecoder('Lab5-01b_Send_Telemetry_Library');
  const phase = line => decode(entry(line)).events.find(event => event.group === 'radio')?.phase;
  assert.equal(phase('[TX] HELLO_FROM_CUBESAT_RAW_LORA: 1200'), 'sent');
  assert.equal(phase('Đang phát xuống mặt đất: PACKET #1 - CUBESAT TELEMETRY DATA'), 'sent');
  assert.equal(phase('[COM] Đã gửi tin nhắn: PACKET #1'), 'sent');
  assert.equal(phase('[COM] Nhận được tin nhắn LoRa: ping'), 'received');
  // "tin nhắn" (message) must not be mistaken for "nhận" (received): a TX log is never an RX.
  const radioPhases = line => decode(entry(line)).events.filter(event => event.group === 'radio').map(event => event.phase);
  assert.deepEqual(radioPhases('[COM] Đã gửi tin nhắn: PACKET #1'), ['sent']);
  assert.deepEqual(radioPhases('[COM] Nhận được tin nhắn LoRa: ping'), ['received']);
  assert.equal(phase('[RX] Nhận được bản tin thô: hello'), 'received');
  assert.equal(phase('[WARNING] LoRa AUX busy; TX skipped, no reception confirmed.'), 'error');
});

test('Lab1 AP preserves its IP through bounded logs and errors clear old connection details', () => {
  const decode = createPracticeDecoder('Lab1-10_WiFi_AP_Mode');
  let activity = emptyActivity();
  const feed = line => { for (const event of decode(entry(line)).events) activity = reduceActivity(activity, event); };
  feed('Configuring access point...AP IP address:'); feed('192.168.4.1');
  for (let i = 0; i < 130; i++) feed(`Số lượng thiết bị đang kết nối: ${i % 3}`);
  assert.equal(activity.events.length, 120);
  assert.equal(activity.subsystems.network.report.ip, '192.168.4.1');
  assert.equal(activity.subsystems.network.report.clients, 0);
  feed('[ERROR] WiFi AP initialization failed');
  assert.equal(activity.subsystems.network.report.error, true);
  assert.equal(activity.subsystems.network.report.ip, null);
  feed('Số lượng thiết bị đang kết nối: 0');
  assert.equal(activity.subsystems.network.report.error, true);
});

test('Lab1 web status requires valid device IP and explicit server startup; reconnect cannot reuse old IP', () => {
  const decode = createPracticeDecoder('Lab1-11_Web_Server_LED');
  let activity = emptyActivity();
  const feed = line => { for (const event of decode(entry(line)).events) activity = reduceActivity(activity, event); };
  feed('IP address:'); feed('999.168.1.2'); feed('0.0.0.0');
  assert.equal(activity.subsystems.network.report.ip, undefined);
  feed('192.168.1.20');
  assert.equal(activity.subsystems.network.report.server, undefined);
  feed('HTTP server started');
  assert.equal(activity.subsystems.network.report.server, true);
  feed('[WARNING] WiFi disconnected; retrying.');
  assert.equal(activity.subsystems.network.report.ip, null);
  assert.equal(activity.subsystems.network.report.server, false);
  feed('WiFi connected.');
  assert.equal(activity.subsystems.network.report.ip, null);
  feed('192.168.1.21');
  assert.equal(activity.subsystems.network.report.ip, '192.168.1.21');
});

test('SD shell reports and errors stay in storage and never invent successful writes', () => {
  const decode = createPracticeDecoder('Lab3-02_Linux_FS_Commands');
  for (const line of ['[Storage] Nội dung thư mục: /logs', '📄 telemetry.csv (120 bytes)', 'OK: cd /logs', '/logs']) {
    const result = decode(entry(line));
    assert.ok(result.events.some(event => event.group === 'storage' && event.phase === 'reported'), line);
    assert.equal(result.frame, null);
  }
  for (const line of ['ERR: Directory not found', 'ERR: SD not ready', 'ERR: Unknown command']) assert.ok(decode(entry(line)).events.some(event => event.group === 'storage' && event.phase === 'error'));
  assert.equal(decode(entry('Log entry #1 - Uptime: 3000ms')).events.length, 0);
});

test('Lab3-02 pairs every shell command with its reply, not only failed ones', () => {
  const decode = createPracticeDecoder('Lab3-02_Linux_FS_Commands');
  const lines = ['User> pwd', '/', 'User> mkdir demo', '[Storage] Đã tạo thư mục: /demo', 'OK: mkdir /demo', 'User> ls', '[Storage] Nội dung thư mục: /', '📁 demo', '📄 log.txt  (12 bytes)', 'OK: ls /',
    'User> cd demo', 'OK: cd /demo', 'User> touch note.txt', 'OK: touch /demo/note.txt', 'User> rm note.txt', 'OK: rm /demo/note.txt', 'User> cd nowhere', 'ERR: Directory not found', 'User> foo', 'ERR: Unknown command'];
  const shell = lines.flatMap(line => decode(entry(line)).events).filter(event => event.group === 'shell');
  assert.deepEqual(shell.map(event => [event.command, event.phase]), [['pwd', 'ok'], ['mkdir demo', 'ok'], ['ls', 'ok'], ['cd demo', 'ok'], ['touch note.txt', 'ok'], ['rm note.txt', 'ok'], ['cd nowhere', 'error'], ['foo', 'error']]);
  assert.deepEqual(shell.map(describeShellResult), ['Thư mục hiện tại: /', 'Đã tạo thư mục /demo', 'Đã liệt kê / · 2 mục', 'Đã chuyển tới /demo', 'Đã tạo file /demo/note.txt (giữ nguyên nếu đã có)', 'Đã xóa /demo/note.txt', 'Không tìm thấy thư mục', 'Lệnh không được hỗ trợ']);
  // A reply without a typed command (e.g. an overlong line) is not attributed to an earlier command.
  assert.equal(decode(entry('ERR: Command exceeds 128 bytes')).events.some(event => event.group === 'shell'), false);
  assert.equal(createPracticeDecoder('Lab3-01a_MicroSD_SPI')(entry('User> ls')).events.some(event => event.group === 'shell'), false);
  assert.equal(practiceProfile('Lab3-01b_MicroSD_Library').serialOnly, true);
});

test('Lab4-03c plots the labelled latitude/longitude/altitude lines even without the combined coordinate line', () => {
  const decode = createPracticeDecoder('Lab4-03c_GPS_PTITCube');
  const frames = ['- Vĩ độ (Latitude)       : 21.028500° Bắc (N)', '- Kinh độ (Longitude)    : 105.854200° Đông (E)', '- Cao độ (Altitude)      : 12.30 m (so với mực nước biển)']
    .map(text => decode(entry(text)).frame);
  assert.equal(frames[0], null);
  assert.ok(Math.abs(frames[1].gpsLat - 21.0285) < 1e-9 && Math.abs(frames[1].gpsLon - 105.8542) < 1e-9);
  assert.equal(frames[2].gpsAlt, 12.3);
  const south = createPracticeDecoder('Lab4-03c_GPS_PTITCube');
  south(entry('- Vĩ độ (Latitude)       : 33.868800° Nam (S)'));
  const west = south(entry('- Kinh độ (Longitude)    : 151.209300° Tây (W)')).frame;
  assert.deepEqual([west.gpsLat, west.gpsLon], [-33.8688, -151.2093]);
  // A longitude with no preceding latitude never produces a half position.
  assert.equal(createPracticeDecoder('Lab4-03c_GPS_PTITCube')(entry('- Kinh độ (Longitude)    : 105.854200° Đông (E)')).frame, null);
});

test('Lab4-04b chunked Serial image becomes one validated JPEG frame; corrupt or truncated transfers never do', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 1000 }, (_, i) => i % 251), 0xff, 0xd9]);
  const lines = (bytes = jpeg) => ['IMG_BEGIN:' + bytes.length, ...Array.from({ length: Math.ceil(bytes.length / 384) }, (_, i) => 'IMG_CHUNK:' + bytes.subarray(i * 384, i * 384 + 384).toString('base64')), 'IMG_END'];
  const run = sequence => { const decode = createPracticeDecoder('Lab4-04b_Camera_Library'); return sequence.map(line => decode(entry(line))); };

  const ok = run(lines());
  assert.equal(ok.slice(0, -1).every(result => result.frame === null), true);
  assert.equal(ok.at(-1).frame.imageData, 'data:image/jpeg;base64,' + jpeg.toString('base64'));
  assert.ok(ok.at(-1).events.some(event => event.group === 'camera' && event.phase === 'saved'));

  const truncated = lines().filter((_, index) => index !== 2);
  assert.equal(run(truncated).at(-1).frame, null);
  assert.ok(run(truncated).at(-1).events.some(event => event.group === 'camera' && event.phase === 'error'));
  const notJpeg = lines(Buffer.from('GIF89a'.repeat(100)));
  assert.equal(run(notJpeg).at(-1).frame, null);
  const oversized = lines(); oversized[1] = 'IMG_CHUNK:' + Buffer.alloc(2000).toString('base64');
  assert.equal(run(oversized).at(-1).frame, null);
  assert.equal(run(['IMG_CHUNK:AAAA', 'IMG_END'])[1].frame, null);
  assert.equal(run(['IMG_BEGIN:10', 'ERROR:IMG_READ', 'IMG_END'])[2].frame, null);
});

test('Camera Viewer can tell a photo saved only on the SD card from one streamed to the browser', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 11199 }, (_, i) => i % 251), 0xff, 0xd9]); // 11205 bytes
  const decode = createPracticeDecoder('Lab4-04a_Camera_UART');
  // Older Lab4-04a drafts stop at this line: the device saved the photo, the browser has nothing to show.
  const saved = decode(entry('Camera: Saved /photos/uart_img_0.jpg (11205 bytes)')).events.find(event => event.group === 'camera');
  assert.deepEqual([saved.phase, saved.browser], ['saved', undefined]);
  const chunks = Array.from({ length: Math.ceil(jpeg.length / 384) }, (_, i) => 'IMG_CHUNK:' + jpeg.subarray(i * 384, i * 384 + 384).toString('base64'));
  const results = ['IMG_BEGIN:' + jpeg.length, ...chunks, 'IMG_END'].map(line => decode(entry(line)));
  const progress = results.flatMap(result => result.events).filter(event => event.phase === 'progress');
  assert.equal(progress[0].received, 0);
  assert.ok(progress.length >= 3 && progress.length <= 6, `throttled progress (${progress.length})`);
  assert.ok(progress.every(event => event.transfer === 'browser' && event.total === jpeg.length));
  const done = results.at(-1).events.find(event => event.group === 'camera');
  assert.deepEqual([done.phase, done.browser], ['saved', true]);
  assert.ok(results.at(-1).frame.imageData.startsWith('data:image/jpeg;base64,/9j/'));
});

test('Lab3-02 (PTITCube library 74065b6) pairs "> cmd" with a bare OK, ERR or command output', () => {
  const decode = createPracticeDecoder('Lab3-02_Linux_FS_Commands');
  const lines = ['> pwd', '/', '> mkdir demo', 'OK', '> ls', 'Storage: List: /', 'DIR:  demo', 'FILE: log.txt  (12 bytes)', 'OK', '> cd demo', 'OK',
    '> rm demo', 'ERR: /demo is a directory (use rmdir)', '> rmdir /nope', 'ERR: Directory not found: /nope', '> foo', "Command not recognized. Type 'help' for commands.", '> df', 'SD Card: Total: 7580 MB | Used: 1 MB | Free: 7579 MB'];
  const shell = lines.flatMap(line => decode(entry(line)).events).filter(event => event.group === 'shell');
  assert.deepEqual(shell.map(event => [event.command, event.phase]), [['pwd', 'ok'], ['mkdir demo', 'ok'], ['ls', 'ok'], ['cd demo', 'ok'], ['rm demo', 'error'], ['rmdir /nope', 'error'], ['foo', 'error'], ['df', 'ok']]);
  assert.deepEqual(shell.map(describeShellResult), ['Thư mục hiện tại: /', 'Đã tạo thư mục demo', 'Đã liệt kê thư mục hiện tại · 2 mục', 'Đã chuyển tới demo',
    'Đây là thư mục, hãy dùng rmdir', 'Không tìm thấy thư mục', 'Lệnh không được hỗ trợ (gõ help để xem danh sách)', 'SD Card: Total: 7580 MB | Used: 1 MB | Free: 7579 MB']);
});

test('new short-label sensor lines report NaN and missing fixes as unavailable, never as zero', () => {
  const env = createPracticeDecoder('Lab4-01b_Environment_Library');
  const nan = env(entry('Temp: nan C | Press: nan hPa'));
  assert.equal(nan.frame, null);
  assert.deepEqual(nan.invalidate, ['temperatureC', 'pressureHpa']);
  assert.ok(env(entry('BMP280 unavailable: check wiring (SDA 21, SCL 22)')).events.some(event => event.group === 'sensor' && event.phase === 'error'));
  const all = createPracticeDecoder('Lab4-06_Read_All_Sensors');
  const noFix = all(entry('TELEM: T: 28.5C | P: 1012.2hPa | Roll: 0.0 | Pitch: -0.0 | GPS: (no fix, 3sats)'));
  assert.equal(noFix.frame.temperatureC, 28.5);
  assert.equal(noFix.frame.gpsLat, null);
  assert.deepEqual(noFix.invalidate, ['gpsLat', 'gpsLon', 'gpsAlt']);
  const gps = createPracticeDecoder('Lab4-03c_GPS_PTITCube')(entry('GPS: Đang quét tìm vệ tinh... (3 sats, chưa có fix)'));
  assert.equal(gps.frame, null);
  assert.deepEqual(gps.invalidate, ['gpsLat', 'gpsLon', 'gpsAlt']);
});

test('simulated Lab3-03 TELEM and radio replies never become voltage or environment samples', () => {
  const scheduler = createPracticeDecoder('Lab3-03_Multitasking_Scheduler');
  const telemetry = scheduler(entry('TELEM: #0001 | V: 3.70V | T: 24.5C | Uptime: 2s'));
  assert.equal(telemetry.frame, null);
  assert.deepEqual(telemetry.events.map(event => [event.name, event.illustrative, event.value]), [['TelemGen', true, 24.5]]);
  const queue = createPracticeDecoder('Lab3-05_Event_Driven_Queue');
  assert.deepEqual(queue(entry('Event: Temp Alert: 33 C (t=2000ms)')).events.map(event => [event.name, event.illustrative]), [['Dispatcher', true]]);
  const radio = createPracticeDecoder('Lab5-03_Ground_Station_Demo');
  const reply = radio(entry('CMD: sensor -> Temp: 28.5C | Press: 1012.2hPa'));
  assert.equal(reply.frame, null);
  assert.ok(reply.events.some(event => event.group === 'radio' && event.phase === 'received'));
  const eps = createPracticeDecoder('Lab2-02_Power_Saving')(entry('EPS: Power Saving Mode (V: 3.65V, SOC: 20.0%)'));
  assert.equal(eps.frame.voltageV, 3.65);
  assert.ok(eps.events.some(event => event.group === 'power'));
});

test('radio totals keep counting after the 120-event window is full', () => {
  let activity = emptyActivity();
  for (let i = 0; i < 300; i++) activity = reduceActivity(activity, { group: 'radio', phase: 'sent', at: 1000 + i, text: `PACKET #${i}` });
  assert.equal(activity.events.length, 120);
  assert.equal(activity.radio.sent, 300);
  assert.equal(activity.radio.received, 0);
  assert.equal(activity.radio.lastAt.sent, 1299);
});

test('extra log details travel as activity events, never as invented measurements', () => {
  const events = (id, lines) => {
    const decode = createPracticeDecoder(id);
    return lines.flatMap((line, index) => decode(entry(line, 10000 + index * 100)).events);
  };
  // Satellites in use while searching: GGA field 7 and the "(N sats" text lines.
  const gga = events('Lab4-03a_GPS_UART', ['$GNGGA,023130.998,,,,,0,0,,,M,,M,,*5D', '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47']);
  assert.deepEqual(gga.map(event => [event.phase, event.satellites]), [['waiting', 0], ['sample', 8]]);
  assert.equal(events('Lab4-05_Camera_Multiplexer', ['GPS: Đang quét tìm vệ tinh... (3 sats, chưa có fix)'])[0].satellites, 3);
  assert.equal(events('Lab4-06_Read_All_Sensors', ['TELEM: T: 29.2C | P: 1026.1hPa | Roll: 3.7 | Pitch: 0.1 | GPS: (no fix, 0sats)']).find(event => event.group === 'gps').satellites, 0);
  // Firmware compass heading (Lab4-02a/b line and Lab7-01 imu.yaw).
  assert.deepEqual(events('Lab4-02b_IMU_Library', ['Roll:   4.3, Pitch:  -1.5, Head:   6.8']).map(({ group, roll, pitch, heading }) => [group, roll, pitch, heading]), [['attitude', 4.3, -1.5, 6.8]]);
  assert.deepEqual(events('Lab4-02b_IMU_Library', ['Roll:    nan, Pitch:    nan, Head:    nan']), []);
  assert.equal(events('Lab7-01_Full_Satellite_Program', ['[TELEM] {"imu":{"roll":3.4,"pitch":-0.7,"yaw":12.9}}']).find(event => event.group === 'attitude').heading, 12.9);
  // MAX17048 SOC / rate / Lab2-02 mode; a 0 V line is "not read", so no gauge sample either.
  assert.deepEqual(events('Lab2-01a_Battery_I2C', ['V: 3.977 V | SOC: 78.8 % | Rate: -9.78 %/h']).map(({ soc, rate, mode }) => [soc, rate, mode]), [[78.8, -9.78, null]]);
  assert.equal(events('Lab2-02_Power_Saving', ['EPS: Power Saving Mode (V: 3.62V, SOC: 20.0%)']).find(event => event.group === 'eps').mode, 'saving');
  assert.equal(events('Lab2-01a_Battery_I2C', ['V: 0.000 V | SOC: 0.0 % | Rate: +0.00 %/h']).some(event => event.group === 'eps'), false);
  // Camera transfer progress, scheduler registrations (Lab3-03 names) and the OBC boot line.
  assert.deepEqual(events('Lab4-04a_Camera_UART', ['Camera: Da nhan 5640 / 17276 bytes']).map(({ phase, received, total }) => [phase, received, total]), [['progress', 5640, 17276]]);
  const registered = events('Lab3-03_Multitasking_Scheduler', ['Scheduler: Đã đăng ký task: Telemetry (chu kỳ 2000ms, Core 1, Priority 1)']);
  assert.deepEqual(registered.map(({ name, phase, periodMs, core, priority }) => [name, phase, periodMs, core, priority]), [['TelemGen', 'registered', 2000, 1, 1]]);
  const task = reduceActivity(registered.reduce(reduceActivity, emptyActivity()), { group: 'task', name: 'TelemGen', phase: 'sample', at: 12000 }).tasks.TelemGen;
  assert.deepEqual([task.count, task.periodMs], [1, 2000]);
  assert.deepEqual(events('Lab5-02b_Receive_Command_Library', ['[BOOT] OBC san sang, dang cho lenh tu tram mat dat qua LoRa']).map(event => `${event.group}:${event.phase}`), ['system:boot']);
});

test('Lab7 System Check marks SD and LoRa Active from fresh reports and Inactive once they age out', () => {
  const decode = createPracticeDecoder('Lab7-01_Full_Satellite_Program');
  const [storage, radio] = ['storage', 'radio'].map(id => SUBSYSTEMS.find(sys => sys.id === id));
  let activity = emptyActivity();
  for (const line of ['[SD] Telemetry saved', '[LORA TX] 4 goi telemetry']) activity = decode(entry(line, 10000)).events.reduce(reduceActivity, activity);
  const at = now => ({ activity, fieldReceivedAt: {}, now, mode: 'serial', link: 'connected' });
  assert.equal(subsystemStatus(storage, at(12000)).state, 'active');
  assert.equal(subsystemStatus(radio, at(12000)).state, 'active');
  assert.equal(subsystemStatus(radio, at(12000)).log[0].text, '[LORA TX] 4 goi telemetry');
  assert.equal(subsystemStatus(storage, at(10000 + ACTIVE_WINDOW_MS + 1)).state, 'inactive');
  assert.equal(subsystemStatus(storage, { ...at(12000), link: 'offline' }).state, 'inactive');
  activity = decode(entry('[SD] Write failed / card not ready', 11000)).events.reduce(reduceActivity, activity);
  assert.equal(subsystemStatus(storage, at(12000)).state, 'error');
  // Command b relays the SD log; a photo saved by command f is an SD write too.
  for (const line of ['Saving battery data to SD card...', '[1/5] Bat: 3.92V, 80.0%', 'Photo captured and saved to SD: /photos/cam_0.jpg']) {
    activity = decode(entry(line, 11500)).events.reduce(reduceActivity, activity);
  }
  assert.equal(subsystemStatus(storage, at(12000)).state, 'active');
  assert.equal(subsystemStatus(storage, at(12000)).log.length, 5);
});

test('ground-station decoder counts every line as a LoRa reception and reads the downlink chunks', () => {
  const lab71 = createPracticeDecoder('Lab7-01_Full_Satellite_Program', { groundStation: true });
  const imu = lab71(entry('{"imu":{"roll":1.5,"pitch":-2,"head":90}}'));
  assert.deepEqual(imu.events.map(event => [event.group, event.phase]), [['radio', 'received'], ['attitude', 'sample']]);
  assert.equal(lab71(entry('{"eps":{"v":3.91,"pct":80.0}}')).frame.voltageV, 3.91);
  assert.ok(lab71(entry('ACK: a')).events.some(event => event.group === 'radio' && event.phase === 'received'));
  assert.ok(!lab71(entry('[LORA TX] 4 goi telemetry')).events.some(event => event.phase === 'sent'));
  const lab72 = createPracticeDecoder('Lab7-02_RTOS_Satellite_System', { groundStation: true });
  assert.equal(lab72(entry('{"acc_x":0,"acc_y":0,"acc_z":9.80665}')).frame.accZ, 1);
  // The lab window's OBC decoder keeps reading unlabelled JSON as-is.
  assert.equal(createPracticeDecoder('Lab7-02_RTOS_Satellite_System')(entry('{"acc_z":1}')).frame.accZ, 1);
});

test('Lab8 chart keeps one unit per chart and never drops its last series', async () => {
  const { chartKeys, formatMetric, METRICS } = await import('../src/telemetry/metrics.js');
  assert.deepEqual(chartKeys(['accX'], 'accY'), ['accX', 'accY']);
  assert.deepEqual(chartKeys(['accX', 'accY'], 'temperatureC'), ['temperatureC']);
  assert.deepEqual(chartKeys(['accX', 'accY'], 'accX'), ['accY']);
  assert.deepEqual(chartKeys(['voltageV'], 'voltageV'), ['voltageV']);
  assert.equal(formatMetric(3.7123, 'voltageV'), '3.71 V');
  assert.equal(formatMetric(null, 'temperatureC'), '—');
  // Every metric is a real telemetry field, so a widget can never point at data the decoder does not produce.
  const { measurementKeys } = await import('../src/telemetry/adapters.js');
  for (const { key } of METRICS) assert.ok(measurementKeys.includes(key), key);
});

test('Lab8 dashboard layout round-trips per account and drops removed widgets or invalid settings', async () => {
  const { defaultLayout, layoutKey, nextWidgetId, parseLayout, serializeLayout } = await import('../src/components/dashboard/dashboard-layout.js');
  const layout = defaultLayout();
  assert.deepEqual(parseLayout(serializeLayout(layout)), layout);
  assert.notEqual(layoutKey(1), layoutKey(2));
  assert.equal(nextWidgetId(layout), 6);
  for (const raw of [null, '', 'not json', '{"version":2,"widgets":[]}', '{"widgets":[]}']) assert.equal(parseLayout(raw), null, String(raw));
  const saved = JSON.stringify({ version: 1, widgets: [
    { i: '1', type: 'network', x: 0, y: 0, w: 6, h: 5, config: {} }, // removed from the palette
    { i: '2', type: 'chart', x: 20, y: 0, w: 1, h: 1, config: { keys: ['humidityPct', 'accX', 'temperatureC', 'accY'] } },
    { i: '2', type: 'map', x: 0, y: 0, w: 6, h: 6, config: {} }, // duplicate id
    { i: '3', type: 'gauge', x: 0, y: 0, w: 3, h: 4, config: { key: 'humidityPct', min: 5, max: 1 } },
    { i: '4', type: 'button', x: 0, y: 0, w: 3, h: 3, config: { label: 'Ping', command: 42 } },
  ] });
  const [chart, gauge, button] = parseLayout(saved);
  // Humidity is no longer offered; a mixed-unit chart keeps its first unit; size respects the minimum.
  assert.deepEqual(chart.config.keys, ['accX', 'accY']);
  assert.deepEqual([chart.w, chart.h, chart.x], [4, 5, 8]);
  assert.deepEqual(gauge.config, { key: 'voltageV', min: 3, max: 4.2 });
  assert.deepEqual(button.config, { label: 'Ping', command: 'capture' });
  assert.equal(parseLayout(saved).length, 3);
});

test('hidden photo uplink: [CLOUD] lines become camera upload events and never sketch data', () => {
  const decode = createPracticeDecoder('Lab4-04a_Camera_UART');
  const sent = decode(entry('[CLOUD] PHOTO SENT /photos/uart_img_0.jpg 11205'));
  assert.deepEqual(sent.events.map(event => [event.group, event.phase, event.size]), [['camera', 'uploaded', 11205]]);
  const failed = decode(entry('[CLOUD] PHOTO FAIL /photos/uart_img_1.jpg mqtt-state=-2'));
  assert.deepEqual(failed.events.map(event => [event.phase, event.reason]), [['upload-error', 'mqtt-state=-2']]);
  // "WIFI connecting ..." mentions no SD/camera keywords but must not reach the generic matchers either.
  for (const line of ['[CLOUD] READY photos=3', '[CLOUD] CFG? v1 uid=none ssid=', '[CLOUD] WIFI connecting Lab WiFi', '[CLOUD] CFG ERR invalid']) {
    const result = decode(entry(line));
    assert.deepEqual([result.frame, result.events], [null, []], line);
  }
});

test('cloud handshake answers: keep own config, re-provision a stale one, clear another account\'s board', async () => {
  const { cloudAnswer } = await import('../src/contexts/cloud-api.js');
  const mine = { deviceUid: 'cube_aaaa1111', wifiSsid: 'PTIT-Lab' };
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 ssid=PTIT-Lab', mine), 'keep');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 ssid=Old WiFi', mine), 'provision');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=none ssid=', mine), 'provision');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_bbbb2222 ssid=PTIT-Lab', mine), 'provision');
  // No WiFi known (no classroom WiFi on the server, none typed yet).
  const noWifi = { deviceUid: 'cube_aaaa1111', wifiSsid: '' };
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 ssid=Home', noWifi), 'keep');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_bbbb2222 ssid=Home', noWifi), 'clear');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=none ssid=', noWifi), 'need-wifi');
  assert.equal(cloudAnswer('[CLOUD] PHOTO SENT /photos/a.jpg 10', mine), null);
  // Uplink v10 reports its broker: a board still pointing at a retired broker is provisioned again.
  const withBroker = { ...mine, broker: 'broker.example:8883' };
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 host=broker.example:8883 ssid=PTIT-Lab', withBroker), 'keep');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 host=old.example:8883 ssid=PTIT-Lab', withBroker), 'provision');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 ssid=PTIT-Lab', withBroker), 'provision');
  assert.equal(cloudAnswer('[CLOUD] CFG? v1 uid=cube_aaaa1111 host=none:8883 ssid=PTIT Lab 2', { ...withBroker, wifiSsid: 'PTIT Lab 2' }), 'provision');
});

test('Lab5-01 ground station counts downlink packets and estimates losses from their numbers', async () => {
  const { countPacket, emptyPackets, lostPackets } = await import('../src/telemetry/downlink.js');
  const lines = ['PACKET #4 - CUBESAT TELEMETRY', 'noise', 'PACKET #5 - CUBESAT TELEMETRY', 'PACKET #8 - CUBESAT TELEMETRY'];
  let stats = lines.reduce(countPacket, emptyPackets);
  assert.deepEqual([stats.packets, stats.firstPacket, stats.lastPacket, lostPackets(stats)], [3, 4, 8, 2]);
  stats = countPacket(stats, 'PACKET #1 - CUBESAT TELEMETRY'); // satellite reset
  assert.deepEqual([stats.packets, stats.firstPacket, lostPackets(stats)], [1, 1, 0]);
  assert.equal(lostPackets(emptyPackets), null);
});

test('Lab3-05 queue events keep their producer, payload and per-kind totals', () => {
  const decode = createPracticeDecoder('Lab3-05_Event_Driven_Queue');
  const lines = ['Event: Button (t=1200ms) -> LED: ON', 'Event: Temp Alert: 33 C (t=2000ms)', "Event: Cmd: 'A' (t=2500ms)", 'Event: Button (t=3200ms) -> LED: OFF'];
  const events = lines.flatMap((line, index) => decode(entry(line, 10000 + index)).events);
  assert.deepEqual(events.map(event => [event.kind, event.lane, event.deviceMs]), [
    ['button', 'Nút nhấn (ISR)', 1200], ['temp', 'Cảm biến giả lập', 2000], ['cmd', 'Lệnh Serial', 2500], ['button', 'Nút nhấn (ISR)', 3200]]);
  assert.deepEqual([events[0].led, events[1].value, events[1].illustrative, events[2].command, events[3].led], [true, 33, true, 'A', false]);
  const activity = events.reduce(reduceActivity, emptyActivity());
  const { kinds, count } = activity.tasks.Dispatcher;
  assert.equal(count, 4);
  assert.deepEqual([kinds.button.count, kinds.temp.count, kinds.cmd.count, kinds.button.led], [2, 1, 1, false]);
});

test('Lab4-03 GLL fixes decode and a GPS position outlives the generic 5 s staleness', () => {
  const decode = createPracticeDecoder('Lab4-03a_GPS_UART');
  // $GPGLL,4916.45,N,12311.12,W,225444,A,*1D (NMEA reference sentence).
  const gll = decode(entry('$GPGLL,4916.45,N,12311.12,W,225444,A,*1D'));
  assert.ok(Math.abs(gll.frame.gpsLat - 49.274167) < 1e-5);
  assert.ok(Math.abs(gll.frame.gpsLon + 123.185333) < 1e-5);
  let clock = 10000;
  const store = createTelemetryStore(() => clock);
  store.setLink('connected');
  store.ingest(gll.frame);
  clock += 20000;
  store.tick();
  const readings = currentReadings(store.getSnapshot());
  assert.ok(readings.gpsLat !== null && readings.gpsLon !== null, 'a fix 20 s old is still shown');
  clock += 15000;
  store.tick();
  assert.equal(currentReadings(store.getSnapshot()).gpsLat, null);
});

test('Lab4-06 TELEM roll/pitch reach the 3D model even without an Accel line', () => {
  const decode = createPracticeDecoder('Lab4-06_Read_All_Sensors');
  const result = decode(entry('TELEM: T: 28.5C | P: 1012.2hPa | Roll: 12.5 | Pitch: -3.0 | GPS: (no fix, 0sats)'));
  const attitude = result.events.find(event => event.group === 'attitude');
  assert.deepEqual([attitude.roll, attitude.pitch, attitude.heading], [12.5, -3, null]);
  assert.equal(decode(entry('TELEM: T: nanC | P: nanhPa | Roll: nan | Pitch: nan | GPS: (no fix, 0sats)')).events.some(event => event.group === 'attitude'), false);
});
