import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/lib/i18n';

interface ThesisItem {
  id: string;
  title: string;
  student_name: string | null;
  supervisor: string;
  faculty: string | null;
  department: string | null;
  programme: string | null;
  degree: string;
  year: number;
  abstract: string | null;
  keywords: string[];
  session: string | null;
  reference_no: string | null;
  created_at: string;
}

interface ThesisListResponse {
  success: boolean;
  data?: { items: ThesisItem[]; total: number };
  error?: string;
}

const DEGREE_LEVELS = ['All Levels', 'PhD', 'Masters', 'PGD', 'B.Ed', 'B.Sc', 'B.A', 'Undergraduate'];
const SORT_OPTIONS = [
  { value: 'year_desc', label: 'Newest First' },
  { value: 'year_asc', label: 'Oldest First' },
  { value: 'title_asc', label: 'Title A–Z' },
];

export default function ThesisListing() {
  usePageTitle('Theses, Projects & Dissertations');
  const { t } = useI18n();
  const [items, setItems] = useState<ThesisItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('All Levels');
  const [sort, setSort] = useState('year_desc');
  const [expanded, setExpanded] = useState<string | null>(null);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort });
      if (search) query.set('q', search);
      if (degreeFilter !== 'All Levels') query.set('degree', degreeFilter);

      try {
        const response = await fetch(`/api/theses?${query.toString()}`, { headers: { accept: 'application/json' } });
        const payload = (await response.json()) as ThesisListResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? 'Thesis listing request failed.');
        }
        setItems(payload.data.items);
        setTotal(payload.data.total);
      } catch {
        setItems([]);
        setTotal(0);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [page, search, degreeFilter, sort]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const degreeBadge = (level: string | null) => {
    if (!level) return 'bg-neutral-100 text-neutral-500';
    if (level.toLowerCase().includes('phd') || level.toLowerCase().includes('doctorate')) return 'bg-purple-100 text-purple-700';
    if (level.toLowerCase().includes('master') || level.toLowerCase().includes('msc') || level.toLowerCase().includes('ma')) return 'bg-blue-100 text-blue-700';
    if (level.toLowerCase().includes('pgd')) return 'bg-teal-100 text-teal-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="section py-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <Link to="/repository" className="hover:text-white transition-colors">Repository</Link>
              <span>›</span>
              <span>Theses &amp; Projects</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Theses, Projects &amp; Dissertations</h1>
            <p className="text-white/75 text-lg">
              Browse {institutionConfig.name}&apos;s academic research outputs — undergraduate projects, postgraduate dissertations, and doctoral theses.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        {/* Search and filters */}
        <div className="bg-white border border-neutral-100 rounded-2xl p-5 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by title, supervisor, degree, or keyword..."
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button type="submit" className="btn-primary px-6 shrink-0">Search</button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); setPage(0); }}
                className="px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Clear
              </button>
            )}
          </form>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-wrap gap-2">
              {DEGREE_LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => { setDegreeFilter(level); setPage(0); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    degreeFilter === level ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-neutral-500">Sort:</label>
              <select
                value={sort}
                onChange={e => { setSort(e.target.value); setPage(0); }}
                className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-neutral-500">
            {loading ? 'Loading…' : `${total.toLocaleString()} result${total !== 1 ? 's' : ''}${search ? ` for "${search}"` : ''}`}
          </p>
          <Link to="/repository/submit" className="text-sm text-primary-700 hover:underline font-medium">
            Submit a Thesis →
          </Link>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="text-center py-16 bg-white border border-neutral-100 rounded-2xl">
            <p className="text-neutral-600 font-medium">{t('thesisListing.loadFailed')}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white border border-neutral-100 rounded-2xl">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-neutral-500 font-medium">No theses found.</p>
            <p className="text-neutral-400 text-sm mt-1">
              {search ? `No results match "${search}". Try a different search term.` : 'No approved theses have been published yet.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide w-12">#</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide hidden md:table-cell">Author(s)</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide hidden lg:table-cell">Faculty / Dept</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide hidden sm:table-cell">Level</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-400 uppercase tracking-wide hidden sm:table-cell">Year</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {items.map((item, idx) => (
                    <Fragment key={item.id}>
                      <tr
                        className="hover:bg-neutral-50 transition-colors cursor-pointer"
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      >
                        <td className="px-4 py-3 text-neutral-400 text-xs font-mono">
                          {page * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-neutral-900 line-clamp-2 leading-snug">{item.title}</span>
                          <div className="md:hidden mt-1 text-xs text-neutral-500">{item.student_name ?? item.programme ?? ''}</div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600 hidden md:table-cell max-w-[180px]">
                          <span className="line-clamp-2">{item.student_name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 hidden lg:table-cell text-xs">
                          <div>{item.faculty}</div>
                          {item.department && <div className="text-neutral-400">{item.department}</div>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {item.degree && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${degreeBadge(item.degree)}`}>
                              {item.degree}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs hidden sm:table-cell">
                          {item.year ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <svg
                            className={`w-4 h-4 text-neutral-400 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                      </tr>

                      {expanded === item.id && (
                        <tr key={`${item.id}-expanded`} className="bg-neutral-50">
                          <td colSpan={7} className="px-6 py-5">
                            <div className="max-w-3xl">
                              <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
                                {item.supervisor && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Supervisor: </span>
                                    <span className="text-neutral-800">{item.supervisor}</span>
                                  </div>
                                )}
                                {item.faculty && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Faculty: </span>
                                    <span className="text-neutral-800">{item.faculty}</span>
                                  </div>
                                )}
                                {item.department && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Department: </span>
                                    <span className="text-neutral-800">{item.department}</span>
                                  </div>
                                )}
                                {item.programme && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Programme: </span>
                                    <span className="text-neutral-800">{item.programme}</span>
                                  </div>
                                )}
                                {item.year && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Year: </span>
                                    <span className="text-neutral-800">{item.year}</span>
                                  </div>
                                )}
                                {item.degree && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Degree: </span>
                                    <span className="text-neutral-800">{item.degree}</span>
                                  </div>
                                )}
                                {item.session && (
                                  <div>
                                    <span className="font-medium text-neutral-500">Session: </span>
                                    <span className="text-neutral-800">{item.session}</span>
                                  </div>
                                )}
                              </div>

                              {item.abstract && (
                                <div className="mb-4">
                                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Abstract</h4>
                                  <p className="text-sm text-neutral-700 leading-relaxed bg-white border border-neutral-100 rounded-lg p-4">
                                    {item.abstract}
                                  </p>
                                </div>
                              )}

                              {item.keywords && item.keywords.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Keywords</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {item.keywords.map(kw => (
                                      <span key={kw} className="text-xs bg-white border border-neutral-200 text-neutral-600 px-2.5 py-1 rounded-full">
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-3">
                                <Link
                                  to={`/theses/${item.id}`}
                                  className="btn-primary text-xs px-4 py-2"
                                >
                                  View Full Record
                                </Link>
                                <Link
                                  to={`/search/global?q=${encodeURIComponent(item.title)}`}
                                  className="btn-outline text-xs px-4 py-2"
                                >
                                  Find Related
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-neutral-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-50 transition-colors"
              >
                ← Prev
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const p = page < 3 ? i : page - 2 + i;
                if (p >= totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 text-sm rounded-lg transition-colors ${
                      page === p ? 'bg-primary-700 text-white' : 'border border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 text-sm border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-50 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Submit CTA */}
        <div className="mt-10 bg-neutral-50 border border-neutral-200 rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <h3 className="font-bold text-neutral-900 mb-1">Submit Your Research</h3>
            <p className="text-neutral-600 text-sm">
              Are you a student or researcher at {institutionConfig.shortName}? Submit your thesis, project, or dissertation to the library repository.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/repository/submit" className="btn-primary shrink-0">Submit Work</Link>
            <Link to="/thesis/status" className="btn-outline shrink-0">Check Status</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
