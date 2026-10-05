import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { KeyboardPreset } from '../data/presets';
import { findRecordedCombination, getKeyForCode } from '../data/hotkeyCapture';
import { getKeyOptions } from '../data/keyboard';
import { Dialog } from './Dialog';

type Props = {
  preset: KeyboardPreset;
  trigger: HTMLButtonElement;
  onClose: () => void;
  onAdd: (keyIds: string[], command: string) => void;
};

export function HotkeyRecorder({ preset, trigger, onClose, onAdd }: Props) {
  const [command, setCommand] = useState('');
  const [recording, setRecording] = useState(false);
  const [keyIds, setKeyIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const held = useRef(new Set<string>());
  const captured = useRef<string[]>([]);
  const released = useRef(false);
  const captureError = useRef('');
  const commandId = useId();
  const helpId = useId();
  const previewId = useId();
  const labels = new Map(getKeyOptions(preset).map((option) => [option.id, option.label]));
  const existing = findRecordedCombination(preset, keyIds);

  const stopOnBlur = useCallback(() => {
    held.current.clear();
    setRecording(false);
    setKeyIds([]);
    setError('Recording stopped. Select Record hotkey to try again.');
  }, []);

  useEffect(() => {
    if (!recording) return;
    const onVisibilityChange = () => { if (document.hidden) stopOnBlur(); };
    window.addEventListener('blur', stopOnBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', stopOnBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [recording, stopOnBlur]);

  function toggleRecording() {
    held.current.clear();
    captured.current = [];
    released.current = false;
    captureError.current = '';
    setKeyIds([]);
    setError('');
    setRecording((current) => !current);
  }

  function recordDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || held.current.has(event.code)) return;
    held.current.add(event.code);
    const key = event.nativeEvent.isComposing ? undefined : getKeyForCode(preset, event.code);
    const missingModifier = ([['Control', event.ctrlKey], ['Shift', event.shiftKey], ['Alt', event.altKey], ['Meta', event.metaKey]] as const)
      .some(([code, active]) => active && ![...held.current].some((heldCode) => heldCode.startsWith(code)));
    if (released.current || missingModifier) {
      captureError.current = 'Release all keys, then record the hotkey again with the keys held together.';
    } else if (!key) {
      captureError.current = `The key ${event.code || event.key} cannot be matched to this layout. Record another hotkey.`;
    } else if (!captured.current.includes(key.id)) {
      captured.current.push(key.id);
    }
    setError(captureError.current);
    setKeyIds(captureError.current ? [] : [...captured.current]);
  }

  function recordUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (!held.current.delete(event.code)) return;
    released.current = true;
    if (!held.current.size) setRecording(false);
  }

  return (
    <Dialog title="Add hotkey" className="hotkey-recorder" returnFocusTo={trigger} onClose={onClose} closeLabel="Close" initialFocus="input">
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!recording && keyIds.length && command.trim() && !error) onAdd(keyIds, command);
      }}>
        <label className="editor-label" htmlFor={commandId}>Command</label>
        <input id={commandId} autoFocus value={command} placeholder="e.g. Select all military units" onChange={(event) => setCommand(event.target.value)} />
        <p className="editor-help">The hotkey will appear on the keyboard. Changes stay in the draft until you save the preset.</p>
        <p className="editor-label" id={previewId}>Hotkey</p>
        <p className="hotkey-preview" aria-labelledby={previewId} role="status">
          {keyIds.length ? keyIds.map((id, index) => <span className="hotkey-preview-key" key={id}>{index > 0 && <i aria-hidden="true">+</i>}<kbd>{labels.get(id)}</kbd></span>) : recording ? 'Listening for keys…' : 'No hotkey recorded'}
          {recording && !!keyIds.length && <span>Release all keys to finish</span>}
        </p>
        <p className="editor-help" id={helpId}>Select Record hotkey, press a key or combination, then release all keys. While recording, Tab and Escape are captured too.</p>
        <div className="mode-controls">
          <button type="button" className="secondary-button" aria-describedby={helpId} aria-pressed={recording}
            onClick={toggleRecording} onKeyDown={recordDown} onKeyUp={recordUp}
            onBlur={() => {
              if (!recording) return;
              stopOnBlur();
            }}>
            {recording ? 'Stop recording' : 'Record hotkey'}
          </button>
        </div>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {!recording && existing && <p className="editor-help hotkey-conflict">Already assigned to “{existing.action}”. Replace hotkey updates this combination.</p>}
        <div className="dialog-actions mode-controls">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={recording || !keyIds.length || !command.trim() || !!error}>{existing ? 'Replace hotkey' : 'Add hotkey'}</button>
        </div>
      </form>
    </Dialog>
  );
}
