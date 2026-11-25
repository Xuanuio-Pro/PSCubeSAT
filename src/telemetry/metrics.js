/**
 * Telemetry fields a Lab 8 dashboard widget can display. `min`/`max` are the default gauge range
 * (typical for the PTITCube sensors), not limits applied to the data.
 * @typedef {{ key: string, label: string, unit: string, decimals: number, min: number, max: number, plot: boolean }} Metric
 */
/** @type {Metric[]} */
export const METRICS = [
  { key: 'voltageV', label: 'Điện áp pin', unit: 'V', decimals: 2, min: 3, max: 4.2, plot: true },
  { key: 'temperatureC', label: 'Nhiệt độ', unit: '°C', decimals: 1, min: -10, max: 60, plot: true },
  { key: 'pressureHpa', label: 'Áp suất', unit: 'hPa', decimals: 1, min: 950, max: 1050, plot: true },
  ...['X', 'Y', 'Z'].map(axis => ({ key: `acc${axis}`, label: `Gia tốc ${axis}`, unit: 'g', decimals: 2, min: -2, max: 2, plot: true })),
  ...['X', 'Y', 'Z'].map(axis => ({ key: `gyro${axis}`, label: `Con quay ${axis}`, unit: '°/s', decimals: 1, min: -250, max: 250, plot: true })),
  ...['X', 'Y', 'Z'].map(axis => ({ key: `mag${axis}`, label: `Từ trường ${axis}`, unit: 'µT', decimals: 1, min: -100, max: 100, plot: true })),
  { key: 'gpsAlt', label: 'Độ cao GPS', unit: 'm', decimals: 1, min: 0, max: 1000, plot: true },
  { key: 'gpsLat', label: 'Vĩ độ', unit: '°', decimals: 6, min: -90, max: 90, plot: false },
  { key: 'gpsLon', label: 'Kinh độ', unit: '°', decimals: 6, min: -180, max: 180, plot: false },
];

/** @param {string} key */
export const metric = key => METRICS.find(item => item.key === key) ?? METRICS[0];

/** Keys sharing one chart must share a unit, so a single Y axis stays readable. */
export function chartKeys(selected, key) {
  if (selected.includes(key)) return selected.length > 1 ? selected.filter(item => item !== key) : selected;
  return selected.length && metric(selected[0]).unit !== metric(key).unit ? [key] : [...selected, key];
}

/** @param {number|null|undefined} value @param {string} key */
export const formatMetric = (value, key) => value == null ? '—' : `${value.toFixed(metric(key).decimals)} ${metric(key).unit}`;
