import './App.css';
import { useEffect, useState } from 'react';
import { loadPresets, savePreset, type KeyboardPreset } from './data/presets';

type AppMode = 'view' | 'edit';
type SelectedKey = {
  rowIndex: number;
  keyIndex: number;
};

function clonePreset(preset: KeyboardPreset): KeyboardPreset {
  return {
    ...preset,
    rows: preset.rows.map((row) => row.map((key) => ({ ...key, hotkeys: [...key.hotkeys] }))),
  };
}

function createPresetFromTemplate(template: KeyboardPreset): KeyboardPreset {
  return {
    ...clonePreset(template),
    id: `custom-${Date.now()}`,
    name: 'Custom Preset',
  };
}

function parseHotkeyText(value: string): string[] {
  const hotkeys = value
    .split('\n')
    .map((hotkey) => hotkey.trim())
    .filter(Boolean);

  return hotkeys.length > 0 ? hotkeys : [''];
}

function App() {
  const [presets, setPresets] = useState<KeyboardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState('aoe4-default');
  const [mode, setMode] = useState<AppMode>('view');
  const [draftPreset, setDraftPreset] = useState<KeyboardPreset | null>(null);
  const [selectedKey, setSelectedKey] = useState<SelectedKey | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState('Loading local database...');
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  const visiblePreset = mode === 'edit' ? draftPreset : activePreset;

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

  function createPreset() {
    if (!activePreset) {
      return;
    }

    const newPreset = createPresetFromTemplate(activePreset);

    setDraftPreset(newPreset);
    setActivePresetId(newPreset.id);
    setMode('edit');
    setSelectedKey(null);
    setDatabaseStatus('Editing a new preset');
  }

  function startEditing() {
    if (!activePreset) {
      return;
    }

    setDraftPreset(clonePreset(activePreset));
    setMode('edit');
    setSelectedKey(null);
    setDatabaseStatus('Editing preset');
  }

  function cancelEditing() {
    setDraftPreset(null);
    setMode('view');
    setSelectedKey(null);
    setDatabaseStatus('Edit cancelled');
  }

  async function saveDraftPreset() {
    if (!draftPreset) {
      return;
    }

    try {
      await savePreset(draftPreset);
      setPresets((currentPresets) => {
        const presetExists = currentPresets.some((preset) => preset.id === draftPreset.id);

        if (presetExists) {
          return currentPresets.map((preset) =>
            preset.id === draftPreset.id ? draftPreset : preset,
          );
        }

        return [...currentPresets, draftPreset];
      });
      setActivePresetId(draftPreset.id);
      setDraftPreset(null);
      setMode('view');
      setSelectedKey(null);
      setDatabaseStatus('Saved preset to local database');
    } catch {
      setDatabaseStatus('Could not save to local database');
    }
  }

  function updateDraftField(field: 'name' | 'game', value: string) {
    setDraftPreset((currentDraft) =>
      currentDraft ? { ...currentDraft, [field]: value } : currentDraft,
    );
  }

  function updateDraftHotkeys(rowIndex: number, keyIndex: number, value: string) {
    setDraftPreset((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const rows = currentDraft.rows.map((row, currentRowIndex) =>
        row.map((key, currentKeyIndex) => {
          if (currentRowIndex !== rowIndex || currentKeyIndex !== keyIndex) {
            return key;
          }

          return {
            ...key,
            hotkeys: parseHotkeyText(value),
          };
        }),
      );

      return { ...currentDraft, rows };
    });
  }

  return (
    <main className="app">
      <h1>RTS Keymap Viewer</h1>

      {visiblePreset && (
        <div className="preset-panel">
          <div className="preset-picker">
            <label htmlFor="preset">Preset</label>
            <select
              id="preset"
              value={visiblePreset.id}
              disabled={mode === 'edit'}
              onChange={(event) => setActivePresetId(event.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
              {mode === 'edit' && draftPreset && !presets.some((preset) => preset.id === draftPreset.id) && (
                <option value={draftPreset.id}>{draftPreset.name}</option>
              )}
            </select>
            <span>{visiblePreset.game}</span>
          </div>

          <div className="mode-controls" aria-label="Preset actions">
            {mode === 'view' ? (
              <>
                <button type="button" onClick={createPreset}>
                  New preset
                </button>
                <button type="button" onClick={startEditing}>
                  Edit preset
                </button>
              </>
            ) : (
              <>
                <button type="button" className="secondary-button" onClick={cancelEditing}>
                  Cancel
                </button>
                <button type="button" onClick={saveDraftPreset}>
                  Save preset
                </button>
              </>
            )}
          </div>

          {mode === 'edit' && draftPreset && (
            <div className="preset-editor">
              <label htmlFor="preset-name">
                Name
                <input
                  id="preset-name"
                  value={draftPreset.name}
                  onChange={(event) => updateDraftField('name', event.target.value)}
                />
              </label>
              <label htmlFor="preset-game">
                Game
                <input
                  id="preset-game"
                  value={draftPreset.game}
                  onChange={(event) => updateDraftField('game', event.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <p className="database-status">{databaseStatus}</p>

      <div className="keyboard">
        {visiblePreset?.rows.map((row, rowIndex) => (
          <div className="keyboard-row" key={rowIndex}>
            {row.map((key, keyIndex) => {
              const width = `${(key.width ?? 1) * 64}px`;
              const isSelected =
                selectedKey?.rowIndex === rowIndex && selectedKey.keyIndex === keyIndex;

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
                  className={`key ${mode === 'edit' ? 'key-editable' : ''} ${isSelected ? 'key-selected' : ''}`}
                  key={`${key.label}-${rowIndex}-${keyIndex}`}
                  style={{ width }}
                  role={mode === 'edit' ? 'button' : undefined}
                  tabIndex={mode === 'edit' ? 0 : undefined}
                  onClick={() => {
                    if (mode === 'edit') {
                      setSelectedKey({ rowIndex, keyIndex });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (mode === 'edit' && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      setSelectedKey({ rowIndex, keyIndex });
                    }
                  }}
                >
                  <span>{key.label}</span>

                  {mode === 'edit' ? (
                    <>
                      <small>{key.hotkeys.filter(Boolean)[0] ?? 'Unassigned'}</small>
                      {isSelected && (
                        <textarea
                          aria-label={`${key.label} hotkeys`}
                          className="key-editor"
                          autoFocus
                          value={key.hotkeys.join('\n')}
                          placeholder="One hotkey per line"
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateDraftHotkeys(rowIndex, keyIndex, event.target.value)
                          }
                        />
                      )}
                    </>
                  ) : (
                    <div className="tooltip">
                      <strong>{key.label}</strong>
                      {key.hotkeys.map((hotkey) => (
                        <p key={hotkey || `${key.label}-empty`}>{hotkey || 'Unassigned'}</p>
                      ))}
                    </div>
                  )}
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
