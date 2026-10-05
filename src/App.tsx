import './App.css';
import { useEffect, useRef, useState } from 'react';
import { deletePreset, loadPresets, savePreset, savePresets, type KeyboardPreset, type Keybind } from './data/presets';
import { defaultPresets } from './data/defaultPresets';
import { getPresetValidationErrors } from './data/presetValidation';
import { clonePreset, createCustomPreset, normalizePreset, updatePresetKey, type KeyPosition } from './data/presetEditing';
import { getKeyId, getKeyOptions } from './data/keyboard';
import { assignRecordedHotkey } from './data/hotkeyCapture';
import { MAX_IMPORT_BYTES, parsePresetImport, serializePresets } from './data/presetTransfer';
import { PresetControls } from './components/PresetControls';
import { Keyboard } from './components/Keyboard';
import { KeyEditor } from './components/KeyEditor';
import { HotkeyRecorder } from './components/HotkeyRecorder';
import { Dialog } from './components/Dialog';

type EditingKey = KeyPosition & { trigger: HTMLButtonElement };
type PendingDelete = { preset: KeyboardPreset; trigger: HTMLButtonElement };
type Operation = 'save' | 'import' | 'delete' | null;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'local database unavailable';
const isBundled = (id: string) => defaultPresets.some((preset) => preset.id === id);

function App() {
  const [presets, setPresets] = useState<KeyboardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState('aoe4-default');
  const [draft, setDraft] = useState<KeyboardPreset | null>(null);
  const [editingKey, setEditingKey] = useState<EditingKey | null>(null);
  const [hotkeyTrigger, setHotkeyTrigger] = useState<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState('');
  const [operation, setOperation] = useState<Operation>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [status, setStatus] = useState('Loading local database...');
  const operationInProgress = useRef(false);
  const picker = useRef<HTMLSelectElement>(null);
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  const visiblePreset = draft ?? activePreset;
  const busy = operation !== null;
  const selectedKeybind = editingKey && draft?.rows[editingKey.rowIndex]?.[editingKey.keyIndex];
  const options = draft ? getKeyOptions(draft) : [];
  const selectedId = editingKey ? getKeyId(editingKey.rowIndex, editingKey.keyIndex) : '';

  useEffect(() => {
    let ignore = false;
    loadPresets().then((loaded) => {
      if (ignore) return;
      setPresets(loaded);
      setActivePresetId(loaded[0]?.id ?? '');
      setStatus('Loaded from local database');
    }).catch(() => { if (!ignore) setStatus('Could not open local database'); });
    return () => { ignore = true; };
  }, []);

  function beginOperation(next: Operation, message: string): boolean {
    if (operationInProgress.current) return false;
    operationInProgress.current = true;
    setOperation(next);
    setStatus(message);
    return true;
  }

  function finishOperation() {
    operationInProgress.current = false;
    setOperation(null);
  }

  function focusPicker() {
    requestAnimationFrame(() => picker.current?.focus());
  }

  function startEditing(asNew = false) {
    if (!activePreset || operationInProgress.current) return;
    setDraft(asNew ? createCustomPreset(activePreset) : clonePreset(activePreset));
    setEditingKey(null);
    setStatus(asNew ? 'Editing a new preset' : 'Editing preset');
  }

  function cancelEditing() {
    if (operationInProgress.current) return;
    setDraft(null);
    setEditingKey(null);
    setStatus('Edit cancelled');
    focusPicker();
  }

  async function saveDraft(asCustom = false) {
    if (!draft || !beginOperation('save', 'Saving preset...')) return;
    try {
      const normalized = normalizePreset(draft);
      const saved = asCustom ? createCustomPreset(normalized, `${normalized.name} (Custom)`) : normalized;
      await savePreset(saved);
      setPresets((current) => current.some((preset) => preset.id === saved.id)
        ? current.map((preset) => preset.id === saved.id ? saved : preset)
        : [...current, saved]);
      setActivePresetId(saved.id);
      setDraft(null);
      setEditingKey(null);
      setStatus(isBundled(saved.id) ? 'Saved for this session. Bundled edits reset after reload.' : 'Saved preset to local database');
      focusPicker();
    } catch (error) {
      setStatus(`Could not save preset: ${errorMessage(error)}`);
    } finally {
      finishOperation();
    }
  }

  function changeKey(keybind: Keybind) {
    if (!editingKey || operationInProgress.current) return;
    setDraft((current) => current ? updatePresetKey(current, editingKey, () => keybind) : current);
  }

  function addHotkey(keyIds: string[], command: string) {
    if (!visiblePreset || operationInProgress.current) return;
    setDraft(assignRecordedHotkey(draft ?? clonePreset(visiblePreset), keyIds, command));
    setHotkeyTrigger(null);
    setStatus('Hotkey added to draft. Save the preset to keep your changes.');
  }

  async function importPresets(file: File) {
    if (draft || !beginOperation('import', 'Importing presets...')) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a JSON file smaller than 2 MB.');
      const imported = parsePresetImport(await file.text());
      await savePresets(imported);
      setPresets((current) => [...current, ...imported]);
      setActivePresetId(imported[0].id);
      setStatus(`Imported ${imported.length} ${imported.length === 1 ? 'preset' : 'presets'} as new custom ${imported.length === 1 ? 'copy' : 'copies'}.`);
      focusPicker();
    } catch (error) {
      setStatus(`Could not import presets: ${errorMessage(error)}`);
    } finally {
      finishOperation();
    }
  }

  function exportPreset() {
    if (!activePreset || operationInProgress.current) return;
    try {
      const blob = new Blob([serializePresets([activePreset])], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const name = activePreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';
      link.href = url;
      link.download = `rts-keymap-${name}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Exported preset as JSON');
    } catch (error) {
      setStatus(`Could not export preset: ${errorMessage(error)}`);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || !beginOperation('delete', 'Deleting preset...')) return;
    setDeleteError('');
    try {
      await deletePreset(pendingDelete.preset.id);
      const remaining = presets.filter((preset) => preset.id !== pendingDelete.preset.id);
      setPresets(remaining);
      setActivePresetId(remaining[0]?.id ?? '');
      setPendingDelete(null);
      setStatus(`Deleted ${pendingDelete.preset.name}`);
      focusPicker();
    } catch (error) {
      const message = `Could not delete preset: ${errorMessage(error)}`;
      setDeleteError(message);
      setStatus(message);
    } finally {
      finishOperation();
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>
        <div><p className="eyebrow">Command reference</p><h1>RTS Keymap Viewer</h1><p className="intro">Learn your layout. Build the muscle memory. Play faster.</p></div>
      </header>
      {visiblePreset && (
        <PresetControls
          presets={presets}
          preset={visiblePreset}
          editing={!!draft}
          bundled={isBundled(visiblePreset.id)}
          busy={busy}
          saving={operation === 'save'}
          validationErrors={getPresetValidationErrors(visiblePreset)}
          pickerRef={picker}
          onSelect={(id) => { if (!operationInProgress.current) setActivePresetId(id); }}
          onNew={() => startEditing(true)}
          onEdit={() => startEditing()}
          onAddHotkey={(trigger) => { if (!operationInProgress.current) setHotkeyTrigger(trigger); }}
          onCancel={cancelEditing}
          onSave={saveDraft}
          onFieldChange={(field, value) => setDraft((current) => current ? { ...current, [field]: value } : current)}
          onImport={importPresets}
          onExport={exportPreset}
          onDelete={(trigger) => { setDeleteError(''); setPendingDelete({ preset: visiblePreset, trigger }); }}
        />
      )}
      <div className="status-row">
        <p className={`database-status ${status.startsWith('Could not') ? 'status-error' : ''}`} aria-live="polite"><span aria-hidden="true" />{status}</p>
        <p className="interaction-hint">{draft ? 'Use Add hotkey to record a binding, or select a key to edit' : 'Hover, tap, or focus a key to view its commands'}</p>
      </div>
      {visiblePreset && <Keyboard key={`${visiblePreset.id}-${!!draft}`} preset={visiblePreset} editing={!!draft} busy={busy} selected={editingKey} query={query} onQueryChange={setQuery} onEditKey={(position, trigger) => { if (!operationInProgress.current) setEditingKey({ ...position, trigger }); }} />}
      {editingKey && selectedKeybind && (
        <KeyEditor key={selectedId} keybind={selectedKeybind} keyId={selectedId} label={options.find((option) => option.id === selectedId)?.label ?? selectedKeybind.label} options={options} busy={busy} trigger={editingKey.trigger} onClose={() => { if (!operationInProgress.current) setEditingKey(null); }} onChange={changeKey} />
      )}
      {hotkeyTrigger && visiblePreset && (
        <HotkeyRecorder preset={visiblePreset} trigger={hotkeyTrigger} onClose={() => setHotkeyTrigger(null)} onAdd={addHotkey} />
      )}
      {pendingDelete && (
        <Dialog title="Delete preset?" returnFocusTo={pendingDelete.trigger} busy={busy} onClose={() => { if (!operationInProgress.current) setPendingDelete(null); }}>
          <p>Delete <strong>{pendingDelete.preset.name}</strong> from this browser?</p>
          {deleteError && <p className="dialog-error" role="alert">{deleteError}</p>}
          <div className="dialog-actions mode-controls">
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setPendingDelete(null)} autoFocus>Cancel</button>
            <button type="button" className="danger-button" disabled={busy} onClick={confirmDelete}>{operation === 'delete' ? 'Deleting...' : 'Delete preset'}</button>
          </div>
        </Dialog>
      )}
    </main>
  );
}

export default App;
