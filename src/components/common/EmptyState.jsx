// One empty-state pattern for the whole site: icon + one sentence (+ optional title) + at most one action.
const ICONS = {
  video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></>,
  class: <><path d="M3 10 12 5l9 5-9 5Z" /><path d="M7 12v4c0 1 2.2 3 5 3s5-2 5-3v-4" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" /><path d="M12 17h.01" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18.5 14a6.5 6.5 0 0 1 3 6" /></>,
};

export default function EmptyState({ icon = 'question', title = '', text, action = null, compact = false }) {
  return <div className={`empty-state${compact ? ' empty-state--compact' : ''}`} role="status">
    <span className="empty-state-icon" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon] || ICONS.question}</svg>
    </span>
    <div className="empty-state-copy">
      {title && <strong>{title}</strong>}
      <p>{text}</p>
    </div>
    {action && <div className="empty-state-action">{action}</div>}
  </div>;
}
