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
  { cmd: 'mkdir demo', label: '➕ mkdir demo', desc: 'Tạo thư mục demo' },
  { cmd: 'cd demo', label: '➡️ cd demo', desc: 'Vào thư mục demo' },
  { cmd: 'cd ..', label: '⬆️ cd ..', desc: 'Lên thư mục cha' },
  { cmd: 'touch note.txt', label: '📝 touch note.txt', desc: 'Tạo file note.txt' },
  { cmd: 'rm note.txt', label: '🗑️ rm note.txt', desc: 'Xóa file note.txt' },
  { cmd: 'rm demo', label: '🗑️ rm demo', desc: 'Xóa thư mục demo' },
  { cmd: 'reboot', label: '🔄 Reboot', desc: 'Khởi động lại' },
  { cmd: 'help', label: '❓ Help', desc: 'Danh sách lệnh' },
];

/** @param {{commands?: string[], labId?: number, exerciseId?: string}} props */
export default function CommandPanel({ commands = [], labId = 0, exerciseId = '' }) {
  const { isConnected, send } = useSerial();
  const { mode, generation, isCurrentSelection } = useTelemetry();
  const [sending, setSending] = useState(false);
  const [radioRole, setRadioRole] = useState(false);
  const groundStation = labId === 5 && radioRole;
  const available = groundStation && exerciseId.startsWith('Lab5-03') ? ['ping', 'battery', 'sensor', 'imu', 'gps', 'led on', 'led off', 'telemetry'] : commands;
  const canSend = mode === 'serial' && isConnected && !sending && (groundStation || available.length > 0);
  const presets = available.map(cmd => PRESET_COMMANDS.find(item => item.cmd === cmd) ?? { cmd, label: cmd === 'p' ? 'Chụp ảnh · p' : cmd === '1' ? 'Bật LED · 1' : cmd === '0' ? 'Tắt LED · 0' : cmd });
  const [customCmd, setCustomCmd] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => { setHistory([]); setRadioRole(false); setCustomCmd(''); }, [generation]);

  const sendCommand = async (cmd) => {
    if (!canSend) {
      alert('Vui lòng kết nối Serial trước.');
      return;
    }
    setSending(true);
    let sent = false;
    try { sent = await send(cmd); } catch { sent = false; } finally { setSending(false); }
    if (!isCurrentSelection(generation)) return false;
    setHistory(prev => [
      { cmd, sent, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 19),
    ]);
    return sent;
  };

  const handleCustomSend = () => {
    if (!customCmd.trim()) return;
    const command = customCmd.trim();
    sendCommand(command).then(sent => { if (sent) setCustomCmd(current => current.trim() === command ? '' : current); });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>🎮 Command Uplink · USB Serial</h3>
      </div>
      <div className="card-body">
        {/* Preset buttons */}
        <div style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          USB Serial · chờ phản hồi thiết bị sau khi gửi
        </div>
        {labId === 5 && <label>Cổng USB đang nối với: <select aria-label="Vai trò cổng lệnh" value={groundStation ? 'gs' : 'obc'} onChange={event => setRadioRole(event.target.value === 'gs')}>
          <option value="obc">OBC</option><option value="gs">Trạm GS qua USB–LoRa</option>
        </select></label>}
        {groundStation && <p className="telemetry-empty">Gửi qua cổng USB–LoRa của GS đã chọn.</p>}
        {!groundStation && available.length === 0 && <p className="telemetry-empty">Bài này không nhận lệnh USB tại OBC.</p>}
        <div className="cmd-btn-grid">
          {presets.map(({ cmd, label }) => (
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
                  <span style={{ color: 'var(--text-muted)' }}>[{h.time}]</span> {h.cmd} · {h.sent ? 'Đã gửi USB · chờ phản hồi Serial' : 'Gửi thất bại'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
