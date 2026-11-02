import { useState, useRef, useEffect } from 'react';
import { useSerial } from '../../contexts/serial-api';

/** @param {{height?: number|string, variant?: string}} props */
export default function SerialMonitor({ height = 350, variant = 'default' }) {
  const { isConnected, lines, send, clearLines, connect, serialSupport } = useSerial();
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const outputRef = useRef(null);

  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input.trim());
    setInput('');
  };

  const getLineClass = (type) => {
    switch (type) {
      case 'tx': return 'tx';
      case 'error': return '';
      case 'system': return '';
      default: return '';
    }
  };

  const getLineColor = (type) => {
    switch (type) {
      case 'tx': return 'var(--accent-cyan)';
      case 'error': return 'var(--accent-red)';
      case 'system': return 'var(--accent-orange)';
      default: return 'var(--accent-green)';
    }
  };

  return (
    <div className={`card serial-card serial-card--${variant}`} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: height === '100%' ? '100%' : 'auto' }}>
      <div className="card-header">
        <h3>{variant === 'workspace' ? 'Serial Monitor' : '📟 Serial Monitor'}</h3>
        {variant !== 'workspace' && <div className="flex gap-sm items-center">
          <button className="btn btn-sm btn-outline" onClick={clearLines}>Xoá</button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowTimestamp(!showTimestamp)}
            style={{ opacity: showTimestamp ? 1 : 0.5 }}
          >
            🕐
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{ opacity: autoScroll ? 1 : 0.5 }}
          >
            ↓
          </button>
        </div>}
      </div>
      <div className="serial-monitor" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!serialSupport.available && <div role="status" style={{ padding: '12px 16px', color: 'var(--accent-orange)', borderBottom: '1px solid var(--border-strong)', fontSize: '0.875rem' }}>{serialSupport.message}</div>}
        <div
          className="serial-output"
          ref={outputRef}
          style={{ flex: 1, maxHeight: height === '100%' ? 'none' : `${height}px` }}
        >
          {!isConnected && lines.length === 0 && serialSupport.available && (
            <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
              {variant === 'workspace' ? 'Đang kết nối Serial...' : <>Nhấn "Kết nối Serial" để bắt đầu<br /></>}
              {variant !== 'workspace' && <button
                className="btn btn-sm btn-primary"
                style={{ marginTop: '8px' }}
                onClick={() => connect()}
              >
                🔗 Kết nối
              </button>}
            </div>
          )}
          {lines.map((line, i) => (
            <div key={i} style={{ color: getLineColor(line.type) }} className={getLineClass(line.type)}>
              {showTimestamp && <span className="timestamp">[{line.timestamp}]</span>}
              {line.type === 'tx' && <span style={{ color: 'var(--text-muted)' }}>{'>>> '}</span>}
              {line.text}
            </div>
          ))}
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
