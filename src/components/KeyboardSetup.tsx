import {
  keyboardShapes, labelLayouts, type KeyboardSettings, type KeyboardShape, type LabelLayout,
} from '../data/keyboardLayouts';
import { getKeyboardProfile, keyboardProfiles } from '../data/keyboardProfiles';

type Props = {
  settings?: KeyboardSettings;
  editing: boolean;
  detecting: boolean;
  connecting: boolean;
  identificationAvailable: boolean;
  listening: boolean;
  status: string;
  hiddenKeyCount: number;
  onShapeChange: (shape: KeyboardShape) => void;
  onModelChange: (profileId: string) => void;
  onConnect: () => void;
  onCancelConnect: () => void;
  onLabelsChange: (labels: LabelLayout) => void;
  onDetect: () => void;
  onListen: () => void;
};

export function KeyboardSetup({
  settings, editing, detecting, connecting, identificationAvailable, listening, status, hiddenKeyCount,
  onShapeChange, onModelChange, onConnect, onCancelConnect, onLabelsChange, onDetect, onListen,
}: Props) {
  const profile = getKeyboardProfile(settings?.profileId);
  const busy = detecting || connecting || listening;
  return (
    <section className="keyboard-setup" aria-label="Keyboard setup">
      <div className="setup-heading">
        <div>
          <p className="eyebrow">Keyboard layout prototype</p>
          <h2>Your keyboard</h2>
        </div>
        <p>Connect a supported keyboard to build a board that matches it.</p>
      </div>
      <div className="setup-controls device-controls">
        <button type="button" disabled={busy} onClick={onConnect}>
          {connecting ? 'Choosing keyboard…' : 'Connect keyboard'}
        </button>
        {connecting && <button type="button" onClick={onCancelConnect}>Cancel identification</button>}
        <label>
          Supported keyboard model
          <select value={profile?.id ?? ''} disabled={busy} onChange={(event) => onModelChange(event.target.value)}>
            <option value="" disabled>Choose a model manually</option>
            {keyboardProfiles.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>
      <p className="setup-note">
        {identificationAvailable
          ? 'The device picker shows keyboards with a QMK/VIA interface. A recognized model rebuilds the entire board. If yours is missing, choose a model or generic shape manually.'
          : 'Device identification needs desktop Chrome/Edge over HTTPS or localhost. You can still choose a model or generic shape manually.'}
        {' '}Supported: Keychron V4, V3, and V6 ANSI without a knob. Other variants need their own profiles.
      </p>
      {profile && <p className="profile-summary">Board: {profile.name}. Model selection and character labels are saved with your preset.</p>}
      <div className="setup-controls">
        <label>
          Generic keyboard shape
          <select
            value={profile ? '' : settings?.shape ?? 'original'}
            disabled={!editing || busy}
            onChange={(event) => onShapeChange(event.target.value as KeyboardShape)}
          >
            {profile && <option value="" disabled>Using model geometry</option>}
            {keyboardShapes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Character layout
          <select
            value={settings?.labels ?? 'original'}
            disabled={!editing || busy}
            onChange={(event) => onLabelsChange(event.target.value as LabelLayout)}
          >
            {labelLayouts.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            {settings?.detectedLabels && <option value="detected">Detected keyboard labels</option>}
          </select>
        </label>
        <button type="button" disabled={!editing || busy} onClick={onDetect}>
          {detecting ? 'Detecting…' : 'Detect my labels'}
        </button>
        {editing && (
          <button type="button" className={listening ? 'listening-button' : ''} aria-pressed={listening} disabled={detecting || connecting} onClick={onListen}>
            {listening ? 'Cancel key selection' : 'Press a key to edit'}
          </button>
        )}
      </div>
      <p className="setup-note">{editing ? 'Detect character labels separately, or choose a layout. Commands stay on their assigned keys.' : 'Connecting or choosing a model opens a new custom preset. Create or edit a preset to use generic shapes and character layouts.'}</p>
      {hiddenKeyCount > 0 && <p className="setup-note">{hiddenKeyCount} saved {hiddenKeyCount === 1 ? 'key is' : 'keys are'} outside this shape. Commands are kept; select “All saved keys” to edit them.</p>}
      <p className="layout-status" role="status">{listening ? 'Press one key to open its editor. Escape cancels. Browser and system shortcuts may be unavailable.' : status}</p>
    </section>
  );
}
