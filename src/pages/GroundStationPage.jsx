import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSerial } from '../contexts/serial-api';
import SerialMonitor from '../components/serial/SerialMonitor';
import { PracticePanels } from '../components/visualization/PracticeVisualization';
import { useTelemetry } from '../contexts/telemetry-api';
import { practiceProfile } from '../telemetry/practice';
import { visualizationPlan } from '../telemetry/visualization-plan';
import { countPacket, emptyPackets, lostPackets } from '../telemetry/downlink';

// Command set understood by the Lab5-03 satellite firmware. Lab5-02 only prints whatever text it receives.
const SATELLITE_COMMANDS = [
  { cmd: 'ping', label: '🏓 ping', desc: 'Kiểm tra đường truyền' },
  { cmd: 'battery', label: '🔋 battery', desc: 'Điện áp pin' },
  { cmd: 'sensor', label: '🔬 sensor', desc: 'Nhiệt độ, áp suất' },
  { cmd: 'imu', label: '🧭 imu', desc: 'Gia tốc, con quay' },
  { cmd: 'gps', label: '🌍 gps', desc: 'Tọa độ' },
  { cmd: 'led on', label: '💡 led on', desc: 'Bật LED trên OBC' },
  { cmd: 'led off', label: '🌑 led off', desc: 'Tắt LED trên OBC' },
  { cmd: 'telemetry', label: '📦 telemetry', desc: 'Gói JSON trạng thái' },
];
// Lab7-01/02 firmware: one-letter commands received over LoRa (switch in the sketch's command handler).
const LAB7_COMMANDS = [
  { cmd: 'a', label: '📶 a · ACK', desc: 'Kiểm tra đường truyền' },
  { cmd: 'b', label: '🔋 b · pin → SD', desc: 'Ghi và đọc lại điện áp/dung lượng pin trên thẻ SD' },
  { cmd: 'c', label: '🧭 c · gia tốc', desc: 'Gia tốc kế' },
  { cmd: 'd', label: '🌀 d · con quay', desc: 'Con quay hồi chuyển' },
  { cmd: 'e', label: '🌍 e · GPS', desc: 'Tọa độ GPS' },
  { cmd: 'f', label: '📷 f · chụp ảnh', desc: 'Chụp ảnh lưu thẻ SD' },
  { cmd: 'p', label: '⏸ p · tạm dừng', desc: 'Tạm dừng viễn trắc định kỳ' },
  { cmd: 'r', label: '▶ r · tiếp tục', desc: 'Tiếp tục viễn trắc định kỳ' },
];
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];
const REPLY_WINDOW_MS = 10000;
const time = at => new Date(at).toLocaleTimeString();
const emptyStats = { tx: 0, rx: 0, lastRxAt: null, lastRxText: '', ...emptyPackets };
// Uplink buttons and hint per lab; Lab8 missions define their own commands, so only free text is offered.
const UPLINK = {
  5: { commands: SATELLITE_COMMANDS, note: 'Lab 5.2 chỉ in lại bản tin nhận được trên Serial của vệ tinh; Lab 5.3 mới thực thi các lệnh dưới đây và phản hồi qua LoRa.' },
  7: { commands: LAB7_COMMANDS, note: 'Lab 7 nhận lệnh một ký tự qua LoRa; phản hồi và gói viễn trắc hiện ở các bảng bên dưới.' },
  8: { commands: [], note: 'Nhập lệnh theo nhiệm vụ bạn tự thiết kế trong Lab 8.' },
};

/**
 * Ground station window. It owns its own Web Serial port (USB-TTL wired to the ground LoRa module), so the
 * satellite's USB port can stay open in the lab window. "Đã ghi vào USB-TTL" is not delivery to the satellite:
 * only a line sent back by the satellite proves the uplink worked.
 */
export default function GroundStationPage() {
  const { isConnected, isConnecting, connect, disconnect, send, subscribe, sessionId, serialSupport } = useSerial();
  const [baudRate, setBaudRate] = useState(9600);
  const [customCmd, setCustomCmd] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const { exerciseId } = useTelemetry();
  const profile = practiceProfile(exerciseId);
  const plan = visualizationPlan(profile);
  // Lab 7/8: the same widgets as the lab window, fed only by what this ground station received over LoRa.
  const mirrored = profile.lab === 7 || profile.lab === 8 ? plan.panels.filter(name => name !== 'groundStation') : [];
  const downlinkOnly = /^Lab5-01/.test(exerciseId);
  const { commands, note: commandNote } = UPLINK[profile.lab] ?? UPLINK[5];
  const lost = lostPackets(stats);

  useEffect(() => { document.title = 'Trạm mặt đất · PTIT CubeSat'; }, []);
  useEffect(() => { setStats(emptyStats); setHistory([]); }, [sessionId]);
  // Totals are counted from the live stream, not from the bounded monitor buffer.
  useEffect(() => subscribe(entry => {
    if (entry.type === 'tx') setStats(current => ({ ...current, tx: current.tx + 1 }));
    if (entry.type !== 'rx' || entry.origin !== 'serial') return;
    setStats(current => countPacket({ ...current, rx: current.rx + 1, lastRxAt: entry.receivedAt, lastRxText: entry.text.slice(0, 300) }, entry.text));
    setHistory(current => {
      const index = current.findIndex(item => item.ok && !item.reply && entry.receivedAt - item.at <= REPLY_WINDOW_MS);
      return index < 0 ? current : current.map((item, i) => i === index ? { ...item, reply: entry.text.slice(0, 300), replyAt: entry.receivedAt } : item);
    });
  }), [subscribe]);

  const canSend = isConnected && !sending;
  const sendCommand = async command => {
    if (!canSend || !command.trim()) return false;
    setSending(true);
    let ok = false;
    try { ok = await send(command.trim()); } catch { ok = false; } finally { setSending(false); }
    setHistory(current => [{ id: `${Date.now()}:${current.length}`, cmd: command.trim(), at: Date.now(), ok, reply: '', replyAt: null }, ...current].slice(0, 30));
    return ok;
  };
  const sendCustom = async () => {
    const command = customCmd.trim();
    if (await sendCommand(command)) setCustomCmd(current => current.trim() === command ? '' : current);
  };

  return <div className="groundstation-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 40px', display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ margin: 0 }}>📡 Trạm mặt đất (Ground Station)</h1>
      <p className="practice-note" style={{ marginTop: 12 }}>
        Cửa sổ này kết nối với mạch <strong>USB-TTL nối module LoRa của trạm mặt đất</strong>. Cửa sổ bài thực hành kết nối riêng với <strong>vệ tinh (OBC ESP32)</strong>;
        hãy cắm hai cổng USB khác nhau và để cả hai cửa sổ cùng mở. Đóng cửa sổ này sẽ ngắt cổng trạm mặt đất.
        {' '}<Link to="/">Về trang chủ</Link>
      </p>
    </header>

    <section className="card">
      <div className="card-header"><h3>🔌 Kết nối trạm mặt đất</h3>
        <span className={`practice-stream ${isConnected ? 'is-live' : ''}`}>{isConnected ? 'Đã kết nối USB-TTL' : 'Chưa kết nối'}</span></div>
      <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>Baud rate: <select aria-label="Baud rate cổng trạm mặt đất" value={baudRate} disabled={isConnected || isConnecting} onChange={event => setBaudRate(Number(event.target.value))}>
          {BAUD_RATES.map(rate => <option key={rate} value={rate}>{rate}</option>)}
        </select></label>
        {isConnected
          ? <button type="button" className="btn btn-sm btn-outline" onClick={() => disconnect()}>Ngắt kết nối</button>
          : <button type="button" className="btn btn-sm btn-primary" disabled={isConnecting || !serialSupport.available} onClick={() => connect(baudRate)}>{isConnecting ? 'Đang kết nối…' : '🔗 Kết nối trạm mặt đất'}</button>}
        <small style={{ color: 'var(--text-muted)' }}>Module LoRa E32 mặc định dùng 9600 baud. Nếu đã cấu hình khác, hãy chọn đúng tốc độ.</small>
        {!serialSupport.available && <p role="status" style={{ width: '100%', margin: 0, color: 'var(--accent-orange)' }}>{serialSupport.message}</p>}
      </div>
    </section>

    <div className="radio-tiles">
      <article className="practice-task"><strong>Lệnh đã ghi vào USB-TTL</strong><b>{stats.tx}</b><span>Chưa phải đã tới vệ tinh</span></article>
      <article className="practice-task"><strong>Dòng nhận từ vệ tinh (RX)</strong><b>{stats.rx}</b><span>{stats.lastRxAt ? time(stats.lastRxAt) : 'Chưa nhận'}</span></article>
      {downlinkOnly && <article className="practice-task"><strong>Gói PACKET #n nhận được</strong><b>{stats.packets}</b>
        <span>{stats.lastPacket === null ? 'Chưa thấy gói PACKET #n' : `Gói cuối #${stats.lastPacket} · ước tính mất ${lost} gói từ #${stats.firstPacket}`}</span></article>}
    </div>

    {downlinkOnly ? <p className="practice-note">Lab 5.1 chỉ <strong>phát xuống (downlink)</strong>: vệ tinh gửi gói mỗi 2 giây, trạm mặt đất chỉ cần kết nối và nhận. Gửi lệnh uplink bắt đầu từ Lab 5.2.</p>
      : <section className="card">
      <div className="card-header"><h3>🎮 Gửi lệnh lên vệ tinh (Command Uplink)</h3></div>
      <div className="card-body">
        <p className="telemetry-empty" style={{ textAlign: 'left' }}>{commandNote}</p>
        <div className="cmd-btn-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {commands.map(({ cmd, label, desc }) => <button key={cmd} type="button" className="btn btn-sm btn-outline" disabled={!canSend} title={desc} onClick={() => sendCommand(cmd)}>{label}</button>)}
        </div>
        <div className="serial-input-bar" style={{ marginTop: 16, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
          <input type="text" aria-label="Lệnh tùy chỉnh" disabled={!canSend} placeholder="Nhập lệnh gửi lên vệ tinh…" maxLength={200} value={customCmd}
            onChange={event => setCustomCmd(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendCustom()} />
          <button type="button" disabled={!canSend || !customCmd.trim()} onClick={sendCustom}>Gửi ↑</button>
        </div>
        {history.length > 0 && <ol className="radio-log" style={{ marginTop: 16, maxHeight: 240, overflow: 'auto' }}>
          {history.map(item => <li key={item.id}>
            <span className={`radio-kind ${item.ok ? 'is-tx' : 'is-error'}`}>{item.ok ? 'TX' : 'Lỗi'}</span>
            <time>{time(item.at)}</time>
            <code>{item.cmd}</code>
            <span style={{ color: 'var(--text-muted)' }}>
              {!item.ok ? ' · gửi thất bại' : item.reply ? ` · vệ tinh phản hồi (${time(item.replyAt)}): ${item.reply}` : ' · đã ghi vào USB-TTL, chưa có phản hồi'}
            </span>
          </li>)}
        </ol>}
      </div>
    </section>}

    {mirrored.length > 0 && <section className="lab-visual-stack" data-lab={profile.lab} aria-label="Trực quan dữ liệu thu qua LoRa">
      <p className="practice-note">Các bảng dưới đây chỉ dùng dữ liệu mà trạm mặt đất <strong>thu được qua LoRa</strong> (không lấy từ cổng USB của vệ tinh).
        Gói downlink rút gọn nên có thể thiếu một số trường so với cửa sổ bài thực hành.</p>
      <PracticePanels profile={profile} plan={plan} panels={mirrored} />
    </section>}

    <section aria-label="Dữ liệu thu từ vệ tinh">
      <p className="practice-note">Dòng hiển thị là dữ liệu thật mà module LoRa của trạm mặt đất nhận được. Không có dòng nào nghĩa là chưa thu được gì.</p>
      <SerialMonitor height={360} baudRate={baudRate} showConnect />
    </section>
  </div>;
}
