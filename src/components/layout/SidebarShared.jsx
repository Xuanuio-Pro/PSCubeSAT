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
