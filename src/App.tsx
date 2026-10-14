import './App.css';
import { useEffect, useRef, useState } from 'react';
import { deletePreset, loadPresets, savePreset, savePresets, type KeyboardPreset, type Keybind } from './data/presets';
import { defaultPresets } from './data/defaultPresets';
import { getPresetValidationErrors, validatePreset } from './data/presetValidation';
import { clonePreset, createCustomPreset, createBlankPreset, normalizePreset, updatePresetKey, type KeyPosition } from './data/presetEditing';
import { getKeyId, getKeyOptions } from './data/keyboard';
import { assignRecordedHotkey } from './data/hotkeyCapture';
import { MAX_IMPORT_BYTES, parsePresetImport, createPresetBackups } from './data/presetTransfer';
import { PresetControls } from './components/PresetControls';
import { Keyboard } from './components/Keyboard';
import { KeyEditor } from './components/KeyEditor';
import { HotkeyRecorder } from './components/HotkeyRecorder';
import { Dialog } from './components/Dialog';
import { useDraft } from './hooks/useDraft';
import { readActivePreset, rememberActivePreset, readRecoveredDraft, rememberDraft } from './data/browserState';

type EditingKey = KeyPosition & { trigger: HTMLButtonElement };
type PendingDelete = { preset: KeyboardPreset; trigger: HTMLButtonElement };
type Operation = 'save' | 'import' | 'delete' | null;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'local database unavailable';
const isBundled = (id: string) => defaultPresets.some((preset) => preset.id === id);

function App() {
  const [editor, setEditor] = useState(() => window.location.hash === '#edit');
  const [presets, setPresets] = useState<KeyboardPreset[]>(defaultPresets);
  const [activePresetId, setActivePresetId] = useState(() => readActivePreset() ?? 'aoe4-default');
  const { draft, setDraft, undo, redo, canUndo, canRedo } = useDraft();
  const [recovery, setRecovery] = useState(readRecoveredDraft);
  const [recoveryAvailable, setRecoveryAvailable] = useState(true);
  const [storageMode, setStorageMode] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [backupParts, setBackupParts] = useState<{ parts: string[]; trigger: HTMLElement } | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<{ trigger: HTMLElement; recovery: boolean } | null>(null);
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
  const visiblePreset = editor ? draft ?? activePreset : activePreset;
  const editing = editor && !!draft;
  const busy = operation !== null;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(activePreset);
  const selectedKeybind = editingKey && draft?.rows[editingKey.rowIndex]?.[editingKey.keyIndex];
  const options = draft ? getKeyOptions(draft) : [];
  const selectedId = editingKey ? getKeyId(editingKey.rowIndex, editingKey.keyIndex) : '';

  useEffect(() => {
    const navigate = () => {
      setEditor(window.location.hash === '#edit');
      setEditingKey(null);
      setHotkeyTrigger(null);
      setPendingDiscard(null);
      setPendingDelete(null);
      setBackupParts(null);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    let ignore = false;
    loadPresets().then((loaded) => {
      if (ignore) return;
      setPresets(loaded);
      const remembered = readActivePreset();
      setActivePresetId(loaded.some((preset) => preset.id === remembered) ? remembered! : loaded[0]?.id ?? '');
      setStorageMode('ready');
      setStatus('Loaded from local database');
    }).catch(() => { if (!ignore) { setStorageMode('unavailable'); setStatus('Could not open local database'); } });
    return () => { ignore = true; };
  }, [loadAttempt]);

  useEffect(() => {
    if (storageMode === 'ready') rememberActivePreset(activePresetId);
  }, [activePresetId, storageMode]);

  useEffect(() => {
    if (draft) Promise.resolve(rememberDraft({ preset: draft, activePresetId })).then(setRecoveryAvailable);
  }, [draft, activePresetId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function clearRecovery() {
    setRecovery(null);
    rememberDraft(null);
  }

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

  function startEditing(mode: 'edit' | 'clone' | 'blank' = 'edit') {
    if (!activePreset || draft || operationInProgress.current || storageMode !== 'ready' || recovery) return;
    setDraft(mode === 'blank' ? createBlankPreset(activePreset) : mode === 'clone' ? createCustomPreset(activePreset, `${activePreset.name} (Copy)`) : clonePreset(activePreset));
    setEditingKey(null);
    setStatus(mode === 'edit' ? 'Editing preset' : 'Editing a new preset');
    if (!editor) {
      setEditor(true);
      window.location.hash = '#edit';
      requestAnimationFrame(() => document.getElementById('preset-name')?.focus());
    }
  }

  function cancelEditing() {
    if (operationInProgress.current) return;
    setDraft(null);
    setEditingKey(null);
    clearRecovery();
    setStatus('Edit cancelled');
    focusPicker();
  }

  async function saveDraft(asCustom = false) {
    if (!draft || storageMode !== 'ready' || !beginOperation('save', 'Saving preset...')) return;
    try {
      const normalized = normalizePreset(draft);
      validatePreset(normalized);
      const saved = asCustom ? createCustomPreset(normalized, `${normalized.name} (Custom)`) : normalized;
      await savePreset(saved);
      setPresets((current) => current.some((preset) => preset.id === saved.id)
        ? current.map((preset) => preset.id === saved.id ? saved : preset)
        : [...current, saved]);
      setActivePresetId(saved.id);
      setDraft(null);
      setEditingKey(null);
      clearRecovery();
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

  function addHotkey(keyIds: string[], command: string, context: string, category: string) {
    if (!editor || !visiblePreset || operationInProgress.current) return;
    setDraft(assignRecordedHotkey(draft ?? clonePreset(visiblePreset), keyIds, command, context, category));
    setHotkeyTrigger(null);
    setStatus('Hotkey added to draft. Save the preset to keep your changes.');
  }

  async function importPresets(file: File) {
    if (draft || recovery || storageMode !== 'ready' || !beginOperation('import', 'Importing presets...')) return;
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

  function downloadBackup(backup: string, name: string) {
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportPreset(all = false, trigger?: HTMLElement) {
    if (!activePreset || operationInProgress.current) return;
    try {
      const backups = createPresetBackups(all ? presets : [activePreset]);
      if (backups.length > 1 && trigger) {
        setBackupParts({ parts: backups, trigger });
        setStatus('Library backup is ready in multiple parts');
        return;
      }
      const name = activePreset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';
      downloadBackup(backups[0], all ? 'rts-keymap-all-presets.json' : `rts-keymap-${name}.json`);
      setStatus(all ? `Exported all ${presets.length} presets as JSON` : 'Exported preset as JSON');
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
      <nav className="screen-nav" aria-label="App screens">
        <a href="#view" aria-current={!editor ? 'page' : undefined} aria-disabled={busy} onClick={(event) => { if (busy) event.preventDefault(); }}>View</a>
        <a href="#edit" aria-current={editor ? 'page' : undefined} aria-disabled={busy} onClick={(event) => { if (busy) event.preventDefault(); }}>Edit{draft && <span className="unsaved-nav"> · Unsaved</span>}</a>
      </nav>
      {editor && <p className="editor-screen-heading">Edit commands and manage presets. Return to View to see your saved layout.</p>}
      {visiblePreset && (
        <PresetControls
          presets={presets}
          preset={visiblePreset}
          editor={editor}
          editing={!!draft}
          bundled={isBundled(visiblePreset.id)}
          busy={busy || storageMode === 'loading'}
          storageAvailable={storageMode === 'ready'}
          recoveryPending={!!recovery}
          dirty={dirty}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          saving={operation === 'save'}
          validationErrors={getPresetValidationErrors(visiblePreset)}
          pickerRef={picker}
          onSelect={(id) => { if (!operationInProgress.current) setActivePresetId(id); }}
          onNew={() => startEditing('clone')}
          onBlank={() => startEditing('blank')}
          onEdit={() => startEditing()}
          onAddHotkey={(trigger) => { if (editor && !operationInProgress.current) setHotkeyTrigger(trigger); }}
          onCancel={(trigger) => { if (dirty) setPendingDiscard({ trigger, recovery: false }); else cancelEditing(); }}
          onSave={saveDraft}
          onFieldChange={(field, value) => setDraft((current) => current ? { ...current, [field]: value } : current)}
          onImport={importPresets}
          onExport={() => exportPreset()}
          onExportAll={(trigger) => exportPreset(true, trigger)}
          onDelete={(trigger) => { setDeleteError(''); setPendingDelete({ preset: visiblePreset, trigger }); }}
        />
      )}
      {storageMode === 'unavailable' && <div className="recovery-banner">
        <p>You can view the bundled layout. Open Edit to retry storage or export. Saving is unavailable until storage reconnects.</p>
        {editor && <button type="button" className="secondary-button" onClick={() => { setStorageMode('loading'); setStatus('Loading local database...'); setLoadAttempt((attempt) => attempt + 1); }}>Retry storage</button>}
      </div>}
      {recovery && !draft && <div className="recovery-banner" role="region" aria-label="Recovered draft">
        <p>Unsaved draft found: <strong>{recovery.preset.name || 'Unnamed preset'}</strong>.</p>
        {editor ? <div className="mode-controls">
          <button type="button" disabled={storageMode !== 'ready'} onClick={() => {
            setActivePresetId(presets.some((preset) => preset.id === recovery.activePresetId) ? recovery.activePresetId : presets[0].id);
            setDraft(recovery.preset); setRecovery(null); setStatus('Recovered unsaved draft');
          }}>Restore draft</button>
          <button type="button" className="secondary-button" onClick={(event) => setPendingDiscard({ trigger: event.currentTarget, recovery: true })}>Discard recovery</button>
        </div> : <a href="#edit">Review recovery in Edit</a>}
      </div>}
      {editor && draft && !recoveryAvailable && <p className="dialog-error" role="alert">Draft recovery is unavailable. Save your preset before closing this page.</p>}
      <div className="status-row">
        <p className={`database-status ${status.startsWith('Could not') ? 'status-error' : ''}`} aria-live="polite"><span aria-hidden="true" />{status}</p>
        <p className="interaction-hint">{editing ? 'Use Add hotkey to record a binding, or select a key to edit' : 'Hover, tap, or focus a key to view its commands'}</p>
      </div>
      {visiblePreset && <Keyboard key={`${visiblePreset.id}-${editing}`} preset={visiblePreset} editor={editor} editing={editing} busy={busy} selected={editing ? editingKey : null} query={query} onQueryChange={setQuery} onEditKey={(position, trigger) => { if (!operationInProgress.current) setEditingKey({ ...position, trigger }); }} />}
      {editor && editingKey && selectedKeybind && (
        <KeyEditor preset={draft!} key={selectedId} keybind={selectedKeybind} keyId={selectedId} label={options.find((option) => option.id === selectedId)?.label ?? selectedKeybind.label} options={options} busy={busy} trigger={editingKey.trigger} onClose={() => { if (!operationInProgress.current) setEditingKey(null); }} onChange={changeKey} />
      )}
      {editor && hotkeyTrigger && visiblePreset && (
        <HotkeyRecorder preset={visiblePreset} trigger={hotkeyTrigger} onClose={() => setHotkeyTrigger(null)} onAdd={addHotkey} />
      )}
      {backupParts && <Dialog title="Download backup parts" returnFocusTo={backupParts.trigger} onClose={() => setBackupParts(null)} closeLabel="Close">
        <p>Your library is split into {backupParts.parts.length} parts so each file can be imported. Download every part, then import each file to restore the full library.</p>
        <div className="mode-controls">
          {backupParts.parts.map((part, index) => <button type="button" key={index} onClick={() => downloadBackup(part, `rts-keymap-all-presets-${index + 1}.json`)}>Download part {index + 1}</button>)}
        </div>
      </Dialog>}
      {pendingDiscard && <Dialog title="Discard unsaved changes?" returnFocusTo={pendingDiscard.trigger} onClose={() => setPendingDiscard(null)}>
        <p>Your saved presets will be kept. This discards the {pendingDiscard.recovery ? 'recovered draft' : 'current draft'}.</p>
        <div className="dialog-actions mode-controls">
          <button type="button" className="secondary-button" autoFocus onClick={() => setPendingDiscard(null)}>Keep editing</button>
          <button type="button" className="danger-button" onClick={() => {
            if (pendingDiscard.recovery) clearRecovery(); else cancelEditing();
            setPendingDiscard(null);
          }}>Discard changes</button>
        </div>
      </Dialog>}
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
