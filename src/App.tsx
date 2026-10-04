import './App.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadPresets, savePreset, type KeyboardPreset } from './data/presets';
import {
  detectKeyboardLabels, getDisplayRows, getKeyLabel, setKeyboardShape, setKeyboardProfile, withKeyCodes,
  type KeyboardShape, type LabelLayout, type KeyPosition,
} from './data/keyboardLayouts';
import { canIdentifyKeyboard, identifyKeyboard } from './data/keyboardDevice';
import { getKeyboardProfile, getProfileSize, type KeyboardProfile } from './data/keyboardProfiles';
import { KeyboardSetup } from './components/KeyboardSetup';
import { KeyEditor } from './components/KeyEditor';

type AppMode = 'view' | 'edit';
type TooltipPosition = {
  keyId: string;
  left: number;
  top: number;
  arrowLeft: number;
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
    keyboard: preset.keyboard ? {
      ...preset.keyboard,
      detectedLabels: preset.keyboard.detectedLabels ? { ...preset.keyboard.detectedLabels } : undefined,
    } : undefined,
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
  const [selectedKey, setSelectedKey] = useState<KeyPosition | null>(null);
  const [hoveredKeyId, setHoveredKeyId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [comboTargetKeyId, setComboTargetKeyId] = useState('');
  const [comboAction, setComboAction] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [layoutStatus, setLayoutStatus] = useState('');
  const detectionRequest = useRef(0);
  const [databaseStatus, setDatabaseStatus] = useState('Loading local database...');
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  const visiblePreset = mode === 'edit' ? draftPreset : activePreset;
  const displayRows = visiblePreset ? getDisplayRows(visiblePreset) : [];
  const visibleProfile = getKeyboardProfile(visiblePreset?.keyboard?.profileId);
  const profileSize = visibleProfile ? getProfileSize(visibleProfile) : undefined;
  const shownKeyIds = new Set(displayRows.flat().filter(({ key }) => !key.spacer).map(({ id }) => id));
  const selectedKeybind = selectedKey ? visiblePreset?.rows[selectedKey.rowIndex]?.[selectedKey.keyIndex] : undefined;
  const selectedKeyId = selectedKey ? getKeyId(selectedKey.rowIndex, selectedKey.keyIndex) : null;
  const keyLabelCounts = new Map<string, number>();

  visiblePreset?.rows.forEach((row) => {
    row.forEach((key) => {
      if (!key.spacer) {
        const label = getKeyLabel(key, visiblePreset?.keyboard);
        keyLabelCounts.set(label, (keyLabelCounts.get(label) ?? 0) + 1);
      }
    });
  });

  const keyOptions =
    visiblePreset?.rows.flatMap((row, rowIndex) =>
      row.flatMap((key, keyIndex) =>
        key.spacer
          ? []
          : (() => {
              const baseLabel = getKeyLabel(key, visiblePreset.keyboard) || 'Blank key';
              const duplicateCount = keyLabelCounts.get(baseLabel) ?? 0;
              const matchingKeysBeforeThisOne = visiblePreset.rows
                .slice(0, rowIndex + 1)
                .flatMap((currentRow, currentRowIndex) =>
                  currentRow
                    .slice(0, currentRowIndex === rowIndex ? keyIndex + 1 : undefined)
                    .filter((currentKey) => !currentKey.spacer && getKeyLabel(currentKey, visiblePreset.keyboard) === baseLabel),
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
  const availableComboTargets = keyOptions.filter(({ id }) =>
    shownKeyIds.has(id) && id !== selectedKeyId &&
    !selectedKeybind?.combinations?.some((combination) => combination.keyId === id),
  );
  const hiddenKeyCount = keyOptions.filter(({ id }) => !shownKeyIds.has(id)).length;
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
          setPresets(loadedPresets.map(withKeyCodes));
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
    if (!listening || mode !== 'edit' || !draftPreset) return;
    const preset = draftPreset;

    function selectPhysicalKey(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.key === 'Tab') return;
      event.preventDefault();
      event.stopPropagation();
      setListening(false);
      if (event.key === 'Escape') {
        setLayoutStatus('Key selection cancelled.');
        return;
      }
      const entry = getDisplayRows(preset).flat().find(({ key }) => !key.spacer && key.code === event.code);
      if (!entry) {
        setLayoutStatus('That key is outside this shape or cannot be identified. Select “All saved keys” or click a displayed key.');
        return;
      }
      setSelectedKey({ rowIndex: entry.rowIndex, keyIndex: entry.keyIndex });
      setComboTargetKeyId('');
      setComboAction('');
      setLayoutStatus(`Selected ${getKeyLabel(entry.key, preset.keyboard)}.`);
    }

    function stopListening() {
      setListening(false);
      setLayoutStatus('Key selection stopped when the window lost focus.');
    }

    window.addEventListener('keydown', selectPhysicalKey, true);
    window.addEventListener('blur', stopListening);
    return () => {
      window.removeEventListener('keydown', selectPhysicalKey, true);
      window.removeEventListener('blur', stopListening);
    };
  }, [listening, mode, draftPreset]);

  useEffect(() => {
    if (!tooltipPosition) {
      return;
    }

    function dismissTooltip() {
      setHoveredKeyId(null);
      setTooltipPosition(null);
    }

    window.addEventListener('scroll', dismissTooltip, true);
    window.addEventListener('resize', dismissTooltip);

    return () => {
      window.removeEventListener('scroll', dismissTooltip, true);
      window.removeEventListener('resize', dismissTooltip);
    };
  }, [tooltipPosition]);

  function resetKeyboardInteraction() {
    detectionRequest.current += 1;
    setDetecting(false);
    setConnecting(false);
    setListening(false);
    setLayoutStatus('');
    setHoveredKeyId(null);
    setTooltipPosition(null);
    setSelectedKey(null);
    setComboTargetKeyId('');
    setComboAction('');
  }

  function changeKeyboardShape(shape: KeyboardShape) {
    setDraftPreset((current) => current ? setKeyboardShape(current, shape) : current);
    resetKeyboardInteraction();
  }

  function applyKeyboardProfile(profile: KeyboardProfile, identified: boolean) {
    if (!activePreset) return;
    resetKeyboardInteraction();
    if (mode === 'edit') {
      setDraftPreset((current) => current ? setKeyboardProfile(current, profile) : current);
    } else {
      const customPreset = createPresetFromTemplate(activePreset);
      customPreset.name = `${activePreset.name} — ${profile.name.split(' · ')[0]}`;
      setDraftPreset(setKeyboardProfile(customPreset, profile));
      setMode('edit');
      setDatabaseStatus('Editing a new preset');
    }
    setLayoutStatus(`${identified ? 'Identified' : 'Manually selected'} ${profile.name}. The board now matches its physical keys. Edit your commands, then save the preset.`);
  }

  function changeKeyboardModel(profileId: string) {
    const profile = getKeyboardProfile(profileId);
    if (profile) applyKeyboardProfile(profile, false);
  }

  async function connectKeyboard() {
    const request = ++detectionRequest.current;
    setConnecting(true);
    setLayoutStatus('Choose your keyboard in the browser’s device picker…');
    try {
      const result = await identifyKeyboard();
      if (request !== detectionRequest.current) return;
      if (result.kind === 'matched') {
        applyKeyboardProfile(result.profile, true);
      } else if (result.kind === 'unknown') {
        setLayoutStatus(`${result.name} (${result.identity}) has no matching profile yet. Choose a supported model, or create a preset with a generic shape. The current board is unchanged.`);
      } else {
        setLayoutStatus('No keyboard selected. Choose a supported model manually, or try connecting again.');
      }
    } catch (error) {
      if (request !== detectionRequest.current) return;
      setLayoutStatus(error instanceof Error ? error.message : 'Could not identify the keyboard. Choose a model manually.');
    } finally {
      if (request === detectionRequest.current) setConnecting(false);
    }
  }

  function changeKeyboardLabels(labels: LabelLayout) {
    setDraftPreset((current) => current ? {
      ...current,
      keyboard: { shape: 'original', ...current.keyboard, labels },
    } : current);
    resetKeyboardInteraction();
  }

  async function detectLabels() {
    const request = ++detectionRequest.current;
    setDetecting(true);
    setLayoutStatus('Reading keyboard labels…');
    try {
      const detectedLabels = await detectKeyboardLabels();
      if (request !== detectionRequest.current) return;
      setDraftPreset((current) => current ? {
        ...current,
        keyboard: { shape: 'original', ...current.keyboard, labels: 'detected', detectedLabels },
      } : current);
      setSelectedKey(null);
      setHoveredKeyId(null);
      setTooltipPosition(null);
      setLayoutStatus('Keyboard labels detected. Check that they match your keyboard. The physical board is unchanged.');
    } catch (error) {
      if (request !== detectionRequest.current) return;
      setLayoutStatus(error instanceof Error
        ? error.message
        : 'Could not detect keyboard labels. Choose a character layout manually.');
    } finally {
      if (request === detectionRequest.current) setDetecting(false);
    }
  }

  function createPreset() {
    if (!activePreset) {
      return;
    }

    const newPreset = createPresetFromTemplate(activePreset);

    setDraftPreset(newPreset);
    resetKeyboardInteraction();
    setMode('edit');
    setSelectedKey(null);
    setDatabaseStatus('Editing a new preset');
  }

  function startEditing() {
    if (!activePreset) {
      return;
    }

    resetKeyboardInteraction();
    setDraftPreset(clonePreset(activePreset));
    setMode('edit');
    setSelectedKey(null);
    setDatabaseStatus('Editing preset');
  }

  function cancelEditing() {
    resetKeyboardInteraction();
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
      resetKeyboardInteraction();
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

  function showTooltip(keyId: string, keyElement: HTMLElement) {
    const tooltipWidth = 210;
    const viewportPadding = 8;
    const keyBounds = keyElement.getBoundingClientRect();
    const keyCenter = keyBounds.left + keyBounds.width / 2;
    const left = Math.min(
      Math.max(keyCenter - tooltipWidth / 2, viewportPadding),
      window.innerWidth - tooltipWidth - viewportPadding,
    );

    setHoveredKeyId(keyId);
    setTooltipPosition({
      keyId,
      left,
      top: keyBounds.bottom + 12,
      arrowLeft: keyCenter - left,
    });
  }

  function hideTooltip(keyId: string) {
    setHoveredKeyId((currentKeyId) => (currentKeyId === keyId ? null : currentKeyId));
    setTooltipPosition((currentPosition) =>
      currentPosition?.keyId === keyId ? null : currentPosition,
    );
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
                  disabled={mode === 'edit' || connecting}
                  onChange={(event) => { resetKeyboardInteraction(); setActivePresetId(event.target.value); }}
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
                  <button type="button" className="secondary-button" disabled={connecting} onClick={createPreset}>
                    <span aria-hidden="true">＋</span> New preset
                  </button>
                  <button type="button" disabled={connecting} onClick={startEditing}>
                    <span aria-hidden="true">✦</span> Edit preset
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="secondary-button" onClick={cancelEditing}>
                    Cancel
                  </button>
                  <button type="button" disabled={detecting || connecting} onClick={saveDraftPreset}>
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
        <p className={`database-status ${databaseStatus.startsWith('Could not') ? 'status-error' : ''}`} aria-live="polite">
          <span aria-hidden="true" />{databaseStatus}
        </p>
        <p className="interaction-hint">Hover or focus a key to view its commands</p>
      </div>

      {visiblePreset && (
        <KeyboardSetup
          settings={visiblePreset.keyboard}
          editing={mode === 'edit'}
          detecting={detecting}
          connecting={connecting}
          identificationAvailable={canIdentifyKeyboard()}
          listening={listening}
          status={layoutStatus}
          hiddenKeyCount={hiddenKeyCount}
          onShapeChange={changeKeyboardShape}
          onModelChange={changeKeyboardModel}
          onConnect={connectKeyboard}
          onCancelConnect={() => { resetKeyboardInteraction(); setLayoutStatus('Keyboard identification cancelled.'); }}
          onLabelsChange={changeKeyboardLabels}
          onDetect={detectLabels}
          onListen={() => { setListening((current) => !current); setLayoutStatus(''); }}
        />
      )}

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

      {mode === 'edit' && selectedKey && selectedKeybind && (
        <KeyEditor
          key={getKeyId(selectedKey.rowIndex, selectedKey.keyIndex)}
          label={keyLabels.get(selectedKeyId ?? '') ?? getKeyLabel(selectedKeybind, visiblePreset?.keyboard)}
          keybind={selectedKeybind}
          options={availableComboTargets}
          keyLabels={keyLabels}
          targetKeyId={comboTargetKeyId}
          action={comboAction}
          onHotkeysChange={(value) => updateDraftHotkeys(selectedKey.rowIndex, selectedKey.keyIndex, value)}
          onTargetChange={setComboTargetKeyId}
          onActionChange={setComboAction}
          onAddCombination={() => addDraftCombination(selectedKey.rowIndex, selectedKey.keyIndex)}
          onCombinationChange={(id, value) => updateDraftCombinationAction(selectedKey.rowIndex, selectedKey.keyIndex, id, value)}
          onRemoveCombination={(id) => removeDraftCombination(selectedKey.rowIndex, selectedKey.keyIndex, id)}
          onClose={() => {
            document.querySelector<HTMLElement>(`[data-key-position="${getKeyId(selectedKey.rowIndex, selectedKey.keyIndex)}"]`)?.focus();
            setSelectedKey(null);
          }}
        />
      )}

      <div className="keyboard-frame">
        <div className={`keyboard ${visibleProfile ? 'keyboard-profile' : ''}`} style={profileSize}>
          {displayRows.map((row, displayRowIndex) => (
          <div
            className="keyboard-row"
            key={displayRowIndex}
            style={!visibleProfile && visiblePreset?.keyboard && visiblePreset.keyboard.shape !== 'original' ? {
              height: `${Math.min(1, ...row.filter(({ key }) => !key.spacer).map(({ key }) => key.height ?? 1)) * 64}px`,
            } : undefined}
          >
            {row.map(({ key, rowIndex, keyIndex, id: keyId, placement }) => {
              const width = `${(key.width ?? 1) * 64}px`;
              const height = `${(key.height ?? 1) * 64}px`;
              const label = getKeyLabel(key, visiblePreset?.keyboard);
              const isSelected =
                selectedKey?.rowIndex === rowIndex && selectedKey.keyIndex === keyIndex;
              const isHighlighted = highlightedKeyIds.has(keyId);
              if (key.spacer) {
                return (
                  <div
                    key={keyId}
                    style={{ width }}
                  />
                );
              }

              return (
                <div
                  className={`key ${mode === 'edit' ? 'key-editable' : ''} ${isSelected ? 'key-selected' : ''} ${isHighlighted ? 'key-combo-highlight' : ''}`}
                  key={keyId}
                  style={{ width, height, ...(placement ? { left: placement.x * 74, top: placement.y * 74 } : {}) }}
                  data-key-position={keyId}
                  data-key-code={key.code}
                  aria-label={keyLabels.get(keyId)}
                  aria-pressed={mode === 'edit' ? isSelected : undefined}
                  role={mode === 'edit' ? 'button' : undefined}
                  tabIndex={0}
                  onMouseEnter={(event) => showTooltip(keyId, event.currentTarget)}
                  onMouseLeave={(event) => {
                    if (document.activeElement !== event.currentTarget) {
                      hideTooltip(keyId);
                    }
                  }}
                  onFocus={(event) => {
                    const target = event.currentTarget;
                    setHoveredKeyId(keyId);
                    setTooltipPosition(null);
                    // Focus can scroll a distant key into view. Wait for that
                    // scroll before showing its tooltip; later scrolls dismiss it.
                    requestAnimationFrame(() => {
                      if (document.activeElement === target) showTooltip(keyId, target);
                    });
                  }}
                  onBlur={() => hideTooltip(keyId)}
                  onClick={() => {
                    if (mode === 'edit') {
                      setListening(false);
                      setSelectedKey({ rowIndex, keyIndex });
                      setComboTargetKeyId('');
                      setComboAction('');
                    }
                  }}
                  onKeyDown={(event) => {
                    if (mode === 'edit' && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      setListening(false);
                      setSelectedKey({ rowIndex, keyIndex });
                      setComboTargetKeyId('');
                      setComboAction('');
                    }
                  }}
                >
                  <span>{label}</span>

                  {mode === 'edit' ? (
                    <small>{key.hotkeys.filter(Boolean)[0] ?? 'Unassigned'}</small>
                  ) : (
                    tooltipPosition?.keyId === keyId &&
                    createPortal(
                      <div
                        className="tooltip"
                        role="tooltip"
                        style={{
                          left: tooltipPosition.left,
                          top: tooltipPosition.top,
                          '--tooltip-arrow-left': `${tooltipPosition.arrowLeft}px`,
                        } as React.CSSProperties}
                      >
                        <strong>{label}</strong>
                        {key.hotkeys.map((hotkey) => (
                          <p key={hotkey || `${key.label}-empty`}>{hotkey || 'Unassigned'}</p>
                        ))}
                        {key.combinations?.map((combination) => (
                          <p className="combo-tooltip" key={combination.keyId}>
                            {label} + {keyLabels.get(combination.keyId) ?? combination.keyId}
                            {combination.action ? `: ${combination.action}` : ': No action specified'}
                          </p>
                        ))}
                      </div>,
                      document.body,
                    )
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
