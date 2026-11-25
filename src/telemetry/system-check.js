// Lab7 downlinks every 4 s and pauses telemetry while it answers a command: allow a couple of periods
// before a subsystem drops back to Inactive.
export const ACTIVE_WINDOW_MS = 10000;
const LOG_LIMIT = 5;

export const SUBSYSTEMS = [
  { id: 'sensor', name: 'Cảm biến I2C', groups: ['sensor', 'attitude'], keys: ['temperatureC', 'pressureHpa', 'accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ', 'magX', 'magY', 'magZ'] },
  { id: 'gps', name: 'Định vị GPS', groups: ['gps'], keys: ['gpsLat', 'gpsLon'] },
  { id: 'eps', name: 'Điện áp pin', groups: ['eps', 'power'], keys: ['voltageV'] },
  { id: 'storage', name: 'Thẻ nhớ SD', groups: ['storage'], keys: [], log: true },
  { id: 'radio', name: 'Đường truyền LoRa', groups: ['radio'], keys: [], log: true },
  { id: 'network', name: 'WiFi / MQTT', groups: ['network'], keys: [] },
];

// A photo saved by command f is an SD write too.
const belongsTo = (sys, event) => sys.groups.includes(event.group) || (sys.id === 'storage' && event.group === 'camera' && event.phase === 'saved');

/**
 * Status of one System Check row from the newest measurement or device report:
 * `active` while something arrived within ACTIVE_WINDOW_MS, `error` when that newest evidence is an error.
 */
export function subsystemStatus(sys, { activity, fieldReceivedAt = {}, now, mode, link }) {
  const events = activity.events.filter(event => belongsTo(sys, event));
  const lastEvent = events.at(-1) ?? null;
  const fieldTimes = sys.keys.map(key => fieldReceivedAt[key]).filter(Number.isFinite);
  const lastField = Math.max(-Infinity, ...fieldTimes);
  const lastAt = Math.max(lastEvent?.at ?? -Infinity, lastField);
  // Device reports (activity) only arrive over Serial; WebSocket sources only carry measurements.
  const online = link === 'connected' && (mode === 'serial' || fieldTimes.length > 0);
  const recent = online && Number.isFinite(lastAt) && now - lastAt <= ACTIVE_WINDOW_MS;
  const error = recent && lastEvent?.phase === 'error' && lastEvent.at >= lastField;
  return { state: error ? 'error' : recent ? 'active' : 'inactive', lastAt: Number.isFinite(lastAt) ? lastAt : null, lastEvent, log: events.slice(-LOG_LIMIT).reverse() };
}
