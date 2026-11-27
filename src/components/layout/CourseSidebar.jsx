import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoSvg from '../../assets/logo.svg';
import textLogo from '../../assets/cubeSAT LMS Text_Logo.svg';
import { labTitleLines } from './lab-titles';
import { HomeIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, CheckIcon, LockIcon } from '../common/HeaderIcons';
import { LabBadgeFace, LessonStatusIcon } from './SidebarShared';
import { useScrollRailToActive } from './use-scroll-rail';
import { isSequentialLesson } from '../lessons/lesson-sequence';
import { legacyLabState } from './lab-state';

const lessonUrl = (slug, id) => `/${slug}?lesson=${encodeURIComponent(id)}`;

export default function CourseSidebar({ labs, currentLabId, activeLesson, onSelectLesson, progress = [], userRole }) {
  const navigate = useNavigate();
  const [expandedLab, setExpandedLab] = useState(currentLabId);
  const [collapsed, setCollapsed] = useState(false);
  const activeLabRef = useRef(null);

  useEffect(() => {
    setExpandedLab(currentLabId);
  }, [currentLabId]);

  useScrollRailToActive(activeLabRef, currentLabId);

  const toggleLab = (id, slug) => {
    const lab = labs.find(item => item.id === id);
    if (lab && getLabState(lab).status === 'locked') return;
    if (id === currentLabId) {
      setExpandedLab(expandedLab === id ? null : id);
    } else {
      navigate(`/${slug}`);
    }
  };

  const progressFor = lab => progress.find(item => item.lab_id === lab.id);
  const isPrivileged = userRole === 'teacher' || userRole === 'admin';
  const getLabState = lab => legacyLabState(labs, lab, progress, userRole);

  return (
    <aside className={`player-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="course-rail">
        <Link to="/" className="course-rail-logo-link" aria-label="Về trang chủ" title="Về trang chủ">
          <img src={logoSvg} alt="PTIT CubeSat" className="course-rail-logo" />
        </Link>
        <nav className="course-rail-nav" aria-label="Chọn Lab">
          {labs.map((lab) => {
            const state = getLabState(lab);
            return <Link
              to={`/${lab.slug}`}
              key={lab.id}
              ref={lab.id === currentLabId ? activeLabRef : null}
              className={`course-lab-badge ${lab.id === currentLabId ? 'active' : ''} is-${state.status}`}
              onClick={event => {
                if (state.status === 'locked') event.preventDefault();
                else setExpandedLab(lab.id);
              }}
              aria-label={`Lab ${lab.id}: ${lab.title}`}
              aria-current={lab.id === currentLabId ? 'page' : undefined}
              aria-disabled={state.status === 'locked' ? 'true' : undefined}
              title={`Lab ${lab.id}: ${lab.title}`}
            >
              <LabBadgeFace labId={lab.id} active={lab.id === currentLabId} />
              <span className="lab-badge-status"><LessonStatusIcon status={state.status} /></span>
            </Link>;
          })}
        </nav>
        <Link to="/" className="course-home-link" aria-label="Về trang chủ" title="Về trang chủ">
          <HomeIcon size={19} />
        </Link>
      </div>

      <div className="course-menu" id="course-curriculum" inert={collapsed}>
        <div className="course-menu-header">
          <Link to="/" className="course-menu-brand" aria-label="Về trang chủ" title="Về trang chủ"><img src={textLogo} alt="CubeSAT PTIT LMS" className="course-menu-wordmark" /></Link>
          <button type="button" className="course-collapse-button" onClick={() => setCollapsed(true)} aria-expanded={!collapsed} aria-controls="course-curriculum" aria-label="Thu gọn thanh điều hướng" title="Thu gọn">
            <ChevronLeftIcon size={18} />
          </button>
        </div>

        <div className="curriculum-list">
          {labs.map((lab) => {
            const isCurrentLab = lab.id === currentLabId;
            const isExpanded = isCurrentLab; // Chỉ hiển thị nội dung của Lab đang chọn
            const lessons = lab.lessons;
            const labState = getLabState(lab);
            const labProgress = progressFor(lab);

            return (
              <div key={lab.id} className={`accordion-section ${isCurrentLab ? 'current' : ''} is-${labState.status}`}>
                <button type="button" className={`accordion-header ${isCurrentLab ? 'current' : ''}`} onClick={() => toggleLab(lab.id, lab.slug)} aria-expanded={isExpanded} aria-controls={isExpanded ? `lab-${lab.id}-lessons` : undefined} aria-disabled={labState.status === 'locked' ? 'true' : undefined}>
                  <span className="accordion-label">
                    <span className="accordion-title"><span className="curriculum-status-icon"><LessonStatusIcon status={labState.status} /></span>Lab {lab.id}: {lab.title.split('(')[0].trim()}</span>
                    <span className="curriculum-status-label">{labState.label}</span>
                    <span className="accordion-meta"><span>{lessons.length} phần</span><span>•</span><span>{lessons.filter(lesson => lesson.type === 'practice' || lesson.type === 'components' || lesson.type === 'assembly').length} bài thực hành</span></span>
                  </span>
                  <ChevronDownIcon size={14} className={`accordion-chevron ${isExpanded ? 'expanded' : ''}`} />
                </button>

                {isCurrentLab && (
                  <div className="lab-frame-head">
                    <h2 className="lab-frame-title">{labTitleLines(lab).map((line, index) => <span key={index} className="lab-frame-title-line">{line}</span>)}</h2>
                    <p className="lab-frame-meta">{labState.done}/{labState.total} · {lessons.filter(lesson => lesson.type === 'practice' || lesson.type === 'components').length} bài thực hành</p>
                  </div>
                )}
                {isExpanded && (
                  <div className="accordion-content" id={`lab-${lab.id}-lessons`}>
                    <div className="lesson-track">
                    {lessons.map((lesson, index) => {
                      const isLessonActive = isCurrentLab && activeLesson === lesson.id;
                      const states = labProgress?.lessons || {};
                      const completed = Boolean(states[lesson.id]?.completed);
                      const inProgress = !completed && Boolean(states[lesson.id]?.started_at);
                      const firstIncomplete = lessons.findIndex(item => isSequentialLesson(item) && !states[item.id]?.completed);
                      const locked = !isPrivileged && (labState.status === 'locked' || (firstIncomplete >= 0 && index > firstIncomplete && !completed));
                      const lessonStatus = completed ? 'completed' : locked ? 'locked' : inProgress || isLessonActive ? 'in-progress' : 'available';
                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          className={`sub-lesson-item ${isLessonActive ? 'active' : ''} is-${lessonStatus}`}
                          disabled={locked}
                          aria-current={isLessonActive ? 'step' : undefined}
                          onClick={() => {
                            if (locked) return;
                            if (!isCurrentLab) {
                              navigate(lessonUrl(lab.slug, lesson.id));
                            } else {
                              onSelectLesson(lesson.id);
                            }
                          }}
                        >
                          <span className="sub-lesson-icon">{completed ? <CheckIcon size={14} /> : locked ? <LockIcon size={13} /> : <span>{String(index + 1).padStart(2, '0')}</span>}</span>
                          <span className="sub-lesson-copy">{!/^\d+$/.test(String(lesson.label)) && <small>{lesson.label}{(lesson.exercises?.length || 0) > 1 ? ` · ${lesson.exercises.length} bài con` : ''}</small>}<span>{lesson.title}</span>{lesson.exerciseCode && <code>{lesson.exerciseCode}</code>}</span>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="course-menu-footer" />
      </div>

      {collapsed && (
        <button type="button" className="course-expand-button" onClick={() => setCollapsed(false)} aria-expanded={!collapsed} aria-controls="course-curriculum" aria-label="Mở rộng thanh điều hướng" title="Mở rộng">
          <ChevronRightIcon size={18} />
        </button>
      )}
    </aside>
  );
}
