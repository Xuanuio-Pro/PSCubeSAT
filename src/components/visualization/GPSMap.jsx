import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSerial } from '../../contexts/SerialContext';

// Fix leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const cubesatIcon = L.divIcon({
  html: '<div style="font-size:24px;text-align:center;margin-top:-12px">🛰️</div>',
  className: '',
  iconSize: [30, 30],
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { duration: 1 });
  }, [center, map]);
  return null;
}

export default function GPSMap({ height = 350 }) {
  const { subscribe } = useSerial();
  const [position, setPosition] = useState([21.0285, 105.8542]); // Hanoi default
  const [trail, setTrail] = useState([]);
  const [gpsInfo, setGpsInfo] = useState({ lat: 21.0285, lng: 105.8542, alt: 0 });

  useEffect(() => {
    const unsub = subscribe((entry) => {
      if (entry.type !== 'rx') return;
      try {
        const text = entry.text.trim();
        if (text.startsWith('{')) {
          const json = JSON.parse(text);
          if (json.lat !== undefined && json.lng !== undefined && json.lat !== 0) {
            const pos = [json.lat, json.lng];
            setPosition(pos);
            setGpsInfo({ lat: json.lat, lng: json.lng, alt: json.alt || 0 });
            setTrail(prev => {
              const next = [...prev, pos];
              return next.length > 200 ? next.slice(-200) : next;
            });
          }
        }
      } catch { /* not JSON */ }
    });
    return unsub;
  }, [subscribe]);

  // Demo movement
  useEffect(() => {
    let t = 0;
    const interval = setInterval(() => {
      t += 0.01;
      const lat = 21.0285 + Math.sin(t) * 0.005;
      const lng = 105.8542 + Math.cos(t * 0.7) * 0.005;
      setPosition([lat, lng]);
      setGpsInfo({ lat, lng, alt: 50 + Math.sin(t * 2) * 10 });
      setTrail(prev => [...prev.slice(-100), [lat, lng]]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3>🌍 GPS Map</h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          <span>Lat: {gpsInfo.lat.toFixed(6)}</span>
          <span>Lng: {gpsInfo.lng.toFixed(6)}</span>
          <span>Alt: {gpsInfo.alt.toFixed(1)}m</span>
        </div>
      </div>
      <div style={{ height: `${height}px` }}>
        <MapContainer
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
                Lat: {gpsInfo.lat.toFixed(6)}<br />
                Lng: {gpsInfo.lng.toFixed(6)}<br />
                Alt: {gpsInfo.alt.toFixed(1)}m
              </div>
            </Popup>
          </Marker>
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
