export const PANEL_LABELS = {
  voltage: 'Điện áp pin', environment: 'Môi trường', attitude: 'Tư thế 3D',
  gps: 'Định vị GPS', camera: 'Camera', system: 'System Check',
  network: 'WiFi / Web server', storage: 'Lưu trữ SD', radio: 'Liên lạc LoRa',
  anomaly: 'Phát hiện sự cố', commands: 'Bảng lệnh', dashboard: 'Dashboard tùy biến',
  lab1Connection: 'Kết nối WiFi',
};

// Subsystems each full-satellite sketch actually exercises; the rest would only ever show "no evidence".
export const SYSTEM_ROWS = {
  'Lab7-02': ['sensor', 'gps', 'eps', 'storage', 'radio'],
  'Lab7-03': ['sensor', 'gps', 'eps', 'storage', 'radio', 'network'],
};

export function visualizationPlan(profile) {
  const panels = [...profile.panels];
  // Lab1-03 LED commands are typed in the Serial Monitor; the lab shows no extra panels.
  if (profile.commands.length && profile.lab !== 1 && !panels.includes('commands')) panels.push('commands');
  return { panels, systemRows: SYSTEM_ROWS[profile.id.slice(0, 7)] ?? [] };
}
