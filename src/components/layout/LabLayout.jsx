import { useState, useEffect, useRef } from 'react';
import CourseSidebar from './CourseSidebar';
import VideoPlayer from '../common/VideoPlayer';
import DocViewer from '../common/DocViewer';
import { useAuth } from '../../contexts/auth-api';
import TelemetryControls from '../groundstation/TelemetryControls';

function LabStateTitle({ step, section, children, description = '', compact = false }) {
  return (
    <header className={`lab-state-title${compact ? ' lab-state-title--compact' : ''}`}>
      <div className="lab-state-meta">
        <span className="lab-state-number">Lab {step}</span>
        <span className="lab-state-section">{section}</span>
      </div>
      <h1 className="lab-state-copy">{children}</h1>
      {description && <p className="lab-state-description">{description}</p>}
    </header>
  );
}

export default function LabLayout({ lab, editorPanel, visualizationPanel, practiceActions = null, practiceVariant = 'split' }) {
  const mainRef = useRef(null);
  const { isAuthenticated, markVideoWatched, markDocViewed } = useAuth();

  // 0: Tổng quan (Video), 1: Tài liệu, 2: Thực hành
  const [activeLesson, setActiveLesson] = useState(0);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    // Khi đổi lab, reset về bài học đầu tiên (Tổng quan)
    setActiveLesson(0);
  }, [lab?.id]);

  useEffect(() => {
    if (!isAuthenticated || !lab) return;
    if (activeLesson === 0) markVideoWatched(lab.id).catch(() => {});
    if (activeLesson === 1) markDocViewed(lab.id).catch(() => {});
  }, [isAuthenticated, lab, activeLesson, markVideoWatched, markDocViewed]);

  if (!lab) return <div>Lab không tồn tại</div>;

  const isLabZero = lab.id === 0;
  const usesFigmaLearningShell = lab.id >= 0 && lab.id <= 8;
  const usesFigmaPracticeShell = lab.id >= 1 && lab.id <= 8;
  const lessonLabels = ['Tổng quan', 'Tài liệu', isLabZero ? 'Thành phần' : 'Thực hành'];

  return (
    <div className="player-layout">
      
      {/* Left Sidebar Curriculum */}
      <CourseSidebar 
        currentLabId={lab.id} 
        activeLesson={activeLesson}
        onSelectLesson={setActiveLesson} 
      />

      {/* Main Content Area */}
      <div className="player-main" ref={mainRef}>
        <TelemetryControls />
        <nav className="lab-mobile-lessons" aria-label={`Nội dung Lab ${lab.id}`}>
          {lessonLabels.map((label, lessonId) => (
            <button
              type="button"
              key={label}
              className={activeLesson === lessonId ? 'active' : ''}
              onClick={() => setActiveLesson(lessonId)}
              aria-current={activeLesson === lessonId ? 'page' : undefined}
            >
              <span>{String(lessonId + 1).padStart(2, '0')}</span>
              {label}
            </button>
          ))}
        </nav>
        
        {activeLesson === 0 && usesFigmaLearningShell && (
          <div className="lab-course-view animate-fadeInUp">
            <LabStateTitle step={`${lab.id}.1`} section="Tổng quan bài học" description={lab.description}>{lab.title}</LabStateTitle>

            <section className="lab-workspace lab-video-workspace" aria-label={`Video Lab ${lab.id}`}>
              <span className="lab-workspace-badge lab-play-badge" aria-hidden="true">▶</span>
              <div className="lab-video-surface">
                <VideoPlayer url={lab.videoUrl} />
              </div>
            </section>

            <section className="lab-objectives">
              <div className="lab-objectives-title"><span aria-hidden="true">◎</span>Mục tiêu bài học</div>
              <div className="lab-objectives-body">
                <p>Nội dung đang được cập nhật...</p>
              </div>
            </section>
          </div>
        )}

        {activeLesson === 0 && !usesFigmaLearningShell && (
          <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="video-section">
              <div className="video-wrapper">
                <VideoPlayer url={lab.videoUrl} />
              </div>
            </div>
            
            <div className="player-content" style={{ marginTop: '32px', marginBottom: '64px' }}>
              <div style={{ maxWidth: '800px' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
                  Lab {lab.id}: {lab.title}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '40px' }}>
                  {lab.description}
                </p>
                
                <div className="card">
                  <div className="card-header" style={{ fontSize: '1.125rem' }}>🎯 Mục tiêu bài học</div>
                  <div className="card-body">
                    <ul style={{ paddingLeft: '24px', lineHeight: 2, fontSize: '1.05rem', color: 'var(--text-body)' }}>
                      <li>Nắm vững kiến trúc phần cứng của phân hệ tương ứng trong vệ tinh.</li>
                      <li>Thực hành cấu hình, lập trình kéo thả và phân tích mã nguồn C++ tương ứng.</li>
                      <li>Kiểm thử trực quan và thu thập dữ liệu qua hệ thống trạm mặt đất mô phỏng.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeLesson === 1 && usesFigmaLearningShell && (
          <div className="lab-course-view animate-fadeInUp">
            <LabStateTitle step={`${lab.id}.2`} section="Tài liệu hướng dẫn">{lab.title}</LabStateTitle>

            <section className="lab-workspace lab-doc-workspace" aria-label={`Tài liệu hướng dẫn Lab ${lab.id}`}>
              <span className="lab-workspace-badge" aria-hidden="true">▤</span>
              <div className="lab-doc-surface">
                <DocViewer docPath={lab.docPath} />
              </div>
            </section>
          </div>
        )}

        {activeLesson === 1 && !usesFigmaLearningShell && (
          <div className="player-content animate-fadeInUp" style={{ padding: '40px max(32px, calc((100vw - 1280px - var(--sidebar-width)) / 2))' }}>
            <div className="doc-content">
              <DocViewer docPath={lab.docPath} />
            </div>
          </div>
        )}

        {activeLesson === 2 && isLabZero && (
          <div className="lab-course-view animate-fadeInUp">
            <LabStateTitle step="0.3" section="Thành phần" compact>Khám phá PTIT STEM CubeSAT</LabStateTitle>

            <section className="lab-workspace lab-components-workspace" aria-label="Khám phá các phân hệ CubeSat">
              {visualizationPanel}
            </section>
          </div>
        )}

        {activeLesson === 2 && usesFigmaPracticeShell && (
          <div className="lab-course-view animate-fadeInUp">
            <LabStateTitle step={`${lab.id}.3`} section="Thực hành" compact>{lab.title}</LabStateTitle>

            <section className={`lab-workspace lab-practice-workspace lab-practice-workspace--${practiceVariant}`} aria-label={`Không gian thực hành Lab ${lab.id}`}>
              <div className={`lab-practice-panels lab-practice-panels--${practiceVariant}`}>
                <div className="lab-practice-editor">
                  <div className="lab-practice-editor-frame">{editorPanel}</div>
                  {practiceVariant !== 'split' && (
                    <div className="lab-practice-actions lab-practice-actions--inline" aria-label="Thao tác thực hành">{practiceActions}</div>
                  )}
                </div>
                <div className="lab-practice-visualization">{visualizationPanel}</div>
              </div>
              {practiceVariant === 'split' && (
                <div className="lab-practice-actions" aria-label="Thao tác thực hành">{practiceActions}</div>
              )}
            </section>
          </div>
        )}

        {activeLesson === 2 && !usesFigmaLearningShell && (
          <div className="player-content animate-fadeInUp" style={{ padding: 0, flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Editor Panel (primary — nơi người dùng code trước) */}
            {editorPanel && (
              <div style={{ flex: '1 1 60%', minWidth: 0, padding: '24px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)' }}>
                {editorPanel}
              </div>
            )}

            {/* Visual Panel (kết quả — Serial Monitor / trực quan) */}
            <div style={{ flex: editorPanel ? '1 1 40%' : 1, minWidth: 0, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: editorPanel ? 'var(--bg-app)' : 'transparent' }}>
              {lab.id !== 0 && (
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-heading)' }}>Kết quả / Bảng điều khiển</h3>
              )}
              {visualizationPanel}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
