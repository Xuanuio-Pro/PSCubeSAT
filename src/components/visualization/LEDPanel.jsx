import { useTelemetry } from '../../contexts/telemetry-api';
import EvidencePanel from './EvidencePanel';

export default function LEDPanel() {
  const { latest } = useTelemetry();
  return <>
    <section className="card"><div className="card-header"><h3>LED / Serial</h3></div>
      <div className="card-body"><p className="practice-led-state">{latest?.ledOn == null ? '— Chờ trạng thái LED' : latest.ledOn ? '🟢 LED: Bật' : '⚫ LED: Tắt'}</p>
      </div></section>
    <EvidencePanel group="serial" title="Phản hồi Serial / Echo" />
  </>;
}
