import { useId, useState } from 'react';
import type { Keybind } from '../data/presets';
import type { KeyOption } from '../data/keyboard';
import { getCombinationLabel, getCombinationTargets } from '../data/keyboard';
import { Dialog } from './Dialog';

type Props = {
  keybind: Keybind;
  keyId: string;
  label: string;
  options: KeyOption[];
  busy: boolean;
  trigger: HTMLButtonElement;
  onClose: () => void;
  onChange: (key: Keybind) => void;
};

export function KeyEditor({ keybind, keyId, label, options, busy, trigger, onClose, onChange }: Props) {
  const [targetId, setTargetId] = useState('');
  const [action, setAction] = useState('');
  const commandsId = useId();
  const helpId = useId();
  const targetSelectId = useId();
  const actionId = useId();
  const labels = new Map(options.map((option) => [option.id, option.label]));
  const availableTargets = options.filter((option) => option.id !== keyId && !keybind.combinations?.some((combination) => combination.keyId === option.id && getCombinationTargets(combination).length === 1));

  function addCombination() {
    if (!action.trim() || !availableTargets.some((option) => option.id === targetId)) return;
    onChange({ ...keybind, combinations: [...(keybind.combinations ?? []), { keyId: targetId, action: action.trim() }] });
    setTargetId('');
    setAction('');
  }

  return (
    <Dialog title={`Edit ${label}`} className="key-editor" busy={busy} returnFocusTo={trigger} onClose={onClose} closeLabel="Close editor" initialFocus="textarea">
      <fieldset disabled={busy}>
        <legend className="visually-hidden">Commands and combinations</legend>
        <label className="editor-label" htmlFor={commandsId}>Commands</label>
        <p className="editor-help" id={helpId}>One command per line. Changes stay in the draft until you save the preset.</p>
        <textarea
          id={commandsId}
          aria-label={`${label} hotkeys`}
          aria-describedby={helpId}
          autoFocus
          value={keybind.hotkeys.join('\n')}
          placeholder="Commands for this key"
          onChange={(event) => onChange({ ...keybind, hotkeys: event.target.value.split('\n') })}
        />
        <div className="combo-editor">
          <label htmlFor={targetSelectId}>Combination key</label>
          <select id={targetSelectId} value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            <option value="">Choose key</option>
            {availableTargets.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <label htmlFor={actionId}>Action</label>
          <input id={actionId} value={action} placeholder="Action for this combination" onChange={(event) => setAction(event.target.value)} />
          <button type="button" disabled={!targetId || !action.trim()} onClick={addCombination}>Add combination</button>
          {!!keybind.combinations?.length && (
            <ul>
              {keybind.combinations.map((combination, index) => (
                <li key={`${combination.keyId}-${index}`}>
                  <span>{getCombinationLabel(label, combination, labels)}</span>
                  <input
                    aria-label={`${getCombinationLabel(label, combination, labels)} action`}
                    value={combination.action}
                    placeholder="Action"
                    onChange={(event) => onChange({ ...keybind, combinations: keybind.combinations?.map((current, currentIndex) => currentIndex === index ? { ...current, action: event.target.value } : current) })}
                  />
                  <button type="button" aria-label={`Remove ${getCombinationLabel(label, combination, labels)} combination`} onClick={() => onChange({ ...keybind, combinations: keybind.combinations?.filter((_, currentIndex) => currentIndex !== index) })}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>
    </Dialog>
  );
}
