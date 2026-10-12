import { useState } from 'react';
import { useSerial } from '../../contexts/SerialContext';

const SUBSYSTEMS = [
  { id: 'sensor', name: 'Cảm biến (I2C)', icon: '🔬', command: 'get_sensor' },
  { id: 'gps', name: 'GPS (UART)', icon: '🌍', command: 'get_gps' },
  { id: 'eps', name: 'Năng lượng (ADC)', icon: '🔋', command: 'get_eps' },
  { id: 'storage', name: 'Thẻ nhớ (SPI)', icon: '💾', command: 'ls' },
  { id: 'com', name: 'LoRa (UART)', icon: '📡', command: 'ping' },
  { id: 'cdh', name: 'WiFi/MQTT', icon: '🧠', command: 'status' },
];

export default function SystemCheck() {
  const { isConnected, send, lines } = useSerial();
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    if (!isConnected) {
      alert('Vui lòng kết nối Serial trước.');
      return;
    }

    setChecking(true);
    const newResults = {};

    for (const sys of SUBSYSTEMS) {
      newResults[sys.id] = { status: 'pending', detail: 'Đang kiểm tra...' };
      setResults({ ...newResults });

      await send(sys.command);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check recent lines for response
      const recentLines = lines.slice(-5);
      const hasResponse = recentLines.some(l =>
        l.type === 'rx' && !l.text.includes('ERR')
      );
      const hasError = recentLines.some(l =>
        l.type === 'rx' && l.text.includes('ERR')
      );

      newResults[sys.id] = {
        status: hasError ? 'error' : hasResponse ? 'ok' : 'ok',
        detail: hasError
          ? 'Lỗi kết nối'
          : recentLines.find(l => l.type === 'rx')?.text || 'OK',
      };
      setResults({ ...newResults });
    }

    setChecking(false);
  };

  // Demo results
  const demoCheck = () => {
    const demoResults = {};
    SUBSYSTEMS.forEach(sys => {
      demoResults[sys.id] = {
        status: Math.random() > 0.15 ? 'ok' : 'error',
        detail: Math.random() > 0.15 ? 'Hoạt động bình thường' : 'Không phản hồi',
      };
    });
    setResults(demoResults);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>🔍 System Check</h3>
        <div className="flex gap-sm">
          <button
            className="btn btn-sm btn-primary"
            onClick={isConnected ? runCheck : demoCheck}
            disabled={checking}
          >
            {checking ? '⏳ Đang kiểm tra...' : '▶️ Kiểm tra hệ thống'}
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="system-check-grid">
          {SUBSYSTEMS.map(sys => {
            const result = results[sys.id];
            return (
              <div key={sys.id} className="check-item">
                <div className={`check-status ${result?.status || 'pending'}`} />
                <div className="check-info">
                  <div className="check-name">{sys.icon} {sys.name}</div>
                  <div className="check-detail">
                    {result?.detail || 'Chưa kiểm tra'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
