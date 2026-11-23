import { useId } from 'react';

export default function PracticeExerciseTabs({ exercises = [], activeExercise, onSelect }) {
  const baseId = useId();
  if (exercises.length <= 1 || !activeExercise) return null;
  const activeIndex = Math.max(0, exercises.findIndex(item => item.id === activeExercise.id));

  return (
    <div className="practice-subtabs-wrap">
      <div className="practice-subtabs" role="tablist" aria-label="Chọn bài thực hành con">
        {exercises.map((item, index) => {
          const selected = item.id === activeExercise.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-${index}-tab`}
              className={`practice-subtab${selected ? ' is-active' : ''}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const nextIndex = event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? exercises.length - 1
                    : event.key === 'ArrowRight'
                      ? (activeIndex + 1) % exercises.length
                      : (activeIndex - 1 + exercises.length) % exercises.length;
                onSelect(exercises[nextIndex].id);
                window.document.getElementById(`${baseId}-${nextIndex}-tab`)?.focus();
              }}
              onClick={() => onSelect(item.id)}
            >
              <span className="practice-subtab-index">{index + 1}</span>
              <code>{item.id}</code>
            </button>
          );
        })}
      </div>
      <p className="practice-subtab-desc" role="status">
        <strong>{activeExercise.id}:</strong> {activeExercise.description || activeExercise.title}
      </p>
    </div>
  );
}
