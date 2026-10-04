import {
  keyboardShapes, labelLayouts, type KeyboardSettings, type KeyboardShape, type LabelLayout,
} from '../data/keyboardLayouts';

type Props = {
  settings?: KeyboardSettings;
  editing: boolean;
  detecting: boolean;
  listening: boolean;
  status: string;
  hiddenKeyCount: number;
  onShapeChange: (shape: KeyboardShape) => void;
  onLabelsChange: (labels: LabelLayout) => void;
  onDetect: () => void;
  onListen: () => void;
};

export function KeyboardSetup({
  settings, editing, detecting, listening, status, hiddenKeyCount,
  onShapeChange, onLabelsChange, onDetect, onListen,
}: Props) {
  return (
    <section className="keyboard-setup" aria-label="Keyboard setup">
      <div className="setup-heading">
        <div>
          <p className="eyebrow">Keyboard layout prototype</p>
          <h2>Your keyboard</h2>
        </div>
        <p>{editing ? 'Choose the shape, then match the character labels.' : 'Create or edit a preset to match your keyboard.'}</p>
      </div>
      <div className="setup-controls">
        <label>
          Keyboard shape
          <select
            value={settings?.shape ?? 'original'}
            disabled={!editing || detecting || listening}
            onChange={(event) => onShapeChange(event.target.value as KeyboardShape)}
          >
            {keyboardShapes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Character layout
          <select
            value={settings?.labels ?? 'original'}
            disabled={!editing || detecting || listening}
            onChange={(event) => onLabelsChange(event.target.value as LabelLayout)}
          >
            {labelLayouts.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            {settings?.detectedLabels && <option value="detected">Detected keyboard labels</option>}
          </select>
        </label>
        <button type="button" disabled={!editing || detecting || listening} onClick={onDetect}>
          {detecting ? 'Detecting…' : 'Detect my labels'}
        </button>
        {editing && (
          <button type="button" className={listening ? 'listening-button' : ''} aria-pressed={listening} disabled={detecting} onClick={onListen}>
            {listening ? 'Cancel key selection' : 'Press a key to edit'}
          </button>
        )}
      </div>
      <p className="setup-note">Labels change by key position; commands stay on their assigned keys. Choose the physical shape manually.</p>
      {hiddenKeyCount > 0 && <p className="setup-note">{hiddenKeyCount} saved {hiddenKeyCount === 1 ? 'key is' : 'keys are'} outside this shape. Commands are kept; select “All saved keys” to edit them.</p>}
      <p className="layout-status" role="status">{listening ? 'Press one key to open its editor. Escape cancels. Browser and system shortcuts may be unavailable.' : status}</p>
    </section>
  );
}
