import { useState } from 'react';
import { CUBESAT_COMPONENTS } from '../../data/components-data';

export default function ComponentViewer() {
  const [selected, setSelected] = useState(CUBESAT_COMPONENTS[0]);

  return (
    <div className="component-explorer">
      <div className="component-explorer-list" aria-label="Danh mục phân hệ CubeSat">
        {CUBESAT_COMPONENTS.map(comp => (
          <button
            type="button"
            key={comp.id}
            onClick={() => setSelected(comp)}
            className={`component-explorer-item ${selected?.id === comp.id ? 'selected' : ''}`}
            aria-pressed={selected?.id === comp.id}
          >
            <span className="component-explorer-icon" aria-hidden="true">{comp.icon}</span>
            <span className="component-explorer-label">
              <strong>{comp.name.split('—')[0].trim()}</strong>
              <small>{comp.role}</small>
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <article className="component-detail animate-fadeInUp">
          <header className="component-detail-header">
            <span className="component-detail-icon" aria-hidden="true">{selected.icon}</span>
            <div><h2>{selected.name}</h2><p>{selected.role}</p></div>
          </header>
          <p className="component-detail-description">{selected.description}</p>
          <h3>Thông số kỹ thuật</h3>
          <div className="component-spec-scroll">
            <table>
            <tbody>
              {selected.specs.map((spec, i) => (
                <tr key={i}>
                  <th scope="row">{spec.label}</th>
                  <td>{spec.value}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}
