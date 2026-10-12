import { useId, useState } from 'react';
import type { KeyOption } from '../data/keyboard';

type Props = { options: KeyOption[]; selected: string[]; onChange: (ids: string[]) => void; label?: string };

export function KeyPicker({ options, selected, onChange, label = 'Choose keys' }: Props) {
  const [query, setQuery] = useState('');
  const id = useId();
  return (
    <fieldset className="key-picker">
      <legend>{label}</legend>
      <label className="visually-hidden" htmlFor={id}>Filter available keys</label>
      <input id={id} type="search" placeholder="Filter keys…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <p className="editor-help">Select every participating key. Select a key again to remove it.</p>
      <div className="key-picker-options">
        {options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())).map((option) => (
          <button type="button" key={option.id} aria-pressed={selected.includes(option.id)} onClick={() => onChange(selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id])}>{option.label}</button>
        ))}
      </div>
      <p className="editor-help" role="status">{selected.length ? selected.map((id) => options.find((option) => option.id === id)?.label ?? id).join(' + ') : 'No keys selected'}</p>
    </fieldset>
  );
}
