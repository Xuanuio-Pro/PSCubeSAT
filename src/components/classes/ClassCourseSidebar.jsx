import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '../../assets/logo.svg';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon, CircleIcon, HomeIcon, LockIcon } from '../common/HeaderIcons';

const typeLabels = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', labtest: 'Lab test' };

function stateFor(lab, unlockedView = false) {
  const lessons = lab.lessons || [];
  const allLessonsLocked = lessons.length > 0 && lessons.every(item => item.access === 'locked' || !item.content);
  if (!unlockedView && (lab.access === 'locked' || allLessonsLocked)) return { status: 'locked', label: 'Đang khóa' };
  if (unlockedView) return { status: 'in-progress', label: 'Mở toàn bộ' };
  const completed = lessons.filter(item => item.access !== 'locked' && ['completed', 'waived'].includes(item.progress?.status)).length;
  if (lessons.length > 0 && completed === lessons.length) return { status: 'completed', label: 'Đã hoàn thành' };
  return { status: 'in-progress', label: `Đang học (${lessons.length ? Math.round((completed / lessons.length) * 100) : 0}%)` };
}

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckIcon size={15} />;
  if (status === 'locked') return <LockIcon size={14} />;
  return <CircleIcon className="status-dot" size={10} />;
}

export default function ClassCourseSidebar({ labs, classId, activeLesson, onSelectLesson, homePath = `/classes/${classId}`, unlockedView = false }) {
  const [expandedLab, setExpandedLab] = useState(labs.find(lab => lab.lessons?.some(lesson => lesson.id === activeLesson))?.id ?? labs[0]?.id);
  const [collapsed, setCollapsed] = useState(false);
  const activeLabRef = useRef(null);

  const activeLab = labs.find(lab => lab.lessons?.some(lesson => lesson.id === activeLesson));

  useEffect(() => {
    if (activeLab?.id !== undefined) setExpandedLab(activeLab.id);
  }, [activeLab?.id]);

  useEffect(() => {
    const activeLabEl = activeLabRef.current;
    const rail = activeLabEl?.parentElement;
    if (!rail) return;
    const itemBounds = activeLabEl.getBoundingClientRect();
    const railBounds = rail.getBoundingClientRect();
    if (itemBounds.top < railBounds.top) rail.scrollTop -= railBounds.top - itemBounds.top + 4;
    if (itemBounds.bottom > railBounds.bottom) rail.scrollTop += itemBounds.bottom - railBounds.bottom + 4;
  }, [activeLesson]);

  const selectLab = lab => {
    if (stateFor(lab, unlockedView).status === 'locked') return;
    const targetLesson = lab.lessons?.find(item => unlockedView || (item.access === 'available' && item.content))
      || lab.lessons?.find(item => unlockedView || (item.access !== 'locked' && item.content))
      || lab.lessons?.[0];
    if (!targetLesson) return;
    setExpandedLab(lab.id);
    onSelectLesson(targetLesson.id);
  };

  return <aside className={`player-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
    <div className="course-rail">
      <Link to="/" className="course-rail-logo-link" aria-label="Về trang chủ" title="Về trang chủ">
        <img src={logoSvg} alt="PTIT CubeSat" className="course-rail-logo" />
      </Link>
      <nav className="course-rail-nav" aria-label="Chọn Lab trong lớp">
        {labs.map(lab => {
          const state = stateFor(lab, unlockedView);
          return <button
            type="button"
            key={lab.id}
            ref={lab.id === activeLab?.id ? activeLabRef : null}
            className={`course-lab-badge ${lab.id === activeLab?.id ? 'active' : ''} is-${state.status}`}
            onClick={() => selectLab(lab)}
            disabled={state.status === 'locked'}
            aria-label={`Lab ${lab.id}: ${lab.title}`}
            title={`Lab ${lab.id}: ${lab.title}`}
          >
            <span className="lab-badge-tag">LAB</span><span className="lab-badge-num">{lab.id}</span><span className="lab-badge-status"><StatusIcon status={state.status} /></span>
          </button>;
        })}
      </nav>
      <Link to={homePath} className="course-home-link" aria-label="Về lớp học" title="Về lớp học"><HomeIcon size={19} /></Link>
    </div>
    <div className="course-menu" id="class-course-curriculum" inert={collapsed}>
      <div className="course-menu-header">
        <Link to="/" className="course-menu-brand" aria-label="Về trang chủ" title="Về trang chủ"><strong>CubeSAT</strong><span>PTIT LMS</span></Link>
        <button type="button" className="course-collapse-button" onClick={() => setCollapsed(true)} aria-expanded={!collapsed} aria-controls="class-course-curriculum" aria-label="Thu gọn thanh điều hướng"><ChevronLeftIcon size={18} /></button>
      </div>
      <div className="curriculum-list">
        {labs.map(lab => {
          const state = stateFor(lab, unlockedView);
          const expanded = expandedLab === lab.id;
          return <div key={lab.id} className={`accordion-section ${lab.id === activeLab?.id ? 'current' : ''} is-${state.status}`}>
            <button type="button" className={`accordion-header ${lab.id === activeLab?.id ? 'current' : ''}`} onClick={() => state.status !== 'locked' && setExpandedLab(expanded ? null : lab.id)} aria-expanded={expanded} disabled={state.status === 'locked'}>
              <span className="accordion-label">
                <span className="accordion-title"><span className="curriculum-status-icon"><StatusIcon status={state.status} /></span>Lab {lab.id}: {lab.title.split('(')[0].trim()}</span>
                <span className="curriculum-status-label">{state.label}</span>
                <span className="accordion-meta"><span>{lab.lessons.length} phần</span><span>•</span><span>{lab.lessons.filter(lesson => lesson.type === 'practice').length} bài thực hành</span></span>
              </span>
              <ChevronDownIcon size={14} className={`accordion-chevron ${expanded ? 'expanded' : ''}`} />
            </button>
            {expanded && <div className="accordion-content">
              {lab.lessons.map(lesson => {
                const locked = !unlockedView && (lesson.access === 'locked' || !lesson.content);
                const completed = !locked && ['completed', 'waived'].includes(lesson.progress?.status);
                return <button type="button" key={lesson.id} className={`sub-lesson-item ${lesson.id === activeLesson ? 'active' : ''} is-${locked ? 'locked' : completed ? 'completed' : 'available'}`} disabled={locked} aria-current={lesson.id === activeLesson ? 'step' : undefined} onClick={() => onSelectLesson(lesson.id)}>
                  <span className="sub-lesson-icon">{completed ? <CheckIcon size={14} /> : locked ? <LockIcon size={13} /> : <CircleIcon className="status-dot" size={10} />}</span>
                  <span className="sub-lesson-copy">
                    <small>{locked ? 'Chưa mở' : typeLabels[lesson.type]}{lesson.progress?.status === 'pending_review' ? ' · Chờ chấm' : ''}</small>
                    <span>{lesson.title}</span>
                  </span>
                </button>;
              })}
            </div>}
          </div>;
        })}
      </div>
    </div>
    {collapsed && <button type="button" className="course-expand-button" onClick={() => setCollapsed(false)} aria-expanded={!collapsed} aria-controls="class-course-curriculum" aria-label="Mở rộng thanh điều hướng" title="Mở rộng"><ChevronRightIcon size={18} /></button>}
  </aside>;
}
