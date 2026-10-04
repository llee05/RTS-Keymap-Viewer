import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Keybind } from '../data/presets';

type Props = {
  id: string;
  anchor: HTMLButtonElement;
  keybind: Keybind;
  label: string;
  labels: Map<string, string>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function KeyTooltip({ id, anchor, keybind, label, labels, onMouseEnter, onMouseLeave }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; arrowLeft: number; above: boolean } | null>(null);

  useLayoutEffect(() => {
    const bounds = anchor.getBoundingClientRect();
    const tooltip = ref.current?.getBoundingClientRect();
    if (!tooltip) return;
    const center = bounds.left + bounds.width / 2;
    const left = Math.max(8, Math.min(center - tooltip.width / 2, window.innerWidth - tooltip.width - 8));
    const above = bounds.bottom + 12 + tooltip.height > window.innerHeight - 8;
    const top = Math.max(8, above ? bounds.top - tooltip.height - 12 : bounds.bottom + 12);
    setPosition({ left, top, arrowLeft: Math.max(10, Math.min(center - left, tooltip.width - 10)), above });
  }, [anchor, keybind]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={`tooltip ${position?.above ? 'tooltip-above' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden', '--tooltip-arrow-left': `${position?.arrowLeft ?? 0}px` } as CSSProperties}
    >
      <div className="tooltip-content">
        <strong>{label}</strong>
        {keybind.hotkeys.map((command, index) => <p key={index}>{command || 'Unassigned'}</p>)}
        {keybind.combinations?.map((combination, index) => (
          <p className="combo-tooltip" key={`${combination.keyId}-${index}`}>
            {label} + {labels.get(combination.keyId) ?? combination.keyId}: {combination.action || 'No action specified'}
          </p>
        ))}
      </div>
    </div>,
    document.body,
  );
}
