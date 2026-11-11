import { useTelemetry } from '../../contexts/telemetry-api';
import './practice.css';

const KIND = { sent: { label: 'TX', className: 'is-tx' }, received: { label: 'RX', className: 'is-rx' }, error: { label: 'Lỗi', className: 'is-error' } };
const time = at => new Date(at).toLocaleTimeString();

/** LoRa link as the OBC Serial log reports it: a TX line is a send request, never proof of reception. */
export default function RadioPanel() {
  const { activity, now, mode, link } = useTelemetry();
  const events = activity.events.filter(event => event.group === 'radio');
  const count = phase => events.filter(event => event.phase === phase).length;
  const sent = events.filter(event => event.phase === 'sent');
  const lastOf = phase => events.findLast(event => event.phase === phase);
  const gaps = sent.slice(-6).map((event, index, list) => index ? event.at - list[index - 1].at : null).filter(Boolean);
  const interval = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 1000 : null;
  const live = mode === 'serial' && link === 'connected' && events.length > 0 && now - events.at(-1).at <= 5000;
  const tiles = [
    { label: 'Đã phát (TX)', value: count('sent'), detail: interval ? `~${interval.toFixed(1)} s/gói` : 'Chưa đủ 2 gói' },
    { label: 'Đã nhận (RX)', value: count('received'), detail: lastOf('received') ? time(lastOf('received').at) : 'Chưa nhận' },
    { label: 'Lỗi radio', value: count('error'), detail: lastOf('error') ? time(lastOf('error').at) : 'Không có' },
  ];
  return <section className="card">
    <div className="card-header"><h3>📡 Liên lạc LoRa</h3><span className={`practice-stream ${live ? 'is-live' : ''}`}>{live ? 'Có log radio mới' : 'Chờ log radio'}</span></div>
    <div className="card-body">
      <div className="radio-tiles">{tiles.map(tile => <article key={tile.label} className="practice-task">
        <strong>{tile.label}</strong><b>{tile.value}</b><span>{tile.detail}</span>
      </article>)}</div>
      <p className="practice-note">TX chỉ là yêu cầu phát tại OBC; chỉ dòng RX ở đầu thu mới xác nhận gói đã tới.</p>
      {events.length ? <ol className="radio-log">{events.slice(-12).reverse().map((event, index) => <li key={`${event.at}:${index}`}>
        <span className={`radio-kind ${KIND[event.phase]?.className ?? ''}`}>{KIND[event.phase]?.label ?? event.phase}</span>
        <time>{time(event.at)}</time><code>{event.text}</code>
      </li>)}</ol> : <p className="telemetry-empty">Chờ log TX/RX từ thiết bị</p>}
    </div>
  </section>;
}
