import { useTelemetry } from '../../contexts/telemetry-api';
import { SUBSYSTEMS, subsystemStatus } from '../../telemetry/system-check';

const PHASES = { saved: 'Đã ghi', reported: 'Báo cáo', error: 'Lỗi', sent: 'TX', received: 'RX', waiting: 'Chờ', sample: 'Dữ liệu' };
const time = at => new Date(at).toLocaleTimeString();
const STATE_LABEL = { active: 'Active', inactive: 'Inactive', error: 'Lỗi' };

/** @param {{ rows?: string[] }} props Subsystem ids the current sketch exercises. */
export default function SystemCheck({ rows = SUBSYSTEMS.map(sys => sys.id) }) {
  const telemetry = useTelemetry();
  const { latest } = telemetry;
  return <section className="card">
    <div className="card-header"><h3>System Check · Phản hồi các phân hệ</h3></div>
    <div className="card-body">
      <div className="system-check-grid">{SUBSYSTEMS.filter(sys => rows.includes(sys.id)).map(sys => {
        const { state, lastAt, lastEvent, log } = subsystemStatus(sys, telemetry);
        const count = sys.keys.filter(key => latest?.[key] != null).length;
        const detail = !lastAt ? 'Chưa có phản hồi từ thiết bị'
          : [count ? `${count}/${sys.keys.length} trường có dữ liệu` : lastEvent?.text, `cập nhật ${time(lastAt)}`].filter(Boolean).join(' · ');
        return <div key={sys.id} className={`check-item${sys.log ? ' check-item--log' : ''}`}>
          <div className="check-row">
            <div className={`check-status ${state === 'active' ? 'ok' : state}`} />
            <div className="check-info"><div className="check-name">{sys.name}</div><div className="check-detail" title={detail}>{detail}</div></div>
            <span className={`check-badge is-${state}`}>{STATE_LABEL[state]}</span>
          </div>
          {sys.log && (log.length ? <ol className="check-log">{log.map((event, index) => <li key={`${event.at}:${index}`}>
            <time>{time(event.at)}</time><span className={`check-log-phase${event.phase === 'error' ? ' is-error' : ''}`}>{PHASES[event.phase] ?? event.phase}</span><code>{event.text}</code>
          </li>)}</ol> : <p className="check-log-empty">Chưa có log</p>)}
        </div>;
      })}</div>
    </div>
  </section>;
}
