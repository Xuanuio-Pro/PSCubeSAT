import { useState } from 'react';
import { getLabById } from '../data/labs';
import LabLayout from '../components/layout/LabLayout';
import IDEPanel from '../components/editor/IDEPanel';
import LabPracticeActions from '../components/editor/LabPracticeActions';
import SerialMonitor from '../components/serial/SerialMonitor';

export default function Lab1() {
  const lab = getLabById(1);
  const [code, setCode] = useState('');

  const editorPanel = <IDEPanel labId={lab.id} code={code} setCode={setCode} variant="workspace" showToolbar={false} />;

  const vizPanel = (
    <div className="lab-visual-stack">
      <SerialMonitor height={350} />
    </div>
  );

  const practiceActions = <LabPracticeActions code={code} labId={lab.id} />;

  return <LabLayout lab={lab} editorPanel={editorPanel} visualizationPanel={vizPanel} practiceActions={practiceActions} practiceVariant="rich" />;
}
