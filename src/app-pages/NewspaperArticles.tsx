import { useEffect, useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { newspapersData } from '@/data/newspapers';

const GREEN = '#1A4731';
const PAGE_SIZE = 24;

interface SerialLite {
  id: string;
  name: string;
  country: string | null;
  category: string | null;
  call_number: string | null;
}

interface ArticleRow {
  id: string;
  serial_id: string;
  title: string;
  link: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  indexing_status: string;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return 'Undated';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'Undated'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function NewspaperArticles() {
  usePageTitle('Newspaper Article Index');

  const [serials, setSerials] = useState<SerialLite[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [serialId, setSerialId] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(0);

  const fallbackSerials = useMemo<SerialLite[]>(() => newspapersData.map((paper) => ({
    id: String(paper.id),
    name: paper.name,
    country: paper.country,
    category: paper.category,
    call_number: null,
  })), []);

  const fallbackArticles = useMemo<ArticleRow[]>(() => newspapersData.map((paper) => ({
    id: `fallback-${paper.id}`,
    serial_id: String(paper.id),
    title: `${paper.name} latest news and article index`,
    link: paper.url,
    summary: paper.description,
    author: paper.name,
    published_at: null,
    indexing_status: 'manual',
  })), []);

  // Load serials once for the filter dropdown + name lookup
  useEffect(() => {
    supabase
      .from('newspaper_serials')
      .select('id, name, country, category, call_number')
      .order('name')
      .then(({ data, error }) => setSerials(error || !data?.length ? fallbackSerials : (data as SerialLite[])));
  }, [fallbackSerials]);

  const serialMap = useMemo(() => {
    const m = new Map<string, SerialLite>();
    serials.forEach((s) => m.set(s.id, s));
    return m;
  }, [serials]);

  const countries = useMemo(
    () => [...new Set(serials.map((s) => s.country).filter(Boolean) as string[])].sort(),
    [serials],
  );

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, serialId, country]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);

      // If filtering by country, resolve the matching serial ids first
      let serialIds: string[] | null = null;
      if (country) {
        serialIds = serials.filter((s) => s.country === country).map((s) => s.id);
        if (serialIds.length === 0) {
          if (!cancelled) {
            setArticles([]);
            setTotal(0);
            setLoading(false);
          }
          return;
        }
      }

      let query = supabase
        .from('newspaper_articles')
        .select('id, serial_id, title, link, summary, author, published_at, indexing_status', {
          count: 'exact',
        })
        .order('published_at', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (serialId) query = query.eq('serial_id', serialId);
      else if (serialIds) query = query.in('serial_id', serialIds);
      if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);

      const { data, count, error } = await query;
      if (!cancelled) {
        const fallback = error || !data?.length;
        const source = fallback ? fallbackArticles : (data as ArticleRow[]);
        const filteredSource = source.filter((article) => {
          const serial = serialMap.get(article.serial_id);
          return (!serialId || article.serial_id === serialId) &&
            (!country || serial?.country === country) &&
            (!search.trim() || article.title.toLowerCase().includes(search.trim().toLowerCase()));
        });
        setArticles(filteredSource.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));
        setTotal(fallback ? filteredSource.length : count ?? 0);
        setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [search, serialId, country, page, serials, serialMap, fallbackArticles]);

  const selCls =
    'border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="text-white" style={{ background: GREEN }}>
        <div className="section pt-24 pb-12">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
            <a href="/" className="hover:text-white transition-colors">Home</a>
            <span>›</span>
            <a href="/newspapers" className="hover:text-white transition-colors">Newspapers</a>
            <span>›</span>
            <span>Article Index</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Newspaper Article Index</h1>
          <p className="text-white/75 text-lg max-w-3xl">
            A searchable index of article links, harvested records where available, and curated newspaper sources.
            Browse by title, country, or keyword.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="section pt-6">
        <div className="flex gap-2 border-b border-neutral-200">
          <a
            href="/newspapers"
            className="px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-neutral-500 hover:text-neutral-800"
          >
            Newspaper Titles
          </a>
          <span
            className="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            Article Index
          </span>
        </div>
      </div>

      <div className="section py-10">
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search article titles…"
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-56 flex-1"
          />
          <select value={serialId} onChange={(e) => setSerialId(e.target.value)} className={selCls}>
            <option value="">All Newspapers</option>
            {serials.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={selCls}>
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {(search || serialId || country) && (
            <button
              onClick={() => { setSearch(''); setSerialId(''); setCountry(''); }}
              className="text-sm font-medium text-primary-700 hover:underline px-2"
            >
              Clear filters
            </button>
          )}
        </div>

        <p className="text-sm text-neutral-500 mb-6">
          {loading ? 'Loading…' : <><span className="font-semibold text-neutral-800">{total}</span> articles indexed</>}
        </p>

        {!loading && articles.length === 0 ? (
          <div className="text-center py-16 bg-white border border-neutral-100 rounded-2xl">
            <div className="text-4xl mb-3">🗞️</div>
            <p className="text-neutral-500">No articles match this filter.</p>
            <p className="text-neutral-400 text-sm mt-1">
              Articles appear as newspaper feeds are harvested or curated by library staff.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => {
              const s = serialMap.get(a.serial_id);
              return (
                <article
                  key={a.id}
                  className="bg-white border border-neutral-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-neutral-900 leading-snug">
                        {a.link ? (
                          <a href={a.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {a.title}
                          </a>
                        ) : (
                          a.title
                        )}
                      </h3>
                      {a.summary && (
                        <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{a.summary}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-neutral-500">
                        <span className="font-medium" style={{ color: GREEN }}>{s?.name ?? 'Unknown'}</span>
                        {s?.call_number && <span className="text-neutral-400">· {s.call_number}</span>}
                        <span>· {fmtDate(a.published_at)}</span>
                        {a.author && <span>· {a.author}</span>}
                        {a.indexing_status === 'manual' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                            Librarian-indexed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg disabled:opacity-40 bg-white"
            >
              ← Prev
            </button>
            <span className="text-sm text-neutral-500">Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg disabled:opacity-40 bg-white"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
