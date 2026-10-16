import { useTelemetry } from '../../contexts/telemetry-api';
import { useSerial } from '../../contexts/serial-api';
import { useAuth } from '../../contexts/auth-api';

const LABELS = { offline: 'Offline', waiting: 'Chờ dữ liệu', live: 'Đang nhận', stale: 'Stale · chưa có mẫu mới' };

export default function TelemetryControls() {
  const { mode, deviceId, serialBinding, devices, status, link, error, deviceError, lastReceivedAt,
    now, rejectedCount, selectSource, selectDevice, refreshDevices } = useTelemetry();
  const { connect, disconnect, isConnected, isConnecting } = useSerial();
  const { user } = useAuth();
  const selected = mode === 'serial' ? serialBinding : deviceId;
  const age = lastReceivedAt === null ? null : Math.max(0, Math.floor((now - lastReceivedAt) / 1000));
  return <section className="telemetry-controls" aria-label="Nguồn telemetry">
    <label>Nguồn dữ liệu
      <select value={mode} onChange={event => selectSource(event.target.value)}>
        <option value="serial">USB Serial · thiết bị thật</option>
        <option value="hardware" disabled={!user}>WebSocket · thiết bị thật</option>
        <option value="simulator" disabled={!user}>WebSocket · simulator</option>
        <option value="demo">Demo · dữ liệu minh họa</option>
      </select>
    </label>
    <label>Thiết bị
      <select value={mode === 'demo' ? 'demo' : selected} disabled={mode === 'demo'} onChange={event => selectDevice(event.target.value)}>
        {mode === 'demo' && <option value="demo">Demo cục bộ</option>}
        {mode === 'serial' && <option value="serial-local">USB hiện tại{deviceId !== 'serial-local' ? ` · ${deviceId}` : ''}</option>}
        {['hardware', 'simulator'].includes(mode) && devices.length === 0 && <option value="">Chưa có thiết bị</option>}
        {devices.map(device => <option key={device.device_uid} value={device.device_uid}>{device.device_name} · {device.device_uid}</option>)}
      </select>
    </label>
    {mode === 'serial' && <button type="button" className="btn btn-sm btn-outline" disabled={isConnecting} onClick={() => isConnected ? disconnect() : connect()}>
      {isConnecting ? 'Đang kết nối...' : isConnected ? 'Ngắt USB' : 'Kết nối USB'}
    </button>}
    {user && mode !== 'demo' && <button type="button" className="btn btn-sm btn-outline" onClick={refreshDevices}>Tải lại thiết bị</button>}
    <div className={`telemetry-link telemetry-link--${status}`} role="status" aria-live="polite">
      <strong>{link === 'connecting' ? 'Đang kết nối...' : LABELS[status]}</strong>
      <span>{age === null ? 'Chưa nhận mẫu' : `Mẫu cuối: ${age}s trước`}{mode === 'demo' ? ' · DEMO' : ''}</span>
    </div>
    {(error || deviceError || rejectedCount > 0) && <p className="telemetry-source-note">
      {error || deviceError || `${rejectedCount} bản tin sai thiết bị/nguồn đã bị loại.`}
    </p>}
  </section>;
}
