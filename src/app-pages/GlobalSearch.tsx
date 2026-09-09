import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Resource3DBookCard, Resource3DBookGrid } from '@/components/resource/Resource3DBookCard';

type TabId = 'all' | 'local' | 'openaccess' | 'crossref' | 'semanticscholar' | 'pubmed' | 'archive' | 'ajol' | 'ebooks' | 'journals';

interface SearchResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  abstract: string;
  doi: string | null;
  url: string | null;
  source: string;
  sourceTag: string;
  pdf_url: string | null;
  cover_url?: string | null;
  read_url?: string | null;
  download_url?: string | null;
  rights_status?: string | null;
  can_download?: boolean;
  item_type?: string | null;
}

interface SearchResults {
  aiSummary: string;
  local: SearchResult[];
  openAccess: SearchResult[];
  crossref: SearchResult[];
  semanticScholar: SearchResult[];
  pubMed: SearchResult[];
  archive: SearchResult[];
  ajol: SearchResult[];
  ebooks: SearchResult[];
  journals: SearchResult[];
  all: SearchResult[];
  localQuality?: 'good' | 'weak' | 'none';
  externalLookupOffered?: boolean;
  externalLookupTriggered?: boolean;
  autoApprovedCount?: number;
}

const TABS: { id: TabId; label: string; key: keyof SearchResults | 'all' }[] = [
  { id: 'all',             label: 'All',              key: 'all' },
  { id: 'local',           label: 'Local',            key: 'local' },
  { id: 'openaccess',      label: 'Open Access',      key: 'openAccess' },
  { id: 'crossref',        label: 'Crossref',         key: 'crossref' },
  { id: 'semanticscholar', label: 'Semantic Scholar', key: 'semanticScholar' },
  { id: 'pubmed',          label: 'PubMed',           key: 'pubMed' },
  { id: 'archive',         label: 'Archive',          key: 'archive' },
  { id: 'ajol',            label: 'AJOL',             key: 'ajol' },
  { id: 'ebooks',          label: '📚 Free Ebooks',   key: 'ebooks' },
  { id: 'journals',        label: '📰 Free Journals', key: 'journals' },
];

const SOURCE_COLORS: Record<string, string> = {
  'ESUT Library': 'bg-primary-100 text-primary-800',
  'ESUT Repository': 'bg-primary-100 text-primary-800',
  'OpenAlex — Open Access': 'bg-green-100 text-green-800',
  'CORE — Open Access': 'bg-emerald-100 text-emerald-800',
  'Crossref': 'bg-primary-100 text-primary-800',
  'Semantic Scholar': 'bg-indigo-100 text-indigo-800',
  'PubMed': 'bg-red-100 text-red-800',
  'Internet Archive': 'bg-amber-100 text-amber-800',
  'AJOL — African Journals': 'bg-orange-100 text-orange-800',
  'Project Gutenberg — Free Ebook': 'bg-violet-100 text-violet-800',
  'Open Library — Free to Read': 'bg-sky-100 text-sky-800',
  'OAPEN — Open Access Book': 'bg-teal-100 text-teal-800',
  'DOAB — Peer-Reviewed Open Access': 'bg-cyan-100 text-cyan-800',
  'Google Books — Free Preview': 'bg-blue-100 text-blue-800',
  'BASE — Academic Search Engine': 'bg-rose-100 text-rose-800',
  'DOAJ — Free Journal': 'bg-lime-100 text-lime-800',
  'Standard Ebooks — Pending review': 'bg-violet-100 text-violet-800',
  'HathiTrust — Pending review': 'bg-amber-100 text-amber-800',
  'PubMed Central — Pending review': 'bg-red-100 text-red-800',
};

function unwrapApi<T = any>(payload: any): T {
  return payload && payload.success === true && 'data' in payload ? payload.data : payload;
}

function EbookCard({ result, onAddToList, canAdd }: {
  result: SearchResult;
  onAddToList: (r: SearchResult) => void;
  canAdd: boolean;
}) {
  const tagColor = SOURCE_COLORS[result.sourceTag] ?? 'bg-neutral-100 text-neutral-700';
  const pendingExternal = result.sourceTag.includes('Pending review');
  return (
    <Resource3DBookCard
      id={result.id}
      title={result.title}
      authors={result.authors}
      year={result.year}
      resourceType={result.item_type || (result.sourceTag.includes('Journal') ? 'journal' : result.sourceTag.includes('Article') ? 'article' : 'ebook')}
      coverUrl={result.cover_url}
      status={pendingExternal ? 'Pending library review' : 'External source'}
      confidence={result.sourceTag}
      actions={(
        <>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tagColor}`}>{result.sourceTag}</span>
          {result.rights_status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{result.rights_status}</span>}
          {result.read_url && (
            <a href={result.read_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-primary-700 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-800">
              View source
            </a>
          )}
          {result.can_download && (result.download_url ?? result.pdf_url) && (
            <a href={result.download_url ?? result.pdf_url!} target="_blank" rel="noopener noreferrer" className="text-xs border border-primary-300 text-primary-700 px-3 py-1.5 rounded-lg font-medium hover:bg-primary-50">
              Legal download
            </a>
          )}
          {canAdd && (
            <button onClick={() => onAddToList(result)} className="text-xs border border-neutral-300 text-neutral-600 px-3 py-1.5 rounded-lg hover:bg-neutral-50">
              {pendingExternal ? 'Request review' : '+ List'}
            </button>
          )}
        </>
      )}
    />
  );
}

function ResultCard({ result, onAddToList, canAdd }: {
  result: SearchResult;
  onAddToList: (r: SearchResult) => void;
  canAdd: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEbook = ['Project Gutenberg — Free Ebook', 'Open Library — Free to Read', 'OAPEN — Open Access Book', 'DOAB — Peer-Reviewed Open Access', 'Google Books — Free Preview'].includes(result.sourceTag);
  if (isEbook || result.cover_url) {
    return <EbookCard result={result} onAddToList={onAddToList} canAdd={canAdd} />;
  }
  const tagColor = SOURCE_COLORS[result.sourceTag] ?? 'bg-neutral-100 text-neutral-700';
  const pendingExternal = result.sourceTag.includes('Pending review');
  return (
    <Resource3DBookCard
      id={result.id}
      title={result.title}
      authors={result.authors}
      year={result.year}
      resourceType={result.item_type || (result.sourceTag.includes('Thesis') ? 'thesis' : result.sourceTag.includes('Journal') ? 'journal' : result.sourceTag.includes('Book') ? 'book' : 'article')}
      coverUrl={result.cover_url}
      href={result.sourceTag === 'ESUT Library' && result.url ? result.url : undefined}
      status={pendingExternal ? 'Pending library review' : result.source}
      confidence={result.doi ? `DOI: ${result.doi}` : undefined}
      actions={(
        <>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tagColor}`}>{result.sourceTag}</span>
            {result.rights_status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">{result.rights_status}</span>}
          {result.abstract && result.abstract.length > 180 && (
            <button type="button" onClick={() => setExpanded(e => !e)} className="text-xs text-primary-600 hover:underline">{expanded ? 'Less detail' : 'More detail'}</button>
          )}
          {expanded && result.abstract && <span className="basis-full text-xs text-neutral-500 line-clamp-none">{result.abstract}</span>}
          {result.url && result.sourceTag !== 'ESUT Library' && (
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs py-1.5 px-3 whitespace-nowrap">View source</a>
          )}
          {result.can_download && (result.download_url ?? result.pdf_url) && (
            <a href={result.download_url ?? result.pdf_url!} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">Legal download</a>
          )}
          {canAdd && (
            <button onClick={() => onAddToList(result)} className="btn-outline text-xs py-1.5 px-3 whitespace-nowrap">{pendingExternal ? 'Request review' : '+ Reading List'}</button>
          )}
        </>
      )}
    />
  );
}

export default function GlobalSearch() {
  usePageTitle('Global Search');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery]               = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab]       = useState<TabId>('all');
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState<SearchResults | null>(null);
  const [addedIds, setAddedIds]         = useState<Set<string>>(new Set());
  const [notice, setNotice]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }, []);

  const mapApiResults = useCallback((data: any): SearchResults => {
    const local: SearchResult[] = (data.localResults ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      authors: Array.isArray(item.authors) ? item.authors.join(', ') : String(item.authors ?? ''),
      year: item.year ?? null,
      abstract: '',
      doi: item.doi ?? null,
      url: item.source_url ?? `/catalogue/${item.id}`,
      source: 'ESUT Library',
      sourceTag: 'ESUT Library',
      pdf_url: null,
      cover_url: item.cover_image ?? null,
      item_type: item.item_type ?? null,
    }));
    const external: SearchResult[] = (data.externalCandidates ?? []).map((item: any) => ({
      id: item.id,
      title: item.title || 'Untitled external resource',
      authors: Array.isArray(item.authors) ? item.authors.join(', ') : '',
      year: item.year ?? null,
      abstract: item.description || (item.actions?.approved ? 'Found from a trusted verified external source.' : 'Found from external source. Pending library review.'),
      doi: item.doi ?? null,
      url: item.actions?.readOnline ?? item.source_url ?? null,
      source: item.source_name,
      sourceTag: item.actions?.approved ? `${item.source_name} — Verified source` : `${item.source_name} — Pending review`,
      pdf_url: item.actions?.download ?? null,
      cover_url: item.cover_url ?? null,
      read_url: item.actions?.readOnline ?? item.source_url ?? null,
      download_url: item.actions?.download ?? null,
      rights_status: item.rights_status ?? null,
      can_download: item.actions?.canDownloadLegally === true,
      item_type: item.item_type ?? null,
    }));
    const sourceIncludes = (pattern: RegExp) => external.filter((item) => pattern.test(`${item.sourceTag} ${item.abstract} ${item.rights_status ?? ''}`));
    return {
      aiSummary: '',
      local,
      openAccess: external,
      crossref: [],
      semanticScholar: [],
      pubMed: sourceIncludes(/pubmed|pmc|biomedical/i),
      archive: [],
      ajol: [],
      ebooks: sourceIncludes(/book|ebook|library|archive|doab|gutenberg|standard ebooks|hathitrust/i),
      journals: sourceIncludes(/doaj|journal|crossref|openalex|article/i),
      all: [...local, ...external],
      localQuality: data.localQuality,
      externalLookupOffered: data.externalLookupOffered,
      externalLookupTriggered: data.externalLookupTriggered,
      autoApprovedCount: data.autoApprovedCount ?? 0,
    };
  }, []);

  // Auto-dismiss notices after a few seconds
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResults(null);
    setSearchParams({ q });
    try {
      const response = await fetch(`/api/search/resources?q=${encodeURIComponent(q)}`, { headers: await authHeaders() });
      const raw = await response.json();
      const data = unwrapApi(raw);
      if (!response.ok) throw new Error(raw.error?.message || raw.error || 'Search failed.');
      setResults(mapApiResults(data));
    } catch (err) {
      console.error('Search error:', err);
      setNotice({ type: 'error', msg: err instanceof Error ? err.message : 'Search failed.' });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, mapApiResults, setSearchParams]);

  const runExternalSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/search/resources?q=${encodeURIComponent(query)}&expand=true`, { headers: await authHeaders() });
      const raw = await response.json();
      const data = unwrapApi(raw);
      if (!response.ok) throw new Error(raw.error?.message || raw.error || 'External search failed.');
      setResults(mapApiResults(data));
    } catch (err) {
      setNotice({ type: 'error', msg: err instanceof Error ? err.message : 'External search failed.' });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, mapApiResults, query]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); runSearch(query); };

  const handleAddToList = async (result: SearchResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotice({ type: 'error', msg: 'Please sign in to save items or request library review.' });
      setTimeout(() => navigate('/login'), 1200);
      return;
    }
    if (result.sourceTag.includes('Pending review')) {
      const response = await fetch('/api/resource-requests/external', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ candidateId: result.id }) });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: 'error', msg: data.error?.message || data.error || 'Could not request library review.' });
        return;
      }
      setAddedIds(prev => new Set([...prev, result.id]));
      setNotice({ type: 'success', msg: 'Request sent to the library review queue.' });
      return;
    }
    const { data: patron } = await supabase.from('patrons').select('id').eq('user_id', user.id).maybeSingle();
    if (!patron) {
      setNotice({ type: 'error', msg: 'No library account found for your profile. Please complete registration first.' });
      return;
    }
    const { error } = await supabase.from('patron_saved_items').insert({
      patron_id: patron.id, title: result.title, authors: result.authors,
      year: result.year, doi: result.doi, url: result.url ?? result.pdf_url, source: result.source,
    });
    if (error) {
      console.error('Save error:', error);
      setNotice({ type: 'error', msg: 'Could not save this item. Please try again.' });
      return;
    }
    setAddedIds(prev => new Set([...prev, result.id]));
    setNotice({ type: 'success', msg: `Saved “${result.title.slice(0, 60)}” to your reading list.` });
  };


  const getTabResults = (): SearchResult[] => {
    if (!results) return [];
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab || tab.key === 'all') return results.all;
    return (results[tab.key as keyof SearchResults] as SearchResult[]) ?? [];
  };

  const tabCount = (tab: typeof TABS[0]): number => {
    if (!results) return 0;
    if (tab.key === 'all') return results.all.length;
    return ((results[tab.key as keyof SearchResults] as SearchResult[]) ?? []).length;
  };

  const displayResults = getTabResults();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <BackButton />
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Federated Academic Search</h1>
          <p className="text-neutral-500 text-sm mb-5">Search 250M+ works across 10 global academic sources simultaneously</p>
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input type="text" className="input flex-1 text-base" placeholder="Search journals, theses, open access articles, ebooks…"
                value={query} onChange={e => setQuery(e.target.value)} autoFocus />
              <button type="submit" className="btn-primary px-6" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {notice && (
          <div
            role="status"
            className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium border ${
              notice.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {notice.msg}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                <div className="h-3 bg-neutral-200 rounded w-24 mb-3" />
                <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-neutral-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-neutral-200 rounded w-full mb-1" />
                <div className="h-3 bg-neutral-200 rounded w-5/6" />
              </div>
            ))}
          </div>
        )}

        {!loading && results?.aiSummary && (
          <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-teal-700 font-bold text-sm">AI Overview</span>
              <span className="text-xs text-teal-500">Powered by the configured AI gateway</span>
            </div>
            <p className="text-sm text-teal-900 leading-relaxed">{results.aiSummary}</p>
          </div>
        )}

        {!loading && results?.externalLookupOffered && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-950">Not found strongly in this library.</p>
              <p className="text-sm text-amber-800">Trusted external open-access sources are searched automatically. Unclear or unsafe records stay in review.</p>
            </div>
            <button className="btn-primary whitespace-nowrap" onClick={runExternalSearch}>Refresh external sources</button>
          </div>
        )}

        {!loading && results?.externalLookupTriggered && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            Trusted verified external results are added automatically. Unclear or unsafe records remain labeled for library review.{results.autoApprovedCount ? ` ${results.autoApprovedCount} trusted result${results.autoApprovedCount === 1 ? '' : 's'} approved automatically.` : ''}
          </div>
        )}

        {!loading && results && (
          <>
            <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
              {TABS.map(tab => {
                const count = tabCount(tab);
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id ? 'bg-primary-700 text-white' : 'bg-white border text-neutral-600 hover:bg-neutral-50'
                    }`}>
                    {tab.label}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {displayResults.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <p className="text-neutral-500">No results in this source for your query.</p>
              </div>
            ) : (
              <Resource3DBookGrid className="lg:grid-cols-3 xl:grid-cols-4">
                {displayResults.map(r => (
                  <ResultCard key={r.id} result={r} onAddToList={handleAddToList} canAdd={!addedIds.has(r.id)} />
                ))}
              </Resource3DBookGrid>
            )}
          </>
        )}

        {!loading && !results && (
          <div className="text-center py-16">
            <p className="text-neutral-400 text-base mb-8">Enter a search query to explore academic resources</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-3xl mx-auto">
              {[
                { name: 'ESUT Library', icon: '🏛️', desc: 'Local catalogue & repository' },
                { name: 'OpenAlex + CORE', icon: '🔓', desc: 'Open access worldwide' },
                { name: 'PubMed', icon: '🔬', desc: 'Biomedical literature' },
                { name: 'AJOL', icon: '🌍', desc: 'African journals' },
                { name: 'Crossref', icon: '📑', desc: 'DOI metadata' },
                { name: 'Semantic Scholar', icon: '🤖', desc: 'AI-indexed papers' },
                { name: 'Internet Archive', icon: '📦', desc: 'Historical texts' },
                { name: 'Unpaywall', icon: '📄', desc: 'Free PDF finder' },
                { name: 'Free Ebooks', icon: '📚', desc: 'Gutenberg, Open Library, OAPEN, DOAB' },
                { name: 'BASE', icon: '🔎', desc: 'Grey literature & IR content' },
              ].map(s => (
                <div key={s.name} className="bg-white rounded-xl border p-4 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <p className="text-xs font-semibold text-neutral-800">{s.name}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
