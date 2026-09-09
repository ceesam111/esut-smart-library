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
  const [stats, setStats] = useState({ resources: 0, downloads: 0, members: 0, faculties: 0 });

  useEffect(() => {
    // Pull from analytics_network — fall back to config values if table is empty
    supabase
      .from('analytics_network')
      .select('total_resources, total_downloads, total_members')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setStats({
          resources:  data?.total_resources ?? 12_450,
          downloads:  data?.total_downloads ?? 58_300,
          members:    data?.total_members   ?? institutionConfig.totalEnrolment,
          faculties:  institutionConfig.faculties.length,
        });
      });
  }, []);

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
      to={`/faculty/${faculty.slug}`}
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
  { label: 'Reference Services',     href: '/course-reserves', icon: '📖', desc: 'Ask Lexis or a human librarian', show: institutionConfig.features.courseReserves },
  { label: 'Researcher Profiles', href: '/researchers',     icon: '🔬', desc: 'Our academic staff', show: institutionConfig.features.researcherProfiles },
  { label: 'Webometrics',         href: '/webometrics',     icon: '🌐', desc: 'Global ranking dashboard', show: institutionConfig.features.webometrics },
];

/* ------------------------------------------------------------------ */
/*  Hero section                                                       */
/* ------------------------------------------------------------------ */
function Hero() {
  const [query, setQuery] = useState('');

  return (
    <section
      className="relative min-h-[90vh] flex items-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
    >
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5 animate-pulse-slow" />
        <div className="absolute bottom-0 -left-20 w-64 h-64 rounded-full bg-white/5 animate-pulse-slow [animation-delay:1s]" />
        <div className="absolute top-1/3 left-1/2 w-80 h-80 rounded-full bg-white/3 animate-pulse-slow [animation-delay:2s]" />
      </div>

      <div className="section relative z-10 py-24 lg:py-32">
        <div className="max-w-3xl">
          {/* Session badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium mb-6 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
            Academic Session {institutionConfig.currentSession}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold text-white mb-4 text-balance">
            Lexis — Your ESUT Reference (AI) Librarian
          </h1>
          <p className="text-xl text-white/80 mb-2 font-light">
            ESUT Smart Library &amp; Knowledge Centre
          </p>
          <p className="text-sm text-white/50 mb-10">
            {institutionConfig.regulatoryBody}-accredited &bull; Est. {institutionConfig.established} &bull;{' '}
            {institutionConfig.faculties.length} faculties
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search books, theses, researchers…"
              className="w-full pl-5 pr-32 py-4 rounded-2xl text-sm text-neutral-800 placeholder:text-neutral-400 bg-white shadow-xl focus:outline-none focus:ring-2 focus:ring-gold-400"
              onKeyDown={(e) => e.key === 'Enter' && query && (window.location.href = `/search/global?q=${encodeURIComponent(query)}`)}
            />
            <Link
              to={`/search/global${query ? `?q=${encodeURIComponent(query)}` : ''}`}
              className="absolute right-2 top-2 bottom-2 px-5 rounded-xl text-white text-sm font-medium flex items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-primary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              Search
            </Link>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary bg-gold-500 hover:bg-gold-600 text-white">
              Register as Patron
            </Link>
            <Link to="/ai-librarian" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-primary-800">
              Ask {institutionConfig.librarianName}, AI Librarian
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Librarian promo                                                 */
/* ------------------------------------------------------------------ */
function AIPromo() {
  return (
    <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white py-16">
      <div className="section">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="badge badge-gold inline-flex mb-4">AI-Powered</div>
            <h2 className="text-3xl font-serif font-semibold mb-4">
              Meet {institutionConfig.librarianName}, Your AI Research Librarian
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
/*  Main Home component                                                */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <>
      <Hero />
      <StatsStrip />

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
      <section className="py-14 bg-neutral-50">
        <div className="section">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-serif font-semibold text-primary-800">
              Faculty Libraries
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {institutionConfig.faculties.map((f) => (
              <FacultyCard key={f.slug} faculty={f} />
            ))}
          </div>
        </div>
      </section>

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

      {/* Academic calendar */}
      <section className="py-14 bg-neutral-50">
        <div className="section">
          <h2 className="text-2xl font-serif font-semibold text-primary-800 mb-8">
            Academic Calendar {institutionConfig.currentSession}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Semester 1', ...institutionConfig.semesterOneDates, color: 'bg-primary-50 border-primary-200' },
              { label: 'Exam Period 1', ...institutionConfig.examOneDates, color: 'bg-warning-50 border-warning-200' },
              { label: 'Semester 2', ...institutionConfig.semesterTwoDates, color: 'bg-secondary-50 border-secondary-200' },
              { label: 'Exam Period 2', ...institutionConfig.examTwoDates, color: 'bg-warning-50 border-warning-200' },
            ].map((period) => (
              <div key={period.label} className={`card p-4 border ${period.color}`}>
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  {period.label}
                </div>
                <div className="text-sm font-medium text-neutral-800">
                  {new Date(period.start).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  {' — '}
                  {new Date(period.end).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link to="/events" className="text-sm text-primary-600 hover:text-primary-800 font-medium">
              View all events →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA — register */}
      <section
        className="py-16"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
      >
        <div className="section text-center text-white">
          <h2 className="text-3xl font-serif font-semibold mb-4">
            Join {institutionConfig.name} Digital Library
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
