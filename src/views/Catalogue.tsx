import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

const formats = ['Book', 'Journal', 'E-Book', 'Video', 'Map', 'Thesis', 'Report'];
const languages = ['English', 'French', 'Arabic', 'Yoruba', 'Igbo', 'Hausa'];
const currentYear = new Date().getFullYear();
const yearRanges = [
  { label: 'Last 5 years', min: currentYear - 5, max: currentYear },
  { label: 'Last 10 years', min: currentYear - 10, max: currentYear },
  { label: '2000 – 2009', min: 2000, max: 2009 },
  { label: '1990 – 1999', min: 1990, max: 1999 },
  { label: 'Before 1990', min: 0, max: 1989 },
];

export default function Catalogue() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [faculty, setFaculty] = useState('');
  const [formats_sel, setFormats] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState('');
  const [language, setLanguage] = useState('');
  const [availability, setAvailability] = useState('');
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageSize = 24;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('catalogue_items')
      .select('id, title, authors, year, format, cover_image, faculty_code, available_copies, total_copies, language, subjects, view_count, download_count, call_number', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) q = q.or(`title.ilike.%${search}%,authors::text.ilike.%${search}%,isbn.ilike.%${search}%`);
    if (faculty) q = q.eq('faculty_code', faculty);
    if (formats_sel.length > 0) q = q.in('format', formats_sel);
    if (language) q = q.eq('language', language);
    if (availability === 'available') q = q.gt('available_copies', 0);
    if (yearRange) {
      const range = yearRanges.find(r => r.label === yearRange);
      if (range) q = q.gte('year', range.min).lte('year', range.max);
    }

    const from = (page - 1) * pageSize;
    const { data, count } = await q.range(from, from + pageSize - 1);
    setItems(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [search, faculty, formats_sel, yearRange, language, availability, page]);

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
    <div className="pt-16">
      {/* Header */}
      <div className="page-header">
        <div className="section py-10">
          <h1 className="text-3xl font-serif font-semibold text-white mb-2">Library Catalogue</h1>
          <p className="text-white/70 text-sm mb-5">Browse, search and reserve our collections</p>
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
        </div>
      </div>

      <div className="section py-8">
        {/* Active filter chips */}
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

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="card p-3 animate-pulse">
                    <div className="w-full aspect-[3/4] bg-neutral-200 rounded-lg mb-3" />
                    <div className="h-3.5 bg-neutral-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-neutral-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 text-neutral-400">
                <p className="text-5xl mb-4">📚</p>
                <p className="font-medium text-neutral-600">No items found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
                {activeFilterCount > 0 && <button onClick={clearAll} className="btn-outline mt-4 text-sm">Clear all filters</button>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map(item => <CatalogueCard key={item.id} item={item} />)}
                </div>

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
      </div>
    </div>
  );
}

function CatalogueCard({ item }: { item: any }) {
  return (
    <Link to={`/catalogue/${item.id}`} className="card p-3 group hover:-translate-y-0.5 transition-all flex flex-col">
      <div className="w-full aspect-[3/4] bg-primary-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {item.cover_image
          ? <img src={item.cover_image} alt={item.title} className="w-full h-full object-cover" />
          : (
            <div className="flex flex-col items-center text-primary-200">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14H8V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
              <span className="text-xs mt-1 text-primary-400 font-medium">{item.format}</span>
            </div>
          )
        }
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-neutral-800 group-hover:text-primary-700 text-xs leading-snug line-clamp-2 mb-1">{item.title}</h3>
        <p className="text-xs text-neutral-400 line-clamp-1 mb-2">
          {Array.isArray(item.authors) ? item.authors.join(', ') : item.authors}
          {item.year && ` · ${item.year}`}
        </p>
      </div>
      <div className="flex items-center justify-between gap-1 mt-auto">
        <span className={`badge text-xs ${item.available_copies > 0 ? 'badge-success' : 'badge-error'}`}>
          {item.available_copies > 0 ? `${item.available_copies} avail.` : 'Unavailable'}
        </span>
        {item.view_count > 0 && (
          <span className="text-xs text-neutral-400 flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            {item.view_count}
          </span>
        )}
      </div>
    </Link>
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
