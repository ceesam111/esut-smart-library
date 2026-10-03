import { useState } from 'react';

const AUTHORITY_CONTROLLED_TAGS = ['100', '110', '111', '130', '600', '610', '611', '630', '650', '651', '655'];

interface Authority {
  id: string;
  term: string;
  term_type: string;
  preferred_heading: string | null;
  variants: string[];
  identifiers: Record<string, string>;
}

interface LinkedAuthority {
  authorityId: string;
  preferredHeading: string;
  termType: string;
}

interface AuthorityLinkingProps {
  tag: string;
  currentHeading: string;
  linked: LinkedAuthority | null;
  onLink: (authorityId: string) => void;
  onUnlink: () => void;
}

export default function AuthorityLinking({ tag, currentHeading, linked, onLink, onUnlink }: AuthorityLinkingProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Authority[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const isControlled = AUTHORITY_CONTROLLED_TAGS.includes(tag);

  if (!isControlled) return null;

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/authorities?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setResults(data.authorities ?? []);
    } catch { /* silent */ } finally { setSearching(false); }
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-neutral-500">Authority Control — {tag}</span>
        {linked ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600">Linked</span>
            <button onClick={onUnlink} className="text-xs text-red-600 hover:underline">Unlink</button>
            <button onClick={() => setShowSearch(!showSearch)} className="text-xs text-primary-600 hover:underline">Change</button>
          </div>
        ) : (
          <button onClick={() => setShowSearch(!showSearch)} className="text-xs text-primary-600 hover:underline">Link Authority</button>
        )}
      </div>

      {linked && (
        <div className="bg-green-50 border border-green-200 rounded p-2">
          <p className="text-xs text-green-700">Linked Authority: {linked.preferredHeading}</p>
          <p className="text-xs text-green-600">{linked.termType}</p>
        </div>
      )}

      {showSearch && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1 text-xs"
              placeholder="Search local authority..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void doSearch()}
            />
            <button onClick={() => void doSearch()} disabled={searching} className="btn-outline text-xs px-2 py-1">
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {results.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {results.map(a => (
                <button
                  key={a.id}
                  onClick={() => { onLink(a.id); setShowSearch(false); }}
                  className="w-full text-left p-2 rounded hover:bg-neutral-50 border border-neutral-100"
                >
                  <p className="text-xs font-medium">{a.preferred_heading ?? a.term}</p>
                  <p className="text-xs text-neutral-400">{a.term_type}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {currentHeading && !linked && (
        <p className="text-xs text-neutral-400">Current: {currentHeading}</p>
      )}
    </div>
  );
}
