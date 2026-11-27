import CloudCompiler from '../serial/CloudCompiler';
import WebFlasher from '../serial/WebFlasher';
import { useSerial } from '../../contexts/serial-api';

export default function LabPracticeActions({ code, labId, classId = undefined, lessonId = undefined, configuredBoard = '' }) {
  const { isConnected, isConnecting, clearLines } = useSerial();

  return (
    <>
      <CloudCompiler code={code} labId={labId} classId={classId} lessonId={lessonId} configuredBoard={configuredBoard} inline showIcon={false} buttonClassName="btn-outline" />
      <WebFlasher code={code} labId={labId} inline showIcon={false} buttonClassName="btn-outline" label="Nạp code" />
      {/* One connect button lives in the device bar above (TelemetryControls); this only shows the state. */}
      <span className={`lab-serial-status${isConnected ? ' is-connected' : ''}`} role="status">
        <span aria-hidden="true" className="lab-serial-status-dot" />
        {isConnecting ? 'Đang kết nối USB…' : isConnected ? 'Đã kết nối USB' : 'Chưa kết nối USB'}
      </span>
      <button type="button" className="btn btn-sm btn-outline" onClick={clearLines} title="Xóa nội dung Serial Monitor">Xóa log</button>
    </>
  );
}
