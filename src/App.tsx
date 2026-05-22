import './App.css';
import { useMemo, useState } from 'react';
import { loadPresets } from './data/presets';

function App() {
  const [activePresetId, setActivePresetId] = useState('aoe4-default');
  const presets = useMemo(() => loadPresets(), []);
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];

  return (
    <main className="app">
      <h1>RTS Keymap Viewer</h1>

      {activePreset && (
        <div className="preset-picker">
          <label htmlFor="preset">Preset</label>
          <select
            id="preset"
            value={activePreset.id}
            onChange={(event) => setActivePresetId(event.target.value)}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <span>{activePreset.game}</span>
        </div>
      )}

      <div className="keyboard">
        {activePreset?.rows.map((row, rowIndex) => (
          <div className="keyboard-row" key={rowIndex}>
            {row.map((key, keyIndex) => {
              const width = `${(key.width ?? 1) * 64}px`;

              if (key.spacer) {
                return (
                  <div
                    key={`spacer-${rowIndex}-${keyIndex}`}
                    style={{ width }}
                  />
                );
              }

              return (
                <div
                  className="key"
                  key={`${key.label}-${rowIndex}-${keyIndex}`}
                  style={{ width }}
                >
                  <span>{key.label}</span>

                  <div className="tooltip">
                    <strong>{key.label}</strong>
                    {key.hotkeys.map((hotkey) => (
                      <p key={hotkey}>{hotkey}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
