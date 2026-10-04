type Props = { query: string; matchCount: number; onChange: (query: string) => void; onNext: () => void };

export function CommandSearch({ query, matchCount, onChange, onNext }: Props) {
  return (
    <section className="command-search" aria-label="Find commands">
      <label htmlFor="command-search">Search commands or keys</label>
      <div className="search-controls">
        <input id="command-search" type="search" value={query} placeholder="Try idle villagers or camera" onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="secondary-button" disabled={!query} onClick={() => onChange('')}>Clear search</button>
        <button type="button" className="secondary-button" disabled={!matchCount} onClick={onNext}>Next match</button>
      </div>
      <p className="search-status" role="status">
        {query.trim() ? matchCount ? `${matchCount} matching ${matchCount === 1 ? 'key' : 'keys'}` : 'No matching keys' : 'Search commands and combination actions to highlight their keys.'}
      </p>
    </section>
  );
}
