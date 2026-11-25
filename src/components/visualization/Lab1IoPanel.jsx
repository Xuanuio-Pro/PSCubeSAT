import { useTelemetry } from '../../contexts/telemetry-api';
import './practice.css';

const time = at => new Date(at).toLocaleTimeString();

/** LED / button state as the Lab 1 sketch reports it. A log line is the sketch's own report, not an electrical readback. */
export default function Lab1IoPanel() {
  const { activity, exerciseId, mode, link } = useTelemetry();
  const button = /^Lab1-04_Button/.test(exerciseId ?? '');
  const group = button ? 'button' : 'led';
  const events = activity.events.filter(event => event.group === group);
  const last = events.at(-1);
  const connected = mode === 'serial' && link === 'connected';
  const on = last?.value === true;
  const label = button ? 'Nút nhấn (GPIO 4)' : 'LED';
  const state = !last ? 'Chưa có log' : button ? (on ? 'Đang nhấn' : 'Đã nhả') : (on ? 'Sáng' : 'Tắt');
  const presses = events.filter(event => event.value === true).length;
  return <section className="card">
    <div className="card-header"><h3>💡 Trạng thái {label}</h3><span className={`practice-stream ${connected && last ? 'is-live' : ''}`}>{connected ? 'Đang đọc Serial' : 'Chưa kết nối'}</span></div>
    <div className="card-body">
      <div className="radio-tiles">
        <article className="practice-task">
          <strong>{label}</strong>
          <div><span className={on ? 'practice-live-dot' : 'practice-muted-dot'} aria-hidden="true" /><b className="practice-led-state">{state}</b></div>
          <span>{last ? `Cập nhật ${time(last.at)}` : 'Chờ dòng log đầu tiên'}</span>
        </article>
        <article className="practice-task">
          <strong>{button ? 'Số lần nhấn' : 'Số lần bật'}</strong><b>{presses}</b>
          <span>{events.length} lần đổi trạng thái (trong 120 log gần nhất)</span>
        </article>
      </div>
      <p className="practice-panel-hint">Trạng thái lấy từ dòng log của sketch ({button ? 'BUTTON: Pressed/Released' : 'LED ON/OFF'}). Lab 1 chạy trên PCB thí nghiệm rời; nếu cắm trên chồng bo vệ tinh, GPIO 4 là chân Buck và nút luôn báo đang nhấn.</p>
    </div>
  </section>;
}
