import { useTelemetry } from '../../contexts/telemetry-api';
import './practice.css';

/** Opens the ground-station window: a second Serial port next to the OBC's port used by this lab. */
export default function GroundStationLink() {
  const { exerciseId } = useTelemetry();
  // The lesson tells the ground-station window which widgets to mirror and how to read the downlink.
  const open = () => { window.open(`/groundstation${exerciseId ? `?lesson=${encodeURIComponent(exerciseId)}` : ''}`, 'ptit-groundstation', 'popup=yes,width=1100,height=860'); };
  return <section className="card">
    <div className="card-header"><h3>🛰️ Trạm mặt đất</h3></div>
    <div className="card-body">
      <p className="practice-note">Bài này dùng <strong>hai cổng USB</strong>: cổng vệ tinh (OBC) ở cửa sổ này và cổng USB-TTL của trạm mặt đất ở cửa sổ riêng.
        Gửi lệnh uplink và theo dõi gói nhận được tại trạm mặt đất, rồi đối chiếu với dòng RX hiển thị ở đây.</p>
      <button type="button" className="btn btn-primary" onClick={open}>🔗 Mở cửa sổ Trạm mặt đất</button>
    </div>
  </section>;
}
