import { useState, useCallback } from 'react';
import { ResponsiveGridLayout } from 'react-grid-layout';
import VoltageChart from '../visualization/VoltageChart';
import GPSMap from '../visualization/GPSMap';
import AttitudeViewer3D from '../visualization/AttitudeViewer3D';
import SerialMonitor from '../serial/SerialMonitor';

const WIDGET_TYPES = [
  { type: 'chart', label: '📈 Đồ thị', icon: '📈', w: 6, h: 4 },
  { type: 'map', label: '🗺️ Bản đồ', icon: '🗺️', w: 6, h: 4 },
  { type: '3d', label: '🛰️ Mô hình 3D', icon: '🛰️', w: 6, h: 4 },
  { type: 'gauge', label: '🎯 Gauge', icon: '🎯', w: 3, h: 3 },
  { type: 'alert', label: '🚨 Cảnh báo', icon: '🚨', w: 3, h: 2 },
  { type: 'button', label: '🔘 Nút bấm', icon: '🔘', w: 3, h: 2 },
  { type: 'terminal', label: '📟 Terminal', icon: '📟', w: 6, h: 4 },
  { type: 'image', label: '📷 Ảnh', icon: '📷', w: 4, h: 3 },
];

function GaugeWidget({ config }) {
  const value = config?.value ?? 72;
  const max = config?.max ?? 100;
  const label = config?.label ?? 'Battery';
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 60 ? 'var(--accent-green)' : pct > 30 ? 'var(--accent-orange)' : 'var(--accent-red)';

  return (
    <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: '110px', height: '110px', borderRadius: '50%', margin: '0 auto var(--space-md)',
        background: `conic-gradient(${color} ${pct * 3.6}deg, var(--bg-tertiary) 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 20px ${color}20, inset 0 4px 10px rgba(0,0,0,0.5)`,
      }}>
        <div style={{
          width: '90px', height: '90px', borderRadius: '50%', background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
        }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color, textShadow: `0 0 10px ${color}40` }}>
            {value.toFixed(1)}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

function AlertWidget({ config }) {
  const [active, setActive] = useState(false);
  const label = config?.label ?? 'Nhiệt độ cao';
  const threshold = config?.threshold ?? 45;

  return (
    <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto var(--space-md)',
        background: active ? 'var(--accent-red)' : 'var(--bg-tertiary)',
        boxShadow: active ? '0 0 25px rgba(248,81,73,0.6)' : 'inset 0 4px 8px rgba(0,0,0,0.4)',
        animation: active ? 'pulse-orange 1s ease-in-out infinite' : 'none',
        border: active ? '2px solid rgba(255,255,255,0.8)' : '2px solid var(--border-subtle)',
        cursor: 'pointer', transition: 'all 0.3s'
      }}
        onClick={() => setActive(!active)}
      />
      <div style={{ fontSize: '1rem', fontWeight: 700, color: active ? 'var(--accent-red)' : 'var(--text-heading)' }}>{active ? '⚠️ NGUY HIỂM' : `🚨 ${label}`}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>Ngưỡng cảnh báo: &gt; {threshold}°C</div>
    </div>
  );
}

function ButtonWidget({ config, onSend }) {
  const label = config?.label ?? 'Chụp ảnh';
  const command = config?.command ?? 'capture';

  return (
    <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <button
        className="btn btn-primary"
        onClick={() => onSend?.(command)}
        style={{ width: '85%', padding: '16px', fontSize: '1rem', borderRadius: '12px', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }}
      >
        {label}
      </button>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '12px', background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: '20px' }}>
        Lệnh phát: <code style={{ color: 'var(--accent-cyan)' }}>{command}</code>
      </div>
    </div>
  );
}

export default function DashboardBuilder() {
  const [widgets, setWidgets] = useState([
    { i: '1', type: 'chart', title: 'Điện áp Pin', x: 0, y: 0, w: 6, h: 4, config: {} },
    { i: '2', type: 'gauge', title: 'Battery Level', x: 6, y: 0, w: 3, h: 3, config: { value: 3.72, max: 4.2, label: 'Pin (V)' } },
    { i: '3', type: 'alert', title: 'Cảnh báo nhiệt', x: 9, y: 0, w: 3, h: 3, config: { label: 'Nhiệt độ cao', threshold: 45 } },
  ]);
  const [nextId, setNextId] = useState(4);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppingItem, setDroppingItem] = useState(null);

  // Handle Drag Start from Palette
  const onDragStart = (e, wt) => {
    e.dataTransfer.setData('text/plain', wt.type);
    e.dataTransfer.effectAllowed = 'copy';
    setDroppingItem({ i: 'drop', w: wt.w, h: wt.h });
  };

  // RGL triggers this when an external item is dropped
  const onDrop = (layout, layoutItem, _event) => {
    const type = _event.dataTransfer.getData('text/plain');
    if (!type) {
      setDroppingItem(null);
      return;
    }

    const info = WIDGET_TYPES.find(w => w.type === type);
    if (!info) {
      setDroppingItem(null);
      return;
    }

    const newWidget = {
      i: nextId.toString(),
      type,
      title: info.label,
      x: layoutItem.x,
      y: layoutItem.y,
      w: info.w,
      h: info.h,
      config: {}
    };

    setWidgets(prev => [...prev, newWidget]);
    setNextId(prev => prev + 1);
    setIsDraggingOver(false);
    setDroppingItem(null);
  };

  const removeWidget = (id) => {
    setWidgets(prev => prev.filter(w => w.i !== id));
  };

  const onLayoutChange = (layout) => {
    // Sync React state with RGL layout
    setWidgets(prev => prev.map(w => {
      const l = layout.find(item => item.i === w.i);
      if (l) return { ...w, x: l.x, y: l.y, w: l.w, h: l.h };
      return w;
    }));
  };

  const renderWidget = (widget) => {
    switch (widget.type) {
      case 'chart': return <div style={{ height: '100%', minHeight: '200px' }}><VoltageChart /></div>;
      case 'map': return <div style={{ height: '100%', minHeight: '200px' }}><GPSMap height="100%" /></div>;
      case '3d': return <div style={{ height: '100%', minHeight: '200px' }}><AttitudeViewer3D height="100%" /></div>;
      case 'gauge': return <GaugeWidget config={widget.config} />;
      case 'alert': return <AlertWidget config={widget.config} />;
      case 'button': return <ButtonWidget config={widget.config} />;
      case 'terminal': return <SerialMonitor height="100%" />;
      case 'image': return (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '40px' }}>📷</span>
          <p style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-sm)' }}>Image Viewer Widget</p>
        </div>
      );
      default: return <div>Unknown widget</div>;
    }
  };

  return (
    <div>
      {/* Widget Palette */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)', borderRadius: '16px' }}>
        <div className="card-header">
          <h3>🧩 Thư viện Tiện ích (Widget Palette)</h3>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            Kéo và thả (Drag and Drop) tiện ích xuống Canvas bên dưới
          </span>
        </div>
        <div className="widget-palette">
          {WIDGET_TYPES.map(wt => (
            <div
              key={wt.type}
              className="widget-palette-item"
              draggable={true}
              onDragStart={(e) => onDragStart(e, wt)}
            >
              {wt.icon} {wt.label}
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard Canvas */}
      <div 
        className={`dashboard-canvas ${isDraggingOver ? 'is-dragging-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
      >
        {widgets.length === 0 && !isDraggingOver && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', 
            justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-md)', 
            color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 0
          }}>
            <span style={{ fontSize: '48px' }}>🧩</span>
            <p>Kéo các tiện ích từ bảng trên và thả vào đây</p>
          </div>
        )}
        {widgets.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', color: 'var(--text-muted)', zIndex: 0 }}>
            <div style={{ fontSize: '48px', opacity: 0.5, marginBottom: '16px' }}>🧩</div>
            <h3 style={{ fontWeight: 600, fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-heading)' }}>Chưa có tiện ích nào</h3>
            <p style={{ opacity: 0.8 }}>Kéo thả tiện ích từ thanh công cụ phía trên vào đây để thiết kế bảng điều khiển</p>
          </div>
        )}

        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: widgets }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          onLayoutChange={onLayoutChange}
          onDrop={onDrop}
          isDroppable={true}
          droppingItem={droppingItem}
          onDropDragOver={() => ({ w: droppingItem?.w || 6, h: droppingItem?.h || 4 })}
          draggableHandle=".dashboard-widget-header"
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
          style={{ minHeight: '600px', zIndex: 1 }}
        >
          {widgets.map(widget => (
            <div key={widget.i} className="dashboard-widget">
              <div className="dashboard-widget-header">
                <span>{widget.title}</span>
                <button
                  onClick={() => removeWidget(widget.i)}
                  onMouseDown={(e) => e.stopPropagation()} // Prevent dragging when clicking close
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '14px', padding: '2px 6px',
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, padding: '8px', overflow: 'hidden' }}>
                {renderWidget(widget)}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
