import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import { IR_ITEM_TYPES } from '@/lib/moduleSeparation';
import { usePageTitle } from '@/hooks/usePageTitle';
import StudyBreakButton from '@/components/StudyBreakButton';
import { Resource3DBookCard, Resource3DBookCardSkeleton, Resource3DBookGrid } from '@/components/resource/Resource3DBookCard';

const formats = ['Book', 'Journal', 'E-Book', 'E-Journal', 'Video', 'Map', 'Report', 'Library Item'];
const languages = ['English', 'French', 'Arabic', 'Yoruba', 'Igbo', 'Hausa'];
const currentYear = new Date().getFullYear();
const yearRanges = [
  { label: 'Last 5 years', min: currentYear - 5, max: currentYear },
  { label: 'Last 10 years', min: currentYear - 10, max: currentYear },
  { label: '2000 – 2009', min: 2000, max: 2009 },
  { label: '1990 – 1999', min: 1990, max: 1999 },
  { label: 'Before 1990', min: 0, max: 1989 },
];

// ── Ebook types ───────────────────────────────────────────────────────────────
interface EbookResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  subject: string;
  source: string;
  sourceTag: string;
  cover_url: string | null;
  read_url: string | null;
  download_url: string | null;
}

interface EbookResponse {
  gutenberg: EbookResult[];
  openlibrary: EbookResult[];
  oapen: EbookResult[];
  doab: EbookResult[];
  google: EbookResult[];
  all: EbookResult[];
}

const SUBJECT_PILLS = ['Education', 'Science', 'Arts', 'Management', 'General'];

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  gutenberg:   { label: 'Project Gutenberg', cls: 'bg-orange-100 text-orange-800 border border-orange-200' },
  openlibrary: { label: 'Open Library',      cls: 'bg-sky-100 text-sky-800 border border-sky-200' },
  oapen:       { label: 'OAPEN',             cls: 'bg-teal-100 text-teal-800 border border-teal-200' },
  doab:        { label: 'DOAB',              cls: 'bg-cyan-100 text-cyan-800 border border-cyan-200' },
  google:      { label: 'Google Books',      cls: 'bg-red-100 text-red-800 border border-red-200' },
};

const SOURCE_FILTER_LABELS: { key: string; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'gutenberg',  label: 'Gutenberg' },
  { key: 'openlibrary',label: 'Open Library' },
  { key: 'oapen',     label: 'OAPEN' },
  { key: 'doab',      label: 'DOAB' },
  { key: 'google',    label: 'Google Books' },
];

function sourceKey(sourceName: string) {
  const source = sourceName.toLowerCase();
  if (source.includes('open library')) return 'openlibrary';
  if (source.includes('google')) return 'google';
  if (source.includes('doab')) return 'doab';
  if (source.includes('oapen')) return 'oapen';
  if (source.includes('gutenberg')) return 'gutenberg';
  return 'openlibrary';
}

function emptyEbookResponse(): EbookResponse {
  return { gutenberg: [], openlibrary: [], oapen: [], doab: [], google: [], all: [] };
}

function mapResourceSearchToEbooks(data: any): EbookResponse {
  const response = emptyEbookResponse();
  const candidates = [...(data.externalCandidates ?? []), ...(data.localResults ?? [])];
  for (const item of candidates) {
    const source = sourceKey(item.source_name || item.source || 'Open Library');
    const ebook: EbookResult = {
      id: String(item.id || item.source_record_id || item.title),
      title: item.title || 'Untitled ebook',
      authors: Array.isArray(item.authors) ? item.authors.join(', ') : String(item.authors ?? ''),
      year: item.year ?? null,
      subject: Array.isArray(item.subjects) ? item.subjects.join(', ') : String(item.subjects ?? ''),
      source,
      sourceTag: item.source_name || item.source || 'Open resource',
      cover_url: item.cover_url || item.cover_image || null,
      read_url: item.source_url || null,
      download_url: item.download_url || null,
    };
    (response[source as keyof EbookResponse] as EbookResult[]).push(ebook);
    response.all.push(ebook);
  }
  return response;
}

// ── Free Ebooks tab ───────────────────────────────────────────────────────────
function FreeEbooksTab() {
  const [query, setQuery]               = useState('');
  const [inputVal, setInputVal]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState<EbookResponse | null>(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [error, setError]               = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSourceFilter('all');
    try {
      const response = await fetch(`/api/search/resources?q=${encodeURIComponent(q)}&expand=true`);
      const raw = await response.json();
      if (!response.ok) throw new Error(raw.error?.message || 'External ebook search failed.');
      setResults(mapResourceSearchToEbooks(raw.data ?? raw));
    } catch (err) {
      console.error('ebook resource search error:', err);
      setError(err instanceof Error ? err.message : 'External ebook search failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setQuery(inputVal); doSearch(inputVal); };
  const handlePill   = (pill: string)        => { setInputVal(pill); setQuery(pill); doSearch(pill); };

  const visible: EbookResult[] = results
    ? (sourceFilter === 'all' ? results.all : (results[sourceFilter as keyof EbookResponse] as EbookResult[]) ?? [])
    : [];

  const totalSources = results
    ? [results.gutenberg, results.openlibrary, results.oapen, results.doab, results.google].filter(a => a.length > 0).length
    : 0;

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-3 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search free academic ebooks…"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button type="submit" className="btn-primary px-5 text-sm" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Subject pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SUBJECT_PILLS.map(pill => (
          <button
            key={pill}
            onClick={() => handlePill(pill)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              query === pill
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400 hover:text-primary-700'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-100 p-3 animate-pulse">
              <div className="w-full aspect-[3/4] bg-neutral-200 rounded-lg mb-3" />
              <div className="h-3 bg-neutral-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-neutral-100 rounded w-1/2 mb-3" />
              <div className="h-7 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
          <p className="font-semibold">Free ebook search is temporarily unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {!loading && results && (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm text-neutral-500">
              <span className="font-semibold text-neutral-800">{results.all.length}</span> free ebook{results.all.length !== 1 ? 's' : ''} from <span className="font-semibold text-neutral-800">{totalSources}</span> source{totalSources !== 1 ? 's' : ''}
            </p>
            {/* Source filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_FILTER_LABELS.map(sf => {
                const count = sf.key === 'all' ? results.all.length : ((results[sf.key as keyof EbookResponse] as EbookResult[])?.length ?? 0);
                if (sf.key !== 'all' && count === 0) return null;
                return (
                  <button
                    key={sf.key}
                    onClick={() => setSourceFilter(sf.key)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                      sourceFilter === sf.key
                        ? 'bg-primary-700 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {sf.label} {count > 0 && <span className="opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <p className="text-4xl mb-3">📚</p>
              <p>No ebooks found from this source.</p>
            </div>
          ) : (
            <Resource3DBookGrid className="lg:grid-cols-4">
              {visible.map(book => <EbookCard key={book.id} book={book} />)}
            </Resource3DBookGrid>
          )}
        </>
      )}

      {/* Prompt when no search yet */}
      {!loading && !results && (
        <div className="text-center py-20 text-neutral-400">
          <p className="text-5xl mb-4">🌐</p>
          <p className="font-medium text-neutral-600 mb-1">Search across 5 free ebook sources</p>
          <p className="text-sm">Project Gutenberg · Open Library · OAPEN · DOAB · Google Books</p>
          <p className="text-xs mt-3">Try a subject pill above, or type your own query</p>
        </div>
      )}
    </div>
  );
}

function EbookCard({ book }: { book: EbookResult }) {
  const badge = SOURCE_BADGE[book.source] ?? { label: book.sourceTag, cls: 'bg-neutral-100 text-neutral-700' };
  const isPeerReviewed = book.source === 'oapen' || book.source === 'doab';
  return (
    <Resource3DBookCard
      id={book.id}
      title={book.title}
      authors={book.authors}
      year={book.year}
      resourceType="ebook"
      coverUrl={book.cover_url}
      href={book.read_url || book.download_url || null}
      status="External open-access source"
      actions={(
        <>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
          {isPeerReviewed && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">Peer-reviewed</span>}
        </>
      )}
    />
  );
}

// ── Main Catalogue component ──────────────────────────────────────────────────
export default function Catalogue() {
  usePageTitle('Catalogue');
  const [searchParams, setSearchParams] = useSearchParams();

  // Active top-level tab: 'local' | 'ebooks'
  const [mainTab, setMainTab] = useState<'local' | 'ebooks'>(
    searchParams.get('tab') === 'ebooks' ? 'ebooks' : 'local'
  );

  const [items, setItems]             = useState<any[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [faculty, setFaculty]         = useState('');
  const [formats_sel, setFormats]     = useState<string[]>([]);
  const [yearRange, setYearRange]     = useState('');
  const [language, setLanguage]       = useState('');
  const [availability, setAvailability] = useState('');
  const [page, setPage]               = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const pageSize = 24;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user));
  }, []);

  const switchTab = (tab: 'local' | 'ebooks') => {
    setMainTab(tab);
    setSearchParams(tab === 'ebooks' ? { tab: 'ebooks' } : {});
  };

  const fetchItems = useCallback(async () => {
    if (mainTab !== 'local') return;
    setLoading(true);
    setCatalogueError(null);
    let q = supabase
      .from('catalogue_items')
      .select('id, title, authors, year, format, cover_image, isbn, faculty_code, available_copies, total_copies, language, subjects, view_count, download_count, call_number, visibility', { count: 'exact' })
      .order('created_at', { ascending: false });

    q = q.not('format', 'in', `(${IR_ITEM_TYPES.map((type) => `"${type}"`).join(',')})`);

    if (!isLoggedIn) {
      q = q.eq('visibility', 'global');
    } else {
      q = q.in('visibility', ['global', 'members']);
    }

    if (search) q = q.or(`title.ilike.%${search}%,isbn.ilike.%${search}%`);
    if (faculty) q = q.eq('faculty_code', faculty);
    if (formats_sel.length > 0) q = q.in('format', formats_sel);
    if (language) q = q.eq('language', language);
    if (availability === 'available') q = q.gt('available_copies', 0);
    if (yearRange) {
      const range = yearRanges.find(r => r.label === yearRange);
      if (range) q = q.gte('year', range.min).lte('year', range.max);
    }

    const from = (page - 1) * pageSize;
    const { data, count, error } = await q.range(from, from + pageSize - 1);
    if (error) {
      const missingSchema = /schema cache|Could not find the table|does not exist|PGRST20/i.test(`${error.code ?? ''} ${error.message ?? ''}`);
      setItems([]);
      setTotal(0);
      setCatalogueError(missingSchema
        ? 'The hosted Supabase database does not have the catalogue schema yet. Apply the Supabase migrations, then refresh this page.'
        : error.message || 'Catalogue search failed.');
      setLoading(false);
      return;
    }
    setItems(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [search, faculty, formats_sel, yearRange, language, availability, page, isLoggedIn, mainTab]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleFormat = (f: string) => {
    setFormats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
    setPage(1);
  };

  const clearAll = () => {
    setSearch(''); setFaculty(''); setFormats([]); setYearRange('');
    setLanguage(''); setAvailability(''); setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);
  const activeFilterCount = [faculty, yearRange, language, availability].filter(Boolean).length + formats_sel.length;

  const Sidebar = () => (
    <div className="space-y-6">
      {activeFilterCount > 0 && (
        <button onClick={clearAll} className="text-xs text-error-600 hover:text-error-800 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          Clear all filters ({activeFilterCount})
        </button>
      )}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Faculty</div>
        <select className="input text-xs" value={faculty} onChange={e => { setFaculty(e.target.value); setPage(1); }}>
          <option value="">All Faculties</option>
          {institutionConfig.faculties.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
        </select>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Format</div>
        <div className="space-y-1">
          {formats.map(f => (
            <label key={f} className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={formats_sel.includes(f)} onChange={() => toggleFormat(f)}
                className="w-3.5 h-3.5 rounded border-neutral-300 accent-primary-600" />
              <span className={`text-sm transition-colors ${formats_sel.includes(f) ? 'text-primary-700 font-medium' : 'text-neutral-600 group-hover:text-neutral-800'}`}>{f}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Year Range</div>
        <div className="space-y-1">
          {yearRanges.map(r => (
            <button key={r.label} onClick={() => { setYearRange(yearRange === r.label ? '' : r.label); setPage(1); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${yearRange === r.label ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Language</div>
        <div className="space-y-1">
          {languages.map(l => (
            <button key={l} onClick={() => { setLanguage(language === l ? '' : l); setPage(1); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${language === l ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Availability</div>
        <div className="space-y-1">
          {[{ val: '', label: 'All items' }, { val: 'available', label: 'Available now' }].map(opt => (
            <button key={opt.val} onClick={() => { setAvailability(opt.val); setPage(1); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${availability === opt.val ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="section py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-white mb-2">Library Catalogue</h1>
              <p className="text-white/70 text-sm mb-5">Browse, search and reserve our collections</p>
            </div>
            <StudyBreakButton className="!bg-white/10 !border-white/40 !text-white hover:!bg-white/20" />
          </div>
          {mainTab === 'local' && (
            <div className="flex gap-3 max-w-2xl">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by title, author, subject, or ISBN…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
                <svg className="absolute left-3 top-3.5 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </div>
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 6a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm4 6a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" /></svg>
                Filters {activeFilterCount > 0 && <span className="bg-gold-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="section">
          <div className="flex gap-0">
            {[
              { id: 'local' as const,  label: '📚 Local Collection' },
              { id: 'ebooks' as const, label: '🌐 Free Ebooks' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  mainTab === tab.id
                    ? 'border-primary-700 text-primary-700'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section py-8">
        {/* ── LOCAL COLLECTION TAB ── */}
        {mainTab === 'local' && (
          <>
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {faculty && <Chip label={institutionConfig.faculties.find(f => f.code === faculty)?.name ?? faculty} onRemove={() => setFaculty('')} />}
                {formats_sel.map(f => <Chip key={f} label={f} onRemove={() => toggleFormat(f)} />)}
                {yearRange && <Chip label={yearRange} onRemove={() => setYearRange('')} />}
                {language && <Chip label={language} onRemove={() => setLanguage('')} />}
                {availability && <Chip label="Available now" onRemove={() => setAvailability('')} />}
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar — desktop */}
              <aside className="hidden lg:block lg:w-56 shrink-0">
                <div className="card p-4 sticky top-20">
                  <Sidebar />
                </div>
              </aside>

              {/* Mobile sidebar overlay */}
              {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                  <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                  <div className="absolute inset-y-0 left-0 w-72 bg-white p-5 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">Filters</h3>
                      <button onClick={() => setSidebarOpen(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
                    </div>
                    <Sidebar />
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-neutral-500">
                    {loading ? 'Searching…' : `${total.toLocaleString()} item${total !== 1 ? 's' : ''} found`}
                  </p>
                </div>

                {catalogueError && (
                  <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Catalogue database is not ready</p>
                    <p className="mt-1">{catalogueError}</p>
                    <p className="mt-2 text-xs">Check <code>/api/health/schema</code> to see which Supabase tables are missing.</p>
                  </div>
                )}

                {loading ? (
                  <Resource3DBookGrid className="xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => <Resource3DBookCardSkeleton key={i} />)}
                  </Resource3DBookGrid>
                ) : items.length === 0 ? (
                  <div className="text-center py-20 text-neutral-400">
                    <p className="text-5xl mb-4">📚</p>
                    <p className="font-medium text-neutral-600">No items found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filters</p>
                    <Link to={`/repository${search ? `?q=${encodeURIComponent(search)}` : ''}`} className="inline-flex mt-3 text-primary-700 font-semibold text-sm hover:underline">Also search the Institutional Repository</Link>
                    {activeFilterCount > 0 && <button onClick={clearAll} className="btn-outline mt-4 text-sm">Clear all filters</button>}
                  </div>
                ) : (
                  <>
                    <Resource3DBookGrid className="xl:grid-cols-4">
                      {items.map(item => <CatalogueCard key={item.id} item={item} />)}
                    </Resource3DBookGrid>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-8">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                          className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40">Previous</button>
                        <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                          className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40">Next</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── FREE EBOOKS TAB ── */}
        {mainTab === 'ebooks' && <FreeEbooksTab />}
      </div>
    </div>
  );
}

function CatalogueCard({ item }: { item: any }) {
  return (
    <Resource3DBookCard
      id={item.id}
      title={item.title}
      authors={Array.isArray(item.authors) ? item.authors : String(item.authors || '').split(',').filter(Boolean)}
      resourceType={item.format || item.item_type || 'book'}
      coverUrl={item.cover_image}
      year={item.year}
      category={item.faculty_code}
      subjects={Array.isArray(item.subjects) ? item.subjects : []}
      spineText={item.call_number || item.isbn || item.format || 'Catalogue'}
      href={`/catalogue/${item.id}`}
      status={item.available_copies > 0 ? `${item.available_copies} available` : 'Unavailable'}
      actions={(
        <>
          <span className={`badge text-xs ${item.available_copies > 0 ? 'badge-success' : 'badge-error'}`}>
            {item.available_copies > 0 ? `${item.available_copies} avail.` : 'Unavailable'}
          </span>
          {item.visibility === 'members' && (
            <span title="Members only" className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
              Members
            </span>
          )}
          {item.view_count > 0 && (
            <span className="text-xs text-neutral-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              {item.view_count}
            </span>
          )}
        </>
      )}
    />
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-primary-900 transition-colors">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </span>
  );
}
