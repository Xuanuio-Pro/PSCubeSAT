import ReactECharts from '../visualization/Chart';
import { useTelemetry } from '../../contexts/telemetry-api';
import { METRICS, chartKeys, formatMetric, metric } from '../../telemetry/metrics';
import { PRESET_COMMANDS } from '../groundstation/command-presets';

const COLORS = ['#2f81f7', '#3fb950', '#f85149', '#d29922', '#a371f7', '#39c5cf'];
const MAX_POINTS = 60;
/** @type {import('react').CSSProperties} */
const center = { textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };

/** Line chart of one or more telemetry fields with the same unit. @param {{ keys: string[] }} props */
export function MetricChart({ keys }) {
  const { latest, history } = useTelemetry();
  const rows = history.filter(frame => keys.some(key => frame[key] != null)).slice(-MAX_POINTS);
  const unit = metric(keys[0]).unit;
  const option = {
    backgroundColor: 'transparent',
    color: COLORS,
    grid: { top: keys.length > 1 ? 34 : 16, right: 16, bottom: 12, left: 12, containLabel: true },
    legend: keys.length > 1 ? { top: 4, textStyle: { color: '#8b949e', fontSize: 11 } } : undefined,
    tooltip: { trigger: 'axis', confine: true, valueFormatter: value => (value == null ? '—' : `${Number(value).toFixed(metric(keys[0]).decimals)} ${unit}`) },
    xAxis: { type: 'category', data: rows.map(frame => new Date(frame.received_at * 1000).toLocaleTimeString()),
      axisLine: { lineStyle: { color: '#30363d' } }, axisLabel: { color: '#8b949e', fontSize: 10, hideOverlap: true } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#8b949e', fontSize: 10, formatter: `{value} ${unit}` }, splitLine: { lineStyle: { color: '#e3e8ed' } } },
    series: keys.map(key => ({ name: metric(key).label, type: 'line', smooth: true, connectNulls: true,
      showSymbol: rows.length < 2, symbolSize: 6, data: rows.map(frame => frame[key]) })),
    animation: false,
  };
  return <div className="card">
    <div className="card-header"><h3>📈 {keys.map(key => metric(key).label).join(' · ')}</h3>
      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{keys.map(key => formatMetric(latest?.[key], key)).join(' · ')}</strong></div>
    {rows.length === 0 && <p className="telemetry-empty">Chưa nhận được {keys.map(key => metric(key).label.toLowerCase()).join(', ')}</p>}
    <ReactECharts option={option} style={{ flex: 1, minHeight: 140 }} notMerge={true} />
  </div>;
}

/** @param {{ config: { key: string, min?: number, max?: number } }} props */
export function GaugeWidget({ config }) {
  const { latest } = useTelemetry();
  const info = metric(config.key);
  const value = latest?.[info.key] ?? null;
  const min = config.min ?? info.min;
  const max = config.max ?? info.max;
  const pct = value === null || max <= min ? 0 : Math.max(0, Math.min((value - min) / (max - min) * 100, 100));
  // Battery level reads green → red as it drains; other fields use one neutral colour.
  const color = info.key !== 'voltageV' ? 'var(--accent-blue)' : pct > 60 ? 'var(--accent-green)' : pct > 30 ? 'var(--accent-orange)' : 'var(--accent-red)';
  return <div style={center}>
    <div style={{ width: 110, height: 110, borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `conic-gradient(${color} ${pct * 3.6}deg, var(--bg-tertiary) 0deg)` }}>
      <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>{value === null ? '—' : value.toFixed(Math.min(info.decimals, 2))}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{info.unit}</span>
      </div>
    </div>
    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{info.label}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Thang đo {min} – {max} {info.unit}</div>
  </div>;
}

/** @param {{ config: { key: string, threshold: number, direction: 'above' | 'below' } }} props */
export function AlertWidget({ config }) {
  const { latest } = useTelemetry();
  const info = metric(config.key);
  const value = latest?.[info.key] ?? null;
  const above = config.direction !== 'below';
  const active = value !== null && (above ? value > config.threshold : value < config.threshold);
  return <div style={center}>
    <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px', transition: 'all 0.3s',
      background: active ? 'var(--accent-red)' : value === null ? 'var(--bg-tertiary)' : 'var(--accent-green)',
      boxShadow: active ? '0 0 25px rgba(248,81,73,0.6)' : 'none', animation: active ? 'pulse-orange 1s ease-in-out infinite' : 'none' }} />
    <div style={{ fontSize: '1rem', fontWeight: 700, color: active ? 'var(--accent-red)' : 'var(--text-heading)' }}>
      {value === null ? `Chờ ${info.label.toLowerCase()}` : active ? '⚠️ VƯỢT NGƯỠNG' : '✅ Bình thường'}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{info.label}: {formatMetric(value, info.key)} · ngưỡng {above ? '>' : '<'} {config.threshold} {info.unit}</div>
  </div>;
}

/** Latest value of several fields side by side. @param {{ config: { keys: string[] } }} props */
export function ValueWidget({ config }) {
  const { latest } = useTelemetry();
  return <div className="radio-tiles" style={{ alignContent: 'start' }}>
    {config.keys.map(key => <article key={key} className="practice-task">
      <strong>{metric(key).label}</strong><b>{formatMetric(latest?.[key], key)}</b>
    </article>)}
  </div>;
}

/** @param {{ config: { label: string, command: string }, onSend?: (command: string) => unknown }} props */
export function ButtonWidget({ config, onSend = undefined }) {
  return <div style={center}>
    <button type="button" className="btn btn-primary" disabled={!onSend} onClick={() => onSend?.(config.command)} style={{ width: '85%', padding: 14, fontSize: '1rem', borderRadius: 12 }}>
      {config.label}
    </button>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
      {onSend ? <>Lệnh gửi qua Serial: <code>{config.command}</code></> : 'Kết nối Serial để gửi lệnh'}
    </div>
  </div>;
}

const plotted = METRICS.filter(item => item.plot);

/** Per-widget settings, edited in place; only fields that the widget type uses are shown. */
export function WidgetSettings({ widget, onChange }) {
  const { type, config } = widget;
  const set = patch => onChange({ ...config, ...patch });
  const number = (value, fallback) => { const parsed = Number(value); return value === '' || !Number.isFinite(parsed) ? fallback : parsed; };
  const select = (value, onSelect, options = METRICS) => <select value={value} onChange={event => onSelect(event.target.value)}>
    {options.map(item => <option key={item.key} value={item.key}>{item.label} ({item.unit})</option>)}
  </select>;
  const checks = (keys, toggle, options) => <div className="dashboard-settings-checks">{options.map(item => <label key={item.key}>
    <input type="checkbox" checked={keys.includes(item.key)} onChange={() => toggle(item.key)} />{item.label} <small>{item.unit}</small>
  </label>)}</div>;
  return <div className="dashboard-settings">
    {type === 'chart' && <>
      <p>Chọn dữ liệu vẽ (các đường trong cùng một đồ thị phải cùng đơn vị; chọn khác đơn vị sẽ bắt đầu đồ thị mới).</p>
      {checks(config.keys, key => set({ keys: chartKeys(config.keys, key) }), plotted)}
    </>}
    {type === 'value' && <>
      <p>Chọn các số liệu hiển thị.</p>
      {checks(config.keys, key => set({ keys: config.keys.includes(key) ? config.keys.filter(item => item !== key) : [...config.keys, key] }), METRICS)}
    </>}
    {type === 'gauge' && <>
      <label>Dữ liệu {select(config.key, key => set({ key, min: metric(key).min, max: metric(key).max }), plotted)}</label>
      <label>Nhỏ nhất <input type="number" value={config.min} onChange={event => set({ min: number(event.target.value, config.min) })} /></label>
      <label>Lớn nhất <input type="number" value={config.max} onChange={event => set({ max: number(event.target.value, config.max) })} /></label>
    </>}
    {type === 'alert' && <>
      <label>Dữ liệu {select(config.key, key => set({ key }), plotted)}</label>
      <label>Cảnh báo khi <select value={config.direction} onChange={event => set({ direction: event.target.value })}>
        <option value="above">lớn hơn</option><option value="below">nhỏ hơn</option></select></label>
      <label>Ngưỡng <input type="number" value={config.threshold} onChange={event => set({ threshold: number(event.target.value, config.threshold) })} /></label>
    </>}
    {type === 'button' && <>
      <label>Nhãn nút <input type="text" maxLength={40} value={config.label} onChange={event => set({ label: event.target.value })} /></label>
      <label>Lệnh gửi <input type="text" maxLength={120} value={config.command} onChange={event => set({ command: event.target.value })} /></label>
    </>}
    {type === 'commands' && (() => {
      const list = config.commandText.split(',').map(item => item.trim()).filter(Boolean);
      const toggle = cmd => set({ commandText: (list.includes(cmd) ? list.filter(item => item !== cmd) : [...list, cmd]).join(', ') });
      return <>
        <p>Chọn lệnh gợi ý hoặc gõ thêm lệnh riêng (cách nhau bằng dấu phẩy). Lệnh chỉ có tác dụng khi firmware của bạn xử lý lệnh đó.</p>
        <div className="dashboard-settings-checks">{PRESET_COMMANDS.map(item => <label key={item.cmd} title={item.desc}>
          <input type="checkbox" checked={list.includes(item.cmd)} onChange={() => toggle(item.cmd)} />{item.label}
        </label>)}</div>
        <label>Danh sách lệnh <input type="text" maxLength={400} value={config.commandText} onChange={event => set({ commandText: event.target.value })} /></label>
      </>;
    })()}
  </div>;
}
