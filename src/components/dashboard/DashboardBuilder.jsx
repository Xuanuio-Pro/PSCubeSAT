import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth-api';
import { useTelemetry } from '../../contexts/telemetry-api';
import { useSerial } from '../../contexts/serial-api';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import GPSMap from '../visualization/GPSMap';
import AttitudeViewer3D from '../visualization/AttitudeViewer3D';
import SerialMonitor from '../serial/SerialMonitor';
import CameraViewer from '../visualization/CameraViewer';
import EnvironmentPanel from '../visualization/EnvironmentPanel';
import SystemCheck from '../visualization/SystemCheck';
import RadioPanel from '../visualization/RadioPanel';
import ShellResultsPanel from '../visualization/ShellResultsPanel';
import AnomalyPanel from '../visualization/AnomalyPanel';
import GroundStationLink from '../visualization/GroundStationLink';
import CommandPanel from '../groundstation/CommandPanel';
import { AlertWidget, ButtonWidget, GaugeWidget, MetricChart, ValueWidget, WidgetSettings } from './DashboardWidgets';
import { metric } from '../../telemetry/metrics';
import { ROW_HEIGHT, WIDGET_GROUPS, WIDGET_TYPES, createWidget, defaultLayout, layoutKey, nextWidgetId, parseLayout, serializeLayout, typeInfo } from './dashboard-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

const SIZE = Object.fromEntries(WIDGET_TYPES.map(({ type, minW, minH }) => [type, { minW, minH }]));
// Panels that fill the widget (plot / map / canvas); every other panel scrolls when the widget is short.
const FILL = ['chart', 'map', '3d', 'terminal'];

/** Title follows the data a configurable widget currently shows. */
function widgetTitle({ type, config }) {
  const info = typeInfo(type);
  if (type === 'chart') return `${info.icon} ${config.keys.map(key => metric(key).label).join(' · ')}`;
  if (type === 'gauge' || type === 'alert') return `${info.icon} ${metric(config.key).label}`;
  return `${info.icon} ${info.label}`;
}

export default function DashboardBuilder() {
  const { mode } = useTelemetry();
  const { isConnected, send } = useSerial();
  const { user } = useAuth();
  // Saved per account in this browser; a guest's layout is not kept.
  const storageKey = user?.id != null ? layoutKey(user.id) : null;
  const [widgets, setWidgets] = useState(() => {
    try { return (storageKey && parseLayout(localStorage.getItem(storageKey))) || defaultLayout(); } catch { return defaultLayout(); }
  });
  const [nextId, setNextId] = useState(() => nextWidgetId(widgets));
  const [saveState, setSaveState] = useState('');
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, serializeLayout(widgets)); setSaveState('Đã lưu bố cục'); }
    catch { setSaveState('Không lưu được bố cục trên trình duyệt này'); }
  }, [storageKey, widgets]);
  const resetLayout = () => {
    if (!window.confirm('Khôi phục bố cục mặc định? Bố cục hiện tại sẽ bị thay thế.')) return;
    const layout = defaultLayout();
    setWidgets(layout); setNextId(nextWidgetId(layout)); setEditing(null);
  };
  const [editing, setEditing] = useState(/** @type {string|null} */ (null));
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppingItem, setDroppingItem] = useState(null);

  const onDragStart = (e, wt) => {
    e.dataTransfer.setData('text/plain', wt.type);
    e.dataTransfer.effectAllowed = 'copy';
    setDroppingItem({ i: 'drop', w: wt.w, h: wt.h });
  };

  // RGL triggers this when an external item is dropped
  const onDrop = (_layout, layoutItem, event) => {
    const type = event.dataTransfer.getData('text/plain');
    setIsDraggingOver(false);
    setDroppingItem(null);
    if (!layoutItem || !typeInfo(type)) return;
    setWidgets(prev => [...prev, createWidget(nextId.toString(), type, layoutItem.x, layoutItem.y)]);
    setNextId(prev => prev + 1);
  };

  const removeWidget = id => setWidgets(prev => prev.filter(w => w.i !== id));
  const updateConfig = (id, config) => setWidgets(prev => prev.map(w => w.i === id ? { ...w, config } : w));

  const onLayoutChange = (layout) => {
    setWidgets(prev => prev.map(w => {
      const l = layout.find(item => item.i === w.i);
      return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
    }));
  };

  const renderWidget = (widget) => {
    const { config } = widget;
    switch (widget.type) {
      // Each panel's card fills the widget body; its plot/map/canvas takes the remaining height (no fixed px).
      case 'chart': return <MetricChart keys={config.keys} />;
      case 'map': return <GPSMap height="100%" />;
      case '3d': return <AttitudeViewer3D height="100%" />;
      case 'gauge': return <GaugeWidget config={config} />;
      case 'value': return <ValueWidget config={config} />;
      case 'alert': return <AlertWidget config={config} />;
      case 'button': return <ButtonWidget config={config} onSend={mode === 'serial' && isConnected ? send : undefined} />;
      case 'commands': return <CommandPanel commands={config.commandText.split(',').map(item => item.trim()).filter(Boolean).slice(0, 20)} />;
      case 'terminal': return <SerialMonitor height="100%" />;
      case 'image': return <CameraViewer />;
      case 'environment': return <EnvironmentPanel />;
      case 'system': return <SystemCheck />;
      case 'radio': return <RadioPanel />;
      case 'groundStation': return <GroundStationLink />;
      case 'shell': return <ShellResultsPanel />;
      case 'anomaly': return <AnomalyPanel />;
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
            Kéo thả tiện ích xuống Canvas; nhấn ⚙ trên tiện ích để chọn dữ liệu hiển thị
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {storageKey ? saveState : 'Đăng nhập để lưu bố cục'}
            <button type="button" className="btn btn-sm btn-outline" onClick={resetLayout}>↺ Bố cục mặc định</button>
          </span>
        </div>
        <div className="widget-palette">
          {WIDGET_GROUPS.map(group => <div key={group.title} className="widget-palette-group">
            <span className="widget-palette-title">{group.title}</span>
            <div className="widget-palette-items">{group.items.map(wt => (
              <div key={wt.type} className="widget-palette-item" draggable={true} onDragStart={(e) => onDragStart(e, wt)}>
                {wt.icon} {wt.label}
              </div>
            ))}</div>
          </div>)}
        </div>
      </div>

      {/* Dashboard Canvas */}
      <div
        className={`dashboard-canvas ${isDraggingOver ? 'is-dragging-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
      >
        {widgets.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', color: 'var(--text-muted)', zIndex: 0 }}>
            <div style={{ fontSize: '48px', opacity: 0.5, marginBottom: '16px' }}>🧩</div>
            <h3 style={{ fontWeight: 600, fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-heading)' }}>Chưa có tiện ích nào</h3>
            <p style={{ opacity: 0.8 }}>Kéo thả tiện ích từ thanh công cụ phía trên vào đây để thiết kế bảng điều khiển</p>
          </div>
        )}

        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: widgets.map(widget => ({ ...widget, ...SIZE[widget.type] })) }}
          // The narrowest breakpoint keeps 4 columns so every widget's minimum width still fits.
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={ROW_HEIGHT}
          onLayoutChange={onLayoutChange}
          onDrop={onDrop}
          isDroppable={true}
          droppingItem={droppingItem ? { ...droppingItem, x: 0, y: 0 } : undefined}
          onDropDragOver={() => ({ w: droppingItem?.w || 6, h: droppingItem?.h || 4 })}
          draggableHandle=".dashboard-widget-header"
          draggableCancel=".dashboard-widget-control"
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
          style={{ minHeight: '600px', zIndex: 1 }}
        >
          {widgets.map(widget => {
            const configurable = Boolean(typeInfo(widget.type).config);
            const open = editing === widget.i;
            return <div key={widget.i} className="dashboard-widget">
              <div className="dashboard-widget-header">
                <span>{widgetTitle(widget)}</span>
                <span style={{ display: 'flex', gap: 2 }}>
                  {configurable && <button type="button" className={`dashboard-widget-control${open ? ' is-active' : ''}`} title="Chọn dữ liệu hiển thị"
                    aria-label="Cài đặt tiện ích" aria-pressed={open} onClick={() => setEditing(open ? null : widget.i)}>⚙</button>}
                  <button type="button" className="dashboard-widget-control" title="Xóa tiện ích" aria-label="Xóa tiện ích" onClick={() => removeWidget(widget.i)}>✕</button>
                </span>
              </div>
              {open && <WidgetSettings widget={widget} onChange={config => updateConfig(widget.i, config)} />}
              <div className={`dashboard-widget-body${FILL.includes(widget.type) ? '' : ' is-scroll'}`}>
                {renderWidget(widget)}
              </div>
            </div>;
          })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
