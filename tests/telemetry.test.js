import test from 'node:test';
import assert from 'node:assert/strict';
import examples from '../shared/telemetry.examples.json' with { type: 'json' };
import { adaptSerialLine, adaptWebSocketMessage, demoFrame, isTelemetryFrame } from '../src/telemetry/adapters.js';
import { createTelemetryStore, telemetryStatus, HISTORY_LIMIT } from '../src/telemetry/store.js';
import { startTelemetrySocket, telemetrySocketUrl } from '../src/telemetry/socket.js';
import { adaptSerialEntry } from '../src/telemetry/serial-entry.js';

const frame = (id = 'cube_test', now = 10000, fields = {}) => ({
  ...adaptSerialLine(JSON.stringify({ acc_z: 1, gyro_z: 10 }), id, now), ...fields,
});

test('compiler/app RX logs never become physical Serial telemetry', () => {
  const entry = { type: 'rx', text: '{"temperature":25}', receivedAt: 10000 };
  assert.equal(adaptSerialEntry({ ...entry, origin: 'app' }), null);
  assert.equal(adaptSerialEntry(entry), null);
  assert.equal(adaptSerialEntry({ ...entry, origin: 'serial' }).temperatureC, 25);
  assert.equal(adaptSerialEntry({ ...entry, origin: 'serial' }).received_at, 10);
});

test('shared backend/frontend examples normalize identically, including zero/null precedence', () => {
  for (const { input, expected } of examples) {
    const sample = adaptSerialLine(JSON.stringify(input), 'cube_test', 10000);
    assert.ok(isTelemetryFrame(sample));
    for (const [key, value] of Object.entries(expected)) assert.equal(sample[key], value, key);
  }
});

test('Serial logs and invalid sensor values cannot mark telemetry fresh', () => {
  for (const text of ['boot ROM log', '{bad', '[]', '{"hello":1}', '{"type":"pong","seq":1}',
    '{"acc_x":"1"}', '{"acc_x":true}', '{"lat":91}', '{"battery_v":-1}', '{"humidity":101}',
    '{"type":0,"acc_z":1}', '{"source":false,"acc_z":1}', '{"schema_version":2,"acc_z":1}',
    '{"device_id":"other","acc_z":1}', 'x'.repeat(65537)]) {
    assert.equal(adaptSerialLine(text, 'cube_test', 10000), null, text.slice(0, 40));
  }
});

test('USB auto-binding discovers UID, while explicit binding rejects another UID', () => {
  const text = '{"device_id":"cube_test","temperature":0}';
  assert.equal(adaptSerialLine(text).device_id, 'cube_test');
  assert.equal(adaptSerialLine(text, 'other'), null);
});

test('Lab1 heartbeat carries uptime/LED without inventing sensor readings', () => {
  const sample = adaptSerialLine('{"type":"lab1","event":"heartbeat","uptime_ms":2000,"led_on":false}');
  assert.equal(sample.uptimeMs, 2000);
  assert.equal(sample.ledOn, false);
  assert.equal(sample.temperatureC, null);
});

test('image adapter only accepts bounded PNG/JPEG data, not SVG', () => {
  assert.equal(adaptSerialLine('IMG:AAAA').imageData, 'data:image/jpeg;base64,AAAA');
  assert.equal(adaptSerialLine('data:image/svg+xml;base64,AAAA'), null);
  assert.equal(adaptSerialLine('IMG:' + 'A'.repeat(60000)), null);
});

test('WS init and live packets validate the same schema and preserve server receive time', () => {
  const sample = frame();
  assert.deepEqual(adaptWebSocketMessage(JSON.stringify(sample)), sample);
  assert.deepEqual(adaptWebSocketMessage(JSON.stringify({ type: 'init', device: sample })), sample);
  assert.equal(adaptWebSocketMessage(JSON.stringify({ ...sample, schema_version: 2 })), null);
  assert.equal(adaptWebSocketMessage(JSON.stringify({ ...sample, extra: 'ignored?' })), null);
  assert.equal(adaptWebSocketMessage(JSON.stringify({ ...sample, constructor: 'extra' })), null);
  assert.equal(isTelemetryFrame({ ...sample, accX: Infinity }), false);
});

test('demo is explicit and cannot overwrite a hardware/Serial selection', () => {
  const store = createTelemetryStore(() => 10000);
  assert.equal(store.getSnapshot().mode, 'serial');
  assert.throws(() => store.select('constructor', 'demo'));
  assert.equal(store.ingest(demoFrame(10000)), false);
  const generation = store.select('demo', 'demo');
  assert.equal(store.ingest(demoFrame(10000), generation), true);
  assert.equal(store.ingest(frame()), false);
});

test('mode/device switches clear snapshots and invalidate late callbacks', () => {
  const store = createTelemetryStore(() => 10000);
  const old = store.select('hardware', 'cube_test');
  assert.equal(store.ingest(frame(), old), true);
  const next = store.select('hardware', 'other');
  assert.equal(store.getSnapshot().latest, null);
  assert.deepEqual(store.getSnapshot().history, []);
  assert.equal(store.ingest(frame(), old), false);
  store.setLink('connected', '', old);
  assert.equal(store.getSnapshot().link, 'offline');
  assert.equal(store.ingest(frame('other'), next), true);
});

test('offline, waiting, live and stale depend on receive age, not device uptime', () => {
  let now = 10000;
  const store = createTelemetryStore(() => now);
  store.select('hardware', 'cube_test');
  assert.equal(telemetryStatus(store.getSnapshot(), now), 'offline');
  store.setLink('connected');
  assert.equal(telemetryStatus(store.getSnapshot(), now), 'waiting');
  store.ingest(frame('cube_test', now, { timestamp: 0 }));
  assert.equal(telemetryStatus(store.getSnapshot(), now), 'live');
  now += 5001;
  assert.equal(telemetryStatus(store.getSnapshot(), now), 'stale');
  store.setLink('offline');
  assert.equal(telemetryStatus(store.getSnapshot(), now), 'offline');
  assert.ok(store.getSnapshot().latest); // Last readings are retained, visibly offline.
});

test('receiving an old cached WS frame never makes it fresh', () => {
  const store = createTelemetryStore(() => 20000);
  store.select('hardware', 'cube_test');
  store.setLink('connected');
  store.ingest(frame('cube_test', 10000));
  assert.equal(telemetryStatus(store.getSnapshot(), 20000), 'stale');
});

test('duplicate/out-of-order packets are dropped; sequence restart is accepted on a newer sample', () => {
  const store = createTelemetryStore(() => 10000);
  store.select('hardware', 'cube_test');
  assert.equal(store.ingest(frame('cube_test', 10000, { seq: 5 })), true);
  assert.equal(store.ingest(frame('cube_test', 10000, { seq: 5 })), false);
  assert.equal(store.ingest(frame('cube_test', 9000, { seq: 4 })), false);
  assert.equal(store.ingest(frame('cube_test', 10100, { seq: 0 })), true);
});

test('different unsequenced frames in the same millisecond are retained', () => {
  const store = createTelemetryStore(() => 10000);
  store.select('hardware', 'cube_test');
  store.ingest(frame());
  assert.equal(store.ingest(frame('cube_test', 10000, { temperatureC: 26 })), true);
});

test('history stays bounded and attitude uses real dt without bridging an outage', () => {
  let now = 10000;
  const store = createTelemetryStore(() => now);
  store.select('hardware', 'cube_test');
  store.ingest(frame('cube_test', now));
  now += 100;
  store.ingest(frame('cube_test', now));
  assert.ok(Math.abs(store.getSnapshot().attitude.yaw - 1) < 1e-8);
  now += 10000;
  store.ingest(frame('cube_test', now));
  assert.ok(Math.abs(store.getSnapshot().attitude.yaw - 1) < 1e-8);
  for (let i = 0; i < 300; i++) store.ingest(frame('cube_test', ++now));
  assert.equal(store.getSnapshot().history.length, HISTORY_LIMIT);
});

test('heartbeats do not freshen the derived IMU pose', () => {
  const store = createTelemetryStore(() => 20000);
  store.select('serial', 'serial-local');
  store.ingest(frame('serial-local', 10000));
  store.ingest(adaptSerialLine('{"type":"lab1","uptime_ms":1}', 'serial-local', 20000));
  assert.equal(store.getSnapshot().attitudeReceivedAt, 10000);
});

test('socket URL encodes UID/token and requires ws/wss', () => {
  const url = new URL(telemetrySocketUrl('wss://example.com/ws', 'cube_test', 'token&value'));
  assert.equal(url.pathname, '/ws/devices/cube_test');
  assert.equal(url.searchParams.get('token'), 'token&value');
  assert.throws(() => telemetrySocketUrl('https://example.com', 'a', 'b'));
});

const flush = () => new Promise(resolve => setImmediate(resolve));
function socketHarness(initial = async () => null) {
  const sockets = [];
  const scheduled = [];
  const beats = [];
  class FakeSocket {
    readyState = 1;
    constructor() { sockets.push(this); }
    send(text) { this.sent = text; }
    close() { this.closed = true; }
  }
  const store = createTelemetryStore(() => 10000);
  const generation = store.select('hardware', 'cube_test');
  const stop = startTelemetrySocket({ url: 'ws://test', store, generation, getInitial: initial,
    Socket: FakeSocket,
    schedule: (fn, ms) => { const timer = { fn, ms }; scheduled.push(timer); return timer; },
    cancel: timer => { if (timer) timer.cancelled = true; },
    repeat: fn => { const timer = { fn }; beats.push(timer); return timer; },
    clearRepeat: timer => { if (timer) timer.cancelled = true; },
  });
  return { sockets, scheduled, beats, store, stop };
}

test('network close reconnects; stale callbacks and cleanup cannot modify the current stream', async () => {
  const h = socketHarness();
  await flush();
  const first = h.sockets[0];
  first.onopen();
  h.beats[0].fn();
  assert.equal(first.sent, 'ping');
  first.onclose({ code: 1006 });
  assert.equal(h.store.getSnapshot().link, 'offline');
  assert.equal(h.scheduled[0].ms, 1000);
  h.scheduled[0].fn();
  await flush();
  const second = h.sockets[1];
  second.onopen();
  first.onclose({ code: 1006 });
  assert.equal(h.store.getSnapshot().link, 'connected');
  const late = second.onmessage;
  h.stop();
  late({ data: JSON.stringify(frame()) });
  assert.equal(h.store.getSnapshot().latest, null);
  assert.equal(second.closed, true);
  assert.equal(h.beats[1].cancelled, true);
});

test('expired/denied authorization stops reconnect rather than looping', async () => {
  const h = socketHarness(async () => { throw Object.assign(new Error('Expired'), { status: 401 }); });
  await flush();
  assert.equal(h.sockets.length, 0);
  assert.equal(h.scheduled.length, 0);
  assert.equal(h.store.getSnapshot().error, 'Expired');
  h.stop();
});

test('a late REST bootstrap is ignored after changing source', async () => {
  let resolve;
  const h = socketHarness(() => new Promise(done => { resolve = done; }));
  h.store.select('demo', 'demo');
  h.stop();
  resolve(frame());
  await flush();
  assert.equal(h.sockets.length, 0);
  assert.equal(h.store.getSnapshot().latest, null);
});

test('policy close does not reconnect', async () => {
  const h = socketHarness();
  await flush();
  h.sockets[0].onopen();
  h.sockets[0].onclose({ code: 1008 });
  assert.equal(h.scheduled.length, 0);
  assert.equal(h.store.getSnapshot().link, 'offline');
  h.stop();
});
