export const PANEL_LABELS = {
  voltage: 'Điện áp pin', environment: 'Môi trường', attitude: 'Tư thế 3D',
  gps: 'Định vị GPS', camera: 'Camera', system: 'System Check',
  network: 'WiFi / Web server', storage: 'Lưu trữ SD', radio: 'Liên lạc LoRa',
  anomaly: 'Phát hiện sự cố', commands: 'Bảng lệnh', groundStation: 'Trạm mặt đất', dashboard: 'Dashboard tùy biến',
  lab1Connection: 'Kết nối WiFi', lab1Io: 'Trạng thái LED / nút', shell: 'Kết quả lệnh',
};

// Subsystems each full-satellite sketch actually exercises; the rest would only ever show "no evidence".
export const SYSTEM_ROWS = {
  'Lab7-01': ['sensor', 'gps', 'eps', 'storage', 'radio'],
  // Lab7-02 (PTITCube 2026-11-24) has no WiFi/MQTT: commands and telemetry go over LoRa.
  'Lab7-02': ['sensor', 'gps', 'eps', 'storage', 'radio'],
};

export function visualizationPlan(profile) {
  const panels = [...profile.panels];
  // Lab1-07 LED commands are typed in the Serial Monitor; the lab shows no extra panels.
  if (profile.commands.length && profile.lab !== 1 && !panels.includes('commands')) panels.push('commands');
  return { panels, systemRows: SYSTEM_ROWS[profile.id.slice(0, 7)] ?? [] };
}
