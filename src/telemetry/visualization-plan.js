// Preserve the original lab blocks; the exercise profile adds specialized capabilities.
export const ORIGINAL_LAB_PANELS = {
  1: [], 2: ['voltage'], 3: [],
  4: ['attitude', 'gps', 'camera', 'environment'],
  5: ['telemetry', 'commands'], 6: ['system'],
  7: ['attitude', 'gps', 'voltage'], 8: ['dashboard'],
};

export const PANEL_LABELS = {
  voltage: 'Điện áp pin', environment: 'Môi trường', attitude: 'Tư thế 3D',
  gps: 'Định vị GPS', camera: 'Camera', telemetry: 'Telemetry', system: 'System Check',
  rawImu: 'Thanh ghi IMU', network: 'WiFi / Web server', storage: 'Lưu trữ SD',
  led: 'LED / Serial', commands: 'Bảng lệnh', dashboard: 'Dashboard tùy biến',
  lab1Connection: 'Kết nối WiFi',
};

export function visualizationPlan(profile) {
  if (profile.lab === 1) {
    const panels = /^Lab1-0[456]/.test(profile.id) ? ['lab1Connection'] : [];
    return { panels, required: panels };
  }
  const required = [...profile.panels];
  if (profile.lab === 3 || profile.lab === 7) required.push('storage');
  if (profile.id.startsWith('Lab7-03')) required.push('network');
  const panels = [...new Set([...(ORIGINAL_LAB_PANELS[profile.lab] ?? []), ...required])];
  if (profile.commands.length) panels.push('commands');
  return { panels: [...new Set(panels)], required: [...new Set(required)] };
}
