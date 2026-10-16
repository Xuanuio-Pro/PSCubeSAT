import { useState, useEffect } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';
import { useSerial } from '../../contexts/serial-api';

const PRESET_COMMANDS = [
  { cmd: 'ping', label: '🏓 Ping', desc: 'Kiểm tra đường truyền' },
  { cmd: 'status', label: '📊 Status', desc: 'Trạng thái hệ thống' },
  { cmd: 'uptime', label: '⏱️ Uptime', desc: 'Thời gian hoạt động' },
  { cmd: 'get_sensor', label: '🔬 Sensor', desc: 'Đọc cảm biến' },
  { cmd: 'get_gps', label: '🌍 GPS', desc: 'Đọc tọa độ' },
  { cmd: 'get_eps', label: '🔋 EPS', desc: 'Đọc pin' },
  { cmd: 'pause', label: '⏸️ Pause', desc: 'Tạm dừng Telemetry' },
  { cmd: 'resume', label: '▶️ Resume', desc: 'Tiếp tục Telemetry' },
  { cmd: 'ls', label: '📁 LS', desc: 'Liệt kê file' },
  { cmd: 'pwd', label: '📂 PWD', desc: 'Thư mục hiện tại' },
  { cmd: 'reboot', label: '🔄 Reboot', desc: 'Khởi động lại' },
  { cmd: 'help', label: '❓ Help', desc: 'Danh sách lệnh' },
];

export default function CommandPanel() {
  const { isConnected, send } = useSerial();
  const { mode, generation } = useTelemetry();
  const canSend = mode === 'serial' && isConnected;
  const [customCmd, setCustomCmd] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => setHistory([]), [generation]);

  const sendCommand = (cmd) => {
    if (!canSend) {
      alert('Vui lòng kết nối Serial trước.');
      return;
    }
    send(cmd);
    setHistory(prev => [
      { cmd, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 19),
    ]);
  };

  const handleCustomSend = () => {
    if (!customCmd.trim()) return;
    sendCommand(customCmd.trim());
    setCustomCmd('');
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>🎮 Command Uplink · USB Serial</h3>
      </div>
      <div className="card-body">
        {/* Preset buttons */}
        <div style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          Lệnh nhanh
        </div>
        <div className="cmd-btn-grid">
          {PRESET_COMMANDS.map(({ cmd, label }) => (
            <button key={cmd} disabled={!canSend} className="cmd-btn" onClick={() => sendCommand(cmd)} title={cmd}>
              {label}
            </button>
          ))}
        </div>

        {/* Custom command */}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
            Lệnh tùy chỉnh
          </div>
          <div className="serial-input-bar" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
            <input
              type="text"
              disabled={!canSend}
              placeholder="Nhập lệnh (VD: ls /logs)..."
              value={customCmd}
              onChange={e => setCustomCmd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomSend()}
            />
            <button disabled={!canSend} onClick={handleCustomSend}>Gửi ↑</button>
          </div>
        </div>

        {/* Command history */}
        {history.length > 0 && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
              Lịch sử lệnh
            </div>
            <div style={{
              maxHeight: '120px',
              overflow: 'auto',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm)',
            }}>
              {history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-cyan)',
                    marginBottom: '2px',
                    cursor: 'pointer',
                  }}
                  onClick={() => sendCommand(h.cmd)}
                >
                  <span style={{ color: 'var(--text-muted)' }}>[{h.time}]</span> {h.cmd}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
