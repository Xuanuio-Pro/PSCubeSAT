import { useState, useEffect } from 'react';
import { useSerial } from '../../contexts/SerialContext';

const TELEMETRY_TYPES = {
  battery_v: { label: 'Pin (V)', icon: '🔋', unit: 'V', color: 'var(--accent-green)' },
  temp: { label: 'Nhiệt độ', icon: '🌡️', unit: '°C', color: 'var(--accent-orange)' },
  pressure: { label: 'Áp suất', icon: '☁️', unit: 'hPa', color: 'var(--accent-cyan)' },
  acc_x: { label: 'Acc X', icon: '📐', unit: 'g', color: 'var(--accent-red)' },
  acc_y: { label: 'Acc Y', icon: '📐', unit: 'g', color: 'var(--accent-green)' },
  acc_z: { label: 'Acc Z', icon: '📐', unit: 'g', color: 'var(--accent-blue)' },
  gyro_x: { label: 'Gyro X', icon: '🔄', unit: '°/s', color: 'var(--accent-red)' },
  gyro_y: { label: 'Gyro Y', icon: '🔄', unit: '°/s', color: 'var(--accent-green)' },
  gyro_z: { label: 'Gyro Z', icon: '🔄', unit: '°/s', color: 'var(--accent-blue)' },
  mag_x: { label: 'Mag X', icon: '🧭', unit: 'µT', color: 'var(--accent-purple)' },
  mag_y: { label: 'Mag Y', icon: '🧭', unit: 'µT', color: 'var(--accent-purple)' },
  mag_z: { label: 'Mag Z', icon: '🧭', unit: 'µT', color: 'var(--accent-purple)' },
  lat: { label: 'Vĩ độ', icon: '🌍', unit: '°', color: 'var(--accent-cyan)' },
  lng: { label: 'Kinh độ', icon: '🌍', unit: '°', color: 'var(--accent-cyan)' },
};

export default function TelemetryPanel() {
  const { subscribe } = useSerial();
  const [telemetry, setTelemetry] = useState({});
  const [packetCount, setPacketCount] = useState(0);
  const [rawPackets, setRawPackets] = useState([]);

  useEffect(() => {
    const unsub = subscribe((entry) => {
      if (entry.type !== 'rx') return;
      try {
        const text = entry.text.trim();
        if (text.startsWith('{')) {
          const json = JSON.parse(text);
          setTelemetry(prev => ({ ...prev, ...json }));
          setPacketCount(prev => prev + 1);
          setRawPackets(prev => [
            { time: entry.timestamp, data: text, parsed: json },
            ...prev.slice(0, 49),
          ]);
        }
      } catch { /* not JSON */ }
    });
    return unsub;
  }, [subscribe]);

  // Demo data
  useEffect(() => {
    const interval = setInterval(() => {
      const demoData = {
        battery_v: 3.7 + Math.random() * 0.4,
        temp: 25 + Math.random() * 5,
        pressure: 1013 + Math.random() * 5,
        acc_x: (Math.random() - 0.5) * 2,
        acc_y: (Math.random() - 0.5) * 2,
        acc_z: 9.8 + (Math.random() - 0.5) * 0.2,
        lat: 21.0285 + Math.random() * 0.001,
        lng: 105.8542 + Math.random() * 0.001,
      };
      setTelemetry(prev => ({ ...prev, ...demoData }));
      setPacketCount(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3>📡 Telemetry Downlink</h3>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {packetCount} packets
        </span>
      </div>
      <div className="card-body">
        <div className="telemetry-grid">
          {Object.entries(telemetry).map(([key, value]) => {
            const info = TELEMETRY_TYPES[key] || { label: key, icon: '📊', unit: '', color: 'var(--text-primary)' };
            return (
              <div key={key} className="telemetry-item">
                <div className="telemetry-label">{info.icon} {info.label}</div>
                <div className="telemetry-value" style={{ color: info.color }}>
                  {typeof value === 'number' ? value.toFixed(3) : value}
                  <span className="telemetry-unit">{info.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Raw packet log */}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
            Raw Packets (gần nhất)
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
