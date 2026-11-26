import L from 'leaflet';
import { ARCHIPELAGOS, PROVIDER_LABEL_MIN_ZOOM, REGION_LABELS, isMaskedArea } from './vietnam-map-data.js';

/*
 * Bản đồ nền thể hiện đúng chủ quyền Việt Nam với hai quần đảo Hoàng Sa và Trường Sa.
 *
 * Tile công cộng (OpenStreetMap…) in sẵn tên đảo theo thẻ `name` địa phương (thường là tên tiếng Trung) và
 * "South China Sea", không gỡ được khỏi ảnh. Vì vậy:
 *  - zoom < 8: nền Esri Ocean Base KHÔNG nhãn, toàn bộ nhãn khu vực do ứng dụng tự vẽ bằng tiếng Việt;
 *  - zoom ≥ 8: tile OpenStreetMap (chi tiết đường phố cho GPS), trừ mọi ô chạm vùng biển quanh hai quần đảo:
 *    ô đó được thay bằng nền biển trơn cùng màu;
 *  - "Biển Đông", "QĐ. Hoàng Sa (Việt Nam)", "QĐ. Trường Sa (Việt Nam)" và các đảo do ứng dụng tự vẽ, nên luôn
 *    hiển thị như nhau, không phụ thuộc nhà cung cấp tile.
 */

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OVERVIEW_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
const OSM_SEA = '#aad3df'; // OpenStreetMap Carto water colour
const ISLAND_NAME_MIN_ZOOM = 9;
export const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Nền tổng quan © Esri · Hoàng Sa, Trường Sa (Việt Nam)';

// OpenStreetMap layer whose tiles over the archipelago seas are replaced by plain sea.
const MaskedTileLayer = /** @type {new (url: string, options?: L.TileLayerOptions) => L.TileLayer} */ (/** @type {unknown} */ (L.TileLayer.extend({
  createTile(coords, done) {
    const size = this.getTileSize();
    const nw = this._map.unproject(coords.scaleBy(size), coords.z);
    const se = this._map.unproject(coords.add([1, 1]).scaleBy(size), coords.z);
    if (isMaskedArea([se.lat, nw.lng, nw.lat, se.lng])) {
      const sea = document.createElement('div');
      sea.style.background = OSM_SEA;
      setTimeout(() => done(undefined, sea), 0);
      return sea;
    }
    return /** @type {any} */ (L.TileLayer.prototype).createTile.call(this, coords, done);
  },
})));

const label = (text, kind) => L.divIcon({ className: `vn-map-label vn-map-label--${kind}`, html: `<span>${text}</span>`, iconSize: [0, 0] });

/**
 * Add the base map and the sovereignty overlay to a Leaflet map.
 * @param {import('leaflet').Map} map
 * @returns {() => void} removes everything it added
 */
export function addVietnamMap(map) {
  // Exactly one base is on the map at a time, switched on zoom. Layer minZoom/maxZoom would instead clamp the
  // map's own zoom range to the layers present (a map opened at zoom 16 would jump to the overview's maximum).
  const overviewBase = L.tileLayer(OVERVIEW_URL, { maxZoom: 19, maxNativeZoom: 10, attribution: ATTRIBUTION });
  const detailBase = new MaskedTileLayer(OSM_URL, { maxZoom: 19, attribution: ATTRIBUTION });
  const overview = L.layerGroup(REGION_LABELS.map(([text, lat, lng, kind]) => L.marker([lat, lng], { icon: label(text, kind), interactive: false, keyboard: false })));
  const sovereignty = L.layerGroup();
  for (const group of ARCHIPELAGOS) {
    for (const [name, lat, lng] of group.islands) {
      L.circleMarker([lat, lng], { radius: 3, weight: 1, color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.9 })
        .bindTooltip(`${name} · ${group.name}, ${group.province}, Việt Nam`, { direction: 'top' }).addTo(sovereignty);
    }
    L.marker(group.center, { icon: label(`${group.short}<br><small>(Việt Nam)</small>`, 'archipelago'), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(sovereignty);
  }
  const islandNames = L.layerGroup(ARCHIPELAGOS.flatMap(group => group.islands.map(([name, lat, lng]) =>
    L.marker([lat, lng], { icon: label(name, 'island'), interactive: false, keyboard: false }))));
  const sync = () => {
    const zoom = map.getZoom();
    const toggle = (layer, visible) => { if (visible && !map.hasLayer(layer)) layer.addTo(map); if (!visible && map.hasLayer(layer)) layer.remove(); };
    toggle(detailBase, zoom >= PROVIDER_LABEL_MIN_ZOOM);
    toggle(overviewBase, zoom < PROVIDER_LABEL_MIN_ZOOM);
    toggle(overview, zoom < PROVIDER_LABEL_MIN_ZOOM);
    toggle(islandNames, zoom >= ISLAND_NAME_MIN_ZOOM);
  };
  sovereignty.addTo(map);
  sync();
  map.on('zoomend', sync);
  return () => {
    map.off('zoomend', sync);
    for (const layer of [overviewBase, detailBase, sovereignty, overview, islandNames]) layer.remove();
  };
}
