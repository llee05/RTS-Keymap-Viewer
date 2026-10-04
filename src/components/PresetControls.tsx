import { useRef, type RefObject } from 'react';
import type { KeyboardPreset } from '../data/presets';

type Props = {
  presets: KeyboardPreset[];
  preset: KeyboardPreset;
  editing: boolean;
  bundled: boolean;
  busy: boolean;
  saving: boolean;
  validationErrors: string[];
  pickerRef: RefObject<HTMLSelectElement | null>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (asCustom?: boolean) => void;
  onFieldChange: (field: 'name' | 'game', value: string) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onDelete: (trigger: HTMLButtonElement) => void;
};

export function PresetControls({
  presets, preset, editing, bundled, busy, saving, validationErrors, pickerRef,
  onSelect, onNew, onEdit, onCancel, onSave, onFieldChange, onImport, onExport, onDelete,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className="preset-panel" aria-label="Preset controls" aria-busy={busy}>
      <div className="preset-panel-main">
        <div className="preset-picker">
          <label htmlFor="preset">Active layout</label>
          <div className="select-wrap">
            <select id="preset" ref={pickerRef} value={preset.id} disabled={editing || busy} onChange={(event) => onSelect(event.target.value)}>
              {presets.map((current) => <option key={current.id} value={current.id}>{current.name}</option>)}
              {editing && !presets.some((current) => current.id === preset.id) && <option value={preset.id}>{preset.name}</option>}
            </select>
          </div>
          <span className="game-badge">{preset.game}</span>
        </div>
        <div className="mode-controls" aria-label="Preset actions">
          {editing ? (
            <>
              <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button>
              <button type="button" className={bundled ? 'secondary-button' : undefined} disabled={busy} onClick={() => onSave()}>{saving ? 'Saving...' : bundled ? 'Save for this session' : 'Save preset'}</button>
              {bundled && <button type="button" disabled={busy} onClick={() => onSave(true)}>Save as custom</button>}
            </>
          ) : (
            <>
              <button type="button" className="secondary-button" disabled={busy} onClick={onNew}>＋ New preset</button>
              <button type="button" disabled={busy} onClick={onEdit}>Edit preset</button>
            </>
          )}
        </div>
      </div>
      {bundled && <p className="preset-notice">Bundled preset: direct edits reset after reload. {editing ? 'Choose Save as custom to keep your changes.' : 'Choose New preset to keep a customized copy.'}</p>}
      {!!validationErrors.length && <div className="preset-notice preset-validation"><p>This preset has invalid combinations. Edit it to remove or correct them before saving.</p><ul>{validationErrors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
      {editing ? (
        <fieldset className="preset-editor" disabled={busy}>
          <legend className="visually-hidden">Preset details</legend>
          <label htmlFor="preset-name">Name<input id="preset-name" value={preset.name} onChange={(event) => onFieldChange('name', event.target.value)} /></label>
          <label htmlFor="preset-game">Game<input id="preset-game" value={preset.game} onChange={(event) => onFieldChange('game', event.target.value)} /></label>
        </fieldset>
      ) : (
        <div className="preset-library mode-controls" aria-label="Preset backup and management">
          <button type="button" className="secondary-button" disabled={busy} onClick={onExport}>Export preset</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => fileInput.current?.click()}>Import presets</button>
          {!bundled && <button type="button" className="secondary-button danger-button" disabled={busy} onClick={(event) => onDelete(event.currentTarget)}>Delete preset</button>}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Import preset JSON"
            className="visually-hidden"
            tabIndex={-1}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onImport(file);
            }}
          />
        </div>
      )}
    </section>
  );
}
