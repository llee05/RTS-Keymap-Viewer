import type { Keybind } from '../data/presets';

type Props = {
  label: string;
  keybind: Keybind;
  options: { id: string; label: string }[];
  keyLabels: Map<string, string>;
  targetKeyId: string;
  action: string;
  onHotkeysChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onAddCombination: () => void;
  onCombinationChange: (keyId: string, value: string) => void;
  onRemoveCombination: (keyId: string) => void;
  onClose: () => void;
};

export function KeyEditor({
  label, keybind, options, keyLabels, targetKeyId, action,
  onHotkeysChange, onTargetChange, onActionChange, onAddCombination,
  onCombinationChange, onRemoveCombination, onClose,
}: Props) {
  return (
    <section className="key-editor" aria-label={`Edit ${label}`} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    }}>
      <div className="key-editor-heading">
        <h3>Commands for {label}</h3>
        <button type="button" className="close-editor" onClick={onClose}>Close editor</button>
      </div>
      <div className="key-editor-fields">
        <label className="commands-field">
          Commands (one per line)
          <textarea
            aria-label={`${label} hotkeys`}
            autoFocus
            value={keybind.hotkeys.join('\n')}
            placeholder="Single-tap command"
            onChange={(event) => onHotkeysChange(event.target.value)}
          />
        </label>
        <div className="combo-editor">
          <label>
            Combination key
            <select value={targetKeyId} onChange={(event) => onTargetChange(event.target.value)}>
              <option value="">Choose key</option>
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Action
            <input value={action} placeholder="Action for this combination" onChange={(event) => onActionChange(event.target.value)} />
          </label>
          <button type="button" disabled={!targetKeyId || !action.trim()} onClick={onAddCombination}>Add combination</button>
          {(keybind.combinations?.length ?? 0) > 0 && (
            <ul>
              {keybind.combinations?.map((combination) => {
                const combinationLabel = `${label} + ${keyLabels.get(combination.keyId) ?? combination.keyId}`;
                return (
                  <li key={combination.keyId}>
                    <span>{combinationLabel}</span>
                    <input
                      value={combination.action ?? ''}
                      placeholder="Action"
                      aria-label={`${combinationLabel} action`}
                      onChange={(event) => onCombinationChange(combination.keyId, event.target.value)}
                    />
                    <button type="button" aria-label={`Remove ${label} combination`} onClick={() => onRemoveCombination(combination.keyId)}>Remove</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
