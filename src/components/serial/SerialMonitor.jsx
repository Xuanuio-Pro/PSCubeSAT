import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useSerial } from '../../contexts/serial-api';

const LINE_COLORS = { tx: 'var(--accent-cyan)', error: 'var(--accent-red)', system: 'var(--accent-orange)' };

/** @param {{ line: any, showTimestamp: boolean }} props */
function SerialLine({ line, showTimestamp }) {
  return <div style={{ color: LINE_COLORS[line.type] ?? 'var(--accent-green)' }} className={line.type === 'tx' ? 'tx' : ''}>
    {showTimestamp && <span className="timestamp">[{line.timestamp}]</span>}
    {line.type === 'tx' && <span style={{ color: 'var(--text-muted)' }}>{'>>> '}</span>}
    {line.text}
  </div>;
}
// Rows are memoized so a burst of new lines does not re-render the hundreds already on screen.
const Line = memo(SerialLine);

// showConnect: only pages without the device bar (ground station) draw their own connect button here.
/** @param {{height?: number|string, variant?: string, baudRate?: number, showConnect?: boolean}} props */
export default function SerialMonitor({ height = 350, variant = 'default', baudRate = 115200, showConnect = false }) {
  const { isConnected, lines, send, clearLines, connect, serialSupport } = useSerial();
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const [frozen, setFrozen] = useState(null); // lines captured when "Tạm dừng" was pressed
  const [copied, setCopied] = useState(false);
  const outputRef = useRef(null);
  const shown = frozen ?? lines;

  useEffect(() => {
    if (autoScroll && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [shown, autoScroll]);

  // Scrolling up to read stops following new lines; reaching the bottom again resumes it.
  const onScroll = useCallback(() => {
    const element = outputRef.current;
    if (!element) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    setAutoScroll(current => current === atBottom ? current : atBottom);
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input.trim());
    setInput('');
  };

  const copyAll = async () => {
    const text = shown.map(line => `${showTimestamp ? `[${line.timestamp}] ` : ''}${line.type === 'tx' ? '>>> ' : ''}${line.text}`).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  };

  /** @param {string} label @param {() => void} onClick @param {{ active?: boolean, title?: string, disabled?: boolean }} [options] */
  const button = (label, onClick, { active = true, title, disabled = false } = {}) =>
    <button type="button" className="btn btn-sm btn-outline" onClick={onClick} title={title} disabled={disabled} style={{ opacity: active ? 1 : 0.55 }}>{label}</button>;

  return (
    <div className={`card serial-card serial-card--${variant}`} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: height === '100%' ? '100%' : 'auto' }}>
      <div className="card-header">
        <h3>Serial Monitor</h3>
        {variant !== 'workspace' && <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap' }}>
          {button(frozen ? '▶ Tiếp tục' : '⏸ Tạm dừng', () => setFrozen(current => current ? null : lines), { title: 'Đóng băng màn hình để đọc; dữ liệu mới vẫn được nhận', active: !frozen })}
          {button(copied ? 'Đã chép' : 'Sao chép', copyAll, { title: 'Chép toàn bộ nội dung đang hiển thị', disabled: shown.length === 0 })}
          {button('Xoá', () => { setFrozen(null); clearLines(); })}
          {button('🕐', () => setShowTimestamp(value => !value), { title: 'Bật/tắt giờ', active: showTimestamp })}
          {button('↓ Cuối', () => { setAutoScroll(true); if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, { title: 'Tự cuộn xuống dòng mới nhất', active: autoScroll })}
        </div>}
      </div>
      <div className="serial-monitor" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!serialSupport.available && <div role="status" style={{ padding: '12px 16px', color: 'var(--accent-orange)', borderBottom: '1px solid var(--border-strong)', fontSize: '0.875rem' }}>{serialSupport.message}</div>}
        {frozen && <div role="status" style={{ padding: '6px 16px', color: 'var(--accent-orange)', fontSize: '0.8rem' }}>Đang tạm dừng hiển thị · {Math.max(0, lines.length - frozen.length)} dòng mới chưa hiện</div>}
        <div
          className="serial-output"
          ref={outputRef}
          onScroll={onScroll}
          style={{ flex: 1, maxHeight: height === '100%' ? 'none' : `${height}px`, overflowAnchor: 'none' }}
        >
          {!isConnected && shown.length === 0 && serialSupport.available && (
            <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
              {variant === 'workspace' ? 'Đang kết nối Serial...' : showConnect ? <>Nhấn "Kết nối" để bắt đầu<br /></> : 'Chưa kết nối mạch. Dùng nút kết nối trên trang này để bắt đầu nhận dữ liệu.'}
              {variant !== 'workspace' && showConnect && <button
                className="btn btn-sm btn-primary"
                style={{ marginTop: '8px' }}
                onClick={() => connect(baudRate)}
              >
                🔗 Kết nối
              </button>}
            </div>
          )}
          {shown.map(line => <Line key={line.id ?? `${line.receivedAt}:${line.text}`} line={line} showTimestamp={showTimestamp} />)}
        </div>
        <div className="serial-input-bar">
          <input
            type="text"
            placeholder={isConnected ? 'Nhập lệnh và nhấn Enter...' : 'Chưa kết nối Serial'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={!isConnected}
          />
          <button onClick={handleSend} disabled={!isConnected}>Gửi</button>
        </div>
      </div>
    </div>
  );
}
