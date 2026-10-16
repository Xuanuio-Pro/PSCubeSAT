import { isTelemetryFrame } from './adapters.js';

export const MODES = { serial: 'hardware', hardware: 'hardware', simulator: 'simulator', demo: 'demo' };
export const STALE_AFTER_MS = 5000;
export const HISTORY_LIMIT = 200;

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
        attitude: { pitch: null, roll: null, yaw: null }, attitudeReceivedAt: null });
      return state.generation;
    },
    setLink(link, error = '', generation = state.generation) {
      if (generation === state.generation) update({ link, error, now: clock() });
    },
    tick: () => update({ now: clock() }),
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
      const elapsed = state.latest ? frame.received_at - state.latest.received_at : 0;
      const dt = elapsed > 0 && elapsed <= 1 ? elapsed : 0;
      const attitude = { ...state.attitude };
      const hasImu = ['accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ'].some(key => frame[key] !== null);
      for (const [angle, rate] of [['roll', 'gyroX'], ['pitch', 'gyroY'], ['yaw', 'gyroZ']]) {
        if (frame[rate] !== null) attitude[angle] = (attitude[angle] ?? 0) + frame[rate] * dt;
      }
      if ([frame.accX, frame.accY, frame.accZ].every(value => value !== null)
        && Math.hypot(frame.accX, frame.accY, frame.accZ) > 1e-6) {
        attitude.roll = Math.atan2(frame.accY, frame.accZ) * 180 / Math.PI;
        attitude.pitch = Math.atan2(-frame.accX, Math.hypot(frame.accY, frame.accZ)) * 180 / Math.PI;
      }
      update({ latest: frame, history: [...state.history, frame].slice(-HISTORY_LIMIT),
        packetCount: state.packetCount + 1, lastReceivedAt: Math.min(now, frame.received_at * 1000), now, attitude,
        attitudeReceivedAt: hasImu ? Math.min(now, frame.received_at * 1000) : state.attitudeReceivedAt });
      return true;
    },
  };
}
