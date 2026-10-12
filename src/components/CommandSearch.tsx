import type { CommandEntry } from '../data/keyboard';
import { displayShortcut } from '../data/keyboard';

type Props = {
  query: string; results: CommandEntry[]; category: string; categories: string[];
  onChange: (query: string) => void; onCategory: (category: string) => void;
  onNext: () => void; onResult: (entry: CommandEntry) => void;
};

export function CommandSearch({ query, results, category, categories, onChange, onCategory, onNext, onResult }: Props) {
  const searching = !!query.trim() || !!category;
  return (
    <section className="command-search" aria-label="Find commands">
      <label htmlFor="command-search">Search commands or keys</label>
      <div className="search-controls">
        <input id="command-search" type="search" value={query} placeholder="Try idle villagers or Ctrl+A" onChange={(event) => onChange(event.target.value)} />
        <select aria-label="Command category" value={category} onChange={(event) => onCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((value) => <option key={value}>{value}</option>)}
        </select>
        <button type="button" className="secondary-button" disabled={!query && !category} onClick={() => { onChange(''); onCategory(''); }}>Clear search</button>
        <button type="button" className="secondary-button" disabled={!results.length} onClick={onNext}>Next match</button>
      </div>
      <p className="search-status" role="status">
        {searching ? results.length ? `${results.length} matching ${results.length === 1 ? 'command' : 'commands'}` : 'No matching commands' : 'Find a command, key, or shortcut.'}
      </p>
      {searching && !!results.length && <ul className="command-results" aria-label="Matching commands">
        {results.map((entry) => <li key={entry.id}><button type="button" onClick={() => onResult(entry)}>
          <span><strong>{entry.action}</strong><small>{entry.category}{entry.context && ` · ${entry.context}`}</small></span>
          <kbd>{displayShortcut(entry.shortcut)}</kbd>
        </button></li>)}
      </ul>}
    </section>
  );
}
