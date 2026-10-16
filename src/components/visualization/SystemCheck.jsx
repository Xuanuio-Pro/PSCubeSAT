import { useState, useEffect, useRef } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';
import { useSerial } from '../../contexts/serial-api';

const SUBSYSTEMS = [
  { id: 'sensor', name: 'Cảm biến (I2C)', icon: '🔬', command: 'get_sensor' },
  { id: 'gps', name: 'GPS (UART)', icon: '🌍', command: 'get_gps' },
  { id: 'eps', name: 'Năng lượng (ADC)', icon: '🔋', command: 'get_eps' },
  { id: 'storage', name: 'Thẻ nhớ (SPI)', icon: '💾', command: 'ls' },
  { id: 'com', name: 'LoRa (UART)', icon: '📡', command: 'ping' },
  { id: 'cdh', name: 'WiFi/MQTT', icon: '🧠', command: 'status' },
];

export default function SystemCheck() {
  const { isConnected, send, subscribe } = useSerial();
  const { mode, generation, isCurrentSelection } = useTelemetry();
  const runRef = useRef(0);
  const responsesRef = useRef([]);
  useEffect(() => subscribe(entry => {
    if (entry.type === 'rx' && entry.origin === 'serial') responsesRef.current = [...responsesRef.current, entry].slice(-100);
  }), [subscribe]);
  useEffect(() => { runRef.current++; setResults({}); setChecking(false); }, [generation]);
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    if (!isConnected) {
      alert('Vui lòng kết nối Serial trước.');
      return;
    }

    const run = ++runRef.current;
    setChecking(true);
    const newResults = {};

    for (const sys of SUBSYSTEMS) {
      if (run !== runRef.current || !isCurrentSelection(generation)) return;
      const startedAt = Date.now();
      newResults[sys.id] = { status: 'pending', detail: 'Đang kiểm tra...' };
      setResults({ ...newResults });

      if (!await send(sys.command)) break;
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (run !== runRef.current || !isCurrentSelection(generation)) return;
      // Check recent lines for response
      const recentLines = responsesRef.current.filter(entry => entry.receivedAt >= startedAt).slice(-5);
      const hasResponse = recentLines.some(l =>
        l.type === 'rx' && l.origin === 'serial' && !l.text.includes('ERR')
      );
      const hasError = recentLines.some(l =>
        l.type === 'rx' && l.origin === 'serial' && l.text.includes('ERR')
      );

      newResults[sys.id] = {
        status: hasError ? 'error' : 'pending',
        detail: hasError
          ? 'Lỗi kết nối'
          : (hasResponse ? 'Có dữ liệu; chưa xác nhận phản hồi của subsystem.' : 'Hết thời gian chờ phản hồi.'),
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
        status: 'ok',
        detail: 'Demo · phản hồi minh họa',
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
            onClick={mode === 'demo' ? demoCheck : runCheck}
            disabled={checking || (mode !== 'demo' && (mode !== 'serial' || !isConnected))}
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
