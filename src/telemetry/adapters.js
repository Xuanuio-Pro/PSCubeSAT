import schema from '../../shared/telemetry.schema.json' with { type: 'json' };

/** @typedef {import('./frame').TelemetryFrame} TelemetryFrame */
export const measurementKeys = Object.keys(schema.properties).filter(key =>
  !['type', 'schema_version', 'device_id', 'source', 'timestamp', 'received_at', 'seq', 'imageData'].includes(key));

function read(data, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((object, key) => object?.[key], data);
    if (value !== undefined) return value;
  }
  return null;
}

function accepts(value, rule) {
  if (rule.anyOf) return rule.anyOf.some(branch => accepts(value, branch));
  if ('const' in rule && value !== rule.const) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  if (rule.type === 'null') return value === null;
  if (rule.type === 'string') return typeof value === 'string'
    && (!rule.pattern || new RegExp(rule.pattern).test(value))
    && (rule.maxLength === undefined || value.length <= rule.maxLength);
  if (rule.type === 'boolean') return typeof value === 'boolean';
  if (rule.type === 'number' || rule.type === 'integer') {
    return typeof value === 'number' && Number.isFinite(value)
      && (rule.type !== 'integer' || Number.isInteger(value))
      && (rule.minimum === undefined || value >= rule.minimum)
      && (rule.maximum === undefined || value <= rule.maximum);
  }
  return true;
}

/** @returns {data is TelemetryFrame} */
export function isTelemetryFrame(data) {
  return data && typeof data === 'object' && !Array.isArray(data)
    && Object.keys(data).every(key => Object.hasOwn(schema.properties, key))
    && schema.required.every(key => Object.hasOwn(data, key))
    && Object.entries(schema.properties).every(([key, rule]) => accepts(data[key], rule));
}

const aliases = {
  accX: ['acc.x', 'acc_x', 'accX'], accY: ['acc.y', 'acc_y', 'accY'], accZ: ['acc.z', 'acc_z', 'accZ'],
  gyroX: ['gyro.x', 'gyro_x', 'gyroX'], gyroY: ['gyro.y', 'gyro_y', 'gyroY'], gyroZ: ['gyro.z', 'gyro_z', 'gyroZ'],
  magX: ['mag.x', 'mag_x', 'magX'], magY: ['mag.y', 'mag_y', 'magY'], magZ: ['mag.z', 'mag_z', 'magZ'],
  temperatureC: ['temperature', 'temperatureC', 'temp', 'temp_c'], voltageV: ['voltage', 'voltageV', 'battery_v'],
  humidityPct: ['humidity', 'humidityPct'], pressureHpa: ['pressure', 'pressureHpa', 'baro_hpa'],
  gpsLat: ['gps.lat', 'lat', 'gpsLat'], gpsLon: ['gps.lon', 'lon', 'lng', 'gpsLon'], gpsAlt: ['gps.alt', 'alt', 'gpsAlt'],
  uptimeMs: ['uptime_ms', 'uptimeMs'], ledOn: ['led_on', 'ledOn'],
  imageData: ['image_data', 'imageData'],
};

export function acceptsSerialMetadata(data, deviceId) {
  return data && typeof data === 'object' && !Array.isArray(data)
    && (data.type == null || ['telemetry', 'lab1'].includes(data.type))
    && (data.schema_version === undefined || data.schema_version === 1)
    && (data.source == null || data.source === 'hardware')
    && (data.device_id == null || accepts(data.device_id, schema.properties.device_id))
    && (data.seq === undefined || accepts(data.seq, schema.properties.seq))
    && (data.timestamp === undefined || accepts(data.timestamp, schema.properties.timestamp))
    && (!data.device_id || deviceId === 'serial-local' || data.device_id === deviceId);
}

export function explicitNullMeasurements(data) {
  return Object.entries(aliases).filter(([, paths]) => paths.some(path =>
    path.split('.').reduce((object, key) => object?.[key], data) !== undefined)
    && read(data, paths) === null).map(([key]) => key);
}

/** Legacy Serial JSON -> the canonical contract. Non-telemetry log lines are ignored. */
export function adaptSerialLine(text, deviceId = 'serial-local', now = Date.now()) {
  if (text.length > 65536) return null;
  let data;
  const trimmed = text.trim();
  if (trimmed.startsWith('IMG:')) data = { imageData: `data:image/jpeg;base64,${trimmed.slice(4)}` };
  else if (trimmed.startsWith('data:image')) data = { imageData: trimmed };
  else {
    if (!trimmed.startsWith('{')) return null;
    try { data = JSON.parse(trimmed); } catch { return null; }
  }
  if (!acceptsSerialMetadata(data, deviceId)) return null;
  const measurements = Object.fromEntries(Object.entries(aliases).map(([key, paths]) => [key, read(data, paths)]));
  if (Object.values(measurements).every(value => value === null)) return null;
  const frame = {
    type: 'telemetry', schema_version: 1, device_id: data.device_id ?? deviceId, source: 'hardware',
    timestamp: data.timestamp ?? null, received_at: now / 1000, seq: data.seq ?? null, ...measurements,
  };
  return isTelemetryFrame(frame) ? frame : null;
}

/** WS init envelopes and live frames share the exact same schema. */
export function adaptWebSocketMessage(text) {
  if (text.length > 65536) return null;
  let envelope;
  try { envelope = JSON.parse(text); } catch { return null; }
  const frame = envelope?.type === 'init' ? envelope.device : envelope;
  return isTelemetryFrame(frame) ? frame : null;
}

export function demoFrame(now = Date.now(), seq = 0) {
  const t = seq / 5;
  const frame = adaptSerialLine(JSON.stringify({
    acc_x: Math.sin(t) * 0.1, acc_y: Math.cos(t) * 0.1, acc_z: 1,
    gyro_x: 0, gyro_y: 0, gyro_z: 3, temperature: 25 + Math.sin(t) * 2,
    voltage: 3.8 + Math.sin(t / 3) * 0.1, humidity: 55 + Math.sin(t) * 5, pressure: 1013.25,
    lat: 21.0285 + Math.sin(t / 8) * 0.002, lng: 105.8542 + Math.cos(t / 8) * 0.002, alt: 50,
    seq, timestamp: now / 1000,
  }), 'demo', now);
  return { ...frame, source: /** @type {const} */ ('demo') };
}
