// Only device-origin network events reach this reducer through the Serial decoder.
/**
 * @param {{ip?: string|null, clients?: number|null, server?: boolean, error?: boolean}} previous
 * @param {{text: string, phase: string}} event
 */
export function reduceNetworkReport(previous = {}, event) {
  const report = { ...previous };
  const text = event.text.trim();
  if (event.phase === 'error') return { ip: null, clients: null, server: false, error: true };
  if (/wifi connected|ap ip address|http server started/i.test(text)) report.error = false;
  if (/http server started/i.test(text)) report.server = true;
  if (/wifi connected/i.test(text)) report.ip = null;
  const address = /^(?:(?:AP )?IP address:\s*)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(text)?.[1];
  if (address) {
    const octets = address.split('.').map(Number);
    if (octets.every(value => value <= 255) && octets[0] > 0 && octets[0] < 224) {
      report.ip = address; report.error = false;
    }
  }
  const clients = /Số lượng thiết bị đang kết nối\s*:\s*(\d+)$/i.exec(text);
  if (clients) report.clients = Number(clients[1]);
  return report;
}
