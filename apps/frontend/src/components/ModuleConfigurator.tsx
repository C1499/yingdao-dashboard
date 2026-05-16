import type { ModuleItem } from '../types';

interface ModuleConfiguratorProps {
  modules: ModuleItem[];
  visibility: Record<string, boolean>;
  onToggle: (key: string, visible: boolean) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
}

function ModuleConfigurator({ modules, visibility, onToggle, onMove }: ModuleConfiguratorProps) {
  return (
    <div className="columns-panel module-panel">
      <h3>模块配置</h3>
      <div className="module-config-list">
        {modules.map((module, index) => (
          <div key={module.key} className="module-config-item">
            <label className="column-checkbox module-visibility">
              <input
                type="checkbox"
                checked={visibility[module.key] !== false}
                onChange={(event) => onToggle(module.key, event.target.checked)}
              />
              <span>
                <strong>{module.title}</strong>
                {module.description ? <em>{module.description}</em> : null}
              </span>
            </label>
            <div className="module-config-actions">
              <button type="button" className="mini-button" onClick={() => onMove(module.key, 'up')} disabled={index === 0}>
                上移
              </button>
              <button type="button" className="mini-button" onClick={() => onMove(module.key, 'down')} disabled={index === modules.length - 1}>
                下移
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModuleConfigurator;
