import './App.css';
import { useEffect, useState } from 'react';
import { loadPresets, savePreset, type KeyboardPreset } from './data/presets';

function App() {
  const [presets, setPresets] = useState<KeyboardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState('aoe4-default');
  const [databaseStatus, setDatabaseStatus] = useState('Loading local database...');
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];

  useEffect(() => {
    let ignore = false;

    async function hydratePresets() {
      try {
        const loadedPresets = await loadPresets();

        if (!ignore) {
          setPresets(loadedPresets);
          setActivePresetId(loadedPresets[0]?.id ?? '');
          setDatabaseStatus('Loaded from local database');
        }
      } catch {
        if (!ignore) {
          setDatabaseStatus('Could not open local database');
        }
      }
    }

    hydratePresets();

    return () => {
      ignore = true;
    };
  }, []);

  async function savePresetCopy() {
    if (!activePreset) {
      return;
    }

    const presetCopy: KeyboardPreset = {
      ...activePreset,
      id: `${activePreset.id}-${Date.now()}`,
      name: `${activePreset.name} Copy`,
    };

    try {
      await savePreset(presetCopy);
      setPresets((currentPresets) => [...currentPresets, presetCopy]);
      setActivePresetId(presetCopy.id);
      setDatabaseStatus('Saved preset copy to local database');
    } catch {
      setDatabaseStatus('Could not save to local database');
    }
  }

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
          <button type="button" onClick={savePresetCopy}>
            Save copy
          </button>
        </div>
      )}

      <p className="database-status">{databaseStatus}</p>

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
