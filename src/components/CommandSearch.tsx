import type { CommandEntry } from '../data/keyboard';
import { displayShortcut } from '../data/keyboard';

type Props = {
  editor: boolean; query: string; results: CommandEntry[]; category: string; categories: string[];
  onChange: (query: string) => void; onCategory: (category: string) => void;
  onNext: () => void; onResult: (entry: CommandEntry) => void;
};

export function CommandSearch({ editor, query, results, category, categories, onChange, onCategory, onNext, onResult }: Props) {
  const searching = !!query.trim() || !!category;
  return (
    <section className="command-search" aria-label="Find commands">
      <label htmlFor="command-search">Search commands or keys</label>
      <div className="search-controls">
        <input id="command-search" type="search" value={query} placeholder="Try idle villagers or Ctrl+A" onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); onNext(); }
          if (event.key === 'Escape') { event.preventDefault(); onChange(''); onCategory(''); }
        }} />
        <select aria-label="Command category" value={category} onChange={(event) => onCategory(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((value) => <option key={value}>{value}</option>)}
        </select>
        {editor && <><button type="button" className="secondary-button" disabled={!query && !category} onClick={() => { onChange(''); onCategory(''); }}>Clear search</button>
        <button type="button" className="secondary-button" disabled={!results.length} onClick={onNext}>Next match</button></>}
      </div>
      <p className="search-status" role="status">
        {searching ? results.length ? `${results.length} matching ${results.length === 1 ? 'command' : 'commands'}` : 'No matching commands' : 'Find a command, key, or shortcut. Enter jumps to a match; Escape clears search.'}
      </p>
      {searching && !!results.length && <ul className="command-results" aria-label="Matching commands">
        {results.map((entry) => {
          const content = <><span><strong>{entry.action}</strong><small>{entry.category}{entry.context && ` · ${entry.context}`}</small></span><kbd>{displayShortcut(entry.shortcut)}</kbd></>;
          return <li key={entry.id}>{editor
            ? <button type="button" onClick={() => onResult(entry)}>{content}</button>
            : <a href={`#key-${entry.ownerId}`} onClick={(event) => { event.preventDefault(); onResult(entry); }}>{content}</a>}
          </li>;
        })}
      </ul>}
    </section>
  );
}
