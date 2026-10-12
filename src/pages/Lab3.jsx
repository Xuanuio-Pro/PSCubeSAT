import { useState } from 'react';
import { getLabById } from '../data/labs';
import LabLayout from '../components/layout/LabLayout';
import IDEPanel from '../components/editor/IDEPanel';
import LabPracticeActions from '../components/editor/LabPracticeActions';
import SerialMonitor from '../components/serial/SerialMonitor';

export default function Lab3() {
  const lab = getLabById(3);
  const [code, setCode] = useState('');

  const editorPanel = <IDEPanel labId={lab.id} code={code} setCode={setCode} variant="workspace" showToolbar={false} />;

  const vizPanel = (
    <div className="lab-visual-stack">
      <SerialMonitor height={350} />
    </div>
  );

  return <LabLayout lab={lab} editorPanel={editorPanel} visualizationPanel={vizPanel} practiceActions={<LabPracticeActions code={code} labId={lab.id} />} practiceVariant="rich" />;
}
