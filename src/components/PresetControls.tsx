import { useRef, type RefObject } from 'react';
import type { KeyboardPreset } from '../data/presets';

type Props = {
  presets: KeyboardPreset[]; preset: KeyboardPreset; editor: boolean; editing: boolean; bundled: boolean;
  busy: boolean; saving: boolean; storageAvailable: boolean; recoveryPending: boolean; dirty: boolean;
  canUndo: boolean; canRedo: boolean; validationErrors: string[];
  pickerRef: RefObject<HTMLSelectElement | null>;
  onSelect: (id: string) => void; onNew: () => void; onBlank: () => void; onEdit: () => void;
  onAddHotkey: (trigger: HTMLButtonElement) => void; onCancel: (trigger: HTMLButtonElement) => void;
  onSave: (asCustom?: boolean) => void; onUndo: () => void; onRedo: () => void;
  onFieldChange: (field: 'name' | 'game' | 'source' | 'version', value: string) => void;
  onImport: (file: File) => void; onExport: () => void; onExportAll: (trigger: HTMLButtonElement) => void;
  onDelete: (trigger: HTMLButtonElement) => void;
};

export function PresetControls({ presets, preset, editor, editing, bundled, busy, saving, storageAvailable, recoveryPending, dirty, canUndo, canRedo, validationErrors, pickerRef, onSelect, onNew, onBlank, onEdit, onAddHotkey, onCancel, onSave, onUndo, onRedo, onFieldChange, onImport, onExport, onExportAll, onDelete }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const editingBlocked = busy || !storageAvailable || recoveryPending;
  const invalidName = !preset.name.trim();
  const invalidGame = !preset.game.trim();
  const combinationErrors = validationErrors.filter((error) => !error.startsWith('Name ') && !error.startsWith('Game '));
  return (
    <section className="preset-panel" aria-label="Preset controls" aria-busy={busy}>
      <div className={`preset-panel-main${editor ? '' : ' preset-panel-view'}`}>
        <div className="preset-picker">
          <label htmlFor="preset">Active layout</label>
          <div className="select-wrap">
            <select id="preset" ref={pickerRef} value={preset.id} disabled={editing || busy} onChange={(event) => onSelect(event.target.value)}>
              {presets.map((current) => <option key={current.id} value={current.id}>{editor && editing && current.id === preset.id ? preset.name || 'Unnamed preset' : current.name}</option>)}
              {editor && editing && !presets.some((current) => current.id === preset.id) && <option value={preset.id}>{preset.name || 'Unnamed preset'}</option>}
            </select>
          </div>
          <span className="game-badge">{preset.game}</span>
        </div>
        {!editor && <div className="mode-controls" aria-label="Preset actions">
          <button type="button" disabled={editingBlocked || editing} onClick={onBlank}>New preset</button>
        </div>}
        {editor && <div className="mode-controls" aria-label="Preset actions">
          <button type="button" disabled={editingBlocked} onClick={(event) => onAddHotkey(event.currentTarget)}>Add hotkey</button>
          {editing ? <>
            <button type="button" className="secondary-button" disabled={busy} onClick={(event) => onCancel(event.currentTarget)}>Cancel</button>
            <button type="button" className={bundled ? 'secondary-button' : undefined} disabled={editingBlocked || !!validationErrors.length} onClick={() => onSave()}>{saving ? 'Saving...' : bundled ? 'Save for this session' : 'Save preset'}</button>
            {bundled && <button type="button" disabled={editingBlocked || !!validationErrors.length} onClick={() => onSave(true)}>Save as custom</button>}
          </> : <>
            <button type="button" className="secondary-button" disabled={editingBlocked} onClick={onNew}>Clone preset</button>
            <button type="button" className="secondary-button" disabled={editingBlocked} onClick={onEdit}>Edit preset</button>
          </>}
        </div>}
      </div>
      {editor && bundled && <p className="preset-notice">{editing ? 'Bundled edits reset on reload. Save as custom to keep them.' : 'Bundled layout · Clone preset to keep your changes.'}</p>}
      {!!combinationErrors.length && <div className="preset-notice preset-validation"><p>{editor ? 'Resolve these combinations before saving:' : 'This layout has invalid combinations. Open Edit to repair them.'}</p><ul>{combinationErrors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
      {editor && (editing ? <>
        <div className="draft-toolbar mode-controls">
          <span className="draft-indicator" role="status">{dirty ? 'Unsaved changes' : 'No changes yet'}</span>
          <button type="button" className="secondary-button" disabled={busy || !canUndo} onClick={onUndo}>Undo</button>
          <button type="button" className="secondary-button" disabled={busy || !canRedo} onClick={onRedo}>Redo</button>
        </div>
        <fieldset className="preset-editor" disabled={busy}>
          <legend className="visually-hidden">Preset details</legend>
          <div className="preset-field"><label htmlFor="preset-name">Name</label><input id="preset-name" required aria-invalid={invalidName} aria-describedby={invalidName ? 'preset-name-error' : undefined} value={preset.name} onChange={(event) => onFieldChange('name', event.target.value)} />{invalidName && <span className="field-error" id="preset-name-error">Enter a preset name.</span>}</div>
          <div className="preset-field"><label htmlFor="preset-game">Game</label><input id="preset-game" required aria-invalid={invalidGame} aria-describedby={invalidGame ? 'preset-game-error' : undefined} value={preset.game} onChange={(event) => onFieldChange('game', event.target.value)} />{invalidGame && <span className="field-error" id="preset-game-error">Enter a game name.</span>}</div>
          <details className="preset-metadata"><summary>Source and version</summary>
            <label>Source<input value={preset.source ?? ''} onChange={(event) => onFieldChange('source', event.target.value)} placeholder="e.g. In-game settings or a reference URL" /></label>
            <label>Version<input value={preset.version ?? ''} onChange={(event) => onFieldChange('version', event.target.value)} placeholder="e.g. Game patch or preset revision" /></label>
          </details>
        </fieldset>
      </> : <details className="preset-management">
        <summary>More preset actions</summary>
        <div className="preset-library mode-controls" aria-label="Preset backup and management">
          <button type="button" className="secondary-button" disabled={editingBlocked} onClick={onBlank}>Blank preset</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={onExport}>Export preset</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={(event) => onExportAll(event.currentTarget)}>Export all presets</button>
          <button type="button" className="secondary-button" disabled={editingBlocked} onClick={() => fileInput.current?.click()}>Import presets</button>
          {!bundled && <button type="button" className="secondary-button danger-button" disabled={editingBlocked} onClick={(event) => onDelete(event.currentTarget)}>Delete preset</button>}
          <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import preset JSON" className="visually-hidden" tabIndex={-1} disabled={editingBlocked} onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = ''; if (file) onImport(file);
          }} />
        </div>
        <p className="preset-notice">Game: {preset.game}{preset.source && <><br />Source: {preset.source}</>}{preset.version && <><br />Version: {preset.version}</>}<br />Reference only; configure the actual bindings in the game.</p>
      </details>)}
    </section>
  );
}
