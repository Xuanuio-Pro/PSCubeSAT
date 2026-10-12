import { useEffect, useState } from 'react';
import { request } from '../../contexts/AuthContext';

export default function DeviceManager() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState(null);

  function loadDevices() {
    setLoading(true);
    request('/api/devices')
      .then(setDevices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadDevices, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await request('/api/devices/register', {
        method: 'POST',
        body: JSON.stringify({ device_name: newName.trim() }),
      });
      setNewSecret(res);
      setNewName('');
      loadDevices();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(deviceUid) {
    if (!confirm(`Xoá thiết bị ${deviceUid}? Hành động này không thể hoàn tác.`)) return;
    try {
      await request(`/api/devices/${deviceUid}`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.device_uid !== deviceUid));
    } catch (err) {
      setError(err.message);
    }
  }

  const statusColor = { online: 'var(--accent-green)', offline: 'var(--text-muted)', sleep: 'var(--accent-orange)', error: 'var(--accent-red)' };

  return (
    <div className="card">
      <div className="card-header">Quản lý thiết bị</div>
      <div className="card-body">
        {error && <div className="auth-error-text" style={{ marginBottom: '16px' }}>⚠ {error}</div>}

        {newSecret && (
          <div style={{
            marginBottom: '20px', padding: '16px', borderRadius: '12px',
            background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>✅ Đã tạo thiết bị "{newSecret.device_name}"</div>
            <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
              UID: {newSecret.device_uid}<br />
              Secret: {newSecret.device_secret}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Lưu lại secret này ngay — sẽ không hiển thị lại lần sau.
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Tên thiết bị mới (vd: CubeSat của tôi)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              flex: 1, height: '40px', padding: '0 12px', borderRadius: '8px',
              border: '1px solid var(--border-strong)', fontSize: '0.9rem',
            }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
            {creating ? 'Đang tạo...' : '+ Thêm thiết bị'}
          </button>
        </form>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Đang tải danh sách thiết bị...</div>
        ) : devices.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Bạn chưa có thiết bị nào.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {devices.map((d) => (
              <div key={d.device_uid} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{d.device_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {d.device_uid}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: statusColor[d.status] || 'var(--text-muted)' }}>
                    ● {d.status}
                  </span>
                  <button className="btn btn-outline btn-sm" onClick={() => handleDelete(d.device_uid)}>
                    Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
