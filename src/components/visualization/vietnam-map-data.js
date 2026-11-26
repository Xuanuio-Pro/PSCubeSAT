// Data for vietnam-map.js, kept free of Leaflet so it can be tested in Node.

// Below this zoom one tile spans both the mainland and the islands: a label-free base (Esri Ocean) and our own labels are used.
// From this zoom on, OpenStreetMap tiles are shown except over the masked sea areas.
export const PROVIDER_LABEL_MIN_ZOOM = 8;

// [south, west, north, east] — open sea of Biển Đông where no provider tile is drawn: provider tiles carry
// foreign names and foreign maritime boundaries around the archipelagos there. The boxes stay clear of the
// Vietnamese coast (≤ 109.5° E), Hainan (≥ 18.2° N), Palawan and Sabah, so no land tile is ever replaced.
/** @type {Array<[number, number, number, number]>} */
export const MASKED_AREAS = [
  [12.0, 110.0, 17.3, 117.5], // central Biển Đông and Hoàng Sa
  [7.1, 109.9, 12.0, 116.0], // southern Biển Đông and Trường Sa
];

/** @type {Array<{ name: string, short: string, province: string, center: [number, number], islands: Array<[string, number, number]> }>} */
export const ARCHIPELAGOS = [
  {
    name: 'Quần đảo Hoàng Sa', short: 'QĐ. Hoàng Sa', province: 'TP. Đà Nẵng', center: [16.45, 112.0],
    islands: [
      ['Đảo Phú Lâm', 16.834, 112.338], ['Đảo Cây', 16.983, 112.262], ['Đảo Linh Côn', 16.667, 112.729],
      ['Đảo Hoàng Sa', 16.533, 111.608], ['Đảo Quang Ảnh', 16.449, 111.508], ['Đảo Duy Mộng', 16.465, 111.741],
      ['Đảo Quang Hòa', 16.442, 111.704], ['Đảo Bạch Quy', 16.058, 111.783], ['Đảo Tri Tôn', 15.783, 111.204],
    ],
  },
  {
    name: 'Quần đảo Trường Sa', short: 'QĐ. Trường Sa', province: 'tỉnh Khánh Hòa', center: [9.6, 114.2],
    islands: [
      ['Đảo Song Tử Tây', 11.429, 114.331], ['Đảo Song Tử Đông', 11.453, 114.297], ['Đảo Thị Tứ', 11.055, 114.284],
      ['Đảo Loại Ta', 10.682, 114.422], ['Đảo Sơn Ca', 10.377, 114.478], ['Đảo Ba Bình', 10.377, 114.365],
      ['Đảo Nam Yết', 10.181, 114.362], ['Đảo Sinh Tồn', 9.886, 114.329], ['Đảo Sinh Tồn Đông', 9.903, 114.563],
      ['Đảo Trường Sa', 8.644, 111.920], ['Đảo An Bang', 7.867, 112.917], ['Đảo Phan Vinh', 8.969, 113.700],
    ],
  },
];

// Overview labels (zoom < 8), drawn by the app because provider labels are off there.
/** @type {Array<[string, number, number, string]>} */
export const REGION_LABELS = [
  ['VIỆT NAM', 14.2, 107.9, 'country'], ['Hà Nội', 21.028, 105.834, 'city'], ['TP. Hồ Chí Minh', 10.776, 106.701, 'city'],
  ['Đà Nẵng', 16.054, 108.202, 'city'], ['Biển Đông', 13.6, 113.6, 'sea'], ['Vịnh Bắc Bộ', 20.2, 107.6, 'sea-small'],
  ['Vịnh Thái Lan', 9.8, 101.8, 'sea-small'], ['LÀO', 19.3, 102.6, 'neighbor'], ['CAMPUCHIA', 12.7, 104.9, 'neighbor'],
  ['THÁI LAN', 15.6, 101.0, 'neighbor'], ['TRUNG QUỐC', 24.6, 108.5, 'neighbor'], ['PHILIPPINES', 15.6, 121.2, 'neighbor'],
  ['MALAYSIA', 4.4, 102.0, 'neighbor'], ['INDONESIA', 0.4, 110.8, 'neighbor'], ['BRUNEI', 4.6, 114.7, 'neighbor'],
];

/** True when an area [south, west, north, east] (e.g. one label tile) touches a masked sea area. */
export const isMaskedArea = (/** @type {[number, number, number, number]} */ [south, west, north, east]) =>
  MASKED_AREAS.some(([s, w, n, e]) => south < n && north > s && west < e && east > w);
