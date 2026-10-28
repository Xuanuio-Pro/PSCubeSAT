import { useTelemetry } from '../../contexts/telemetry-api';

const SUBSYSTEMS = [
  { id: 'sensor', name: 'Cảm biến I2C', keys: ['temperatureC', 'pressureHpa', 'accX', 'accY', 'accZ', 'gyroX', 'gyroY', 'gyroZ', 'magX', 'magY', 'magZ'] },
  { id: 'gps', name: 'Định vị GPS', keys: ['gpsLat', 'gpsLon'] },
  { id: 'eps', name: 'Điện áp pin', keys: ['voltageV'] },
  { id: 'storage', name: 'Thẻ nhớ SD', keys: [] },
  { id: 'radio', name: 'Đường truyền LoRa', keys: [] },
  { id: 'network', name: 'WiFi / MQTT', keys: [] },
];

// Passive evidence only: a sketch is not assumed to implement generic diagnostic commands.
/** @param {{ rows?: string[] }} props Subsystem ids the current sketch exercises. */
export default function SystemCheck({ rows = SUBSYSTEMS.map(sys => sys.id) }) {
  const { latest, activity, now, mode, link } = useTelemetry();
  return <section className="card">
    <div className="card-header"><h3>System Check · Phản hồi các phân hệ</h3></div>
    <div className="card-body">
      <div className="system-check-grid">{SUBSYSTEMS.filter(sys => rows.includes(sys.id)).map(sys => {
        const count = sys.keys.filter(key => latest?.[key] != null).length;
        const evidence = activity.subsystems[sys.id];
        const fresh = mode === 'serial' && link === 'connected' && evidence && now - evidence.at <= 5000;
        const error = fresh && evidence.phase === 'error';
        const measurement = count ? `${count}/${sys.keys.length} trường có dữ liệu mới` : '';
        const response = evidence && (!count || error) ? `${evidence.text}${fresh ? '' : ' · phản hồi đã cũ / ngắt kết nối'}` : '';
        const detail = [measurement, response].filter(Boolean).join(' · ') || 'Chưa có bằng chứng phản hồi';
        return <div key={sys.id} className="check-item">
          <div className={`check-status ${error ? 'error' : count ? 'ok' : 'pending'}`} />
          <div className="check-info"><div className="check-name">{sys.name}</div><div className="check-detail" title={detail}>{detail}</div></div>
        </div>;
      })}</div>
    </div>
  </section>;
}
