import { useState } from 'react';
import { getLabById } from '../data/labs';
import LabLayout from '../components/layout/LabLayout';
import IDEPanel from '../components/editor/IDEPanel';
import LabPracticeActions from '../components/editor/LabPracticeActions';
import SerialMonitor from '../components/serial/SerialMonitor';
import AttitudeViewer3D from '../components/visualization/AttitudeViewer3D';
import GPSMap from '../components/visualization/GPSMap';
import CameraViewer from '../components/visualization/CameraViewer';
import EnvironmentPanel from '../components/visualization/EnvironmentPanel';

export default function Lab4() {
  const lab = getLabById(4);
  const [code, setCode] = useState('');

  const editorPanel = <IDEPanel labId={lab.id} code={code} setCode={setCode} variant="workspace" showToolbar={false} />;

  const vizPanel = (
    <div className="lab-visual-stack">
      <div className="lab-visual-grid">
        <AttitudeViewer3D height={320} />
        <GPSMap height={320} />
        <CameraViewer />
      </div>
      <EnvironmentPanel />
      <SerialMonitor height={350} />
    </div>
  );

  return <LabLayout lab={lab} editorPanel={editorPanel} visualizationPanel={vizPanel} practiceActions={<LabPracticeActions code={code} labId={lab.id} />} practiceVariant="rich" />;
}
