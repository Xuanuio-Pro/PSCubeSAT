import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LABS } from '../../data/labs';
import logoSvg from '../../assets/logo.svg';
import { HomeIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from '../common/HeaderIcons';

const LAB_MINUTES = [26, 28, 30, 25, 32, 30, 24, 35, 40];

export default function CourseSidebar({ currentLabId, activeLesson, onSelectLesson }) {
  const navigate = useNavigate();
  const [expandedLab, setExpandedLab] = useState(currentLabId);
  const [collapsed, setCollapsed] = useState(false);
  const activeLabRef = useRef(null);

  useEffect(() => {
    setExpandedLab(currentLabId);
    const activeLab = activeLabRef.current;
    const rail = activeLab?.parentElement;
    if (rail) {
      const itemBounds = activeLab.getBoundingClientRect();
      const railBounds = rail.getBoundingClientRect();
      if (itemBounds.top < railBounds.top) rail.scrollTop -= railBounds.top - itemBounds.top + 4;
      else if (itemBounds.bottom > railBounds.bottom) rail.scrollTop += itemBounds.bottom - railBounds.bottom + 4;
    }
  }, [currentLabId]);

  const toggleLab = (id, slug) => {
    if (id === currentLabId) {
      setExpandedLab(expandedLab === id ? null : id);
    } else {
      navigate(`/${slug}`);
    }
  };

  const getLessonsForLab = (labId) => [
    { id: 0, title: 'Tổng quan bài học', icon: '01' },
    { id: 1, title: 'Tài liệu hướng dẫn', icon: '02' },
    { id: 2, title: labId === 0 ? 'Thành phần' : 'Thực hành', icon: '03' },
  ];

  return (
    <aside className={`player-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="course-rail">
        <img src={logoSvg} alt="PTIT CubeSat" className="course-rail-logo" />
        <nav className="course-rail-nav" aria-label="Chọn Lab">
          {LABS.map((lab) => (
            <Link
              to={`/${lab.slug}`}
              key={lab.id}
              ref={lab.id === currentLabId ? activeLabRef : null}
              className={`course-lab-badge ${lab.id === currentLabId ? 'active' : ''}`}
              onClick={() => setExpandedLab(lab.id)}
              aria-label={`Lab ${lab.id}: ${lab.title}`}
              aria-current={lab.id === currentLabId ? 'page' : undefined}
              title={`Lab ${lab.id}: ${lab.title}`}
            >
              <span className="lab-badge-tag">LAB</span>
              <span className="lab-badge-num">{lab.id}</span>
            </Link>
          ))}
        </nav>
        <Link to="/" className="course-home-link" aria-label="Về trang chủ" title="Về trang chủ">
          <HomeIcon size={19} />
        </Link>
      </div>

      <div className="course-menu" id="course-curriculum" inert={collapsed}>
        <div className="course-menu-header">
          <div className="course-menu-brand"><strong>CubeSAT</strong><span>PTIT LMS</span></div>
          <button type="button" className="course-collapse-button" onClick={() => setCollapsed(true)} aria-expanded={!collapsed} aria-controls="course-curriculum" aria-label="Thu gọn thanh điều hướng" title="Thu gọn">
            <ChevronLeftIcon size={18} />
          </button>
        </div>

        <div className="curriculum-list">
          {LABS.map((lab) => {
            const isCurrentLab = lab.id === currentLabId;
            const isExpanded = expandedLab === lab.id;

            return (
              <div key={lab.id} className={`accordion-section ${isCurrentLab ? 'current' : ''}`}>
                <button type="button" className={`accordion-header ${isCurrentLab ? 'current' : ''}`} onClick={() => toggleLab(lab.id, lab.slug)} aria-expanded={isExpanded} aria-controls={isExpanded ? `lab-${lab.id}-lessons` : undefined}>
                  <span className="accordion-label">
                    <span className="accordion-title">Lab {lab.id}: {lab.title.split('(')[0].trim()}</span>
                    <span className="accordion-meta"><span>0 / 3</span><span>•</span><span>{LAB_MINUTES[lab.id]} phút</span></span>
                  </span>
                  <ChevronDownIcon size={14} className={`accordion-chevron ${isExpanded ? 'expanded' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="accordion-content" id={`lab-${lab.id}-lessons`}>
                    {getLessonsForLab(lab.id).map((lesson) => {
                      const isLessonActive = isCurrentLab && activeLesson === lesson.id;
                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          className={`sub-lesson-item ${isLessonActive ? 'active' : ''}`}
                          aria-current={isLessonActive ? 'step' : undefined}
                          onClick={() => {
                            if (!isCurrentLab) {
                              navigate(`/${lab.slug}`);
                              setTimeout(() => onSelectLesson(lesson.id), 100);
                            } else {
                              onSelectLesson(lesson.id);
                            }
                          }}
                        >
                          <span className="sub-lesson-icon">{lesson.icon}</span>
                          <span>{lesson.title}</span>
                        </button>
                      );
                    })}
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
