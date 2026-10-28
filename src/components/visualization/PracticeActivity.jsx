import { lazy, Suspense } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';
import { practiceProfile } from '../../telemetry/practice';
import './practice.css';

const GROUPS = { system: 'Hệ thống', sensor: 'Cảm biến', camera: 'Camera / SD', storage: 'Lưu trữ', network: 'WiFi / MQTT', radio: 'LoRa', gps: 'GPS', mux: 'Chuyển mạch UART', power: 'Nguồn / Sleep', alert: 'Cảnh báo từ firmware', led: 'LED', 'raw-imu': 'Thanh ghi IMU' };
const PHASES = { start: 'Bắt đầu', done: 'Hoàn tất', sample: 'Nhận dữ liệu', saved: 'Đã lưu', waiting: 'Chờ xác nhận', recovered: 'Firmware báo hết điều kiện cảnh báo', error: 'Báo lỗi', sent: 'Đã yêu cầu gửi · chưa có ACK', requested: 'Yêu cầu ghi log · chưa xác nhận ghi SD', received: 'Nhận qua radio', reported: 'Thiết bị báo cáo', ok: 'Đã phản hồi' };
const time = at => new Date(at).toLocaleTimeString();
const TaskTimeline = lazy(() => import('./TaskTimeline'));

/** @param {{ exclude?: string[] }} props Evidence groups already shown by a dedicated panel. */
export default function PracticeActivity({ exclude = [] }) {
  const { exerciseId, activity, now, mode, link } = useTelemetry();
  const profile = practiceProfile(exerciseId);
  const tasks = ['Sensor', 'Network'];
  const events = activity.events.filter(event => event.group === 'task');
  const recent = activity.lastLineAt !== null && now - activity.lastLineAt <= 5000;
  const live = mode === 'serial' && link === 'connected' && recent;
  const evidence = Object.entries(activity.subsystems).filter(([group, event]) => !exclude.includes(group) && (['alert', 'power', 'radio', 'mux'].includes(group) || event.phase === 'error'));
  if (!profile.scheduler && evidence.length === 0) return null;
  return <section className="card practice-activity" aria-label="Kết quả thực hành">
    <div className="card-header"><h3>{profile.scheduler ? 'Tác vụ chạy đồng thời' : 'Kết quả thực hành'}</h3><span className={`practice-stream ${live ? 'is-live' : ''}`}>{mode !== 'serial' ? 'Nguồn dữ liệu khác USB' : live ? 'Đang nhận Serial' : link !== 'connected' ? 'Serial đã ngắt' : 'Chờ log Serial'}</span></div>
    <div className="card-body">
      {profile.scheduler && <>
        <div className="practice-task-grid">
          {tasks.map(name => {
            const task = activity.tasks[name];
            const fresh = live && task && now - task.at <= 5000;
            return <article className="practice-task" key={name}>
              <div><strong>{name === 'Sensor' ? 'Đọc cảm biến · minh họa' : 'Gửi mạng · minh họa'}</strong><span className={fresh ? 'practice-live-dot' : 'practice-muted-dot'} /></div>
              <b>{task?.count ?? 0} <small>{name === 'Sensor' ? 'lần đọc' : 'lần hoàn tất'}</small></b>
              <span>{task ? PHASES[task.phase] ?? 'Có log' : 'Chưa quan sát'}</span>
              {task && <span>Lần cuối {time(task.at)}{!fresh && ' · đã cũ / ngắt kết nối'}</span>}
              {name === 'Sensor' && <span>{task?.value != null ? `${task.value.toFixed(1)} °C · giá trị mẫu trong code` : 'Chờ log [Sensor]'}</span>}
              {name === 'Network' && <span>{task?.durationMs != null ? `Thời gian quan sát: ${task.durationMs} ms` : 'Chờ cặp log bắt đầu / hoàn tất'}</span>}
            </article>;
          })}
          <article className="practice-task"><div><strong>LED · GPIO</strong><span className={live && activity.tasks.LED && now - activity.tasks.LED.at <= 5000 ? 'practice-live-dot' : 'practice-muted-dot'} /></div><b>{activity.tasks.LED?.count ?? '—'}</b><span>{activity.tasks.LED ? `Lệnh cuối: ${activity.tasks.LED.value ? 'Bật' : 'Tắt'} · ${time(activity.tasks.LED.at)}` : 'Chưa nhận log LED.'}</span></article>
        </div>
        {events.length ? <Suspense fallback={<p>Đang tải dòng thời gian…</p>}><TaskTimeline events={events} /></Suspense> : <p className="telemetry-empty">Chờ log tác vụ để vẽ dòng thời gian.</p>}
      </>}
      {evidence.length > 0 && <div className="practice-evidence-grid">
        {evidence.map(([group, event]) => <article key={group} className={`practice-evidence practice-evidence--${event.phase}`}>
          <strong>{GROUPS[group] ?? group}</strong><span>{PHASES[event.phase] ?? event.phase} · {time(event.at)}</span>
          <p>{event.text}</p>
        </article>)}
      </div>}
    </div>
  </section>;
}
