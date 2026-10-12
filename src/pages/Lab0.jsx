import { getLabById } from '../data/labs';
import LabLayout from '../components/layout/LabLayout';
import ComponentViewer from '../components/interactive/ComponentViewer';

export default function Lab0() {
  const lab = getLabById(0);

  const vizPanel = (
    <ComponentViewer />
  );

  return <LabLayout lab={lab} editorPanel={null} visualizationPanel={vizPanel} />;
}
