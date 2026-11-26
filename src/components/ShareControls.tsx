import { useState } from 'react';

type Props = {
  disabled: boolean;
  onCopy: (trigger: HTMLButtonElement) => void;
  onExport: () => void;
};

export function ShareControls({ disabled, onCopy, onExport }: Props) {
  const [open, setOpen] = useState(false);
  return <details className="share-controls" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Share layout</summary>
    {open && <div className="mode-controls">
      <button type="button" className="secondary-button" disabled={disabled} onClick={(event) => onCopy(event.currentTarget)}>Copy share link</button>
      <button type="button" className="secondary-button" disabled={disabled} onClick={onExport}>Export preset</button>
    </div>}
  </details>;
}
