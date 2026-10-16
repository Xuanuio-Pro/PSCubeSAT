import { useState, useEffect } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';

export default function CameraViewer() {
  const { history, generation } = useTelemetry();
  const images = [...new Set(history.filter(frame => frame.imageData).map(frame => frame.imageData))].slice(-10).reverse();
  const [selected, setSelected] = useState(null);
  useEffect(() => setSelected(null), [generation]);
  const currentImage = selected && images.includes(selected) ? selected : images[0] ?? null;
  const gallery = images;

  return (
    <div className="card">
      <div className="card-header">
        <h3>📷 Camera Viewer</h3>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          {gallery.length} ảnh
        </span>
      </div>
      <div className="card-body" style={{ textAlign: 'center' }}>
        {currentImage ? (
          <img
            src={currentImage}
            alt="Camera capture"
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
