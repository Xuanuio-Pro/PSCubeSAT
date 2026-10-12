import CloudCompiler from '../serial/CloudCompiler';
import WebFlasher from '../serial/WebFlasher';
import { useSerial } from '../../contexts/SerialContext';

export default function LabPracticeActions({ code, labId }) {
  const { isConnected, connect, clearLines } = useSerial();

  return (
    <>
      <CloudCompiler code={code} labId={labId} inline showIcon={false} buttonClassName="btn-outline" />
      <WebFlasher inline showIcon={false} buttonClassName="btn-outline" label="Nạp code" />
      <button type="button" className="btn btn-sm btn-primary" onClick={() => connect()} disabled={isConnected}>
        {isConnected ? 'Đã kết nối' : 'Kết nối Serial'}
      </button>
      <button type="button" className="btn btn-sm btn-outline" onClick={clearLines}>Xóa</button>
    </>
  );
}
