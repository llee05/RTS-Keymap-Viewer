import { useId } from 'react';

type Props = {
  category: string;
  context: string;
  onCategoryChange: (value: string) => void;
  onContextChange: (value: string) => void;
  categoryLabel?: string;
  contextLabel?: string;
  categoryPlaceholder?: string;
  scopeNote?: string;
};

export function HotkeyAdvancedOptions({ category, context, onCategoryChange, onContextChange, categoryLabel = 'Category (optional)', contextLabel = 'Context (optional)', categoryPlaceholder = 'e.g. Selection', scopeNote }: Props) {
  const helpId = useId();
  return (
    <details className="hotkey-advanced-options">
      <summary>Advanced options</summary>
      <p className="editor-help" id={helpId}>Category groups commands for filtering. Context describes when a command applies; use different contexts for different commands on the same combination.{scopeNote && ` ${scopeNote}`}</p>
      <div className="editor-fields">
        <label>{categoryLabel}<input aria-describedby={helpId} placeholder={categoryPlaceholder} value={category} onChange={(event) => onCategoryChange(event.target.value)} /></label>
        <label>{contextLabel}<input aria-describedby={helpId} placeholder="e.g. Combat or Spectator" value={context} onChange={(event) => onContextChange(event.target.value)} /></label>
      </div>
    </details>
  );
}
