import { useTelemetry } from '../../contexts/telemetry-api';

export default function Lab1ConnectionNotice() {
  const { activity, exerciseId, mode, link } = useTelemetry();
  const report = activity.subsystems.network?.report;
  const ap = exerciseId.startsWith('Lab1-05');
  const web = exerciseId.startsWith('Lab1-06');
  const connected = mode === 'serial' && link === 'connected';
  if (!connected || !report?.ip || report.error) return null;
  return <section role="status" className="lab1-connection-notice">
    <div>{ap ? 'WiFi AP started.' : 'WiFi connected.'}</div>
    <div>IP address: {web && report.server
      ? <a href={`http://${report.ip}/`} target="_blank" rel="noopener noreferrer">{report.ip}</a>
      : <strong>{report.ip}</strong>}</div>
    {ap && report.clients != null && <div>Thiết bị đang kết nối: {report.clients}</div>}
    {web && report.server && <div>HTTP server started.</div>}
  </section>;
}
