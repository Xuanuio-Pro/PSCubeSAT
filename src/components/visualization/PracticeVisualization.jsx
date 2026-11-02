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
  attitude: lazy(() => import('./AttitudeViewer3D')), rawImu: lazy(() => import('./RawIMUPanel')),
  gps: lazy(() => import('./GPSMap')), camera: lazy(() => import('./CameraViewer')),
  telemetry: lazy(() => import('../groundstation/TelemetryPanel')),
  network: lazy(() => import('./NetworkPanel')), storage: lazy(() => import('./StoragePanel')),
  led: lazy(() => import('./LEDPanel')),
  lab1Connection: lazy(() => import('./Lab1ConnectionNotice')),
};

export default function PracticeVisualization() {
  const { exerciseId } = useTelemetry();
  const profile = practiceProfile(exerciseId);
  const plan = visualizationPlan(profile);
  const gridPanels = profile.lab === 4 ? ['attitude', 'gps', 'camera'] : profile.lab === 5 ? ['telemetry', 'commands'] : profile.lab === 7 ? ['attitude', 'gps', 'voltage'] : [];
  const render = name => {
    const Panel = PANELS[name];
    if (name === 'lab1Connection') return <Panel key={name} />;
    return <section key={name} className="practice-panel" aria-label={PANEL_LABELS[name]}>
      {name === 'commands' ? <CommandPanel commands={profile.commands} labId={profile.lab} exerciseId={exerciseId} /> : <Panel {...(['attitude', 'gps'].includes(name) ? { height: 320 } : {})} />}
    </section>;
  };
  return <div className="lab-visual-stack" data-exercise-id={exerciseId}>
    <SerialMonitor height={350} />
    <Suspense fallback={<p className="telemetry-empty">Đang tải bảng trực quan…</p>}>
      {profile.lab === 8 ? <DashboardBuilder /> : <>
        {gridPanels.length > 0 && <div className="lab-visual-grid">{gridPanels.map(render)}</div>}
        {plan.panels.filter(name => !gridPanels.includes(name) && Object.hasOwn(PANELS, name)).map(render)}
      </>}
    </Suspense>
    {(plan.panels.includes('system') || profile.lab === 7) && <SystemCheck />}
    {plan.panels.includes('commands') && !gridPanels.includes('commands') && <CommandPanel commands={profile.commands} labId={profile.lab} exerciseId={exerciseId} />}
    {profile.lab !== 1 && <PracticeActivity />}
  </div>;
}
