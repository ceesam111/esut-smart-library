import { useState } from 'react';

interface Authority {
  id: string;
  term: string;
  term_type: string;
  preferred_heading: string | null;
  variants: string[];
  identifiers: Record<string, string>;
  status: string;
}

interface MergePreview {
  source: Authority;
  target: Authority;
  linkedCount: number;
  conflicts: string[];
}

export default function AuthorityMerge() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Authority[]>([]);
  const [source, setSource] = useState<Authority | null>(null);
  const [target, setTarget] = useState<Authority | null>(null);
  const [_preview, setPreview] = useState<MergePreview | null>(null);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState('');

  const searchAuthorities = async () => {
    if (!search.trim()) return;
    try {
      const res = await fetch(`/api/authorities?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setResults(data.authorities ?? []);
    } catch { /* silent */ }
  };

  const doMerge = async () => {
    if (!source || !target) return;
    setMerging(true);
    setResult('');
    try {
      const res = await fetch('/api/authorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'merge', sourceId: source.id, targetId: target.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || 'Merge failed');
        return;
      }
      setResult(`Merged "${source.term}" into "${target.term}". ${data.bibliographicCount ?? 0} records relinked.`);
      setSource(null);
      setTarget(null);
      setPreview(null);
    } catch {
      setResult('Merge failed. Please try again.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-neutral-800">Merge Authorities</h2>
      <p className="text-sm text-neutral-500">Merge one authority into another. Linked bibliographic records are moved.</p>

      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="Search authority..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void searchAuthorities()}
        />
        <button onClick={() => void searchAuthorities()} className="btn-primary">Search</button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(a => (
            <div key={a.id} className="border border-neutral-200 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{a.preferred_heading ?? a.term}</p>
                  <p className="text-xs text-neutral-500">{a.term_type} · {a.status}</p>
                  {a.variants.length > 0 && (
                    <p className="text-xs text-neutral-400">Variants: {a.variants.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setSource(a)} className="btn-outline text-xs px-2 py-1">Source</button>
                  <button onClick={() => setTarget(a)} className="btn-outline text-xs px-2 py-1">Target</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {source && target && (
        <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium">Merge Preview</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-500">Source (will be retired)</p>
              <p className="font-medium">{source.preferred_heading ?? source.term}</p>
              <p className="text-xs text-neutral-400">{source.term_type}</p>
            </div>
            <div>
              <p className="text-neutral-500">Target (retained)</p>
              <p className="font-medium">{target.preferred_heading ?? target.term}</p>
              <p className="text-xs text-neutral-400">{target.term_type}</p>
            </div>
          </div>
          {source.id === target.id && (
            <p className="text-sm text-red-600">Cannot merge authority into itself.</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => void doMerge()} disabled={merging || source.id === target.id} className="btn-primary disabled:opacity-50">
              {merging ? 'Merging...' : 'Confirm Merge'}
            </button>
            <button onClick={() => { setSource(null); setTarget(null); }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {result && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">{result}</div>
      )}
    </div>
  );
}
