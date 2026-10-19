import { useState } from 'react';
import { getLabById } from '../data/labs';
import LabLayout from '../components/layout/LabLayout';
import IDEPanel from '../components/editor/IDEPanel';
import LabPracticeActions from '../components/editor/LabPracticeActions';
import TelemetryPanel from '../components/groundstation/TelemetryPanel';
import CommandPanel from '../components/groundstation/CommandPanel';

export default function Lab5() {
  const lab = getLabById(5);
  const [code, setCode] = useState('');

  const editorPanel = <IDEPanel labId={lab.id} setCode={setCode} variant="workspace" showToolbar={false} />;

  const vizPanel = (
    <div className="lab-visual-stack">
      <div className="lab-visual-grid">
        <TelemetryPanel />
        <CommandPanel />
      </div>
    </div>
  );

  return <LabLayout lab={lab} editorPanel={editorPanel} visualizationPanel={vizPanel} practiceActions={<LabPracticeActions code={code} labId={lab.id} />} practiceVariant="rich" />;
}
