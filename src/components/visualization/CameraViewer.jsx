import { useState, useEffect } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';
import { authorizedFetch } from '../../contexts/auth-api';
import { useCloud } from '../../contexts/cloud-api';
import './practice.css';

const POLL_MS = 4000;
// A configured board starts sending within a scan period (2 s) of the photo being closed on the SD card.
const NOT_CONFIGURED_AFTER_MS = 6000;
// WiFi connect (≤ 15 s) + TLS + upload of a few tens of KB: no report after this means the board skipped the photo.
const NO_UPLOAD_AFTER_MS = 30000;
const UPLOAD_REASONS = {
  wifi: 'bo không kết nối được WiFi', 'wifi-ap': 'chương trình đang phát WiFi riêng (AP)', open: 'không mở được ảnh trên thẻ SD',
  'not-jpeg': 'tệp không phải JPEG hoàn chỉnh', size: 'ảnh quá lớn (> 2 MB) hoặc rỗng', network: 'mất kết nối khi đang gửi',
  publish: 'máy chủ MQTT từ chối gói ảnh', read: 'lỗi đọc thẻ SD', 'sd-busy': 'thẻ SD đang bận',
};
const uploadReason = reason => UPLOAD_REASONS[reason] ?? (reason?.startsWith('mqtt') ? 'không kết nối được máy chủ MQTT' : reason);
const base64Bytes = data => { const body = data.slice(data.indexOf(',') + 1); return body.length / 4 * 3 - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0); };

/**
 * Images the backend received from the board over MQTT (`sensors/{uid}/image`), fetched as blob URLs because
 * <img> cannot send the bearer token. `refresh` triggers an immediate poll (the board reported an upload).
 * @returns {{ url: string, size: number | null }[]}
 */
function useDeviceImages(deviceId, generation, refresh) {
  const [images, setImages] = useState([]);
  useEffect(() => {
    setImages([]);
    if (!deviceId) return undefined;
    const abort = new AbortController();
    const known = new Map();
    const poll = async () => {
      try {
        const list = await authorizedFetch(`/api/telemetry/images/${encodeURIComponent(deviceId)}`, { signal: abort.signal });
        if (!list.ok) return;
        const { images: ids, sizes = {} } = await list.json();
        for (const id of ids.filter(image => !known.has(image)).reverse()) {
          const response = await authorizedFetch(`/api/telemetry/images/${encodeURIComponent(deviceId)}/${id}`, { signal: abort.signal });
          if (response.ok) known.set(id, { url: URL.createObjectURL(await response.blob()), size: sizes[id] ?? null });
        }
        setImages([...known.values()].slice(-10));
      } catch { /* Offline or aborted: the next poll retries. */ }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => { abort.abort(); clearInterval(timer); known.forEach(image => URL.revokeObjectURL(image.url)); };
  }, [deviceId, generation, refresh]);
  return images;
}

function WifiForm({ onSubmit }) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  return <form className="camera-wifi-form" onSubmit={event => { event.preventDefault(); if (ssid.trim()) onSubmit(ssid.trim(), password); }}>
    <input aria-label="Tên WiFi" placeholder="Tên WiFi (SSID)" maxLength={32} value={ssid} onChange={event => setSsid(event.target.value)} />
    <input aria-label="Mật khẩu WiFi" type="password" placeholder="Mật khẩu" maxLength={64} value={password} onChange={event => setPassword(event.target.value)} />
    <button type="submit" className="btn btn-sm btn-primary" disabled={!ssid.trim()}>Lưu vào bo</button>
  </form>;
}

export default function CameraViewer() {
  const { history, generation, activity, mode, deviceId, now } = useTelemetry();
  const cloud = useCloud();
  // Over USB the photos still travel through the server: the board uploads them over MQTT on its own.
  const imageDevice = mode === 'serial' ? cloud.deviceUid : mode !== 'demo' ? deviceId : null;
  const deviceImages = useDeviceImages(imageDevice, generation, cloud.photoSentAt);
  const capture = activity.subsystems.camera;
  const savedOnDevice = mode === 'serial' && capture?.phase === 'saved' && !capture.browser;
  const serialImages = history.filter(frame => frame.imageData).map(frame => frame.imageData);
  // A reference sketch that also streams over Serial would otherwise show each photo twice.
  const serialSizes = new Set(serialImages.map(base64Bytes));
  const cloudImages = deviceImages.filter(image => image.size === null || !serialSizes.has(image.size)).map(image => image.url);
  const images = [...new Set([...serialImages, ...cloudImages])].slice(-10).reverse();
  const [selected, setSelected] = useState(null);
  const [failed, setFailed] = useState([]);
  useEffect(() => { setSelected(null); setFailed([]); }, [generation]);
  const gallery = images.filter(value => !failed.includes(value));
  const currentImage = selected && gallery.includes(selected) ? selected : gallery[0] ?? null;

  return (
    <div className="card">
      <div className="card-header">
        <h3>📷 Camera Viewer</h3>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          {gallery.length} ảnh
        </span>
      </div>
      <div className="card-body" style={{ textAlign: 'center' }}>
        {failed.length > 0 && <p role="status" className="practice-note">Đã bỏ qua ảnh không giải mã được. Kiểm tra JPEG/PNG và dữ liệu truyền qua Serial.</p>}
        {capture?.phase === 'progress' && capture.total > 0 && <progress className="camera-progress" max={capture.total} value={capture.received} aria-label="Tiến độ nhận ảnh từ ESP32-CAM" style={{ width: '100%' }} />}
        {capture && <p className="practice-note">{capture.text} · {new Date(capture.at).toLocaleTimeString()}
          {savedOnDevice && cloud.board.state !== 'need-wifi' && now - capture.at <= NO_UPLOAD_AFTER_MS && (now - capture.at <= NOT_CONFIGURED_AFTER_MS || cloud.board.state === 'configured') && ' · đang gửi ảnh lên máy chủ…'}
          {savedOnDevice && cloud.board.state === 'configured' && now - capture.at > NO_UPLOAD_AFTER_MS && ' · bo chưa báo gửi ảnh này. Xem các dòng [CLOUD] trong Serial Monitor; nếu không có dòng "[CLOUD] READY", hãy nạp lại code để dùng thư viện mới.'}
          {capture.phase === 'uploaded' && ' · đang tải ảnh về…'}
          {capture.phase === 'upload-error' && ` · ${uploadReason(capture.reason)}`}</p>}
        {mode === 'serial' && cloud.board.state === 'need-wifi' && <div className="camera-send-hint" role="status">
          <strong>{cloud.board.message}</strong>
          <p>Bo dùng WiFi này để tự gửi ảnh lên máy chủ; thông tin chỉ được lưu trong bộ nhớ của bo.</p>
          <WifiForm onSubmit={cloud.setWifi} />
          <p>Sau khi lưu, nếu chưa thấy "Bo đã sẵn sàng", nhấn nút RST (EN) trên bo.</p>
        </div>}
        {mode === 'serial' && cloud.board.state === 'error' && <p className="camera-send-hint" role="status">{cloud.board.message}</p>}
        {savedOnDevice && ['unknown', 'configuring'].includes(cloud.board.state) && now - capture.at > NOT_CONFIGURED_AFTER_MS && <p className="camera-send-hint" role="status">
          Bo chưa được cấu hình để gửi ảnh lên máy chủ. Giữ kết nối Serial và nhấn nút RST (EN) trên bo: trình duyệt sẽ tự cấu hình, rồi chụp lại.</p>}
        {currentImage ? (
          <img
            src={currentImage}
            alt="Camera capture"
            onError={() => setFailed(previous => [...previous, currentImage].slice(-10))}
            style={{
              maxWidth: '100%',
              maxHeight: '250px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
            }}
          />
        ) : (
          <div style={{
            height: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
            color: 'var(--text-muted)',
          }}>
            <span style={{ fontSize: '48px', opacity: 0.3 }}>📷</span>
            <span style={{ fontSize: 'var(--font-size-sm)' }}>
              Chờ ảnh từ Camera vệ tinh...
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)' }}>
              Ảnh hiển thị từ thiết bị và nguồn dữ liệu đã chọn
            </span>
          </div>
        )}

        {gallery.length > 1 && (
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '8px',
            overflowX: 'auto',
            padding: '4px 0',
          }}>
            {gallery.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Capture ${i}`}
                onClick={() => setSelected(img)}
                style={{
                  width: '50px',
                  height: '50px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: currentImage === img ? '2px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                  opacity: currentImage === img ? 1 : 0.6,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
