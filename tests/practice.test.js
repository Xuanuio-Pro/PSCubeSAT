import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/practice-serial.json' with { type: 'json' };
import { CURRICULUM } from '../src/data/curriculum.js';
import { createPracticeDecoder, emptyActivity, reduceActivity, practiceProfile } from '../src/telemetry/practice.js';
import { createTelemetryStore, currentReadings, telemetryStatus } from '../src/telemetry/store.js';
import { adaptSerialLine } from '../src/telemetry/adapters.js';
import { visualizationPlan } from '../src/telemetry/visualization-plan.js';

const entry = (text, at = 10000) => ({ text, receivedAt: at, type: 'rx', origin: 'serial' });

test('every curriculum practice has a concrete output fixture and matching visualization profile', () => {
  const ids = Object.values(CURRICULUM).flatMap(lab => lab.lessons.filter(lesson => lesson.type === 'practice').map(lesson => lesson.id));
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
  const decode = createPracticeDecoder('Lab6-01_Multitasking_Scheduler');
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

test('diagnostic response formats map to the actual measurements and units', () => {
  const decode = createPracticeDecoder('Lab7-03_RTOS_Satellite_System');
  assert.equal(decode(entry('Sensor: Temp=28.50C, Press=1012.25hPa')).frame.temperatureC, 28.5);
  assert.equal(decode(entry('EPS: Battery=3.72V')).frame.voltageV, 3.72);
  assert.equal(decode(entry('GPS: Lat=21.028500, Lng=105.854200')).frame.gpsLon, 105.8542);
  assert.equal(decode(entry('STATUS: Up 123s, Bat=3.7V, SD=OK (ACTIVE)')).frame.uptimeMs, 123000);
});

test('explicit unavailable fields clear old readings without clearing unrelated sparse measurements', () => {
  const decode = createPracticeDecoder('Lab7-03_RTOS_Satellite_System');
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
  const decode = createPracticeDecoder('Lab7-02_Full_Satellite_Program');
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
  const scheduler = createPracticeDecoder('Lab6-01_Multitasking_Scheduler');
  const result = scheduler(entry('LED ON'));
  assert.equal(result.frame.ledOn, true);
  assert.ok(result.events.some(event => event.group === 'task' && event.name === 'LED' && event.illustrative === false));
});

test('only explicit snapshot prefixes unwrap JSON; old callbacks cannot alter another session', () => {
  const decode = createPracticeDecoder('Lab7-03_RTOS_Satellite_System');
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
    'Lab1-01': [], 'Lab1-02': [], 'Lab1-03': [], 'Lab1-04': ['lab1Connection'], 'Lab1-05': ['lab1Connection'], 'Lab1-06': ['lab1Connection'],
    'Lab2-01a': ['voltage'], 'Lab2-01b': ['voltage'], 'Lab2-02': ['voltage'],
    'Lab3-01a': ['storage'], 'Lab3-01b': ['storage'], 'Lab3-02': ['commands'],
    'Lab4-01a': ['environment'], 'Lab4-01b': ['environment'], 'Lab4-02a': ['attitude'], 'Lab4-02b': ['attitude'],
    'Lab4-03a': ['gps'], 'Lab4-03b': ['gps'], 'Lab4-04a': ['camera', 'commands'], 'Lab4-04b': ['camera', 'commands'],
    'Lab4-05': ['environment', 'attitude', 'gps'],
    'Lab5-01a': ['radio'], 'Lab5-01b': ['radio'], 'Lab5-02a': ['radio', 'commands'], 'Lab5-02b': ['radio', 'commands'], 'Lab5-03': ['radio', 'commands'],
    'Lab6-01': [], 'Lab6-02': ['anomaly', 'attitude'],
    'Lab7-01': ['gps', 'camera'], 'Lab7-02': ['attitude', 'gps', 'voltage', 'environment', 'storage', 'system'],
    'Lab7-03': ['attitude', 'gps', 'voltage', 'camera', 'environment', 'storage', 'network', 'system', 'commands'],
    'Lab8-01': ['dashboard'],
  };
  for (const fixture of fixtures) {
    const plan = visualizationPlan(practiceProfile(fixture.id));
    assert.deepEqual(plan.panels, expected[fixture.id.split('_')[0]], fixture.id);
    assert.ok(!plan.panels.includes('telemetry'), `${fixture.id}: raw telemetry table duplicates dedicated panels`);
  }
  assert.deepEqual(visualizationPlan(practiceProfile('Lab7-02_Full_Satellite_Program')).systemRows, ['sensor', 'gps', 'eps', 'storage', 'radio']);
});

test('LoRa logs from the raw UART and the COM library become TX/RX/error radio events', () => {
  const decode = createPracticeDecoder('Lab5-01b_Send_Telemetry_Library');
  const phase = line => decode(entry(line)).events.find(event => event.group === 'radio')?.phase;
  assert.equal(phase('[TX] HELLO_FROM_CUBESAT_RAW_LORA: 1200'), 'sent');
  assert.equal(phase('Đang phát xuống mặt đất: PACKET #1 - CUBESAT TELEMETRY DATA'), 'sent');
  assert.equal(phase('[COM] Đã gửi tin nhắn: PACKET #1'), 'sent');
  assert.equal(phase('[COM] Nhận được tin nhắn LoRa: ping'), 'received');
  assert.equal(phase('[RX] Nhận được bản tin thô: hello'), 'received');
  assert.equal(phase('[WARNING] LoRa AUX busy; TX skipped, no reception confirmed.'), 'error');
});

test('Lab1 AP preserves its IP through bounded logs and errors clear old connection details', () => {
  const decode = createPracticeDecoder('Lab1-05_WiFi_AP_Mode');
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
  const decode = createPracticeDecoder('Lab1-06_Web_Server_LED');
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
