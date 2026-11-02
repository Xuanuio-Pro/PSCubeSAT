import ReactECharts from './Chart';
import { useTelemetry } from '../../contexts/telemetry-api';

export default function RawIMUPanel() {
  const { activity, now, link, mode } = useTelemetry();
  const sample = activity.subsystems['raw-imu'];
  const fresh = mode === 'serial' && link === 'connected' && sample && now - sample.at <= 5000;
  const option = {
    grid: { left: 60, right: 20, bottom: 30, top: 20 },
    xAxis: { type: 'category', data: ['X', 'Y', 'Z'] },
    yAxis: { type: 'value', name: 'counts', min: -32768, max: 32767 },
    tooltip: { trigger: 'axis' },
    series: [{ type: 'bar', data: sample?.values ?? [], itemStyle: { color: '#167eac' }, label: { show: true, position: 'top' }, barMaxWidth: 50 }],
    animation: false,
  };
  return <section className="card" style={{ opacity: fresh ? 1 : 0.65 }}>
    <div className="card-header"><h3>Gia tốc thô · số đếm thanh ghi</h3><small>{fresh ? 'Mẫu mới' : 'Chờ mẫu RAW_ACCEL mới'}</small></div>
    <ReactECharts option={option} style={{ height: 260 }} notMerge />
  </section>;
}
