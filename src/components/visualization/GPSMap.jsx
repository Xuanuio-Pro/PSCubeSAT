import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTelemetry } from '../../contexts/telemetry-api';

const cubesatIcon = L.divIcon({
  html: '<div style="font-size:24px;text-align:center;margin-top:-12px">🛰️</div>',
  className: '',
  iconSize: [30, 30],
});

// Map stays visible without a fix; centred on PTIT Hà Đông until the first valid position.
/** @type {import('leaflet').LatLngTuple} */
const DEFAULT_CENTER = [20.9806, 105.7873];

// Leaflet measures its container once; a resized dashboard widget needs a re-measure or tiles stay grey.
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.panTo(center, { animate: false });
  }, [center, map]);
  return null;
}

/** @param {{height?: number|string}} props `'100%'` fills a flex parent (dashboard widget). */
export default function GPSMap({ height = 350 }) {
  const { latest, history, status, generation, activity, now } = useTelemetry();
  // Satellites in use (GGA field 7 or "N sats" in the log): shows the receiver is searching before the first fix.
  const gpsEvent = activity.events.findLast(event => event.group === 'gps' && event.satellites != null);
  const satellites = gpsEvent && now - gpsEvent.at <= 10000 ? gpsEvent.satellites : null;
  const validGPS = sample => sample?.gpsLat != null && sample?.gpsLon != null;
  const lastKnown = history.findLast(validGPS);
  const position = validGPS(latest) ? /** @type {import('leaflet').LatLngTuple} */ ([latest.gpsLat, latest.gpsLon]) : null;
  const trail = history.filter(validGPS).map(sample => /** @type {import('leaflet').LatLngTuple} */ ([sample.gpsLat, sample.gpsLon]));
  const display = (value, decimals) => value == null ? '—' : value.toFixed(decimals);

  return (
    <div className="card" style={{ opacity: status === 'live' ? 1 : 0.65 }}>
      <div className="card-header">
        <h3>🌍 GPS Map</h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          <span>Lat: {display(latest?.gpsLat, 6)}</span>
          <span>Lng: {display(latest?.gpsLon, 6)}</span>
          <span>Alt: {display(latest?.gpsAlt, 1)}m</span>
          <span>Vệ tinh: {satellites ?? '—'}</span>
        </div>
      </div>
      {!position && <div className="telemetry-empty">{lastKnown ? 'Mất fix — bản đồ giữ vị trí hợp lệ gần nhất' : 'Chờ fix GPS — đem mạch ra ngoài trời'}{satellites != null && ` · module đang dò, thấy ${satellites} vệ tinh (cần ≥ 4)`}</div>}
      <div style={height === '100%' ? { flex: 1, minHeight: 160, position: 'relative' } : { height, position: 'relative' }}>
        <MapContainer
          key={generation}
          center={position ?? (lastKnown ? /** @type {import('leaflet').LatLngTuple} */ ([lastKnown.gpsLat, lastKnown.gpsLon]) : DEFAULT_CENTER)}
          zoom={16}
          style={{ position: 'absolute', inset: 0, borderRadius: '0 0 12px 12px' }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />
          <MapResizer />
          {position && <MapUpdater center={position} />}
          {position && <Marker position={position} icon={cubesatIcon}>
            <Popup>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <b>🛰️ PTIT CubeSat</b><br />
                Lat: {display(latest?.gpsLat, 6)}<br />
                Lng: {display(latest?.gpsLon, 6)}<br />
                Alt: {display(latest?.gpsAlt, 1)}m
              </div>
            </Popup>
          </Marker>}
          {trail.length > 1 && (
            <Polyline
              positions={trail}
              pathOptions={{ color: '#388bfd', weight: 2, opacity: 0.7 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
