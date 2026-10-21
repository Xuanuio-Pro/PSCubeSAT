import { useTelemetry } from '../../contexts/telemetry-api';

/** A bounded record of device reports, never a synthetic subsystem health check. */
export default function EvidencePanel({ group, title }) {
  const { activity, mode, link, now } = useTelemetry();
  const events = activity.events.filter(event => event.group === group).slice(-16).reverse();
  const fresh = mode === 'serial' && link === 'connected' && events[0] && now - events[0].at <= 5000;
  return <section className="card">
    <div className="card-header"><h3>{title}</h3><span>{fresh ? 'Có phản hồi mới' : 'Chờ phản hồi mới'}</span></div>
    <div className="card-body">
      {events.length ? <ol className="practice-report-list">{events.map((event, index) => <li key={`${event.at}:${index}`}>
        <time>{new Date(event.at).toLocaleTimeString()}</time> <strong>{event.phase === 'error' ? 'Lỗi · ' : event.phase === 'requested' ? 'Yêu cầu · ' : ''}</strong>
        <code>{event.text}</code>
      </li>)}</ol> : <p className="telemetry-empty">Chờ phản hồi thiết bị</p>}
    </div>
  </section>;
}
