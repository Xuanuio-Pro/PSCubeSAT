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

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.panTo(center, { animate: false });
  }, [center, map]);
  return null;
}

/** @param {{height?: number|string}} props */
export default function GPSMap({ height = 350 }) {
  const { latest, history, status, generation } = useTelemetry();
  const validGPS = sample => sample?.gpsLat != null && sample?.gpsLon != null;
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
        </div>
      </div>
      <div style={{ height }}>
        {position ? <MapContainer
          key={generation}
          center={position}
          zoom={16}
          style={{ height: '100%', width: '100%', borderRadius: '0 0 12px 12px' }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapUpdater center={position} />
          <Marker position={position} icon={cubesatIcon}>
            <Popup>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <b>🛰️ PTIT CubeSat</b><br />
                Lat: {display(latest?.gpsLat, 6)}<br />
                Lng: {display(latest?.gpsLon, 6)}<br />
                Alt: {display(latest?.gpsAlt, 1)}m
              </div>
            </Popup>
          </Marker>
          {trail.length > 1 && (
            <Polyline
              positions={trail}
              pathOptions={{ color: '#388bfd', weight: 2, opacity: 0.7 }}
            />
          )}
        </MapContainer> : <div className="telemetry-empty">Chờ tọa độ từ nguồn đã chọn</div>}
      </div>
    </div>
  );
}
