import { labIconUrl } from './lab-icons';
import { CheckIcon, CircleIcon, LockIcon } from '../common/HeaderIcons';

export function LabBadgeFace({ labId, active }) {
  const src = labIconUrl(labId, active);
  if (!src) return <><span className="lab-badge-tag">LAB</span><span className="lab-badge-num">{labId}</span></>;
  return <img className="lab-badge-icon" src={src} alt="" draggable="false" />;
}

export function LessonStatusIcon({ status }) {
  if (status === 'completed') return <CheckIcon size={15} />;
  if (status === 'locked') return <LockIcon size={14} />;
  return <CircleIcon className="status-dot" size={10} />;
}

// Phone layout: the LAB 0–8 rail is hidden, so the lab is picked from this dropdown above the lesson picker.
export function MobileLabPicker({ id, labs, currentLabId, isLocked, onPick }) {
  return <div className="mobile-lab-picker">
    <label htmlFor={id}>Lab</label>
    <select id={id} value={String(currentLabId)} onChange={event => onPick(Number(event.target.value))}>
      {labs.map(lab => {
        const locked = isLocked(lab);
        return <option key={lab.id} value={String(lab.id)} disabled={locked}>Lab {lab.id} · {lab.title}{locked ? ' (chưa mở)' : ''}</option>;
      })}
    </select>
  </div>;
}
