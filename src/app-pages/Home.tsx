import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

/* ------------------------------------------------------------------ */
/*  Animated counter hook                                              */
/* ------------------------------------------------------------------ */
function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    ref.current = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(ref.current!); }
      else setValue(start);
    }, 16);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [target, duration]);

  return value;
}

/* ------------------------------------------------------------------ */
/*  Stats strip                                                        */
/* ------------------------------------------------------------------ */
function StatsStrip() {
  const [stats] = useState({
    resources: 12_450,
    downloads: 58_300,
    members: institutionConfig.totalEnrolment,
    faculties: institutionConfig.faculties.length,
  });

  const facCount  = useCountUp(stats.faculties);
  const resCount  = useCountUp(stats.resources);
  const dlCount   = useCountUp(stats.downloads);
  const memCount  = useCountUp(stats.members);

  const items = [
    { label: 'Faculties',          value: facCount.toLocaleString() },
    { label: 'Total Resources',    value: resCount.toLocaleString() },
    { label: 'Downloads This Year',value: dlCount.toLocaleString() },
    { label: 'Registered Patrons', value: memCount.toLocaleString() },
  ];

  return (
    <div className="bg-primary-900 text-white">
      <div className="section py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-primary-700">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col items-center py-4 px-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-gold-400">
                {item.value}
              </span>
              <span className="text-xs text-primary-300 mt-1 text-center">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Faculty card                                                       */
/* ------------------------------------------------------------------ */
interface Faculty { name: string; slug: string; code: string; }

function FacultyCard({ faculty }: { faculty: Faculty }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('catalogue_items')
      .select('id', { count: 'exact', head: true })
      .eq('faculty_code', faculty.code)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [faculty.code]);

  return (
    <Link
      to={`/library/${faculty.slug}`}
      className="group card p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono"
        style={{ background: 'var(--color-primary)' }}
      >
        {faculty.code.slice(0, 3)}
      </div>
      <div>
        <h3 className="font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors leading-snug text-sm">
          {faculty.name}
        </h3>
        {count !== null && (
          <p className="text-xs text-neutral-400 mt-0.5">
            {count.toLocaleString()} resource{count !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center text-xs text-primary-600 font-medium gap-1">
        Browse library
        <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick-access tiles                                                 */
/* ------------------------------------------------------------------ */
const quickLinks = [
  { label: 'Search Catalogue',    href: '/catalogue',       icon: '📚', desc: 'Browse 12,000+ titles' },
  { label: 'Repository',          href: '/repository',      icon: '🗄️',  desc: 'Theses, papers & more' },
  { label: 'Global Search',       href: '/search/global',   icon: '🔍', desc: '250M+ academic works' },
  { label: 'Reference Services',  href: '/course-reserves', icon: '📖', desc: 'Reference & reader services', show: institutionConfig.features.courseReserves },
  { label: 'Researcher Profiles', href: '/researchers',     icon: '🔬', desc: 'Our academic staff', show: institutionConfig.features.researcherProfiles },
  { label: 'Webometrics',         href: '/webometrics',     icon: '🌐', desc: 'Global ranking dashboard', show: institutionConfig.features.webometrics },
];

/* ------------------------------------------------------------------ */
/*  Hero orbit card data                                               */
/* ------------------------------------------------------------------ */
const ORBIT_CARDS = [
  { label: 'Global Search',     icon: '🔍', href: '/search/global' },
  { label: 'AI Reference Librarian',      icon: '🤖', href: '/ai-librarian' },
  { label: 'Newspapers',        icon: '🗞️', href: '/newspapers' },
  { label: 'Theses',            icon: '🎓', href: '/thesis' },
  { label: 'Open Repository',   icon: '📂', href: '/repository' },
];

/* ------------------------------------------------------------------ */
/*  Hero section                                                       */
/* ------------------------------------------------------------------ */
function Hero() {
  const [query, setQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'catalog' | 'repository'>('catalog');
  const [catCount, setCatCount]       = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [openCount, setOpenCount]     = useState(0);

  useEffect(() => {
    supabase
      .from('catalogue_items')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setCatCount(count ?? 0));

    supabase
      .from('patrons')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count }) => setMemberCount(count ?? 0));

    supabase
      .from('repository_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('visibility', 'global')
      .then(({ count }) => setOpenCount(count ?? 0));
  }, []);

  const dispCat    = useCountUp(catCount    || 12450);
  const dispMember = useCountUp(memberCount || 9800);
  const dispOpen   = useCountUp(openCount   || 3200);

  return (
    <section className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      <style>{`
        @keyframes slowOrbit {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .orbit-group:hover .orbit-ring {
          animation-play-state: paused;
        }
      `}</style>

      {/* LEFT COLUMN — 55% */}
      <div
        className="flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-16 lg:py-0 lg:w-[55%]"
        style={{ background: '#6B1D2A' }}
      >
        {/* Location pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-6 self-start text-xs font-semibold" style={{ borderColor: 'rgba(201,168,76,0.5)', color: '#D4A017', background: 'rgba(201,168,76,0.08)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#D4A017' }} />
          Enugu, Enugu State, Nigeria
        </div>

        <p className="text-white/70 mb-2 font-light" style={{ fontSize: 15 }}>
          Enugu State University of Science and Technology
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-serif font-semibold text-white mb-3 leading-tight">
          ESUT Library
        </h1>
        <p className="text-white/60 text-base lg:text-lg mb-8 font-light">
          Smart Library &amp; Knowledge Centre
        </p>

        {/* Search */}
        <div className="max-w-lg mb-8 space-y-2">
          <div className="grid grid-cols-2 rounded-xl bg-white/10 p-1 text-sm">
            <button onClick={() => setSearchTarget('catalog')} className={`rounded-lg px-3 py-2 font-semibold ${searchTarget === 'catalog' ? 'bg-white text-primary-900' : 'text-white/75'}`}>Search Books & Journals</button>
            <button onClick={() => setSearchTarget('repository')} className={`rounded-lg px-3 py-2 font-semibold ${searchTarget === 'repository' ? 'bg-white text-primary-900' : 'text-white/75'}`}>Search Research & Theses</button>
          </div>
          <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchTarget === 'catalog' ? 'Search OPAC by title, author, ISBN...' : 'Search theses, papers, datasets...'}
            className="w-full pl-5 pr-28 py-4 rounded-2xl text-sm text-neutral-800 placeholder:text-neutral-400 bg-white shadow-lg focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#D4A017' } as React.CSSProperties}
            onKeyDown={(e) => e.key === 'Enter' && query && (window.location.href = `/${searchTarget === 'catalog' ? 'catalog' : 'repository'}?q=${encodeURIComponent(query)}`)}
          />
          <Link
            to={`/${searchTarget === 'catalog' ? 'catalog' : 'repository'}${query ? `?q=${encodeURIComponent(query)}` : ''}`}
            className="absolute right-2 top-2 bottom-2 px-4 rounded-xl text-white text-sm font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: '#D4A017' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            Search
          </Link>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Link
            to="/register"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90"
            style={{ background: '#D4A017' }}
          >
            Register as Patron
          </Link>
          <Link
            to="/ai-librarian"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            Ask Lexis, AI Reference Librarian
          </Link>
        </div>

        {/* Stats row */}
        <div className="flex gap-8">
          {[
            { value: dispCat.toLocaleString(),    label: 'Catalogue Items' },
            { value: dispMember.toLocaleString(), label: 'Active Patrons' },
            { value: dispOpen.toLocaleString(),   label: 'Open Access Works' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold font-mono" style={{ color: '#D4A017' }}>{s.value}</div>
              <div className="text-white/50 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN — 45% */}
      <div
        className="flex items-center justify-center flex-1 lg:w-[45%] py-16 relative overflow-hidden"
        style={{ background: '#3D1122' }}
      >
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, transparent 70%)' }}
        />

        {/* Orbit container */}
        <div className="orbit-group relative flex items-center justify-center" style={{ width: 280, height: 280 }}>

          {/* Central open-book SVG */}
          <div
            className="absolute flex items-center justify-center rounded-2xl shadow-xl z-10"
            style={{ width: 76, height: 76, background: '#6B1D2A', border: '2px solid rgba(201,168,76,0.4)' }}
          >
            <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
              <path d="M6 10 C6 10 14 8 24 14 C34 8 42 10 42 10 L42 38 C42 38 34 36 24 42 C14 36 6 38 6 38 Z" stroke="#D4A017" strokeWidth="2" fill="rgba(201,168,76,0.12)" />
              <line x1="24" y1="14" x2="24" y2="42" stroke="#D4A017" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Orbit ring + cards */}
          <div
            className="orbit-ring absolute"
            style={{ width: 260, height: 260, animation: 'slowOrbit 18s linear infinite' }}
          >
            {ORBIT_CARDS.map((card, i) => {
              const angle = (i / ORBIT_CARDS.length) * 360;
              const rad   = (angle * Math.PI) / 180;
              const r     = 118;
              const x     = 130 + r * Math.cos(rad) - 44;
              const y     = 130 + r * Math.sin(rad) - 28;
              return (
                <Link
                  key={card.href}
                  to={card.href}
                  className="absolute flex flex-col items-center justify-center rounded-xl border transition-all hover:scale-105"
                  style={{
                    left: x, top: y, width: 88, height: 56,
                    background: 'rgba(61,17,34,0.9)',
                    border: '1px solid rgba(201,168,76,0.35)',
                    transform: `rotate(${-angle}deg)`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <span className="text-lg leading-none">{card.icon}</span>
                  <span className="text-white text-[10px] font-medium mt-1 text-center leading-tight px-1">{card.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Open Access pill */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold border"
          style={{ background: 'rgba(61,17,34,0.8)', border: '1px solid rgba(201,168,76,0.4)', color: '#D4A017' }}
        >
          Open Access Available
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Reference Librarian promo                                       */
/* ------------------------------------------------------------------ */
function AIPromo() {
  return (
    <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white py-16">
      <div className="section">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="badge badge-gold inline-flex mb-4">AI-Powered</div>
            <h2 className="text-3xl font-serif font-semibold mb-4">
              Lexis — Your ESUT AI Reference Librarian
            </h2>
            <p className="text-primary-200 leading-relaxed mb-6 max-w-lg">
              {institutionConfig.librarianPersonality}. Available 24/7 to help you find
              resources, generate citations, and navigate our collections.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {['APA Citations', 'Book Recommendations', 'Research Guidance', 'ILL Requests'].map((tag) => (
                <span key={tag} className="badge bg-white/10 text-white/80 border border-white/20">
                  {tag}
                </span>
              ))}
            </div>
            <Link to="/ai-librarian" className="btn-primary bg-gold-500 hover:bg-gold-600">
              Start a Conversation →
            </Link>
          </div>

          {/* Chat preview */}
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 space-y-3">
            <div className="flex justify-start">
              <div className="bg-white text-neutral-700 rounded-xl rounded-bl-sm px-4 py-3 text-sm max-w-[85%] shadow-sm">
                Hello! I'm {institutionConfig.librarianName}. What research topic can I help you with today?
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-primary-500 text-white rounded-xl rounded-br-sm px-4 py-3 text-sm max-w-[85%]">
                Find me recent papers on contract law in Nigeria
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white text-neutral-700 rounded-xl rounded-bl-sm px-4 py-3 text-sm max-w-[85%] shadow-sm">
                I found 47 relevant resources on Nigerian contract law published between 2020–2026. Shall I format the top 5 in APA?
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Free Ebooks section — DOAB open-access academic books (2020+)       */
/* ------------------------------------------------------------------ */
interface DoabBook {
  id: string;
  title: string;
  authors: string;
  publisher: string;
  year: number | null;
  subject: string;
  cover_url: string | null;
  record_url: string;
}

const DOAB_PER_PAGE = 12;

function FreeEbooksStrip() {
  const [books, setBooks] = useState<DoabBook[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/search/resources?q=education&limit=8&legalOnly=true')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!active || !data?.groups) return;
        const openBooks = Object.values(data.groups).flatMap((group: any) => group.results ?? []).slice(0, 8);
        setBooks(openBooks.map((item: any) => ({
          id: item.id ?? item.source_record_id ?? item.title,
          title: item.title,
          authors: Array.isArray(item.authors) ? item.authors.join(', ') : item.authors ?? '',
          publisher: item.publisher ?? item.source_name ?? '',
          year: typeof item.year === 'number' ? item.year : null,
          subject: (item.subjects ?? [item.category ?? 'Open Access']).join(', '),
          cover_url: item.cover_url,
          record_url: item.source_url ?? item.download_url ?? '/search/global',
        })));
        setSubjects([...new Set(openBooks.flatMap((item: any) => item.subjects ?? []))].slice(0, 12) as string[]);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = subject
    ? books.filter(b => b.subject.toLowerCase().includes(subject.toLowerCase()))
    : books;
  const totalPages = Math.max(1, Math.ceil(filtered.length / DOAB_PER_PAGE));
  const current = Math.min(page, totalPages - 1);
  const pageBooks = filtered.slice(current * DOAB_PER_PAGE, current * DOAB_PER_PAGE + DOAB_PER_PAGE);

  if (!loading && books.length === 0) return null;

  return (
    <section className="py-14 bg-neutral-50">
      <div className="section">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-serif font-semibold text-primary-800">
              Free Academic Ebooks — Available Now
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Peer-reviewed open-access books published 2020–present · No registration required
            </p>
          </div>
          {subjects.length > 0 && (
            <select
              value={subject}
              onChange={e => { setSubject(e.target.value); setPage(0); }}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[16rem]"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s.length > 50 ? s.slice(0, 50) + '…' : s}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: DOAB_PER_PAGE }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-neutral-100 p-3 animate-pulse">
                <div className="w-full aspect-[3/4] bg-neutral-200 rounded-lg mb-3" />
                <div className="h-3 bg-neutral-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-neutral-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {pageBooks.map(book => (
                <div key={book.id} className="bg-white rounded-xl border border-neutral-100 p-3 flex flex-col hover:shadow-md transition-shadow">
                  <div className="w-full aspect-[3/4] bg-primary-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-primary-300 px-2 text-center">
                        <svg className="w-10 h-10 mb-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V6h10v2z" />
                        </svg>
                        <span className="text-[10px] font-medium text-primary-400 line-clamp-3">{book.title}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-800 text-xs leading-snug line-clamp-2 mb-0.5">{book.title}</h3>
                    <p className="text-xs text-neutral-400 line-clamp-1">{book.authors}</p>
                    {book.publisher && <p className="text-[11px] text-neutral-400 line-clamp-1">{book.publisher}</p>}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 mb-3">
                      {book.year && <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full">{book.year}</span>}
                      {book.subject && book.subject !== 'General' && (
                        <span className="text-[10px] bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded-full line-clamp-1 max-w-full">
                          {book.subject.split(',')[0].split('::').pop()?.trim().slice(0, 24)}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={book.record_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto text-center text-xs font-medium py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: '#6B1D2A' }}
                  >
                    Access Book →
                  </a>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={current === 0}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-600 disabled:opacity-40 hover:bg-neutral-50"
                >
                  ← Prev
                </button>
                <span className="text-sm text-neutral-500">Page {current + 1} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={current >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-600 disabled:opacity-40 hover:bg-neutral-50"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-neutral-400 mt-6 text-center">
          Powered by{' '}
          <a href="https://www.doabooks.org" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
            DOAB
          </a>{' '}
          — Directory of Open Access Books · Peer-reviewed scholarly books, freely available
        </p>
      </div>
    </section>
  );
}


/* ------------------------------------------------------------------ */
/*  Main Home component                                                */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <>
      <Hero />
      <StatsStrip />
      <FreeEbooksStrip />

      {/* Quick access */}
      <section className="py-14 bg-white">
        <div className="section">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-serif font-semibold text-primary-800">
              Library Services
            </h2>
            <Link to="/catalogue" className="text-sm text-primary-600 hover:text-primary-800 font-medium">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickLinks
              .filter((l) => l.show !== false)
              .map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  className="group card p-4 flex flex-col items-center text-center gap-2 hover:-translate-y-1 transition-all duration-200"
                >
                  <span className="text-2xl">{l.icon}</span>
                  <span className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors leading-tight">
                    {l.label}
                  </span>
                  <span className="text-xs text-neutral-400 line-clamp-2">{l.desc}</span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Faculty grid */}
      {institutionConfig.facultyLibraries.length > 0 && (
      <section className="py-14 bg-neutral-50">
        <div className="section">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-serif font-semibold text-primary-800">
              Faculty Libraries
            </h2>
            <Link to="/faculty-libraries" className="text-sm text-primary-600 hover:text-primary-800 font-medium">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {institutionConfig.facultyLibraries.map((f) => (
              <FacultyCard key={f.slug} faculty={f} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Loan rules quick reference */}
      <section className="py-14 bg-white">
        <div className="section">
          <h2 className="text-2xl font-serif font-semibold text-primary-800 mb-8">
            Borrowing Privileges
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(institutionConfig.loanRules).map(([category, rules]) => (
              <div key={category} className="card p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  {category.replace('_', ' ')}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Items</span>
                    <span className="font-semibold text-primary-700">{rules.maxItems}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Duration</span>
                    <span className="font-semibold text-primary-700">{rules.durationDays} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Renewals</span>
                    <span className="font-semibold text-primary-700">{rules.renewals}×</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AIPromo />

      {/* CTA — register */}
      <section
        className="py-16"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
      >
        <div className="section text-center text-white">
          <h2 className="text-3xl font-serif font-semibold mb-4">
            Join {institutionConfig.name} Smart Library
          </h2>
          <p className="text-primary-200 mb-8 max-w-md mx-auto">
            Register with your matric number or staff ID to access all services including loans, ILL, thesis submission, and AI research support.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-primary bg-gold-500 hover:bg-gold-600">
              Register Now
            </Link>
            <Link to="/login" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-primary-800">
              Already a Member? Sign In
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
