import { useState } from 'react';
import { getLabById } from '../../data/labs';
import LabLayout from './LabLayout';
import IDEPanel from '../editor/IDEPanel';
import LabPracticeActions from '../editor/LabPracticeActions';

export default function LabWorkspace({ labId }) {
  const lab = getLabById(labId);
  const [code, setCode] = useState('');
  return <LabLayout lab={lab}
    editorPanel={<IDEPanel labId={labId} setCode={setCode} variant="workspace" showToolbar={false} />}
    practiceActions={<LabPracticeActions code={code} labId={labId} />}
    practiceVariant={labId === 8 ? 'dashboard' : 'rich'} />;
}
