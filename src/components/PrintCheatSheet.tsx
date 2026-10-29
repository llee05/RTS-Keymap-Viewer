import type { KeyboardPreset } from '../data/presets';
import { displayShortcut, getCommandEntries, type KeyOption } from '../data/keyboard';

export function PrintHeader({ preset, options }: { preset: KeyboardPreset; options: KeyOption[] }) {
  const entries = getCommandEntries(preset);
  return (
    <header className="print-header">
      <div className="print-header-brand">
        <span className="print-brand-title">RTS Keymap Cheat Sheet</span>
        <span className="print-game-badge">{preset.game}</span>
      </div>
      <h1 className="print-title">{preset.name}</h1>
      <div className="print-meta">
        {preset.source && <span className="print-meta-item">Source: {preset.source}</span>}
        {preset.version && <span className="print-meta-item">Version: {preset.version}</span>}
        <span className="print-meta-item">{options.length} keys · {entries.length} commands</span>
      </div>
    </header>
  );
}

export function PrintLegend() {
  return (
    <div className="print-legend" aria-label="Print legend">
      <span><i className="print-legend-dot assigned" aria-hidden="true" /> Assigned key command</span>
      <span><i className="print-legend-dot combination" aria-hidden="true" /> Combination participant</span>
    </div>
  );
}

export function PrintCommandList({ preset }: { preset: KeyboardPreset }) {
  const entries = getCommandEntries(preset);
  const categories = [...new Set(entries.map((entry) => entry.category))].sort();

  return (
    <section className="print-command-list" aria-label="Commands by category">
      <h2 className="print-section-heading">Commands by Category ({entries.length})</h2>
      <div className="print-category-columns">
        {categories.map((category) => {
          const categoryEntries = entries.filter((entry) => entry.category === category);
          return (
            <div key={category} className="print-category-group">
              <h3 className="print-category-title">
                <span>{category}</span>
                <span className="print-category-count">({categoryEntries.length})</span>
              </h3>
              <table className="print-category-table">
                <tbody>
                  {categoryEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="print-table-shortcut">
                        <kbd>{displayShortcut(entry.shortcut)}</kbd>
                      </td>
                      <td className="print-table-action">
                        <span className="print-action-text">{entry.action}</span>
                        {entry.context && <span className="print-action-context"> · {entry.context}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}
