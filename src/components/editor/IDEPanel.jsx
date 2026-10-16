import TabPanel from '../common/TabPanel';
import BlocklyEditor from './BlocklyEditor';
import MonacoEditor from './MonacoEditor';
import CloudCompiler from '../serial/CloudCompiler';
import WebFlasher from '../serial/WebFlasher';

export default function IDEPanel({ labId, code, setCode, variant = 'default', showToolbar = true }) {
  const isWorkspace = variant === 'workspace';
  const editorTabs = [
    {
      label: isWorkspace ? 'Kéo thả (Blockly)' : '🧩 Kéo thả (Blockly)',
      content: <BlocklyEditor labId={labId} onCodeChange={setCode} minHeight={isWorkspace ? '100%' : '400px'} />
    },
    {
      label: isWorkspace ? 'Mã nguồn C++' : '💻 Mã nguồn (C++)',
      content: <MonacoEditor code={code} onChange={setCode} height={isWorkspace ? '100%' : '400px'} />
    }
  ];

  const toolbar = (
    <div style={{ display: 'flex', gap: '12px' }}>
      <CloudCompiler code={code} labId={labId} inline={true} />
      <WebFlasher code={code} labId={labId} inline={true} />
    </div>
  );

  return (
    <div className={`card ide-panel ide-panel--${variant}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <TabPanel tabs={editorTabs} defaultTab={isWorkspace ? 1 : 0} extraToolbar={showToolbar ? toolbar : null} />
    </div>
  );
}
