import { lazy, Suspense } from 'react';
import { useTelemetry } from '../../contexts/telemetry-api';
import { practiceProfile } from '../../telemetry/practice';
import { PANEL_LABELS, visualizationPlan } from '../../telemetry/visualization-plan';
import PracticeActivity from './PracticeActivity';
import SystemCheck from './SystemCheck';
import CommandPanel from '../groundstation/CommandPanel';
import SerialMonitor from '../serial/SerialMonitor';

const DashboardBuilder = lazy(() => import('../dashboard/DashboardBuilder'));
const PANELS = {
  voltage: lazy(() => import('./VoltageChart')), environment: lazy(() => import('./EnvironmentPanel')),
  attitude: lazy(() => import('./AttitudeViewer3D')),
  gps: lazy(() => import('./GPSMap')), camera: lazy(() => import('./CameraViewer')),
  network: lazy(() => import('./NetworkPanel')), storage: lazy(() => import('./StoragePanel')),
  radio: lazy(() => import('./RadioPanel')), anomaly: lazy(() => import('./AnomalyPanel')),
  lab1Connection: lazy(() => import('./Lab1ConnectionNotice')),
};
// Compact panels sit side by side when an exercise shows two or more of them.
const GRID = ['attitude', 'gps', 'camera', 'voltage', 'radio', 'commands'];
// Evidence groups that already have a dedicated panel are not repeated in "Kết quả thực hành".
const DEDICATED = { radio: 'radio', anomaly: 'alert' };

export default function PracticeVisualization() {
  const { exerciseId } = useTelemetry();
  const profile = practiceProfile(exerciseId);
  const plan = visualizationPlan(profile);
  const grid = plan.panels.filter(name => GRID.includes(name));
  const gridPanels = grid.length > 1 ? grid : [];
  const render = name => {
    if (name === 'lab1Connection') { const Panel = PANELS[name]; return <Panel key={name} />; }
    if (name === 'system') return <SystemCheck key={name} rows={plan.systemRows} />;
    const Panel = PANELS[name];
    return <section key={name} className="practice-panel" aria-label={PANEL_LABELS[name]}>
      {name === 'commands' ? <CommandPanel commands={profile.commands} labId={profile.lab} exerciseId={exerciseId} /> : <Panel {...(['attitude', 'gps'].includes(name) ? { height: 320 } : {})} />}
    </section>;
  };
  return <div className="lab-visual-stack" data-exercise-id={exerciseId}>
    <SerialMonitor height={350} />
    <Suspense fallback={<p className="telemetry-empty">Đang tải bảng trực quan…</p>}>
      {profile.lab === 8 ? <DashboardBuilder /> : <>
        {gridPanels.length > 0 && <div className="lab-visual-grid">{gridPanels.map(render)}</div>}
        {plan.panels.filter(name => !gridPanels.includes(name)).map(render)}
      </>}
    </Suspense>
    {profile.lab !== 1 && <PracticeActivity exclude={plan.panels.map(name => DEDICATED[name]).filter(Boolean)} />}
  </div>;
}
