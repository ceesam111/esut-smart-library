import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { trackClientEvent } from '@/lib/analytics';
import BackButton from '@/components/BackButton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type I18nContextValue, type TranslationKey } from '@/lib/i18n';
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

const TABS: { id: TabId; labelKey: TranslationKey; key: keyof SearchResults | 'all' }[] = [
  { id: 'all',             labelKey: 'search.tabAll',             key: 'all' },
  { id: 'local',           labelKey: 'search.tabLocal',           key: 'local' },
  { id: 'openaccess',      labelKey: 'search.tabOpenAccess',      key: 'openAccess' },
  { id: 'crossref',        labelKey: 'search.tabCrossref',        key: 'crossref' },
  { id: 'semanticscholar', labelKey: 'search.tabSemanticScholar', key: 'semanticScholar' },
  { id: 'pubmed',          labelKey: 'search.tabPubMed',          key: 'pubMed' },
  { id: 'archive',         labelKey: 'search.tabArchive',         key: 'archive' },
  { id: 'ajol',            labelKey: 'search.tabAjol',            key: 'ajol' },
  { id: 'ebooks',          labelKey: 'search.tabFreeEbooks',      key: 'ebooks' },
  { id: 'journals',        labelKey: 'search.tabFreeJournals',    key: 'journals' },
];

const UNTITLED_EXTERNAL = 'Untitled external resource';
const ABSTRACT_TRUSTED = 'Found from a trusted verified external source.';
const ABSTRACT_PENDING = 'Found from external source. Pending library review.';
const VERIFIED_SUFFIX = ' — Verified source';
const PENDING_SUFFIX = ' — Pending review';

function translateSourceTag(tag: string, translate: I18nContextValue['t']): string {
  if (tag.endsWith(VERIFIED_SUFFIX)) return translate('search.verifiedSource', { name: tag.slice(0, -VERIFIED_SUFFIX.length) });
  if (tag.endsWith(PENDING_SUFFIX)) return translate('search.pendingReviewSource', { name: tag.slice(0, -PENDING_SUFFIX.length) });
  return tag;
}

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

interface LocalSearchRow {
  id: string;
  title: string;
  authors?: unknown;
  year?: number | null;
  doi?: string | null;
  source_url?: string | null;
  cover_image?: string | null;
  item_type?: string | null;
}

interface ExternalSearchActions {
  approved?: boolean;
  readOnline?: string | null;
  download?: string | null;
  canDownloadLegally?: boolean;
}

interface ExternalSearchRow {
  id: string;
  title?: string;
  authors?: unknown;
  year?: number | null;
  description?: string | null;
  doi?: string | null;
  source_url?: string | null;
  source_name: string;
  cover_url?: string | null;
  rights_status?: string | null;
  item_type?: string | null;
  actions?: ExternalSearchActions;
}

interface SearchApiPayload {
  localResults?: LocalSearchRow[];
  externalCandidates?: ExternalSearchRow[];
  localQuality?: 'good' | 'weak' | 'none';
  externalLookupOffered?: boolean;
  externalLookupTriggered?: boolean;
  autoApprovedCount?: number;
}

function unwrapApi<T>(payload: unknown): T {
  const p = payload as { success?: boolean; data?: T } | null | undefined;
  return p && p.success === true && 'data' in p ? (p.data as T) : (payload as T);
}

function EbookCard({ result, onAddToList, canAdd, onOpen }: {
  result: SearchResult;
  onAddToList: (r: SearchResult) => void;
  canAdd: boolean;
  onOpen?: (r: SearchResult) => void;
}) {
  const { t } = useI18n();
  const tagColor = SOURCE_COLORS[result.sourceTag] ?? 'bg-neutral-100 text-neutral-700';
  const pendingExternal = result.sourceTag.includes('Pending review');
  return (
    <Resource3DBookCard
      id={result.id}
      title={result.title === UNTITLED_EXTERNAL ? t('search.untitledExternal') : result.title}
      authors={result.authors}
      year={result.year}
      resourceType={result.item_type || (result.sourceTag.includes('Journal') ? 'journal' : result.sourceTag.includes('Article') ? 'article' : 'ebook')}
      coverUrl={result.cover_url}
      status={pendingExternal ? t('search.pendingReview') : t('search.externalSource')}
      confidence={translateSourceTag(result.sourceTag, t)}
      onClick={onOpen ? () => onOpen(result) : undefined}
      actions={(
        <>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tagColor}`}>{translateSourceTag(result.sourceTag, t)}</span>
          {result.rights_status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">{result.rights_status}</span>}
          {result.read_url && (
            <a href={result.read_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-primary-700 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-800">
              {t('search.viewSource')}
            </a>
          )}
          {result.can_download && (result.download_url ?? result.pdf_url) && (
            <a href={result.download_url ?? result.pdf_url!} target="_blank" rel="noopener noreferrer" className="text-xs border border-primary-300 text-primary-700 px-3 py-1.5 rounded-lg font-medium hover:bg-primary-50">
              {t('search.legalDownload')}
            </a>
          )}
          {canAdd && (
            <button onClick={() => onAddToList(result)} className="text-xs border border-neutral-300 text-neutral-600 px-3 py-1.5 rounded-lg hover:bg-neutral-50">
              {pendingExternal ? t('search.requestReview') : t('search.addToList')}
            </button>
          )}
        </>
      )}
    />
  );
}

function ResultCard({ result, onAddToList, canAdd, onOpen }: {
  result: SearchResult;
  onAddToList: (r: SearchResult) => void;
  canAdd: boolean;
  onOpen?: (r: SearchResult) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const isEbook = ['Project Gutenberg — Free Ebook', 'Open Library — Free to Read', 'OAPEN — Open Access Book', 'DOAB — Peer-Reviewed Open Access', 'Google Books — Free Preview'].includes(result.sourceTag);
  if (isEbook || result.cover_url) {
    return <EbookCard result={result} onAddToList={onAddToList} canAdd={canAdd} onOpen={onOpen} />;
  }
  const tagColor = SOURCE_COLORS[result.sourceTag] ?? 'bg-neutral-100 text-neutral-700';
  const pendingExternal = result.sourceTag.includes('Pending review');
  return (
    <Resource3DBookCard
      id={result.id}
      title={result.title === UNTITLED_EXTERNAL ? t('search.untitledExternal') : result.title}
      authors={result.authors}
      year={result.year}
      resourceType={result.item_type || (result.sourceTag.includes('Thesis') ? 'thesis' : result.sourceTag.includes('Journal') ? 'journal' : result.sourceTag.includes('Book') ? 'book' : 'article')}
      coverUrl={result.cover_url}
      href={result.sourceTag === 'ESUT Library' && result.url ? result.url : undefined}
      onClick={onOpen ? () => onOpen(result) : undefined}
      status={pendingExternal ? t('search.pendingReview') : result.source}
      confidence={result.doi ? t('search.doiPrefix', { doi: result.doi }) : undefined}
      actions={(
        <>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tagColor}`}>{translateSourceTag(result.sourceTag, t)}</span>
            {result.rights_status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">{result.rights_status}</span>}
          {result.abstract && result.abstract.length > 180 && (
            <button type="button" onClick={() => setExpanded(e => !e)} className="text-xs text-primary-600 hover:underline">{expanded ? t('search.lessDetail') : t('search.moreDetail')}</button>
          )}
          {expanded && result.abstract && <span className="basis-full text-xs text-neutral-500 line-clamp-none">{result.abstract === ABSTRACT_TRUSTED ? t('search.foundTrusted') : result.abstract === ABSTRACT_PENDING ? t('search.foundPending') : result.abstract}</span>}
          {result.url && result.sourceTag !== 'ESUT Library' && (
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs py-1.5 px-3 whitespace-nowrap">{t('search.viewSource')}</a>
          )}
          {result.can_download && (result.download_url ?? result.pdf_url) && (
            <a href={result.download_url ?? result.pdf_url!} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">{t('search.legalDownload')}</a>
          )}
          {canAdd && (
            <button onClick={() => onAddToList(result)} className="btn-outline text-xs py-1.5 px-3 whitespace-nowrap">{pendingExternal ? t('search.requestReview') : t('search.addReadingList')}</button>
          )}
        </>
      )}
    />
  );
}

export default function GlobalSearch() {
  const { t } = useI18n();
  usePageTitle(t('search.title'));
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

  const mapApiResults = useCallback((data: SearchApiPayload): SearchResults => {
    const local: SearchResult[] = (data.localResults ?? []).map((item) => ({
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
    const external: SearchResult[] = (data.externalCandidates ?? []).map((item) => ({
      id: item.id,
      title: item.title || UNTITLED_EXTERNAL,
      authors: Array.isArray(item.authors) ? item.authors.join(', ') : '',
      year: item.year ?? null,
      abstract: item.description || (item.actions?.approved ? ABSTRACT_TRUSTED : ABSTRACT_PENDING),
      doi: item.doi ?? null,
      url: item.actions?.readOnline ?? item.source_url ?? null,
      source: item.source_name,
      sourceTag: item.actions?.approved ? `${item.source_name}${VERIFIED_SUFFIX}` : `${item.source_name}${PENDING_SUFFIX}`,
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
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setResults(null);
    setSearchParams({ q });
    try {
      const response = await fetch(`/api/search/resources?q=${encodeURIComponent(q)}`, { headers: await authHeaders() });
      const raw = await response.json();
      const data = unwrapApi<SearchApiPayload>(raw);
      if (!response.ok) throw new Error(raw.error?.message || raw.error || t('search.searchFailed'));
      setResults(mapApiResults(data));
    } catch (err) {
      console.error('Search error:', err);
      setNotice({ type: 'error', msg: err instanceof Error ? err.message : t('search.searchFailed') });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, mapApiResults, setSearchParams, t]);

  const runExternalSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/search/resources?q=${encodeURIComponent(query)}&expand=true`, { headers: await authHeaders() });
      const raw = await response.json();
      const data = unwrapApi<SearchApiPayload>(raw);
      if (!response.ok) throw new Error(raw.error?.message || raw.error || t('search.externalSearchFailed'));
      setResults(mapApiResults(data));
    } catch (err) {
      setNotice({ type: 'error', msg: err instanceof Error ? err.message : t('search.externalSearchFailed') });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, mapApiResults, query, t]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void runSearch(query); };

  const handleOpenResult = useCallback((result: SearchResult) => {
    const isLocal = result.sourceTag === 'ESUT Library';
    void trackClientEvent({
      event_type: isLocal ? 'federated_result_click' : 'provider_result_click',
      entity_id: String(result.id),
      entity_type: isLocal ? 'catalogue_item' : 'external_resource',
      search_query: query.slice(0, 300),
      provider: result.source?.slice(0, 100),
      path: '/search/global',
    });
  }, [query]);

  const handleAddToList = async (result: SearchResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotice({ type: 'error', msg: t('search.signInToSave') });
      setTimeout(() => { void navigate('/login'); }, 1200);
      return;
    }
    if (result.sourceTag.includes('Pending review')) {
      const response = await fetch('/api/resource-requests/external', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ candidateId: result.id }) });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: 'error', msg: data.error?.message || data.error || t('search.couldNotRequestReview') });
        return;
      }
      setAddedIds(prev => new Set([...prev, result.id]));
      setNotice({ type: 'success', msg: t('search.requestSent') });
      return;
    }
    const { data: patron } = await supabase.from('patrons').select('id').eq('user_id', user.id).maybeSingle();
    if (!patron) {
      setNotice({ type: 'error', msg: t('search.noLibraryAccount') });
      return;
    }
    const { error } = await supabase.from('patron_saved_items').insert({
      patron_id: patron.id, title: result.title, authors: result.authors,
      year: result.year, doi: result.doi, url: result.url ?? result.pdf_url, source: result.source,
    });
    if (error) {
      console.error('Save error:', error);
      setNotice({ type: 'error', msg: t('search.couldNotSave') });
      return;
    }
    setAddedIds(prev => new Set([...prev, result.id]));
    setNotice({ type: 'success', msg: t('search.savedToReadingList', { title: result.title.slice(0, 60) }) });
  };


  const getTabResults = (): SearchResult[] => {
    if (!results) return [];
    const tab = TABS.find(entry => entry.id === activeTab);
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
          <BackButton label={t('common.back')} />
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">{t('search.title')}</h1>
          <p className="text-neutral-500 text-sm mb-5">{t('search.subtitle')}</p>
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input type="text" className="input flex-1 text-base" placeholder={t('search.placeholder')}
                value={query} onChange={e => setQuery(e.target.value)} autoFocus />
              <button type="submit" className="btn-primary px-6" disabled={loading}>{loading ? t('search.searching') : t('search.search')}</button>
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
              <span className="text-teal-700 font-bold text-sm">{t('search.aiOverview')}</span>
              <span className="text-xs text-teal-500">{t('search.poweredByGateway')}</span>
            </div>
            <p className="text-sm text-teal-900 leading-relaxed">{results.aiSummary}</p>
          </div>
        )}

        {!loading && results?.externalLookupOffered && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-950">{t('search.notFoundInLibrary')}</p>
              <p className="text-sm text-amber-800">{t('search.trustedSourcesNote')}</p>
            </div>
            <button className="btn-primary whitespace-nowrap" onClick={runExternalSearch}>{t('search.refreshSources')}</button>
          </div>
        )}

        {!loading && results?.externalLookupTriggered && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {t('search.trustedAutoNote')}{results.autoApprovedCount ? ` ${t('search.trustedResultsNote', { count: results.autoApprovedCount, plural: results.autoApprovedCount === 1 ? '' : 's' })}` : ''}
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
                    {t(tab.labelKey)}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {displayResults.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <p className="text-neutral-500">{t('search.noResultsInSource')}</p>
              </div>
            ) : (
              <Resource3DBookGrid className="lg:grid-cols-3 xl:grid-cols-4">
                {displayResults.map(r => (
                  <ResultCard key={r.id} result={r} onAddToList={handleAddToList} canAdd={!addedIds.has(r.id)} onOpen={handleOpenResult} />
                ))}
              </Resource3DBookGrid>
            )}
          </>
        )}

        {!loading && !results && (
          <div className="text-center py-16">
            <p className="text-neutral-400 text-base mb-8">{t('search.enterQuery')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-3xl mx-auto">
              {[
                { name: t('search.cardEsutLibrary'), icon: '🏛️', desc: t('search.cardLocalCatalogue') },
                { name: t('search.cardOpenAlex'), icon: '🔓', desc: t('search.cardOpenAccessWorldwide') },
                { name: t('search.cardPubMed'), icon: '🔬', desc: t('search.cardBiomedical') },
                { name: t('search.cardAjol'), icon: '🌍', desc: t('search.cardAfricanJournals') },
                { name: t('search.cardCrossref'), icon: '📑', desc: t('search.cardDoiMetadata') },
                { name: t('search.cardSemanticScholar'), icon: '🤖', desc: t('search.cardAiPapers') },
                { name: t('search.cardInternetArchive'), icon: '📦', desc: t('search.cardHistoricalTexts') },
                { name: t('search.cardUnpaywall'), icon: '📄', desc: t('search.cardFreePdf') },
                { name: t('search.cardFreeEbooks'), icon: '📚', desc: t('search.cardFreeEbooksDesc') },
                { name: t('search.cardBase'), icon: '🔎', desc: t('search.cardGreyLiterature') },
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
