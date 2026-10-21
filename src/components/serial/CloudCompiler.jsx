import { useState } from 'react';
import { useSerial } from '../../contexts/serial-api';
import { authorizedFetch } from '../../contexts/auth-api';

export default function CloudCompiler({ code, labId, onBinaryReady = undefined, inline = false, showIcon = true, buttonClassName = '' }) {
  const [status, setStatus] = useState('idle');
  const [output, setOutput] = useState('');
  const { print, boards, selectBoard, saveBuild, isFlashing } = useSerial();
  const board = boards[labId] || 'esp32';

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

    if (isFlashing) return;
    saveBuild(labId, null);
    setStatus('compiling');
    appendLog('🔨 Bắt đầu biên dịch trên Cloud...', 'system');

    try {
      const res = await authorizedFetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, board, lab_id: labId, include_binary: !!onBinaryReady }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        saveBuild(labId, { artifact: data.artifact, source: code });
        setStatus('success');
        if (data.logs) {
          data.logs.split('\n').forEach(line => appendLog(line, 'rx'));
        }
        appendLog('✅ Biên dịch thành công!', 'system');
        appendLog(`📦 Kích thước: ${data.binSize ? (data.binSize / 1024).toFixed(1) + ' KB' : 'N/A'}`, 'system');
        if (onBinaryReady) onBinaryReady(data.binBase64, data.fileName);
      } else {
        setStatus('error');
        appendLog(data.message || (typeof data.detail === 'string' ? data.detail : `Lỗi biên dịch (HTTP ${res.status})`), 'error');
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

  const boardSelector = (
    <select aria-label="Board biên dịch" value={board} disabled={status === 'compiling' || isFlashing}
      onChange={event => { selectBoard(labId, event.target.value); setStatus('idle'); }}>
      <option value="esp32s3">ESP32-S3</option>
      <option value="esp32">ESP32</option>
    </select>
  );

  if (inline) {
    return (
      <>{boardSelector}<button
        className={`btn btn-sm ${buttonClassName || (status === 'compiling' ? 'btn-secondary' : 'btn-primary')}`}
        onClick={handleCompile}
        disabled={status === 'compiling' || isFlashing || !code?.trim()}
        title={!code?.trim() ? 'Cần mã nguồn hợp lệ. Hãy sửa lỗi trong vùng Blockly hoặc nhập C++.' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {showIcon && statusIcon[status]} {status === 'compiling' ? 'Đang biên dịch...' : 'Biên dịch'}
      </button></>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>{statusIcon[status]} Biên dịch (Build)</h3>
        {boardSelector}
        <button
          className={`btn btn-sm ${status === 'compiling' ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleCompile}
          disabled={status === 'compiling' || isFlashing || !code?.trim()}
          title={!code?.trim() ? 'Cần mã nguồn hợp lệ. Hãy sửa lỗi trong vùng Blockly hoặc nhập C++.' : undefined}
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
