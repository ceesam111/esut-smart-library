import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  fetchCoverage,
  fetchProgrammes,
  fetchResources,
  type CoverageResponseData,
  type ProgrammeWithStats,
  type ProgrammesResponseData,
  type ResourcesResponseData,
} from '@/lib/accreditationApi';
import { accessBadge, recordSourceLabel, resourceTypeLabel, verificationLabel } from '@/lib/accreditationLabels';

const PAGE_SIZE = 20;

type TabId = 'ebooks' | 'ejournals' | 'articles' | 'databases' | 'subjects';

const TAB_TYPE_MAP: Record<TabId, string[] | null> = {
  ebooks: ['ebook'],
  ejournals: ['ejournal'],
  articles: ['research_article', 'thesis', 'report', 'dataset', 'standard', 'course_material'],
  databases: null,
  subjects: null,
};

const PROGRAMME_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'ebooks', label: 'Ebooks' },
  { id: 'ejournals', label: 'Ejournals' },
  { id: 'articles', label: 'Research Articles' },
  { id: 'databases', label: 'Databases' },
  { id: 'subjects', label: 'Courses and Subjects' },
];

const ALL_SEARCH_TABS = PROGRAMME_TABS.filter((tab) => tab.id !== 'subjects');

const parseTabParam = (value: string | null, allowSubjects: boolean): TabId => {
  if (value === 'subjects') return allowSubjects ? 'subjects' : 'ebooks';
  if (value === 'ejournals') return 'ejournals';
  if (value === 'articles') return 'articles';
  if (value === 'databases') return 'databases';
  return 'ebooks';
};

const formatDate = (value: string | null): string => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface ResourceCardProps {
  item: ResourcesResponseData['items'][number];
}

function ResourceCard({ item }: ResourceCardProps) {
  const badge = accessBadge(item.accessState, item.verification);
  const verified = verificationLabel(item.verification);
  return (
    <article className="border border-neutral-200 rounded-xl p-4 bg-white flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <a
          href={item.landingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-neutral-900 hover:underline"
        >
          {item.title}
        </a>
        <span
          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
            badge.tone === 'open'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : badge.tone === 'warn'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : badge.tone === 'restricted'
                  ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
          }`}
          title={badge.detail ?? undefined}
        >
          {badge.label}
        </span>
      </div>
      <p className="text-sm text-neutral-600">
        {[item.creators.slice(0, 3).join(', '), item.year !== null ? String(item.year) : null, item.publisher]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="text-xs text-neutral-500">
        {item.sourceLabel} · {resourceTypeLabel(item.resourceType)}
        {item.openAccess ? ' · Open access' : ''}
        {verified ? ` · ${verified}` : ''}
      </p>
      {item.abstract ? (
        <p className="text-sm text-neutral-700 line-clamp-3">{item.abstract}</p>
      ) : null}
      {item.subjects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.subjects.slice(0, 6).map((subject) => (
            <span key={subject} className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">
              {subject}
            </span>
          ))}
        </div>
      ) : null}
      {item.availability ? (
        <p className="text-xs text-neutral-500">
          Shelf: {item.availability.shelfLocation ?? 'Ask at the desk'}
          {item.availability.callNumber ? ` · Call number ${item.availability.callNumber}` : ''}
        </p>
      ) : null}
      <div className="mt-auto pt-1 flex flex-wrap items-center gap-3 text-sm">
        {badge.allowsFullTextAction && item.fullTextUrl ? (
          <a
            href={item.fullTextUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold"
            style={{ color: '#8A6A00' }}
          >
            Open full text
          </a>
        ) : null}
        {item.doi ? (
          <a
            href={`https://doi.org/${item.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:underline"
          >
            doi.org/{item.doi}
          </a>
        ) : null}
        <span className="text-xs text-neutral-400">{recordSourceLabel(item.recordSource)}</span>
      </div>
    </article>
  );
}

interface ExplorerProps {
  catalogue: ProgrammesResponseData;
  slug?: string;
  programme?: ProgrammeWithStats;
  initialQuery?: string;
}

function ResourceExplorer({ catalogue, slug, programme, initialQuery }: ExplorerProps) {
  const tabs = slug ? PROGRAMME_TABS : ALL_SEARCH_TABS;
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>(() =>
    parseTabParam(searchParams.get('tab'), Boolean(slug)),
  );
  const paramQuery = searchParams.get('q') ?? '';
  const [queryInput, setQueryInput] = useState(initialQuery ?? paramQuery);
  const [query, setQuery] = useState(initialQuery ?? paramQuery);
  const [yearFrom, setYearFrom] = useState(catalogue.yearFrom);
  const [yearTo, setYearTo] = useState(catalogue.yearTo);
  const [source, setSource] = useState('');
  const [fullTextOnly, setFullTextOnly] = useState(false);
  const [sort, setSort] = useState<'relevance' | 'year_desc'>('relevance');
  const [page, setPage] = useState(1);
  const [resources, setResources] = useState<ResourcesResponseData | null>(null);
  const [coverage, setCoverage] = useState<CoverageResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    const types = TAB_TYPE_MAP[tab];
    if (types === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchResources({
      programme: slug,
      q: query.trim() || undefined,
      yearFrom,
      yearTo,
      types,
      fullTextOnly: fullTextOnly || undefined,
      source: source || undefined,
      page,
      pageSize: PAGE_SIZE,
      sort,
    })
      .then((data) => {
        if (!cancelled) setResources(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load resources.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, tab, query, yearFrom, yearTo, fullTextOnly, source, page, sort]);

  useEffect(() => {
    if (!slug || tab !== 'subjects') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCoverage(slug)
      .then((data) => {
        if (!cancelled) setCoverage(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load coverage.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, tab]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(queryInput);
    setPage(1);
  };

  const tabCount = (id: TabId): number | null => {
    const types = TAB_TYPE_MAP[id];
    if (!types || !resources) return null;
    return resources.typeFacets
      .filter((facet) => types.includes(facet.type))
      .reduce((sum, facet) => sum + facet.count, 0);
  };

  const totalPages = resources ? Math.max(1, Math.ceil(resources.total / resources.pageSize)) : 1;
  const databases = slug
    ? catalogue.databases.filter(
        (db) => db.programmeSlugs === 'all' || db.programmeSlugs.includes(slug),
      )
    : catalogue.databases;

  const yearOptions = useMemo(() => {
    const options: number[] = [];
    for (let year = catalogue.yearFrom; year <= catalogue.yearTo; year += 1) options.push(year);
    return options;
  }, [catalogue.yearFrom, catalogue.yearTo]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Resource categories">
        {tabs.map((entry) => {
          const count = tabCount(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => {
                setTab(entry.id);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                tab === entry.id
                  ? 'text-white border-transparent'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
              }`}
              style={tab === entry.id ? { backgroundColor: '#1F3A5F', borderColor: '#1F3A5F' } : undefined}
            >
              {entry.label}
              {count !== null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <form onSubmit={submitSearch} className="flex flex-col sm:flex-row gap-3">
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder={
              slug ? 'Search within this programme…' : 'Search across all 15 programmes — title, author, subject…'
            }
            aria-label="Search resources"
            className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#1F3A5F' }}
          >
            Search
          </button>
        </form>
        {tab !== 'databases' && tab !== 'subjects' ? (
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm text-neutral-600 flex items-center gap-2">
              Year
              <select
                value={yearFrom}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setYearFrom(value);
                  if (value > yearTo) setYearTo(value);
                  setPage(1);
                }}
                className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                aria-label="From year"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              –
              <select
                value={yearTo}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setYearTo(value);
                  if (value < yearFrom) setYearFrom(value);
                  setPage(1);
                }}
                className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                aria-label="To year"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-neutral-600 flex items-center gap-2">
              Source
              <select
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setPage(1);
                }}
                className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                aria-label="Filter by source"
              >
                <option value="">All sources</option>
                {resources?.providerFacets.map((facet) => (
                  <option key={facet.provider} value={facet.provider}>
                    {facet.label} ({facet.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-neutral-600 flex items-center gap-2">
              Sort
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value === 'year_desc' ? 'year_desc' : 'relevance');
                  setPage(1);
                }}
                className="border border-neutral-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                aria-label="Sort results"
              >
                <option value="relevance">Best match</option>
                <option value="year_desc">Newest first</option>
              </select>
            </label>
            <label className="text-sm text-neutral-600 flex items-center gap-2">
              <input
                type="checkbox"
                checked={fullTextOnly}
                onChange={(event) => {
                  setFullTextOnly(event.target.checked);
                  setPage(1);
                }}
              />
              Full-text links only
            </label>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="border border-amber-300 bg-amber-50 text-amber-800 rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      ) : null}

      {tab === 'databases' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => (
            <div key={db.id} className="border border-neutral-200 rounded-xl p-4 bg-white flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={db.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-neutral-900 hover:underline"
                >
                  {db.name}
                </a>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                    db.accessState === 'open'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-sky-50 text-sky-700 border border-sky-200'
                  }`}
                >
                  {db.accessState === 'open' ? 'Open access' : 'Institutional access'}
                </span>
              </div>
              <p className="text-sm text-neutral-600">{db.description}</p>
              <p className="text-xs text-neutral-500 mt-auto">
                {db.kinds.map((kind) => resourceTypeLabel(kind)).join(', ')}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'subjects' && programme ? (
        <div className="space-y-6">
          {coverage ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-xs text-neutral-500">Records indexed</p>
                  <p className="text-2xl font-bold text-neutral-900">{coverage.totals.indexed}</p>
                </div>
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-xs text-neutral-500">From {catalogue.yearFrom} onward</p>
                  <p className="text-2xl font-bold text-neutral-900">{coverage.totals.recent2023}</p>
                </div>
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-xs text-neutral-500">Verified full text</p>
                  <p className="text-2xl font-bold text-neutral-900">{coverage.totals.fullText}</p>
                </div>
                <div className="border border-neutral-200 rounded-xl p-4 bg-white">
                  <p className="text-xs text-neutral-500">Links verified</p>
                  <p className="text-2xl font-bold text-neutral-900">{coverage.totals.verified}</p>
                </div>
              </div>
              {coverage.warnings.map((warning) => (
                <p
                  key={warning.message}
                  className={`text-sm rounded-lg px-4 py-3 border ${
                    warning.level === 'ok'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {warning.message}
                </p>
              ))}
              <div>
                <h2 className="text-lg font-bold text-neutral-900 mb-3">Subject areas</h2>
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-neutral-500">
                        <th scope="col" className="px-4 py-2 font-semibold">Subject</th>
                        <th scope="col" className="px-4 py-2 font-semibold">Matching records</th>
                        <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverage.topics.map((topic) => (
                        <tr key={topic.topic} className="border-t border-neutral-100">
                          <td className="px-4 py-2 text-neutral-800">{topic.topic}</td>
                          <td className="px-4 py-2 text-neutral-600">{topic.count}</td>
                          <td className="px-4 py-2">
                            {topic.weak ? (
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                Needs more resources
                              </span>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                                Covered
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  “Needs more resources” flags subjects below an internal screening heuristic of{' '}
                  {coverage.thresholds.topicMinimum} matching records. This is a library working
                  target, not a NUC quota.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 mb-3">Curriculum topics</h2>
                <div className="flex flex-wrap gap-2">
                  {programme.curriculumTopics.map((topic) => (
                    <span key={topic} className="text-sm bg-neutral-100 text-neutral-700 rounded-full px-3 py-1">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : loading ? (
            <p className="text-sm text-neutral-500">Loading subject coverage…</p>
          ) : null}
        </div>
      ) : null}

      {tab !== 'databases' && tab !== 'subjects' ? (
        <div>
          {loading && !resources ? <p className="text-sm text-neutral-500">Loading resources…</p> : null}
          {resources ? (
            <>
              <p className="text-sm text-neutral-500 mb-4">
                {resources.total} resource{resources.total === 1 ? '' : 's'}
                {query.trim() ? ` matching “${query.trim()}”` : ''}
                {slug ? ' in this programme' : ' across all programmes'}
              </p>
              {resources.capped ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
                  The result set is larger than the display cap. Narrow the search with filters to
                  see more of it.
                </p>
              ) : null}
              {resources.items.length === 0 ? (
                <p className="text-sm text-neutral-500 border border-neutral-200 rounded-lg px-4 py-6 text-center bg-white">
                  No resources match the current filters. Try widening the year range or clearing
                  the source filter.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {resources.items.map((item) => (
                    <ResourceCard key={item.key} item={item} />
                  ))}
                </div>
              )}
              {totalPages > 1 ? (
                <nav className="flex items-center justify-between mt-6" aria-label="Pagination">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || loading}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-600 disabled:opacity-40 bg-white"
                  >
                    ‹ Previous
                  </button>
                  <span className="text-sm text-neutral-500">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages || loading}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-600 disabled:opacity-40 bg-white"
                  >
                    Next ›
                  </button>
                </nav>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AccreditationResources() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [catalogue, setCatalogue] = useState<ProgrammesResponseData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [searchQuery, setSearchQuery] = useState<string | null>(() => searchParams.get('q'));

  const programme = slug && catalogue ? catalogue.programmes.find((entry) => entry.slug === slug) : undefined;

  usePageTitle(programme ? programme.name : '2026 Accreditation Resources');

  useEffect(() => {
    let cancelled = false;
    fetchProgrammes()
      .then((data) => {
        if (!cancelled) setCatalogue(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load programmes.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitLandingSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim() || null);
  };

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <BackButton />
        <div className="border border-amber-300 bg-amber-50 text-amber-800 rounded-lg px-4 py-3 text-sm">
          {loadError}
        </div>
      </div>
    );
  }

  if (!catalogue) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <BackButton />
        <p className="text-sm text-neutral-500">Loading accreditation resources…</p>
      </div>
    );
  }

  if (slug && !programme) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <BackButton />
        <p className="text-sm text-neutral-500">Programme not found.</p>
        <Link to="/accreditation-resources" className="text-sm font-semibold hover:underline" style={{ color: '#8A6A00' }}>
          Back to all programmes
        </Link>
      </div>
    );
  }

  if (programme) {
    const programmeDatabases = catalogue.databases.filter(
      (db) => db.programmeSlugs === 'all' || db.programmeSlugs.includes(programme.slug),
    );
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <BackButton />
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#D4A017' }}>
            2026 NUC Accreditation Resources
          </p>
          <h1 className="text-3xl font-bold text-neutral-900 mb-1">{programme.name}</h1>
          <p className="text-neutral-500">
            {programme.department} · {programme.faculty} · {programme.degreeLevels.join(', ')}
          </p>
          <p className="text-sm text-neutral-600 mt-2">
            NUC accreditation visit {formatDate(programme.accreditationVisit.start)} –{' '}
            {formatDate(programme.accreditationVisit.end)}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-3 py-1">
              {programme.stats.indexed} records indexed
            </span>
            <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-3 py-1">
              {programme.stats.recent2023} from {catalogue.yearFrom} onward
            </span>
            <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-3 py-1">
              {programme.stats.verifiedFullText} verified full-text links
            </span>
            <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-3 py-1">
              {programmeDatabases.length} databases
            </span>
            <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-3 py-1">
              Last synchronised {formatDate(programme.stats.lastSyncedAt)}
            </span>
          </div>
        </div>
        <ResourceExplorer catalogue={catalogue} slug={programme.slug} programme={programme} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <BackButton />
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#D4A017' }}>
          2026 NUC Accreditation Resources
        </p>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Accreditation Resource Portal</h1>
        <p className="text-neutral-500 max-w-2xl">
          Curated digital resources for all {catalogue.programmes.length} programmes seeking NUC
          accreditation in 2026. Resources are published from {catalogue.yearFrom} onward, with
          full-text links verified where possible. {catalogue.databases.length} academic databases
          are available.
        </p>
      </div>

      <form onSubmit={submitLandingSearch} className="mb-10 flex flex-col sm:flex-row gap-3">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search across all programmes — title, author, subject…"
          aria-label="Search all programmes"
          className="flex-1 min-w-0 border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#1F3A5F' }}
        >
          Search
        </button>
      </form>

      {searchQuery ? (
        <div>
          <button
            type="button"
            onClick={() => setSearchQuery(null)}
            className="mb-6 text-sm font-semibold hover:underline"
            style={{ color: '#8A6A00' }}
          >
            ‹ Back to programme collections
          </button>
          <ResourceExplorer key={searchQuery} catalogue={catalogue} initialQuery={searchQuery} />
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Programme collections</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalogue.programmes.map((entry) => {
              const dbCount = catalogue.databases.filter(
                (db) => db.programmeSlugs === 'all' || db.programmeSlugs.includes(entry.slug),
              ).length;
              return (
                <Link
                  key={entry.slug}
                  to={`/accreditation-resources/${entry.slug}`}
                  className="border border-neutral-200 rounded-xl p-5 bg-white hover:border-primary-300 hover:shadow-sm transition-colors flex flex-col gap-2"
                >
                  <h3 className="font-bold text-neutral-900">{entry.name}</h3>
                  <p className="text-xs text-neutral-500">
                    {entry.department} · {entry.faculty}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2 py-0.5">
                      {entry.stats.indexed} indexed records
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2 py-0.5">
                      {entry.stats.ebooks} ebooks
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2 py-0.5">
                      {entry.stats.ejournals} e-journals
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2 py-0.5">
                      {entry.stats.articles} articles
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2 py-0.5">
                      {dbCount} databases
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2 py-0.5">
                      {entry.stats.verifiedFullText} verified links
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-auto pt-1">
                    Last synchronised {formatDate(entry.stats.lastSyncedAt)}
                  </p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
