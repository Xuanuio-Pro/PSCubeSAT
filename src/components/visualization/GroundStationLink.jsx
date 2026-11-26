import { useTelemetry } from '../../contexts/telemetry-api';
import './practice.css';

// What the student does in the ground-station window for each lesson.
function task(exerciseId) {
  if (/^Lab5-01/.test(exerciseId)) return 'Theo dõi gói downlink "PACKET #n" mà trạm mặt đất thu được qua LoRa, rồi đối chiếu với dòng TX hiển thị ở đây (số gói mất được tính từ số thứ tự).';
  if (/^Lab8-/.test(exerciseId)) return 'Gửi lệnh nhiệm vụ và xem dữ liệu nhiệm vụ thu qua LoRa (dashboard tại trạm mặt đất chỉ dùng dữ liệu thu được).';
  if (/^Lab7-/.test(exerciseId)) return 'Gửi lệnh một ký tự (a, b, c, d, e, f, p, r) và xem các bảng trực quan dựng lại từ dữ liệu downlink thu qua LoRa.';
  return 'Gửi lệnh uplink và theo dõi gói nhận được tại trạm mặt đất, rồi đối chiếu với dòng RX hiển thị ở đây.';
}

/** Opens the ground-station window: a second Serial port next to the OBC's port used by this lab. */
export default function GroundStationLink() {
  const { exerciseId } = useTelemetry();
  // The lesson tells the ground-station window which widgets to mirror and how to read the downlink.
  const open = () => { window.open(`/groundstation${exerciseId ? `?lesson=${encodeURIComponent(exerciseId)}` : ''}`, 'ptit-groundstation', 'popup=yes,width=1100,height=860'); };
  return <section className="card">
    <div className="card-header"><h3>🛰️ Trạm mặt đất</h3></div>
    <div className="card-body">
      <p className="practice-note">Bài này dùng <strong>hai cổng USB</strong>: cổng vệ tinh (OBC) ở cửa sổ này và cổng USB-TTL của trạm mặt đất ở cửa sổ riêng.
        {task(exerciseId)}</p>
      <button type="button" className="btn btn-primary" onClick={open}>🔗 Mở cửa sổ Trạm mặt đất</button>
    </div>
  </section>;
}
