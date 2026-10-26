import CloudCompiler from '../serial/CloudCompiler';
import WebFlasher from '../serial/WebFlasher';
import { useSerial } from '../../contexts/serial-api';

export default function LabPracticeActions({ code, labId, classId = undefined, lessonId = undefined, configuredBoard = '' }) {
  const { isConnected, isConnecting, isFlashing, connect, disconnect, clearLines, serialSupport } = useSerial();

  return (
    <>
      <CloudCompiler code={code} labId={labId} classId={classId} lessonId={lessonId} configuredBoard={configuredBoard} inline showIcon={false} buttonClassName="btn-outline" />
      <WebFlasher code={code} labId={labId} inline showIcon={false} buttonClassName="btn-outline" label="Nạp code" />
      <button type="button" className="btn btn-sm btn-primary"
        onClick={() => isConnected ? disconnect() : connect()} disabled={isConnecting || isFlashing || (!isConnected && !serialSupport.available)}
        title={isConnected ? 'Nhấn để ngắt kết nối Serial' : !serialSupport.available ? serialSupport.message : 'Kết nối Serial'} aria-pressed={isConnected}>
        {isConnecting ? 'Đang kết nối...' : isConnected ? 'Đã kết nối · Ngắt' : 'Kết nối Serial'}
      </button>
      <button type="button" className="btn btn-sm btn-outline" onClick={clearLines}>Xóa</button>
    </>
  );
}
