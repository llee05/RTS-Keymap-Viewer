import { useId, useState } from 'react';
import type { KeyboardPreset, Keybind, KeyCombination } from '../data/presets';
import type { KeyOption } from '../data/keyboard';
import { getCombinationLabel, getCombinationTargets } from '../data/keyboard';
import { getPresetValidationErrors } from '../data/presetValidation';
import { updatePresetKey } from '../data/presetEditing';
import { Dialog } from './Dialog';
import { KeyPicker } from './KeyPicker';
import { HotkeyAdvancedOptions } from './HotkeyAdvancedOptions';

type Props = {
  preset: KeyboardPreset; keybind: Keybind; keyId: string; label: string;
  options: KeyOption[]; busy: boolean; trigger: HTMLButtonElement;
  onClose: () => void; onChange: (key: Keybind) => void;
};

export function KeyEditor({ preset, keybind, keyId, label, options, busy, trigger, onClose, onChange }: Props) {
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState('');
  const id = useId();
  const labels = new Map(options.map((option) => [option.id, option.label]));
  const targets = options.filter((option) => option.id !== keyId);
  const availableTargets = targets.filter((option) => !keybind.combinations?.some((combination) => combination.keyId === option.id && getCombinationTargets(combination).length === 1 && (combination.context ?? '').trim().toLowerCase() === context.trim().toLowerCase()));
  const candidate: KeyCombination = { keyId: targetIds[0] ?? '', ...(targetIds.length > 1 ? { additionalKeyIds: targetIds.slice(1) } : {}), action: command.trim(), ...(context.trim() ? { context: context.trim() } : {}), ...(category.trim() ? { category: category.trim() } : {}) };
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
        <label className="editor-label" htmlFor={`${id}-commands`}>Commands for {label} alone</label>
        <p className="editor-help" id={`${id}-help`}>Describe what pressing {label} by itself does, one command per line. Changes stay in the draft until you save the preset.</p>
        <textarea id={`${id}-commands`} aria-describedby={`${id}-help`} autoFocus value={keybind.hotkeys.join('\n')} placeholder="e.g. Attack Move" onChange={(event) => onChange({ ...keybind, hotkeys: event.target.value.split('\n') })} />
        <HotkeyAdvancedOptions category={keybind.category ?? ''} context={keybind.context ?? ''} onCategoryChange={(category) => onChange({ ...keybind, category })} onContextChange={(context) => onChange({ ...keybind, context })} scopeNote={`These labels apply to all commands for ${label} alone.`} />
        <div className="combo-editor">
          <h3 className="editor-label">Commands with other keys</h3>
          <p className="editor-help" id={`${id}-combination-help`}>Combine {label} with the keys below, then describe what the full shortcut does.</p>
          <label htmlFor={`${id}-target`}>Combination key</label>
          <select id={`${id}-target`} value={targetIds.length === 1 ? targetIds[0] : ''} onChange={(event) => setTargetIds(event.target.value ? [event.target.value] : [])}>
            <option value="">Choose key</option>
            {availableTargets.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <details><summary>Choose multiple combination keys</summary><KeyPicker options={targets} selected={targetIds} onChange={setTargetIds} /></details>
          <label htmlFor={`${id}-combination-command`}>Combination command</label>
          <input id={`${id}-combination-command`} aria-describedby={`${id}-combination-help`} value={command} placeholder="e.g. Select all units" onChange={(event) => setCommand(event.target.value)} />
          <HotkeyAdvancedOptions category={category} context={context} onCategoryChange={setCategory} onContextChange={setContext} categoryLabel="Combination category (optional)" contextLabel="Combination context (optional)" categoryPlaceholder="Use this key's category" />
          {!!candidateErrors.length && <p className="dialog-error" role="alert">{candidateErrors.join(' ')}</p>}
          <button type="button" disabled={!targetIds.length || !command.trim() || !!candidateErrors.length} onClick={() => {
            onChange({ ...keybind, combinations: [...(keybind.combinations ?? []), candidate] });
            setTargetIds([]); setCommand(''); setContext(''); setCategory('');
          }}>Add combination</button>
          {!!keybind.combinations?.length && <ul>
            {keybind.combinations.map((combination, index) => {
              const name = getCombinationLabel(label, combination, labels);
              return <li key={index} className="combination-item">
                <span>{name}</span>
                <input aria-label={`${name} command`} value={combination.action} placeholder="Command" onChange={(event) => changeCombination(index, { action: event.target.value })} />
                <button type="button" aria-label={`Remove ${name} combination`} onClick={() => onChange({ ...keybind, combinations: keybind.combinations?.filter((_, current) => current !== index) })}>Remove</button>
                <details className="combination-details"><summary>Change keys</summary>
                  <KeyPicker options={targets} selected={getCombinationTargets(combination)} onChange={(ids) => changeCombination(index, { keyId: ids[0] ?? '', additionalKeyIds: ids.slice(1) })} />
                </details>
                <HotkeyAdvancedOptions category={combination.category ?? ''} context={combination.context ?? ''} onCategoryChange={(category) => changeCombination(index, { category })} onContextChange={(context) => changeCombination(index, { context })} categoryLabel={`Category for ${name} (optional)`} contextLabel={`Context for ${name} (optional)`} categoryPlaceholder="Use this key's category" />
              </li>;
            })}
          </ul>}
          {!!errors.length && <p className="dialog-error" role="alert">Resolve before saving: {errors.join(' ')}</p>}
        </div>
      </fieldset>
    </Dialog>
  );
}
