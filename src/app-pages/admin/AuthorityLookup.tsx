import { useState } from 'react';

interface ExternalSearchResult {
  preferredHeading: string;
  variants: string[];
  authorityType: string;
  externalId: string;
  provider: string;
  sourceUri: string | null;
  identifiers: Record<string, string>;
}

export default function AuthorityLookup() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState<ExternalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    try {
      const params = new URLSearchParams({ q: query });
      if (type) params.set('type', type);
      const res = await fetch(`/api/authorities/external-search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Search failed');
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="Search external authority..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <select className="input max-w-[140px]" value={type} onChange={e => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="PERSON">Person</option>
          <option value="CORPORATE_BODY">Corporate</option>
          <option value="TOPIC">Topic</option>
        </select>
        <button onClick={() => void search()} disabled={searching || !query.trim()} className="btn-primary disabled:opacity-50">
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="border border-neutral-200 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{r.preferredHeading}</p>
                  <p className="text-xs text-neutral-500">
                    {r.authorityType} · {r.provider} · {r.externalId}
                  </p>
                  {r.identifiers && Object.entries(r.identifiers).map(([k, v]) => (
                    <p key={k} className="text-xs font-mono text-neutral-400">{k}: {v}</p>
                  ))}
                </div>
                <button onClick={() => {}} className="btn-outline text-xs px-2 py-1">Import</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && !error && results.length === 0 && query && (
        <p className="text-sm text-neutral-400 text-center py-4">No results found.</p>
      )}
    </div>
  );
}
