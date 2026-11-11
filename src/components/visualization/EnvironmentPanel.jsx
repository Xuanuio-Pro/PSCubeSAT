import ReactECharts from './Chart';
import { useTelemetry } from '../../contexts/telemetry-api';
import { makeSparkOption } from './spark-option';

const MAX_POINTS = 60;

// Every reference sketch uses BMP280 (temperature + pressure); humidity is shown only when asked for.
export default function EnvironmentPanel({ maxPoints = MAX_POINTS, metrics = ['temp', 'pres'] }) {
  const { latest: frame, history, status } = useTelemetry();
  const series = key => history.filter(sample => sample[key] !== null).slice(-maxPoints)
    .map(sample => ({ time: new Date(sample.received_at * 1000).toLocaleTimeString(), value: sample[key] }));
  const temp = series('temperatureC');
  const hum = series('humidityPct');
  const pres = series('pressureHpa');
  const latest = { temp: frame?.temperatureC, hum: frame?.humidityPct, pres: frame?.pressureHpa };
  const display = value => value == null ? '—' : value.toFixed(1);
  const fresh = status === 'live' && metrics.some(key => latest[key] != null);

  const charts = [
    {
      key: 'temp',
      data: temp,
      opts: makeSparkOption({
        title: 'Nhiệt độ (°C)',
        unit: '°C',
        color: '#f85149',
        data: temp,
        markLines: [
          { value: 0,  label: '0 °C',  lineColor: '#388bfd' },
          { value: 85, label: '85 °C', lineColor: '#f85149' },
        ],
      }),
    },
    {
      key: 'hum',
      data: hum,
      opts: makeSparkOption({
        title: 'Độ ẩm (%RH)',
        unit: '%RH',
        color: '#388bfd',
        data: hum,
        min: 0,
        max: 100,
        markLines: [
          { value: 30, label: '30% (khô)',  lineColor: '#e3b341' },
          { value: 80, label: '80% (ẩm)',   lineColor: '#388bfd' },
        ],
      }),
    },
    {
      key: 'pres',
      data: pres,
      opts: makeSparkOption({
        title: 'Áp suất (hPa)',
        unit: 'hPa',
        color: '#a371f7',
        data: pres,
        markLines: [
          { value: 1013.25, label: '1 atm', lineColor: '#8b949e' },
        ],
      }),
    },
  ];

  const badges = [
    { key: 'temp', label: 'Nhiệt độ',   value: display(latest.temp), unit: '°C',   color: '#f85149', emoji: '🌡️' },
    { key: 'hum', label: 'Độ ẩm',      value: display(latest.hum),  unit: '%RH',  color: '#388bfd', emoji: '💧' },
    { key: 'pres', label: 'Áp suất',    value: display(latest.pres), unit: 'hPa',  color: '#a371f7', emoji: '🔵' },
  ].filter(badge => metrics.includes(badge.key));

  return (
    <div className="card environment-panel" style={{ opacity: fresh ? 1 : 0.65 }}>
      {/* Header */}
      <div className="card-header">
        <h3>🌍 Cảm biến Môi trường</h3>
        <div className="environment-summary">
          {badges.map(b => (
            <span key={b.label} style={{ color: b.color }}>
              {b.emoji} {b.value} {b.unit}
            </span>
          ))}
        </div>
      </div>
      {!fresh && <p className="telemetry-empty">Chờ mẫu môi trường mới</p>}

      {/* Badge row */}
      <div className="environment-readings">
        {badges.map(b => (
          <div
            key={b.label}
            className="environment-reading"
            style={{
              background: '#161b22',
              border: `1px solid ${b.color}33`,
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ color: '#8b949e', fontSize: '11px' }}>{b.emoji} {b.label}</span>
            <span className="environment-reading-value" style={{ color: b.color }}>
              <span>{b.value}</span>
              <span className="environment-reading-unit">{b.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Sparkline charts */}
      <div className="environment-charts">
        {charts.filter(chart => metrics.includes(chart.key) && (chart.key !== 'hum' || chart.data.length > 0)).map(({ key, opts }) => (
          <ReactECharts
            key={key}
            option={opts}
            style={{ height: '190px', minWidth: 0, width: '100%' }}
            notMerge={true}
          />
        ))}
      </div>
    </div>
  );
}
