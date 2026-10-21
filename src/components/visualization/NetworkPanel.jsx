import EvidencePanel from './EvidencePanel';
import { useTelemetry } from '../../contexts/telemetry-api';

export default function NetworkPanel() {
  const { activity } = useTelemetry();
  const events = activity.events.filter(event => event.group === 'network').slice().reverse();
  const ipReport = events.find(event => event.text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/));
  const ip = ipReport?.text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];
  const validIp = ip && ip.split('.').every(octet => Number(octet) <= 255);
  const clients = events.find(event => /Số lượng thiết bị đang kết nối\s*:\s*\d+/i.test(event.text));
  return <>
    <section className="card"><div className="card-header"><h3>Thông tin mạng ESP</h3></div><div className="card-body practice-evidence-grid">
      <article className="practice-evidence"><strong>IP được báo gần nhất</strong><b>{validIp ? ip : '—'}</b><span>{validIp ? new Date(ipReport.at).toLocaleTimeString() : 'Chờ IP từ firmware'}</span></article>
      <article className="practice-evidence"><strong>Client AP được báo gần nhất</strong><b>{clients ? /:\s*(\d+)/.exec(clients.text)?.[1] ?? '—' : '—'}</b><span>{clients ? new Date(clients.at).toLocaleTimeString() : 'Chờ số client từ firmware'}</span></article>
    </div></section>
    <EvidencePanel group="network" title="WiFi / Web server" />
  </>;
}
