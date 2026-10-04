import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardPreset } from '../data/presets';
import type { KeyPosition } from '../data/presetEditing';
import { findMatchingKeys, getKeyId, getKeyOptions, getRelatedKeyIds } from '../data/keyboard';
import { CommandSearch } from './CommandSearch';
import { KeyTooltip } from './KeyTooltip';

type Props = {
  preset: KeyboardPreset;
  editing: boolean;
  busy: boolean;
  selected: KeyPosition | null;
  query: string;
  onQueryChange: (query: string) => void;
  onEditKey: (position: KeyPosition, trigger: HTMLButtonElement) => void;
};
type ActiveKey = { id: string; element: HTMLButtonElement };

export function Keyboard({ preset, editing, busy, selected, query, onQueryChange, onEditKey }: Props) {
  const [active, setActive] = useState<ActiveKey | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const nextMatch = useRef({ query: '', index: 0 });
  const tooltipId = useId();
  const options = getKeyOptions(preset);
  const labels = new Map(options.map((option) => [option.id, option.label]));
  const matches = findMatchingKeys(preset, query);
  const selectedId = selected ? getKeyId(selected.rowIndex, selected.keyIndex) : null;
  const related = getRelatedKeyIds(preset, selectedId ?? active?.id ?? null);
  const activeKey = active ? preset.rows.flatMap((row, rowIndex) => row.map((keybind, keyIndex) => ({ keybind, id: getKeyId(rowIndex, keyIndex) }))).find((key) => key.id === active.id)?.keybind : undefined;

  function cancelHide() {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }

  useEffect(() => () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (!active || editing) return;
    const dismiss = () => { cancelHide(); setActive(null); };
    const dismissOnScroll = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.tooltip')) dismiss();
    };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.key, .tooltip')) dismiss();
    };
    window.addEventListener('scroll', dismissOnScroll, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', dismissOnEscape);
    window.addEventListener('pointerdown', dismissOutside);
    return () => {
      window.removeEventListener('scroll', dismissOnScroll, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', dismissOnEscape);
      window.removeEventListener('pointerdown', dismissOutside);
    };
  }, [active, editing]);

  function focusNextMatch() {
    const matchingOptions = options.filter((option) => matches.has(option.id));
    if (!matchingOptions.length) return;
    if (nextMatch.current.query !== query) nextMatch.current = { query, index: 0 };
    const match = matchingOptions[nextMatch.current.index % matchingOptions.length];
    nextMatch.current.index++;
    const element = board.current?.querySelector<HTMLButtonElement>(`[data-key-position="${match.id}"]`);
    element?.scrollIntoView({ block: 'nearest', inline: 'center' });
    requestAnimationFrame(() => element?.focus({ preventScroll: true }));
  }

  return (
    <>
      <CommandSearch query={query} matchCount={matches.size} onChange={onQueryChange} onNext={focusNextMatch} />
      <div className="keyboard-heading">
        <div><p className="eyebrow">Reference board</p><h2>{preset.name}</h2></div>
        <div className="keyboard-legend" aria-label="Keyboard legend">
          <span><i className="legend-dot assigned" aria-hidden="true" /> Assigned</span>
          <span><i className="legend-dot combination" aria-hidden="true" /> Combination</span>
          {query.trim() && <span><i className="legend-dot search" aria-hidden="true" /> Search match</span>}
        </div>
      </div>
      <div className="keyboard-frame" ref={board}>
        <div className="keyboard">
          {preset.rows.map((row, rowIndex) => (
            <div className="keyboard-row" key={rowIndex}>
              {row.map((keybind, keyIndex) => {
                const id = getKeyId(rowIndex, keyIndex);
                const width = `${(keybind.width ?? 1) * 64}px`;
                if (keybind.spacer) return <div key={id} style={{ width }} aria-hidden="true" />;
                const isAssigned = keybind.hotkeys.some((command) => command.trim());
                const hasCombination = !!keybind.combinations?.length;
                const label = labels.get(id) ?? keybind.label;
                return (
                  <button
                    type="button"
                    key={id}
                    className={`key ${editing ? 'key-editable' : ''} ${id === selectedId ? 'key-selected' : ''} ${related.has(id) ? 'key-combo-highlight' : ''} ${matches.has(id) ? 'key-search-match' : ''}`}
                    style={{ width, height: `${(keybind.height ?? 1) * 64}px` }}
                    data-key-position={id}
                    aria-label={label}
                    aria-describedby={!editing && active?.id === id ? tooltipId : undefined}
                    aria-haspopup={editing ? 'dialog' : undefined}
                    aria-expanded={editing ? id === selectedId : undefined}
                    disabled={editing && busy}
                    onMouseEnter={(event) => { cancelHide(); setActive({ id, element: event.currentTarget }); }}
                    onMouseLeave={(event) => {
                      if (document.activeElement !== event.currentTarget) {
                        cancelHide();
                        hideTimer.current = window.setTimeout(() => setActive((current) => current?.id === id ? null : current), 150);
                      }
                    }}
                    onFocus={(event) => {
                      cancelHide();
                      const element = event.currentTarget;
                      requestAnimationFrame(() => {
                        if (document.activeElement === element) setActive({ id, element });
                      });
                    }}
                    onBlur={() => setActive((current) => current?.id === id ? null : current)}
                    onClick={(event) => {
                      if (editing) onEditKey({ rowIndex, keyIndex }, event.currentTarget);
                      else setActive({ id, element: event.currentTarget });
                    }}
                  >
                    <span>{keybind.label}</span>
                    <span className="key-markers" aria-hidden="true">
                      {isAssigned && <i className="key-assigned-marker" />}
                      {hasCombination && <i className="key-combination-marker" />}
                    </span>
                    {editing && <small>{keybind.hotkeys.filter((command) => command.trim())[0] ?? 'Unassigned'}</small>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!editing && active && activeKey && <KeyTooltip key={active.id} id={tooltipId} anchor={active.element} keybind={activeKey} label={labels.get(active.id) ?? activeKey.label} labels={labels} onMouseEnter={cancelHide} onMouseLeave={() => { if (document.activeElement !== active.element) setActive(null); }} />}
    </>
  );
}
