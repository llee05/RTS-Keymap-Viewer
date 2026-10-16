import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardPreset } from '../data/presets';
import type { KeyPosition } from '../data/presetEditing';
import { findCommandResults, getCommandEntries, getKeyId, getKeyOptions, getRelatedKeyIds, type CommandEntry } from '../data/keyboard';
import { CommandSearch } from './CommandSearch';
import { KeyTooltip } from './KeyTooltip';

type Props = {
  preset: KeyboardPreset;
  editor: boolean;
  editing: boolean;
  busy: boolean;
  selected: KeyPosition | null;
  query: string;
  onQueryChange: (query: string) => void;
  onEditKey: (position: KeyPosition, trigger: HTMLButtonElement) => void;
};
type ActiveKey = { id: string; element: HTMLButtonElement };

export function Keyboard({ preset, editor, editing, busy, selected, query, onQueryChange, onEditKey }: Props) {
  const [category, setCategory] = useState('');
  const [active, setActive] = useState<ActiveKey | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const nextMatch = useRef({ query: '', index: 0 });
  const tooltipId = useId();
  const options = getKeyOptions(preset);
  const labels = new Map(options.map((option) => [option.id, option.label]));
  const entries = getCommandEntries(preset);
  const categories = [...new Set(entries.map((entry) => entry.category))].sort();
  const results = findCommandResults(preset, query, category);
  const matches = new Set(results.flatMap((entry) => entry.keyIds));
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
    if (!results.length) return;
    const search = `${query}:${category}`;
    if (nextMatch.current.query !== search) nextMatch.current = { query: search, index: 0 };
    const match = results[nextMatch.current.index % results.length];
    nextMatch.current.index++;
    focusResult(match);
  }

  function focusResult(entry: CommandEntry) {
    const element = board.current?.querySelector<HTMLButtonElement>(`[data-key-position="${entry.ownerId}"]`);
    element?.scrollIntoView({ block: 'nearest', inline: 'center' });
    requestAnimationFrame(() => element?.focus({ preventScroll: true }));
  }

  return (
    <>
      <CommandSearch editor={editor} query={query} results={results} category={category} categories={categories} onChange={onQueryChange} onCategory={setCategory} onNext={focusNextMatch} onResult={focusResult} />
      <section className="board-panel" aria-label="Keyboard reference">
        <div className="keyboard-heading">
          <div><p className="eyebrow">Reference board</p><h2>{preset.name}</h2></div>
          <div className="keyboard-legend" aria-label="Keyboard legend">
            <span><i className="legend-dot assigned" aria-hidden="true" /> Assigned</span>
            <span><i className="legend-dot combination" aria-hidden="true" /> Combination</span>
            {(query.trim() || category) && <span><i className="legend-dot search" aria-hidden="true" /> Search match</span>}
          </div>
        </div>
        <p className="board-hint">Tap or focus a key. Arrow keys move focus.<span className="swipe-hint"> Swipe sideways for more keys.</span></p>
        <div className="keyboard-frame" ref={board}>
          <div className="keyboard">
            {preset.rows.map((row, rowIndex) => (
              <div className="keyboard-row" key={rowIndex}>
                {row.map((keybind, keyIndex) => {
                  const id = getKeyId(rowIndex, keyIndex);
                  // A wide key spans key positions, including the gutters between them.
                  const width = `max(1px, calc(${keybind.width ?? 1} * var(--key-pitch) - var(--key-gap)))`;
                  if (keybind.spacer) return <div className="keyboard-spacer" key={id} style={{ width }} aria-hidden="true" />;
                  const isAssigned = keybind.hotkeys.some((command) => command.trim());
                  const hasCombination = entries.some((entry) => entry.combination && entry.keyIds.includes(id));
                  const label = labels.get(id) ?? keybind.label;
                  return (
                    <button
                      type="button"
                      key={id}
                      id={`key-${id}`}
                      className={`key ${editing ? 'key-editable' : ''} ${id === selectedId ? 'key-selected' : ''} ${related.has(id) ? 'key-combo-highlight' : ''} ${matches.has(id) ? 'key-search-match' : ''}`}
                      style={{ width, height: `${(keybind.height ?? 1) * 64}px` }}
                      data-key-position={id}
                      aria-label={label}
                      aria-describedby={!editing && active?.id === id ? tooltipId : undefined}
                      aria-haspopup={editing ? 'dialog' : undefined}
                      aria-expanded={editing ? id === selectedId : undefined}
                      disabled={editing && busy}
                      onKeyDown={(event) => {
                        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const current = event.currentTarget;
                        const row = current.closest('.keyboard-row');
                        const rows = [...(board.current?.querySelectorAll('.keyboard-row') ?? [])];
                        const buttons = [...(row?.querySelectorAll<HTMLButtonElement>('.key') ?? [])];
                        let target: HTMLButtonElement | undefined;
                        const index = buttons.indexOf(current);
                        if (event.key === 'Home') target = buttons[0];
                        else if (event.key === 'End') target = buttons.at(-1);
                        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') target = buttons[index + (event.key === 'ArrowLeft' ? -1 : 1)];
                        else {
                          const direction = event.key === 'ArrowUp' ? -1 : 1;
                          const center = current.getBoundingClientRect().left + current.offsetWidth / 2;
                          for (let i = rows.indexOf(row!) + direction; i >= 0 && i < rows.length; i += direction) {
                            const candidates = [...rows[i].querySelectorAll<HTMLButtonElement>('.key')];
                            if (!candidates.length) continue;
                            target = candidates.sort((a, b) => Math.abs(a.getBoundingClientRect().left + a.offsetWidth / 2 - center) - Math.abs(b.getBoundingClientRect().left + b.offsetWidth / 2 - center))[0];
                            break;
                          }
                        }
                        target?.focus();
                      }}
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
                      <span className="key-label">{keybind.label}</span>
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
        <div className="board-footer">
          <span><strong>{options.length}</strong> keys <span aria-hidden="true">/</span> <strong>{entries.length}</strong> commands</span>
          <span>Reference at your fingertips</span>
        </div>
      </section>
      {!editing && active && activeKey && <KeyTooltip key={active.id} id={tooltipId} anchor={active.element} keybind={activeKey} label={labels.get(active.id) ?? activeKey.label} combinations={entries.filter((entry) => entry.combination && entry.keyIds.includes(active.id))} onMouseEnter={cancelHide} onMouseLeave={() => { if (document.activeElement !== active.element) setActive(null); }} />}
    </>
  );
}
