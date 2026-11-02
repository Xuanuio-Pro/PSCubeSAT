import { NavLink } from 'react-router-dom';
import { LABS } from '../../data/lab-metadata';
import logoSvg from '../../assets/logo.svg';

export default function Sidebar() {

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center' }}>
          <img src={logoSvg} alt="PTIT CubeSat Logo" style={{ height: '32px', width: 'auto' }} />
        </div>
        <div className="sidebar-brand">
          <h1>PTIT CubeSat</h1>
          <span>STEM Learning Platform</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Tổng quan</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-item-icon">🏠</span>
          <span className="nav-item-label">Trang chủ</span>
        </NavLink>

        <div className="nav-section-title" style={{ marginTop: '12px' }}>Bài thực hành</div>
        {LABS.map(lab => (
          <NavLink
            key={lab.id}
            to={`/${lab.slug}`}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-item-icon">{lab.icon}</span>
            <span className="nav-item-label">Lab {lab.id}: {lab.title.split('(')[0].trim()}</span>
            <span className="nav-item-badge">{lab.id}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-primary)' }}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
          PTIT STEM Lab v1.0
        </div>
      </div>
    </aside>
  );
}
