import ReactECharts from './Chart';
import { useTelemetry } from '../../contexts/telemetry-api';

/** @param {{ maxPoints?: number, height?: number|string }} props `'100%'` fills a flex parent (dashboard widget). */
export default function VoltageChart({ maxPoints = 60, height = 300 }) {
  const { latest, history, status, activity, now } = useTelemetry();
  const fresh = status === 'live' && latest?.voltageV != null;
  // SOC, charge rate and the Lab2-02 mode come from the same MAX17048 log line (activity event, not a telemetry field).
  const gauge = activity.subsystems.eps;
  const gaugeFresh = fresh && gauge?.phase === 'sample' && now - gauge.at <= 5000;
  const MODES = { normal: 'Normal Mode · Buck bật', saving: 'Power Saving · Buck tắt' };
  const data = history.filter(frame => frame.voltageV !== null).slice(-maxPoints)
    .map(frame => ({ time: new Date(frame.received_at * 1000).toLocaleTimeString(), value: frame.voltageV }));

  const option = {
    backgroundColor: 'transparent',
    grid: { top: 40, right: 16, bottom: 12, left: 12, containLabel: true },
    title: {
      text: 'Điện áp Pin (V)',
      textStyle: { color: '#8b949e', fontSize: 12, fontWeight: 500 },
      left: 10,
      top: 8,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: '#e6edf3', fontSize: 12 },
      formatter: (params) => {
        const p = params[0];
        return `<b>t = ${p.name}</b><br/>Điện áp: <b style="color:#3fb950">${p.value.toFixed(3)} V</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.time),
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 10, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: (v) => Number.isFinite(v.min) ? Math.floor((v.min - 0.2) * 10) / 10 : 0,
      max: (v) => Number.isFinite(v.max) ? Math.ceil((v.max + 0.2) * 10) / 10 : 5,
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e', fontSize: 10, formatter: '{value} V' },
      splitLine: { lineStyle: { color: '#1a1f2e' } },
    },
    series: [{
      data: data.map(d => d.value),
      type: 'line',
      smooth: true,
      symbol: data.length === 1 ? 'circle' : 'none',
      symbolSize: 6,
      lineStyle: { color: '#3fb950', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(63,185,80,0.3)' },
            { offset: 1, color: 'rgba(63,185,80,0)' },
          ],
        },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        label: {
          position: 'insideEndTop', distance: 5,
          backgroundColor: 'rgba(255,255,255,0.94)', padding: [3, 5], borderRadius: 4,
        },
        data: [
          { yAxis: 3.3, label: { formatter: 'Ngưỡng sụt áp', color: '#f85149', fontSize: 10 }, lineStyle: { color: '#f85149', type: 'dashed' } },
          { yAxis: 4.2, label: { formatter: 'Đầy pin', color: '#3fb950', fontSize: 10 }, lineStyle: { color: '#3fb950', type: 'dashed' } },
        ],
      },
    }],
    animation: true,
    animationDuration: 300,
  };

  return (
    <div className="card" style={{ opacity: fresh ? 1 : 0.65 }}>
      <div className="card-header"><h3>Điện áp pin</h3><strong>{fresh ? `${latest.voltageV.toFixed(2)} V` : '— · chờ mẫu điện áp mới'}</strong></div>
      {!fresh && data.length > 0 && <p className="practice-source" style={{ padding: '0 16px' }}>Chờ mẫu điện áp mới</p>}
      {gaugeFresh && (gauge.soc != null || gauge.rate != null || gauge.mode) && <div className="radio-tiles" style={{ padding: '0 16px' }}>
        {gauge.soc != null && <article className="practice-task"><strong>Dung lượng (SOC)</strong><b>{gauge.soc.toFixed(1)} %</b></article>}
        {gauge.rate != null && <article className="practice-task"><strong>Tốc độ sạc/xả</strong><b>{gauge.rate > 0 ? '+' : ''}{gauge.rate.toFixed(2)} %/h</b><span>{gauge.rate < 0 ? 'Đang xả' : gauge.rate > 0 ? 'Đang sạc' : 'Ổn định'}</span></article>}
        {gauge.mode && <article className="practice-task"><strong>Chế độ nguồn</strong><b className="practice-led-state">{MODES[gauge.mode]}</b></article>}
      </div>}
      <ReactECharts option={option} style={height === '100%' ? { flex: 1, minHeight: 140 } : { height }} notMerge={true} />
    </div>
  );
}
