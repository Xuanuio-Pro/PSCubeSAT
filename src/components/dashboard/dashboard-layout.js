import { METRICS } from '../../telemetry/metrics.js';

// Default and minimum sizes in grid units (1 row = ROW_HEIGHT px): the minimum keeps each widget's header,
// content and controls visible, so resizing can never squash a map, chart or 3D view into an unreadable strip.
// `config`: default settings for widgets the student can configure (⚙).
export const ROW_HEIGHT = 60;
export const GRID_COLS = 12;
export const DEFAULT_COMMANDS = 'ping, status, uptime, get_sensor, get_eps, get_gps, capture, pause, resume, help';
/** @typedef {{ type: string, label: string, icon: string, w: number, h: number, minW: number, minH: number, config?: Record<string, any> }} WidgetType */
/** @typedef {{ i: string, type: string, x: number, y: number, w: number, h: number, config: Record<string, any> }} Widget */
/** @type {{ title: string, items: WidgetType[] }[]} */
export const WIDGET_GROUPS = [
  { title: 'Số liệu', items: [
    { type: 'chart', label: 'Đồ thị', icon: '📈', w: 6, h: 6, minW: 4, minH: 5, config: { keys: ['voltageV'] } },
    { type: 'gauge', label: 'Gauge', icon: '🎯', w: 3, h: 4, minW: 2, minH: 4, config: { key: 'voltageV', min: 3, max: 4.2 } },
    { type: 'value', label: 'Bảng số liệu', icon: '🔢', w: 4, h: 4, minW: 3, minH: 3, config: { keys: ['voltageV', 'temperatureC', 'pressureHpa'] } },
    { type: 'alert', label: 'Cảnh báo ngưỡng', icon: '🚨', w: 3, h: 4, minW: 2, minH: 3, config: { key: 'temperatureC', threshold: 45, direction: 'above' } },
    { type: 'environment', label: 'Môi trường', icon: '🌡️', w: 6, h: 7, minW: 4, minH: 5 },
  ] },
  { title: 'Định vị · Tư thế · Camera', items: [
    { type: 'map', label: 'Bản đồ GPS', icon: '🗺️', w: 6, h: 6, minW: 4, minH: 5 },
    { type: '3d', label: 'Mô hình 3D', icon: '🛰️', w: 6, h: 6, minW: 4, minH: 5 },
    { type: 'image', label: 'Ảnh camera', icon: '📷', w: 4, h: 6, minW: 3, minH: 5 },
  ] },
  { title: 'Hệ thống · Truyền thông', items: [
    { type: 'system', label: 'System Check', icon: '🩺', w: 6, h: 6, minW: 4, minH: 4 },
    { type: 'radio', label: 'Liên lạc LoRa', icon: '📡', w: 6, h: 6, minW: 4, minH: 5 },
    { type: 'groundStation', label: 'Trạm mặt đất', icon: '🛰️', w: 4, h: 4, minW: 3, minH: 4 },
    { type: 'shell', label: 'Kết quả lệnh', icon: '🗂️', w: 6, h: 5, minW: 3, minH: 4 },
    { type: 'anomaly', label: 'Phát hiện sự cố', icon: '⚠️', w: 4, h: 5, minW: 3, minH: 4 },
  ] },
  { title: 'Điều khiển', items: [
    { type: 'button', label: 'Nút lệnh', icon: '🔘', w: 3, h: 3, minW: 2, minH: 3, config: { label: 'Chụp ảnh', command: 'capture' } },
    { type: 'commands', label: 'Bảng lệnh', icon: '🎮', w: 6, h: 6, minW: 4, minH: 5, config: { commandText: DEFAULT_COMMANDS } },
    { type: 'terminal', label: 'Terminal', icon: '📟', w: 6, h: 6, minW: 4, minH: 5 },
  ] },
];
export const WIDGET_TYPES = WIDGET_GROUPS.flatMap(group => group.items);
/** @param {string} type */
export const typeInfo = type => WIDGET_TYPES.find(item => item.type === type);

/** @returns {Widget} */
export function createWidget(i, type, x, y) {
  const info = typeInfo(type);
  return { i, type, x, y, w: info.w, h: info.h, config: structuredClone(info.config ?? {}) };
}

export const defaultLayout = () => [
  createWidget('1', 'chart', 0, 0), createWidget('2', 'gauge', 6, 0), { ...createWidget('3', 'value', 9, 0), w: 3 }, // 6 + 3 + 3 = 12 columns
  createWidget('4', 'map', 0, 6), createWidget('5', '3d', 6, 6),
];

// One layout per account, next to that account's code drafts in this browser.
export const layoutKey = userId => `ptit:dashboard:v1:user:${encodeURIComponent(String(userId))}`;

const KEYS = new Set(METRICS.map(item => item.key));
const PLOT_KEYS = new Set(METRICS.filter(item => item.plot).map(item => item.key));
const int = (value, min, max, fallback) => Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback;
const num = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const text = (value, fallback, length) => typeof value === 'string' ? value.slice(0, length) : fallback;

/** Keep only settings the widget type knows, with valid values; anything else falls back to the default. */
function cleanConfig(type, config) {
  const base = structuredClone(typeInfo(type).config ?? {});
  const saved = config && typeof config === 'object' ? config : {};
  const keys = (list, allowed) => Array.isArray(list) ? [...new Set(list.filter(key => allowed.has(key)))] : [];
  if (type === 'chart') {
    const picked = keys(saved.keys, PLOT_KEYS);
    // A saved chart mixing units (edited by hand) keeps the fields of its first unit only.
    const unit = picked.length ? METRICS.find(item => item.key === picked[0]).unit : null;
    const same = picked.filter(key => METRICS.find(item => item.key === key).unit === unit);
    return { keys: same.length ? same : base.keys };
  }
  if (type === 'value') { const picked = keys(saved.keys, KEYS); return { keys: picked.length ? picked : base.keys }; }
  if (type === 'gauge') {
    const key = PLOT_KEYS.has(saved.key) ? saved.key : base.key;
    const metric = METRICS.find(item => item.key === key);
    const min = num(saved.min, metric.min); const max = num(saved.max, metric.max);
    return max > min ? { key, min, max } : { key, min: metric.min, max: metric.max };
  }
  if (type === 'alert') return { key: PLOT_KEYS.has(saved.key) ? saved.key : base.key,
    threshold: num(saved.threshold, base.threshold), direction: saved.direction === 'below' ? 'below' : 'above' };
  if (type === 'button') return { label: text(saved.label, base.label, 40), command: text(saved.command, base.command, 120) };
  if (type === 'commands') return { commandText: text(saved.commandText, base.commandText, 400) };
  return base;
}

/**
 * Parses a saved layout. Widgets of a type that no longer exists (e.g. removed panels) or with
 * malformed geometry are dropped; settings are re-validated. Returns null when nothing usable is stored.
 * @returns {Widget[] | null}
 */
export function parseLayout(raw) {
  let data;
  try { data = JSON.parse(raw ?? 'null'); } catch { return null; }
  if (!data || data.version !== 1 || !Array.isArray(data.widgets)) return null;
  const seen = new Set();
  const widgets = [];
  for (const item of data.widgets.slice(0, 40)) {
    const info = item && typeof item === 'object' ? typeInfo(item.type) : null;
    if (!info || typeof item.i !== 'string' || !/^\d{1,6}$/.test(item.i) || seen.has(item.i)) continue;
    seen.add(item.i);
    const w = int(item.w, info.minW, GRID_COLS, info.w);
    widgets.push({ i: item.i, type: item.type, x: int(item.x, 0, GRID_COLS - w, 0), y: int(item.y, 0, 1000, 0),
      w, h: int(item.h, info.minH, 30, info.h), config: cleanConfig(item.type, item.config) });
  }
  return widgets;
}

/** @param {Widget[]} widgets */
export const serializeLayout = widgets => JSON.stringify({ version: 1, widgets: widgets.map(({ i, type, x, y, w, h, config }) => ({ i, type, x, y, w, h, config })) });

/** @param {Widget[]} widgets */
export const nextWidgetId = widgets => widgets.reduce((max, widget) => Math.max(max, Number(widget.i)), 0) + 1;
