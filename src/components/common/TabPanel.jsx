import { useState } from 'react';

export default function TabPanel({ tabs, defaultTab = 0, extraToolbar }) {
  const [active, setActive] = useState(defaultTab);

  return (
    <div className="tab-panel">
      <div className="tabs tab-panel-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="tab-panel-list" style={{ display: 'flex', gap: '8px' }}>
          {tabs.map((tab, i) => (
            <button
              key={i}
              className={`tab ${active === i ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>
        {extraToolbar && (
          <div style={{ display: 'flex', gap: '8px', paddingRight: '16px' }}>
            {extraToolbar}
          </div>
        )}
      </div>
      <div className="tab-panel-content">
        {tabs[active] && tabs[active].content}
      </div>
    </div>
  );
}
