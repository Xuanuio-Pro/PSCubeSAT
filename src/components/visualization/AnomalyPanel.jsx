import ReactECharts from './Chart';
import { makeSparkOption } from './spark-option';
import { useTelemetry } from '../../contexts/telemetry-api';
import './practice.css';

// Thresholds copied from Lab6-02 FallDetector / isOverheating; the verdict itself always comes from the firmware log.
const FREEFALL_G = 1;
const OVERHEAT_C = 45;
const MAX_POINTS = 60;

export default function AnomalyPanel() {
  const { latest, history, activity, now, mode, link, status } = useTelemetry();
  const at = frame => new Date(frame.received_at * 1000).toLocaleTimeString();
  const magnitude = history.filter(frame => [frame.accX, frame.accY, frame.accZ].every(value => value !== null)).slice(-MAX_POINTS)
    .map(frame => ({ time: at(frame), value: Math.hypot(frame.accX, frame.accY, frame.accZ) }));
  const temperature = history.filter(frame => frame.temperatureC !== null).slice(-MAX_POINTS).map(frame => ({ time: at(frame), value: frame.temperatureC }));
  const alert = activity.subsystems.alert;
  const fresh = mode === 'serial' && link === 'connected' && alert && now - alert.at <= 5000;
  const verdict = !alert ? { className: '', title: 'Chưa có sự kiện', detail: 'Firmware chỉ in log khi vào hoặc thoát trạng thái sự cố.' }
    : alert.phase === 'error' ? { className: 'is-error', title: fresh ? '⚠️ SỰ CỐ' : '⚠️ Sự cố gần nhất', detail: alert.text }
      : alert.phase === 'recovered' ? { className: 'is-ok', title: '✅ Hết điều kiện sự cố', detail: alert.text }
        : { className: '', title: 'Không xác định', detail: alert.text };
  const display = (value, digits) => value == null ? '—' : value.toFixed(digits);
  const lastG = magnitude.at(-1)?.value;
  return <section className="card" style={{ opacity: status === 'live' ? 1 : 0.75 }}>
    <div className="card-header"><h3>🚨 Phát hiện sự cố</h3>
      <div className="environment-summary">
        <span style={{ color: '#e3b341' }}>|a| {display(lastG, 2)} g</span>
        <span style={{ color: '#f85149' }}>🌡️ {display(latest?.temperatureC, 1)} °C</span>
        <span style={{ color: '#a371f7' }}>🔵 {display(latest?.pressureHpa, 1)} hPa</span>
      </div>
    </div>
    <div className="card-body">
      <div className={`anomaly-status ${verdict.className}`}><div><strong>{verdict.title}</strong><p>{verdict.detail}{alert && ` · ${new Date(alert.at).toLocaleTimeString()}`}</p></div></div>
      <div className="environment-charts">
        <ReactECharts notMerge style={{ height: 190, width: '100%', minWidth: 0 }} option={makeSparkOption({
          title: 'Độ lớn gia tốc |a| (g)', unit: 'g', color: '#e3b341', data: magnitude, min: 0, max: v => Math.max(2, Number.isFinite(v.max) ? Math.ceil(v.max) : 0),
          markLines: [{ value: FREEFALL_G, label: `< ${FREEFALL_G} g trong 200 ms: rơi tự do`, lineColor: '#c94a4a' }],
        })} />
        <ReactECharts notMerge style={{ height: 190, width: '100%', minWidth: 0 }} option={makeSparkOption({
          title: 'Nhiệt độ (°C)', unit: '°C', color: '#f85149', data: temperature,
          max: v => Math.max(OVERHEAT_C + 5, Number.isFinite(v.max) ? Math.ceil(v.max + 2) : 0),
          markLines: [{ value: OVERHEAT_C, label: `> ${OVERHEAT_C} °C: quá nhiệt`, lineColor: '#c94a4a' }],
        })} />
      </div>
    </div>
  </section>;
}
