import { useState } from 'react';
import { useSerial } from '../../contexts/serial-api';
import { getAuthToken } from '../../contexts/auth-storage';
import { authorizedFetch } from '../../contexts/auth-api';
import { downloadFlashFiles, writeArtifact } from './flash-artifact';

export default function WebFlasher({ code = '', labId = undefined, inline = false, showIcon = true, buttonClassName = '', label = 'Nạp Code' }) {
  const { builds, boards, isFlashing, withFlashPort, print, serialSupport } = useSerial();
  const build = builds[labId];
  const ready = !!build && build.source === code && build.artifact?.board === (boards[labId] || 'esp32');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [completedId, setCompletedId] = useState(null);
  const finished = status === 'done' && ready && completedId === build?.artifact?.id;

  const handleFlash = async () => {
    if (!ready || isFlashing || !serialSupport.available) return;
    setStatus('flashing');
    setProgress(0);
    const token = getAuthToken();
    try {
      await withFlashPort(async port => {
        print('Đang kiểm tra và tải bộ firmware...', 'system');
        const files = await downloadFlashFiles(build.artifact, code, token, authorizedFetch);
        const { ESPLoader, Transport } = await import('esptool-js');
        if (!token || token !== getAuthToken()) throw new Error('Phiên đăng nhập đã kết thúc. Đăng nhập lại trước khi nạp.');
        const transport = new Transport(port);
        const loader = new ESPLoader({ transport, baudrate: 115200,
          terminal: { clean() {}, write: text => print(text, 'system'), writeLine: text => print(text, 'system') } });
        try {
          print('Đang kết nối bootloader. Nếu không kết nối được, giữ BOOT và nhấn RESET.', 'system');
          await writeArtifact(loader, build.artifact, files, setProgress);
          print('Firmware đã ghi và xác minh hash trên chip. Đang mở lại Serial...', 'system');
        } finally {
          await transport.disconnect().catch(() => {});
        }
      });
      setCompletedId(build.artifact.id);
      setStatus('done');
    } catch (error) {
      setStatus('error');
      print(`Nạp thất bại: ${error.message}`, 'error');
    }
  };

  if (inline) {
    return (
      <button
        className={`btn btn-sm ${buttonClassName || (status === 'flashing' ? 'btn-secondary' : 'btn-success')}`}
        onClick={handleFlash}
        disabled={!ready || isFlashing || !serialSupport.available}
        title={!serialSupport.available ? serialSupport.message : !ready ? 'Biên dịch code hiện tại trước khi nạp' : 'Nạp firmware thật qua USB trên máy của bạn'}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {showIcon && '⚡'} {!serialSupport.available ? serialSupport.label : status === 'flashing' ? `Đang nạp... ${Math.round(progress)}%` : finished ? `${showIcon ? '✅ ' : ''}Nạp xong` : label}
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
          disabled={!ready || isFlashing || !serialSupport.available}
          title={!serialSupport.available ? serialSupport.message : !ready ? 'Biên dịch code hiện tại trước khi nạp' : 'Nạp firmware thật qua USB trên máy của bạn'}
        >
          {!serialSupport.available ? serialSupport.label : status === 'flashing' ? 'Đang nạp...' : finished ? '✅ Hoàn tất' : 'Nạp code'}
        </button>
      </div>
      {!serialSupport.available && <div className="card-body" role="status">{serialSupport.message}</div>}
      {(status === 'flashing' || status === 'error' || finished) && (
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
              background: finished ? 'var(--accent-green)' : 'var(--gradient-primary)',
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
            {finished
              ? '✅ Firmware đã được ghi và xác minh.'
              : status === 'error' ? 'Nạp thất bại — xem log Serial.' : `Đang nạp... ${Math.round(Math.min(progress, 100))}%`
            }
          </div>
        </div>
      )}
    </div>
  );
}
