import { useId, useState } from 'react';
import type { KeyboardPreset, Keybind, KeyCombination } from '../data/presets';
import type { KeyOption } from '../data/keyboard';
import { getCombinationLabel, getCombinationTargets } from '../data/keyboard';
import { getPresetValidationErrors } from '../data/presetValidation';
import { updatePresetKey } from '../data/presetEditing';
import { Dialog } from './Dialog';
import { KeyPicker } from './KeyPicker';

type Props = {
  preset: KeyboardPreset; keybind: Keybind; keyId: string; label: string;
  options: KeyOption[]; busy: boolean; trigger: HTMLButtonElement;
  onClose: () => void; onChange: (key: Keybind) => void;
};

export function KeyEditor({ preset, keybind, keyId, label, options, busy, trigger, onClose, onChange }: Props) {
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState('');
  const id = useId();
  const labels = new Map(options.map((option) => [option.id, option.label]));
  const targets = options.filter((option) => option.id !== keyId);
  const availableTargets = targets.filter((option) => !keybind.combinations?.some((combination) => combination.keyId === option.id && getCombinationTargets(combination).length === 1 && (combination.context ?? '').trim().toLowerCase() === context.trim().toLowerCase()));
  const candidate: KeyCombination = { keyId: targetIds[0] ?? '', ...(targetIds.length > 1 ? { additionalKeyIds: targetIds.slice(1) } : {}), action: action.trim(), ...(context.trim() ? { context: context.trim() } : {}), ...(category.trim() ? { category: category.trim() } : {}) };
  const [rowIndex, keyIndex] = keyId.split('-').map(Number);
  const errors = getPresetValidationErrors(preset);
  const candidateErrors = targetIds.length ? getPresetValidationErrors(updatePresetKey(preset, { rowIndex, keyIndex }, (key) => ({ ...key, combinations: [...(key.combinations ?? []), candidate] }))).filter((error) => !errors.includes(error)) : [];
  function changeCombination(index: number, change: Partial<KeyCombination>) {
    onChange({ ...keybind, combinations: keybind.combinations?.map((combination, current) => current === index ? { ...combination, ...change } : combination) });
  }
  return (
    <Dialog title={`Edit ${label}`} className="key-editor" busy={busy} returnFocusTo={trigger} onClose={onClose} closeLabel="Close editor" initialFocus="textarea">
      <fieldset disabled={busy}>
        <legend className="visually-hidden">Commands and combinations</legend>
        <label className="editor-label" htmlFor={`${id}-commands`}>Commands</label>
        <p className="editor-help" id={`${id}-help`}>One command per line. Changes stay in the draft until you save the preset.</p>
        <textarea id={`${id}-commands`} aria-label={`${label} hotkeys`} aria-describedby={`${id}-help`} autoFocus value={keybind.hotkeys.join('\n')} placeholder="Commands for this key" onChange={(event) => onChange({ ...keybind, hotkeys: event.target.value.split('\n') })} />
        <div className="editor-fields">
          <label>Command category<input value={keybind.category ?? ''} onChange={(event) => onChange({ ...keybind, category: event.target.value })} /></label>
          <label>Command context<input value={keybind.context ?? ''} onChange={(event) => onChange({ ...keybind, context: event.target.value })} /></label>
        </div>
        <div className="combo-editor">
          <label htmlFor={`${id}-target`}>Combination key</label>
          <select id={`${id}-target`} value={targetIds.length === 1 ? targetIds[0] : ''} onChange={(event) => setTargetIds(event.target.value ? [event.target.value] : [])}>
            <option value="">Choose key</option>
            {availableTargets.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <details><summary>Choose multiple combination keys</summary><KeyPicker options={targets} selected={targetIds} onChange={setTargetIds} /></details>
          <label htmlFor={`${id}-action`}>Action</label>
          <input id={`${id}-action`} value={action} placeholder="Action for this combination" onChange={(event) => setAction(event.target.value)} />
          <div className="editor-fields">
            <label>Combination category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
            <label>Combination context<input value={context} placeholder="Use a distinct context for a repeated shortcut" onChange={(event) => setContext(event.target.value)} /></label>
          </div>
          {!!candidateErrors.length && <p className="dialog-error" role="alert">{candidateErrors.join(' ')}</p>}
          <button type="button" disabled={!targetIds.length || !action.trim() || !!candidateErrors.length} onClick={() => {
            onChange({ ...keybind, combinations: [...(keybind.combinations ?? []), candidate] });
            setTargetIds([]); setAction(''); setContext(''); setCategory('');
          }}>Add combination</button>
          {!!keybind.combinations?.length && <ul>
            {keybind.combinations.map((combination, index) => {
              const name = getCombinationLabel(label, combination, labels);
              return <li key={index} className="combination-item">
                <span>{name}</span>
                <input aria-label={`${name} action`} value={combination.action} placeholder="Action" onChange={(event) => changeCombination(index, { action: event.target.value })} />
                <button type="button" aria-label={`Remove ${name} combination`} onClick={() => onChange({ ...keybind, combinations: keybind.combinations?.filter((_, current) => current !== index) })}>Remove</button>
                <details className="combination-details"><summary>Change keys, category or context</summary>
                  <KeyPicker options={targets} selected={getCombinationTargets(combination)} onChange={(ids) => changeCombination(index, { keyId: ids[0] ?? '', additionalKeyIds: ids.slice(1) })} />
                  <div className="editor-fields">
                    <label>Category for {name}<input value={combination.category ?? ''} onChange={(event) => changeCombination(index, { category: event.target.value })} /></label>
                    <label>Context for {name}<input value={combination.context ?? ''} onChange={(event) => changeCombination(index, { context: event.target.value })} /></label>
                  </div>
                </details>
              </li>;
            })}
          </ul>}
          {!!errors.length && <p className="dialog-error" role="alert">Resolve before saving: {errors.join(' ')}</p>}
        </div>
      </fieldset>
    </Dialog>
  );
}
