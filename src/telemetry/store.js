import { isTelemetryFrame, measurementKeys } from './adapters.js';
import { emptyActivity, reduceActivity } from './practice.js';

export const MODES = { serial: 'hardware', hardware: 'hardware', simulator: 'simulator', demo: 'demo' };
export const STALE_AFTER_MS = 5000;
export const HISTORY_LIMIT = 200;

// Keep sparse samples in history, but present a fresh value for each measurement independently.
export function currentReadings(state) {
  if (!state.latest) return null;
  const frame = { ...state.latest };
  for (const key of Object.keys(state.readings)) {
    frame[key] = state.link === 'connected' && state.now - state.fieldReceivedAt[key] <= STALE_AFTER_MS ? state.readings[key] : null;
  }
  // Never compose a location from latitude and longitude belonging to different fixes.
  if (state.fieldReceivedAt.gpsLat !== state.fieldReceivedAt.gpsLon || frame.gpsLat === null || frame.gpsLon === null) {
    frame.gpsLat = null; frame.gpsLon = null;
  }
  return frame;
}

export function telemetryStatus(state, now = Date.now()) {
  if (state.link !== 'connected') return 'offline';
  if (!state.latest) return now - state.selectedAt > STALE_AFTER_MS ? 'stale' : 'waiting';
  return now - state.lastReceivedAt > STALE_AFTER_MS ? 'stale' : 'live';
}

export function createTelemetryStore(clock = Date.now) {
  let state = {
    mode: 'serial', deviceId: 'serial-local', generation: 0, selectedAt: clock(), link: 'offline',
    latest: null, history: [], packetCount: 0, rejectedCount: 0, lastReceivedAt: null,
    error: '', now: clock(),
    readings: {}, fieldReceivedAt: {}, activity: emptyActivity(),
    attitude: { pitch: null, roll: null, yaw: null },
    attitudeReceivedAt: null,
  };
  const listeners = new Set();
  function update(patch) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    select(mode, deviceId) {
      if (!Object.hasOwn(MODES, mode)) throw new Error('Unknown telemetry source');
      update({ mode, deviceId, generation: state.generation + 1, selectedAt: clock(), link: 'offline',
        latest: null, history: [], packetCount: 0, rejectedCount: 0, lastReceivedAt: null, error: '', now: clock(),
        readings: {}, fieldReceivedAt: {}, activity: emptyActivity(),
        attitude: { pitch: null, roll: null, yaw: null }, attitudeReceivedAt: null });
      return state.generation;
    },
    setLink(link, error = '', generation = state.generation) {
      if (generation === state.generation) update({ link, error, now: clock() });
    },
    tick: () => update({ now: clock() }),
    observe(events, at, generation = state.generation) {
      if (generation !== state.generation || state.mode !== 'serial') return;
      const activity = events.reduce(reduceActivity, { ...state.activity, lineCount: state.activity.lineCount + 1, lastLineAt: at });
      update({ activity, now: clock() });
    },
    invalidate(keys, generation = state.generation) {
      if (generation !== state.generation || !keys.length) return;
      const readings = { ...state.readings };
      const fieldReceivedAt = { ...state.fieldReceivedAt };
      for (const key of keys) { readings[key] = null; delete fieldReceivedAt[key]; }
      update({ readings, fieldReceivedAt, ...(keys.some(key => /^(acc|gyro)[XYZ]$/.test(key)) ? { attitudeReceivedAt: null } : {}) });
    },
    ingest(frame, generation = state.generation) {
      if (generation !== state.generation) return false;
      if (!isTelemetryFrame(frame) || frame.device_id !== state.deviceId || frame.source !== MODES[state.mode]) {
        update({ rejectedCount: state.rejectedCount + 1 });
        return false;
      }
      // Reject duplicates/out-of-order frames, but accept sequence restart on a newer sample.
      if (state.latest && frame.received_at < state.latest.received_at) return false;
      if (state.latest && frame.received_at === state.latest.received_at
        && ((frame.seq !== null && frame.seq === state.latest.seq) || JSON.stringify(frame) === JSON.stringify(state.latest))) return false;
      const now = clock();
      const attitude = { ...state.attitude };
      const hasImu = ['accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ'].some(key => frame[key] !== null);
      for (const [angle, rate] of [['roll', 'gyroX'], ['pitch', 'gyroY'], ['yaw', 'gyroZ']]) {
        const elapsed = state.fieldReceivedAt[rate] == null ? 0 : frame.received_at - state.fieldReceivedAt[rate] / 1000;
        const dt = elapsed > 0 && elapsed <= 1 ? elapsed : 0;
        if (frame[rate] !== null) attitude[angle] = (attitude[angle] ?? 0) + frame[rate] * dt;
      }
      if ([frame.accX, frame.accY, frame.accZ].every(value => value !== null)
        && Math.hypot(frame.accX, frame.accY, frame.accZ) > 1e-6) {
        attitude.roll = Math.atan2(frame.accY, frame.accZ) * 180 / Math.PI;
        attitude.pitch = Math.atan2(-frame.accX, Math.hypot(frame.accY, frame.accZ)) * 180 / Math.PI;
      }
      const readings = { ...state.readings };
      const fieldReceivedAt = { ...state.fieldReceivedAt };
      for (const key of [...measurementKeys, 'imageData']) {
        if (frame[key] !== null) { readings[key] = frame[key]; fieldReceivedAt[key] = Math.min(now, frame.received_at * 1000); }
      }
      update({ latest: frame, readings, fieldReceivedAt, history: [...state.history, frame].slice(-HISTORY_LIMIT),
        packetCount: state.packetCount + 1, lastReceivedAt: Math.min(now, frame.received_at * 1000), now, attitude,
        attitudeReceivedAt: hasImu ? Math.min(now, frame.received_at * 1000) : state.attitudeReceivedAt });
      return true;
    },
  };
}
