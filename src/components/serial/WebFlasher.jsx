import { useState } from 'react';
import { useSerial } from '../../contexts/SerialContext';

export default function WebFlasher({ inline = false, showIcon = true, buttonClassName, label = 'Nạp Code' }) {
  const { isConnected, print } = useSerial();
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);

  const handleFlash = async () => {
    if (!isConnected) {
      alert('Vui lòng kết nối Serial trước khi nạp code.');
      return;
    }

    setStatus('flashing');
    setProgress(0);
    if (print) print('⚡ Bắt đầu nạp Firmware xuống vệ tinh...', 'system');

    // Simulate flashing progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStatus('done');
          if (print) print('✅ Firmware đã được nạp thành công!', 'system');
          return 100;
        }
        if (print && Math.random() > 0.7) {
          print(`Writing at 0x${Math.floor(Math.random()*100000).toString(16)}... (${Math.round(prev)}%)`, 'rx');
        }
        return prev + Math.random() * 15;
      });
    }, 300);
  };

  if (inline) {
    return (
      <button
        className={`btn btn-sm ${buttonClassName || (status === 'flashing' ? 'btn-secondary' : 'btn-success')}`}
        onClick={handleFlash}
        disabled={status === 'flashing'}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {showIcon && '⚡'} {status === 'flashing' ? `Đang nạp... ${Math.round(progress)}%` : status === 'done' ? `${showIcon ? '✅ ' : ''}Nạp xong` : label}
      </button>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>📥 Nạp code (Upload)</h3>
        <button
          className={`btn btn-sm ${status === 'flashing' ? 'btn-secondary' : 'btn-success'}`}
          onClick={handleFlash}
          disabled={status === 'flashing'}
        >
          {status === 'flashing' ? 'Đang nạp...' : status === 'done' ? '✅ Hoàn tất' : 'Nạp code'}
        </button>
      </div>
      {status !== 'idle' && (
        <div className="card-body">
          <div style={{
            width: '100%',
            height: '6px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(progress, 100)}%`,
              height: '100%',
              background: status === 'done' ? 'var(--accent-green)' : 'var(--gradient-primary)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{
            marginTop: 'var(--space-sm)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            {status === 'done'
              ? '✅ Firmware đã được nạp thành công!'
              : `Đang nạp... ${Math.round(Math.min(progress, 100))}%`
            }
          </div>
        </div>
      )}
    </div>
  );
}
