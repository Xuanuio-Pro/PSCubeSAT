import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIPELAGOS, MASKED_AREAS, PROVIDER_LABEL_MIN_ZOOM, REGION_LABELS, isMaskedArea } from '../src/components/visualization/vietnam-map-data.js';

// Web Mercator tile → [south, west, north, east], as Leaflet computes for a 256 px tile.
const lat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;
const tileBounds = (x, y, z) => [lat(y + 1, z), x / 2 ** z * 360 - 180, lat(y, z), (x + 1) / 2 ** z * 360 - 180];
const tileOf = (latitude, longitude, z) => {
  const rad = latitude * Math.PI / 180;
  return [Math.floor((longitude + 180) / 360 * 2 ** z), Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * 2 ** z)];
};

test('both archipelagos are drawn as Vietnamese territory with their islands', () => {
  assert.deepEqual(ARCHIPELAGOS.map(group => group.name), ['Quần đảo Hoàng Sa', 'Quần đảo Trường Sa']);
  for (const group of ARCHIPELAGOS) assert.ok(group.islands.length >= 8, group.name);
  assert.ok(REGION_LABELS.some(([text]) => text === 'Biển Đông'));
});

test('provider labels are blanked on every tile showing an island, at every zoom where they are drawn', () => {
  for (const group of ARCHIPELAGOS) for (const [name, latitude, longitude] of [...group.islands, [group.name, ...group.center]]) {
    assert.ok(MASKED_AREAS.some(([s, w, n, e]) => latitude > s && latitude < n && longitude > w && longitude < e), name);
    for (let z = PROVIDER_LABEL_MIN_ZOOM; z <= 19; z++) assert.ok(isMaskedArea(tileBounds(...tileOf(latitude, longitude, z), z)), `${name} z${z}`);
  }
});

test('no land tile is replaced: Vietnamese coast and neighbouring coasts keep the street map', () => {
  const coast = [['Đà Nẵng', 16.054, 108.202], ['Quảng Ngãi', 15.12, 108.8], ['Lý Sơn', 15.38, 109.12], ['Quy Nhơn', 13.77, 109.22],
    ['Đại Lãnh', 12.85, 109.46], ['Nha Trang', 12.24, 109.19], ['Phan Rang', 11.56, 109.0], ['Vũng Tàu', 10.35, 107.08], ['Côn Đảo', 8.68, 106.6],
    ['Hà Nội', 21.028, 105.834], ['Sanya', 18.25, 109.5], ['Puerto Princesa', 9.74, 118.74], ['Kudat', 6.88, 116.85], ['Kota Kinabalu', 5.98, 116.07]];
  for (const [name, latitude, longitude] of coast) {
    for (let z = PROVIDER_LABEL_MIN_ZOOM; z <= 19; z++) assert.equal(isMaskedArea(tileBounds(...tileOf(latitude, longitude, z), z)), false, `${name} z${z}`);
  }
});
