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
  lab1Io: lazy(() => import('./Lab1IoPanel')),
  shell: lazy(() => import('./ShellResultsPanel')),
  groundStation: lazy(() => import('./GroundStationLink')),
};
// Compact panels sit side by side when an exercise shows two or more of them.
const GRID = ['attitude', 'gps', 'camera', 'voltage', 'radio', 'shell', 'commands', 'groundStation'];
// Evidence groups that already have a dedicated panel are not repeated in "Kết quả thực hành".
const DEDICATED = { radio: ['radio'], anomaly: ['alert'], shell: ['shell', 'storage'] };

/**
 * The visual widgets of one exercise (no Serial Monitor). Shared by the lab window and, for Lab 7,
 * by the ground-station window, where the same widgets are fed by the LoRa downlink.
 */
export function PracticePanels({ profile, plan, panels = plan.panels }) {
  const grid = panels.filter(name => GRID.includes(name));
  const gridPanels = grid.length > 1 ? grid : [];
  const render = name => {
    if (name === 'lab1Connection') { const Panel = PANELS[name]; return <Panel key={name} />; }
    if (name === 'system') return <SystemCheck key={name} rows={plan.systemRows} />;
    const Panel = PANELS[name];
    return <section key={name} className="practice-panel" aria-label={PANEL_LABELS[name]}>
      {name === 'commands' ? <CommandPanel commands={profile.commands} /> : <Panel {...(['attitude', 'gps'].includes(name) ? { height: 320 } : {})} />}
    </section>;
  };
  return <Suspense fallback={<p className="telemetry-empty">Đang tải bảng trực quan…</p>}>
    {gridPanels.length > 0 && <div className="lab-visual-grid">{gridPanels.map(render)}</div>}
    {panels.filter(name => !gridPanels.includes(name)).map(render)}
  </Suspense>;
}

export default function PracticeVisualization() {
  const { exerciseId } = useTelemetry();
  const profile = practiceProfile(exerciseId);
  const plan = visualizationPlan(profile);
  // Lab 7: the ground-station link sits right under the Serial Monitor; SD and LoRa are reported in System Check.
  const lead = profile.lab === 7 ? plan.panels.filter(name => name === 'groundStation') : [];
  return <div className="lab-visual-stack" data-exercise-id={exerciseId} data-lab={profile.lab}>
    <SerialMonitor height={350} />
    {profile.lab === 8 ? <Suspense fallback={<p className="telemetry-empty">Đang tải bảng trực quan…</p>}><DashboardBuilder /></Suspense> : <>
      {lead.length > 0 && <PracticePanels profile={profile} plan={plan} panels={lead} />}
      <PracticePanels profile={profile} plan={plan} panels={plan.panels.filter(name => !lead.includes(name))} />
    </>}
    {profile.lab !== 1 && profile.lab !== 7 && !profile.serialOnly && <PracticeActivity exclude={plan.panels.flatMap(name => DEDICATED[name] ?? [])} />}
  </div>;
}
