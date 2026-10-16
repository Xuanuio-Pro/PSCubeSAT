import { useTelemetry } from '../../contexts/telemetry-api';
import { measurementKeys } from '../../telemetry/adapters';

const TELEMETRY_TYPES = {
  voltageV: { label: 'Pin (V)', icon: '🔋', unit: 'V', color: 'var(--accent-green)' },
  temperatureC: { label: 'Nhiệt độ', icon: '🌡️', unit: '°C', color: 'var(--accent-orange)' },
  pressureHpa: { label: 'Áp suất', icon: '☁️', unit: 'hPa', color: 'var(--accent-cyan)' },
  accX: { label: 'Acc X', icon: '📐', unit: 'g', color: 'var(--accent-red)' },
  accY: { label: 'Acc Y', icon: '📐', unit: 'g', color: 'var(--accent-green)' },
  accZ: { label: 'Acc Z', icon: '📐', unit: 'g', color: 'var(--accent-blue)' },
  gyroX: { label: 'Gyro X', icon: '🔄', unit: '°/s', color: 'var(--accent-red)' },
  gyroY: { label: 'Gyro Y', icon: '🔄', unit: '°/s', color: 'var(--accent-green)' },
  gyroZ: { label: 'Gyro Z', icon: '🔄', unit: '°/s', color: 'var(--accent-blue)' },
  magX: { label: 'Mag X', icon: '🧭', unit: 'µT', color: 'var(--accent-purple)' },
  magY: { label: 'Mag Y', icon: '🧭', unit: 'µT', color: 'var(--accent-purple)' },
  magZ: { label: 'Mag Z', icon: '🧭', unit: 'µT', color: 'var(--accent-purple)' },
  gpsLat: { label: 'Vĩ độ', icon: '🌍', unit: '°', color: 'var(--accent-cyan)' },
  gpsLon: { label: 'Kinh độ', icon: '🌍', unit: '°', color: 'var(--accent-cyan)' },
  gpsAlt: { label: 'Độ cao', icon: '🌍', unit: 'm', color: 'var(--accent-cyan)' },
  humidityPct: { label: 'Độ ẩm', icon: '💧', unit: '%RH', color: 'var(--accent-blue)' },
  uptimeMs: { label: 'Thời gian chạy', icon: '⏱️', unit: 'ms', color: 'var(--text-primary)' },
  ledOn: { label: 'LED', icon: '💡', unit: '', color: 'var(--accent-orange)' },
};

export default function TelemetryPanel() {
  const { latest, history, packetCount, status } = useTelemetry();
  const telemetry = latest ?? {};
  const rawPackets = [...history].reverse().slice(0, 10).map(frame => ({
    time: new Date(frame.received_at * 1000).toLocaleTimeString(),
    data: JSON.stringify({ ...frame, imageData: frame.imageData ? '[image]' : null }).slice(0, 800),
  }));

  return (
    <div className="card" style={{ opacity: status === 'live' ? 1 : 0.65 }}>
      <div className="card-header">
        <h3>📡 Telemetry Downlink</h3>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {packetCount} packets
        </span>
      </div>
      <div className="card-body">
        <div className="telemetry-grid">
          {measurementKeys.map(key => {
            const value = telemetry[key];
            const info = TELEMETRY_TYPES[key] || { label: key, icon: '📊', unit: '', color: 'var(--text-primary)' };
            return (
              <div key={key} className="telemetry-item">
                <div className="telemetry-label">{info.icon} {info.label}</div>
                <div className="telemetry-value" style={{ color: info.color }}>
                  {value == null ? '—' : typeof value === 'boolean' ? (value ? 'Bật' : 'Tắt') : typeof value === 'number' ? value.toFixed(3) : value}
                  <span className="telemetry-unit">{info.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Raw packet log */}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
            Bản tin chuẩn hóa (gần nhất)
          </div>
          <div style={{
            maxHeight: '150px',
            overflow: 'auto',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
          }}>
            {rawPackets.slice(0, 10).map((pkt, i) => (
              <div key={i} style={{ color: 'var(--accent-green)', marginBottom: '2px' }}>
                <span style={{ color: 'var(--text-muted)' }}>[{pkt.time}]</span> {pkt.data}
              </div>
            ))}
            {rawPackets.length === 0 && (
              <span style={{ color: 'var(--text-muted)' }}>Chờ dữ liệu telemetry...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
