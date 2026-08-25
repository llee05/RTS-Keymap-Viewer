import './App.css';
import { useEffect, useState } from 'react';
import { loadPresets, savePreset, type KeyboardPreset } from './data/presets';

type AppMode = 'view' | 'edit';
type SelectedKey = {
  rowIndex: number;
  keyIndex: number;
};

function getKeyId(rowIndex: number, keyIndex: number) {
  return `${rowIndex}-${keyIndex}`;
}

function getOrdinal(value: number) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const lastTwoDigits = value % 100;
  const suffix = suffixes[(lastTwoDigits - 20) % 10] ?? suffixes[lastTwoDigits] ?? suffixes[0];

  return `${value}${suffix}`;
}

function clonePreset(preset: KeyboardPreset): KeyboardPreset {
  return {
    ...preset,
    rows: preset.rows.map((row) =>
      row.map((key) => ({
        ...key,
        hotkeys: [...key.hotkeys],
        combinations: key.combinations?.map((combination) => ({ ...combination })),
      })),
    ),
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
  const [hoveredKeyId, setHoveredKeyId] = useState<string | null>(null);
  const [comboTargetKeyId, setComboTargetKeyId] = useState('');
  const [comboAction, setComboAction] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState('Loading local database...');
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  const visiblePreset = mode === 'edit' ? draftPreset : activePreset;
  const keyLabelCounts = new Map<string, number>();

  visiblePreset?.rows.forEach((row) => {
    row.forEach((key) => {
      if (!key.spacer) {
        keyLabelCounts.set(key.label, (keyLabelCounts.get(key.label) ?? 0) + 1);
      }
    });
  });

  const keyOptions =
    visiblePreset?.rows.flatMap((row, rowIndex) =>
      row.flatMap((key, keyIndex) =>
        key.spacer
          ? []
          : (() => {
              const baseLabel = key.label || 'Blank key';
              const duplicateCount = keyLabelCounts.get(key.label) ?? 0;
              const matchingKeysBeforeThisOne = visiblePreset.rows
                .slice(0, rowIndex + 1)
                .flatMap((currentRow, currentRowIndex) =>
                  currentRow
                    .slice(0, currentRowIndex === rowIndex ? keyIndex + 1 : undefined)
                    .filter((currentKey) => !currentKey.spacer && currentKey.label === key.label),
                ).length;
              const duplicateLabel =
                duplicateCount === 2
                  ? `${matchingKeysBeforeThisOne === 1 ? 'Left' : 'Right'} ${baseLabel}`
                  : `${getOrdinal(matchingKeysBeforeThisOne)} ${baseLabel}`;

              return [
                {
                  id: getKeyId(rowIndex, keyIndex),
                  label: duplicateCount > 1 ? duplicateLabel : baseLabel,
                },
              ];
            })(),
      ),
    ) ?? [];
  const keyLabels = new Map(keyOptions.map((keyOption) => [keyOption.id, keyOption.label]));
  const highlightedKeyIds = new Set<string>();

  if (hoveredKeyId && visiblePreset) {
    highlightedKeyIds.add(hoveredKeyId);

    visiblePreset.rows.forEach((row, rowIndex) => {
      row.forEach((key, keyIndex) => {
        const currentKeyId = getKeyId(rowIndex, keyIndex);

        key.combinations?.forEach((combination) => {
          if (currentKeyId === hoveredKeyId) {
            highlightedKeyIds.add(combination.keyId);
          }

          if (combination.keyId === hoveredKeyId) {
            highlightedKeyIds.add(currentKeyId);
          }
        });
      });
    });
  }

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

  useEffect(() => {
    if (mode !== 'edit' || !selectedKey) {
      return;
    }

    const currentSelectedKey = selectedKey;

    function closeEditorOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      const selectedKeyElement = event.target.closest(
        `[data-key-position="${currentSelectedKey.rowIndex}-${currentSelectedKey.keyIndex}"]`,
      );

      if (!selectedKeyElement) {
        setSelectedKey(null);
      }
    }

    document.addEventListener('pointerdown', closeEditorOnOutsideClick, true);

    return () => {
      document.removeEventListener('pointerdown', closeEditorOnOutsideClick, true);
    };
  }, [mode, selectedKey]);

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

  function addDraftCombination(rowIndex: number, keyIndex: number) {
    const selectedKeyId = getKeyId(rowIndex, keyIndex);
    const trimmedAction = comboAction.trim();

    if (!comboTargetKeyId || !trimmedAction || comboTargetKeyId === selectedKeyId) {
      return;
    }

    setDraftPreset((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const rows = currentDraft.rows.map((row, currentRowIndex) =>
        row.map((key, currentKeyIndex) => {
          if (currentRowIndex !== rowIndex || currentKeyIndex !== keyIndex) {
            return key;
          }

          const combinations = key.combinations ?? [];

          if (combinations.some((combination) => combination.keyId === comboTargetKeyId)) {
            return key;
          }

          return {
            ...key,
            combinations: [...combinations, { keyId: comboTargetKeyId, action: trimmedAction }],
          };
        }),
      );

      return { ...currentDraft, rows };
    });
    setComboTargetKeyId('');
    setComboAction('');
  }

  function updateDraftCombinationAction(
    rowIndex: number,
    keyIndex: number,
    keyId: string,
    action: string,
  ) {
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
            combinations: key.combinations?.map((combination) =>
              combination.keyId === keyId ? { ...combination, action } : combination,
            ),
          };
        }),
      );

      return { ...currentDraft, rows };
    });
  }

  function removeDraftCombination(rowIndex: number, keyIndex: number, keyId: string) {
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
            combinations: key.combinations?.filter((combination) => combination.keyId !== keyId),
          };
        }),
      );

      return { ...currentDraft, rows };
    });
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div>
          <p className="eyebrow">Command reference</p>
          <h1>RTS Keymap Viewer</h1>
          <p className="intro">Learn your layout. Build the muscle memory. Play faster.</p>
        </div>
      </header>

      {visiblePreset && (
        <section className="preset-panel" aria-label="Preset controls">
          <div className="preset-panel-main">
            <div className="preset-picker">
              <label htmlFor="preset">Active layout</label>
              <div className="select-wrap">
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
              </div>
              <span className="game-badge">{visiblePreset.game}</span>
            </div>

            <div className="mode-controls" aria-label="Preset actions">
              {mode === 'view' ? (
                <>
                  <button type="button" className="secondary-button" onClick={createPreset}>
                    <span aria-hidden="true">＋</span> New preset
                  </button>
                  <button type="button" onClick={startEditing}>
                    <span aria-hidden="true">✦</span> Edit preset
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
        </section>
      )}

      <div className="status-row">
        <p className="database-status"><span aria-hidden="true" />{databaseStatus}</p>
        <p className="interaction-hint">Hover a key to view its commands</p>
      </div>

      <div className="keyboard-heading">
        <div>
          <p className="eyebrow">Reference board</p>
          <h2>{visiblePreset?.name ?? 'Keyboard layout'}</h2>
        </div>
        <div className="keyboard-legend" aria-label="Keyboard legend">
          <span><i className="legend-dot assigned" /> Assigned</span>
          <span><i className="legend-dot combination" /> Combination</span>
        </div>
      </div>

      <div className="keyboard-frame">
        <div className="keyboard">
          {visiblePreset?.rows.map((row, rowIndex) => (
          <div className="keyboard-row" key={rowIndex}>
            {row.map((key, keyIndex) => {
              const width = `${(key.width ?? 1) * 64}px`;
              const height = `${(key.height ?? 1) * 64}px`;
              const keyId = getKeyId(rowIndex, keyIndex);
              const isSelected =
                selectedKey?.rowIndex === rowIndex && selectedKey.keyIndex === keyIndex;
              const isHighlighted = highlightedKeyIds.has(keyId);
              const availableComboTargets = keyOptions.filter(
                (keyOption) =>
                  keyOption.id !== keyId &&
                  !key.combinations?.some((combination) => combination.keyId === keyOption.id),
              );

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
                  className={`key ${mode === 'edit' ? 'key-editable' : ''} ${isSelected ? 'key-selected' : ''} ${isHighlighted ? 'key-combo-highlight' : ''}`}
                  key={`${key.label}-${rowIndex}-${keyIndex}`}
                  style={{ width, height }}
                  data-key-position={keyId}
                  role={mode === 'edit' ? 'button' : undefined}
                  tabIndex={mode === 'edit' ? 0 : undefined}
                  onMouseEnter={() => setHoveredKeyId(keyId)}
                  onMouseLeave={() => setHoveredKeyId((currentKeyId) => (currentKeyId === keyId ? null : currentKeyId))}
                  onClick={() => {
                    if (mode === 'edit') {
                      setSelectedKey({ rowIndex, keyIndex });
                      setComboTargetKeyId('');
                      setComboAction('');
                    }
                  }}
                  onKeyDown={(event) => {
                    if (mode === 'edit' && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      setSelectedKey({ rowIndex, keyIndex });
                      setComboTargetKeyId('');
                      setComboAction('');
                    }
                  }}
                >
                  <span>{key.label}</span>

                  {mode === 'edit' ? (
                    <>
                      <small>{key.hotkeys.filter(Boolean)[0] ?? 'Unassigned'}</small>
                      {isSelected && (
                        <div className="key-editor" onClick={(event) => event.stopPropagation()}>
                          <textarea
                            aria-label={`${key.label} hotkeys`}
                            autoFocus
                            value={key.hotkeys.join('\n')}
                            placeholder="Single-tap hotkey"
                            onChange={(event) =>
                              updateDraftHotkeys(rowIndex, keyIndex, event.target.value)
                            }
                          />
                          <div className="combo-editor">
                            <label>
                              Combination key
                              <select
                                value={comboTargetKeyId}
                                onChange={(event) => setComboTargetKeyId(event.target.value)}
                              >
                                <option value="">Choose key</option>
                                {availableComboTargets.map((keyOption) => (
                                  <option key={keyOption.id} value={keyOption.id}>
                                    {keyOption.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Action
                              <input
                                value={comboAction}
                                placeholder="Action for this combination"
                                onChange={(event) => setComboAction(event.target.value)}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={!comboTargetKeyId || !comboAction.trim()}
                              onClick={() => addDraftCombination(rowIndex, keyIndex)}
                            >
                              Add combination
                            </button>
                            {(key.combinations?.length ?? 0) > 0 && (
                              <ul>
                                {key.combinations?.map((combination) => (
                                  <li key={combination.keyId}>
                                    <span>
                                      {key.label} + {keyLabels.get(combination.keyId) ?? combination.keyId}
                                    </span>
                                    <input
                                      value={combination.action ?? ''}
                                      placeholder="Action"
                                      aria-label={`${key.label} + ${
                                        keyLabels.get(combination.keyId) ?? combination.keyId
                                      } action`}
                                      onChange={(event) =>
                                        updateDraftCombinationAction(
                                          rowIndex,
                                          keyIndex,
                                          combination.keyId,
                                          event.target.value,
                                        )
                                      }
                                    />
                                    <button
                                      type="button"
                                      aria-label={`Remove ${key.label} combination`}
                                      onClick={() =>
                                        removeDraftCombination(rowIndex, keyIndex, combination.keyId)
                                      }
                                    >
                                      Remove
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="tooltip">
                      <strong>{key.label}</strong>
                      {key.hotkeys.map((hotkey) => (
                        <p key={hotkey || `${key.label}-empty`}>{hotkey || 'Unassigned'}</p>
                      ))}
                      {key.combinations?.map((combination) => (
                        <p className="combo-tooltip" key={combination.keyId}>
                          {key.label} + {keyLabels.get(combination.keyId) ?? combination.keyId}
                          {combination.action ? `: ${combination.action}` : ': No action specified'}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default App;
