import { lazy, Suspense } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';
import { practiceProfile } from '../../telemetry/practice';
import './practice.css';

const GROUPS = { system: 'Hệ thống', sensor: 'Cảm biến', camera: 'Camera / SD', storage: 'Lưu trữ', network: 'WiFi / MQTT', radio: 'LoRa', gps: 'GPS', mux: 'Chuyển mạch UART', power: 'Nguồn / Sleep', alert: 'Cảnh báo từ firmware', led: 'LED', 'raw-imu': 'Thanh ghi IMU' };
const PHASES = { start: 'Bắt đầu', done: 'Hoàn tất', sample: 'Nhận dữ liệu', saved: 'Đã lưu', waiting: 'Chờ xác nhận', recovered: 'Firmware báo hết điều kiện cảnh báo', error: 'Báo lỗi', sent: 'Đã yêu cầu gửi · chưa có ACK', requested: 'Yêu cầu ghi log · chưa xác nhận ghi SD', received: 'Nhận qua radio', reported: 'Thiết bị báo cáo', ok: 'Đã phản hồi', registered: 'Đã đăng ký với Scheduler', boot: 'Đã khởi động' };
const time = at => new Date(at).toLocaleTimeString();
const TaskTimeline = lazy(() => import('./TaskTimeline'));
// Task cards. Lab3-03: TelemGen/SysDiag ("TELEM:" / "DIAG:" lines); Lab3-05: Dispatcher ("Event:" lines).
// Sensor/Network/LED only appear for older firmware logs.
const TASK_CARDS = {
  TelemGen: { title: 'Viễn trắc giả lập · minh họa', unit: 'gói', detail: task => task?.value != null ? `${task.value.toFixed(1)} °C · số giả lập trong code` : 'Chờ log TELEM' },
  SysDiag: { title: 'Tự chẩn đoán · Core 0', unit: 'lần chạy', detail: task => task?.durationMs != null ? `Thời gian quan sát: ${task.durationMs} ms` : task ? 'Mỗi dòng DIAG là một lần chạy (heap, tần số CPU)' : 'Chờ log DIAG' },
  Dispatcher: { title: 'Dispatcher · hàng đợi sự kiện', unit: 'sự kiện', detail: task => !task ? 'Chờ log Event: (nhấn nút GPIO 4 hoặc gửi một ký tự)'
    : task.illustrative ? 'Sự kiện cuối: cảnh báo nhiệt độ giả lập' : 'Sự kiện cuối: nút nhấn hoặc lệnh Serial' },
  Sensor: { title: 'Đọc cảm biến · minh họa', unit: 'lần đọc', detail: task => task?.value != null ? `${task.value.toFixed(1)} °C · giá trị mẫu trong code` : 'Chờ log [Sensor]' },
  Heartbeat: { title: 'Heartbeat LED', unit: 'lần chạy', detail: () => 'LED nhịp tim nháy theo chu kỳ; sketch không in log cho task này.' },
  Network: { title: 'Gửi mạng · minh họa', unit: 'lần hoàn tất', detail: task => task?.durationMs != null ? `Thời gian quan sát: ${task.durationMs} ms` : 'Chờ cặp log bắt đầu / hoàn tất' },
};

/** @param {{ exclude?: string[] }} props Evidence groups already shown by a dedicated panel. */
export default function PracticeActivity({ exclude = [] }) {
  const { exerciseId, activity, now, mode, link } = useTelemetry();
  const profile = practiceProfile(exerciseId);
  const queue = profile.id.startsWith('Lab3-05');
  const events = activity.events.filter(event => event.group === 'task');
  const tasks = queue ? ['Dispatcher'] : ['TelemGen', 'SysDiag', ...['Heartbeat', 'Sensor', 'Network'].filter(name => activity.tasks[name])];
  // Declared period ("Scheduler: Đã đăng ký task") against the gaps actually observed between log lines.
  const measured = name => {
    const at = events.filter(event => event.name === name && event.phase === 'sample').slice(-6).map(event => event.at);
    return at.length > 1 ? Math.round((at.at(-1) - at[0]) / (at.length - 1)) : null;
  };
  const showTasks = profile.scheduler || queue;
  const recent = activity.lastLineAt !== null && now - activity.lastLineAt <= 5000;
  const live = mode === 'serial' && link === 'connected' && recent;
  const evidence = Object.entries(activity.subsystems).filter(([group, event]) => !exclude.includes(group) && (['alert', 'power', 'radio', 'mux'].includes(group) || event.phase === 'error'));
  if (!showTasks && evidence.length === 0) return null;
  return <section className="card practice-activity" aria-label="Kết quả thực hành">
    <div className="card-header"><h3>{profile.scheduler ? 'Tác vụ chạy đồng thời' : queue ? 'Hàng đợi sự kiện FreeRTOS' : 'Kết quả thực hành'}</h3><span className={`practice-stream ${live ? 'is-live' : ''}`}>{mode !== 'serial' ? 'Nguồn dữ liệu khác USB' : live ? 'Đang nhận Serial' : link !== 'connected' ? 'Serial đã ngắt' : 'Chờ log Serial'}</span></div>
    <div className="card-body">
      {showTasks && <>
        <div className="practice-task-grid">
          {tasks.map(name => {
            const task = activity.tasks[name];
            const fresh = live && task && now - task.at <= 5000;
            return <article className="practice-task" key={name}>
              <div><strong>{TASK_CARDS[name].title}</strong><span className={fresh ? 'practice-live-dot' : 'practice-muted-dot'} /></div>
              <b>{task?.count ?? 0} <small>{TASK_CARDS[name].unit}</small></b>
              <span>{task ? PHASES[task.phase] ?? 'Có log' : 'Chưa quan sát'}</span>
              {task && <span>Lần cuối {time(task.at)}{!fresh && ' · đã cũ / ngắt kết nối'}</span>}
              <span>{TASK_CARDS[name].detail(task)}</span>
              {task?.periodMs != null && <span>Khai báo: {task.periodMs} ms · Core {task.core} · Priority {task.priority}{measured(name) != null && ` · đo được ~${measured(name)} ms`}</span>}
            </article>;
          })}
          {activity.tasks.LED && <article className="practice-task"><div><strong>LED · GPIO</strong><span className={live && now - activity.tasks.LED.at <= 5000 ? 'practice-live-dot' : 'practice-muted-dot'} /></div><b>{activity.tasks.LED.count}</b><span>{`Lệnh cuối: ${activity.tasks.LED.value ? 'Bật' : 'Tắt'} · ${time(activity.tasks.LED.at)}`}</span></article>}
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
