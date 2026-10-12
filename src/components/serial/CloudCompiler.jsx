import { useState } from 'react';
import { useSerial } from '../../contexts/SerialContext';
import { TOKEN_KEY } from '../../contexts/AuthContext';

export default function CloudCompiler({ code, labId, onBinaryReady, inline = false, showIcon = true, buttonClassName }) {
  const [status, setStatus] = useState('idle');
  const [output, setOutput] = useState('');
  const { print } = useSerial();

  const appendLog = (msg, type = 'system') => {
    setOutput(prev => prev + msg + '\n');
    if (print) print(msg, type);
  };

  const handleCompile = async () => {
    if (!code || !code.trim()) {
      appendLog('Lỗi: Không có mã nguồn để biên dịch.', 'error');
      setStatus('error');
      return;
    }

    setStatus('compiling');
    appendLog('🔨 Bắt đầu biên dịch trên Cloud...', 'system');

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code, board: 'esp32s3', lab_id: labId }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        if (data.logs) {
          data.logs.split('\n').forEach(line => appendLog(line, 'rx'));
        }
        appendLog('✅ Biên dịch thành công!', 'system');
        appendLog(`📦 Kích thước: ${data.binSize ? (data.binSize / 1024).toFixed(1) + ' KB' : 'N/A'}`, 'system');
        if (onBinaryReady) onBinaryReady(data.binBase64, data.fileName);
      } else {
        setStatus('error');
        appendLog(data.message || 'Lỗi biên dịch không xác định', 'error');
        if (data.logs) {
          data.logs.split('\n').forEach(line => appendLog(line, 'error'));
        }
      }
    } catch (err) {
      setStatus('error');
      appendLog(`Lỗi kết nối tới máy chủ biên dịch: ${err.message}`, 'error');
    }
  };

  const statusIcon = {
    idle: '🔨',
    compiling: '⏳',
    success: '✅',
    error: '❌',
  };

  if (inline) {
    return (
      <button
        className={`btn btn-sm ${buttonClassName || (status === 'compiling' ? 'btn-secondary' : 'btn-primary')}`}
        onClick={handleCompile}
        disabled={status === 'compiling'}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {showIcon && statusIcon[status]} {status === 'compiling' ? 'Đang biên dịch...' : 'Biên dịch'}
      </button>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>{statusIcon[status]} Biên dịch (Build)</h3>
        <button
          className={`btn btn-sm ${status === 'compiling' ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleCompile}
          disabled={status === 'compiling'}
        >
          {status === 'compiling' ? 'Đang biên dịch...' : 'Biên dịch'}
        </button>
      </div>
      {output && (
        <div className="card-body" style={{ padding: 0 }}>
          <pre style={{
            margin: 0,
            padding: 'var(--space-md)',
            background: 'var(--bg-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-xs)',
            color: status === 'error' ? 'var(--accent-red)' : 'var(--accent-green)',
            maxHeight: '200px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
