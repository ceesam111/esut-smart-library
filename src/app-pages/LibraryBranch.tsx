import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BaseLibrary {
  name: string;
  slug: string;
  code: string;
  description: string;
}

interface BranchLibrary extends BaseLibrary {}

interface FacultyLibrary extends BaseLibrary {
  faculty: string;
}

type LibraryKind = 'main' | 'branch' | 'faculty';

interface ResolvedLibrary {
  info: BaseLibrary & { faculty?: string };
  kind: LibraryKind;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveLibrary(slug: string): ResolvedLibrary | null {
  const { mainLibrary, branchLibraries, facultyLibraries } = institutionConfig;
  if (mainLibrary.slug === slug) return { info: mainLibrary, kind: 'main' };
  const branch = branchLibraries.find((l) => l.slug === slug);
  if (branch) return { info: branch, kind: 'branch' };
  const fac = facultyLibraries.find((l) => l.slug === slug);
  if (fac) return { info: fac as FacultyLibrary, kind: 'faculty' };
  return null;
}

const GREEN = '#1A4731';
const GOLD  = '#C9A84C';

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 shadow-sm px-5 py-5 flex flex-col gap-1">
      <div className="text-2xl font-bold font-mono" style={{ color: GREEN }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm font-medium text-neutral-700">{label}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-serif font-semibold text-neutral-900">{title}</h2>
      {sub && <p className="text-sm text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Branch / Central layout ───────────────────────────────────────────────────

interface BranchStats {
  catItems:   number | null;
  repoItems:  number | null;
  members:    number | null;
}

interface FeaturedItem {
  id: string;
  title: string;
  author: string | null;
  item_type: string | null;
  cover_url: string | null;
}

interface ActivityItem {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
}

function BranchLayout({ library, kind }: { library: BaseLibrary; kind: LibraryKind }) {
  const [stats, setStats]       = useState<BranchStats>({ catItems: null, repoItems: null, members: null });
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [events, setEvents]     = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Catalogue count
    supabase
      .from('catalogue_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', library.code)
      .then(({ count }) => setStats((s) => ({ ...s, catItems: count ?? 0 })));

    // Repository count
    supabase
      .from('repository_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', library.code)
      .eq('status', 'published')
      .then(({ count }) => setStats((s) => ({ ...s, repoItems: count ?? 0 })));

    // Active patron count (global — no home_tenant column)
    supabase
      .from('patrons')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count }) => setStats((s) => ({ ...s, members: count ?? 0 })));

    // Featured resources
    supabase
      .from('catalogue_items')
      .select('id, title, author, item_type, cover_url')
      .eq('tenant_id', library.code)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setFeatured((data ?? []) as FeaturedItem[]));

    // Upcoming events
    supabase
      .from('events')
      .select('id, title, event_date, location')
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date')
      .limit(4)
      .then(({ data }) => setEvents((data ?? []) as ActivityItem[]));
  }, [library.code]);

  const typeLabel =
    kind === 'main' ? 'Central Library'
    : kind === 'branch' ? 'Branch Library'
    : 'Library';

  const hours = [
    { day: 'Monday – Friday', time: '8:00 am – 8:00 pm' },
    { day: 'Saturday',        time: '9:00 am – 4:00 pm' },
    { day: 'Sunday',          time: 'Closed' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Section 1: Hero ─────────────────────────────────────────── */}
      <div className="text-white py-20" style={{ background: GREEN }}>
        <div className="section">
          <BackButton />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 text-xs font-medium text-white/60 mb-5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            {typeLabel}
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4">{library.name}</h1>
          <p className="text-white/60 text-base max-w-2xl leading-relaxed mb-6">{library.description}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/catalogue"
              className="px-5 py-2 rounded-xl text-sm font-semibold text-neutral-900 hover:opacity-90 transition-opacity"
              style={{ background: GOLD }}
            >
              Browse Catalogue
            </Link>
            <Link
              to="/ai-librarian"
              className="px-5 py-2 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              Ask Lexis
            </Link>
          </div>
        </div>
      </div>

      {/* ── Section 2: Stats ────────────────────────────────────────── */}
      <div className="section py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Catalogue Items"
            value={stats.catItems !== null ? stats.catItems : '—'}
            sub="Physical & digital holdings"
          />
          <StatCard
            label="Repository Works"
            value={stats.repoItems !== null ? stats.repoItems : '—'}
            sub="Published submissions"
          />
          <StatCard
            label="Active Patrons"
            value={stats.members !== null ? stats.members : '—'}
            sub="Registered library members"
          />
        </div>
      </div>

      {/* ── Section 3: Featured Resources ───────────────────────────── */}
      <div className="section pb-12">
        <SectionHeading title="Featured Resources" sub="Recent additions to this library" />
        {featured.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 px-6 py-10 text-center text-neutral-400 text-sm">
            No catalogue items yet for this library.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((item) => (
              <Link
                key={item.id}
                to={`/catalogue/${item.id}`}
                className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4 flex gap-3 hover:border-primary-200 transition-colors group"
              >
                <div
                  className="w-12 h-16 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                  style={{ background: GREEN }}
                >
                  {item.cover_url
                    ? <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                    : library.code.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-neutral-400 mb-0.5 capitalize">{item.item_type ?? 'Book'}</div>
                  <div className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </div>
                  {item.author && (
                    <div className="text-xs text-neutral-500 mt-1 truncate">{item.author}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link to="/catalogue" className="text-sm font-medium hover:underline" style={{ color: GREEN }}>
            View full catalogue →
          </Link>
        </div>
      </div>

      {/* ── Section 4: About + Hours ─────────────────────────────────── */}
      <div className="section pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
            <h3 className="font-semibold text-neutral-900 mb-3">About This Library</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">{library.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Academic Resources', 'Print & Digital', 'Study Spaces', 'Research Support'].map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(26,71,49,0.08)', color: GREEN }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
            <h3 className="font-semibold text-neutral-900 mb-3">Opening Hours</h3>
            <div className="space-y-3">
              {hours.map((h) => (
                <div key={h.day} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{h.day}</span>
                  <span
                    className="font-medium"
                    style={{ color: h.time === 'Closed' ? '#b91c1c' : GREEN }}
                  >
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100 text-xs text-neutral-400">
              Hours may vary during exam periods and public holidays.
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 5: Activity / Events ─────────────────────────────── */}
      <div className="section pb-14">
        <SectionHeading title="Upcoming Events" sub="Workshops, talks, and library activities" />
        {events.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 px-6 py-10 text-center text-neutral-400 text-sm">
            No upcoming events scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {events.map((ev) => {
              const d = new Date(ev.event_date);
              return (
                <div key={ev.id} className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4 flex gap-4">
                  <div
                    className="w-12 h-12 rounded-xl shrink-0 flex flex-col items-center justify-center text-white"
                    style={{ background: GREEN }}
                  >
                    <span className="text-[10px] font-bold uppercase leading-none">
                      {d.toLocaleDateString('en-NG', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-neutral-800 leading-snug">{ev.title}</div>
                    {ev.location && (
                      <div className="text-xs text-neutral-400 mt-0.5">{ev.location}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          <Link to="/events" className="text-sm font-medium hover:underline" style={{ color: GREEN }}>
            View all events →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Faculty library layout ────────────────────────────────────────────────────

interface CourseList {
  id: string;
  course_title: string;
  course_code: string;
  department: string | null;
  semester: string | null;
  lecturer_id: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  abstract: string | null;
  publication_year: number | null;
  author: string | null;
}

function FacultyLayout({ library }: { library: FacultyLibrary }) {
  const [catCount, setCatCount]       = useState<number | null>(null);
  const [repoCount, setRepoCount]     = useState<number | null>(null);
  const [thesisCount, setThesisCount] = useState<number | null>(null);
  const [highlights, setHighlights]   = useState<ResearchItem[]>([]);
  const [courseLists, setCourseLists] = useState<CourseList[]>([]);

  useEffect(() => {
    // Catalogue count
    supabase
      .from('catalogue_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', library.code)
      .then(({ count }) => setCatCount(count ?? 0));

    // Repository count
    supabase
      .from('repository_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', library.code)
      .eq('status', 'published')
      .then(({ count }) => setRepoCount(count ?? 0));

    // Thesis count
    supabase
      .from('theses')
      .select('id', { count: 'exact', head: true })
      .ilike('programme', `%${library.faculty}%`)
      .eq('status', 'approved')
      .then(({ count }) => setThesisCount(count ?? 0));

    // Research highlights from repository
    supabase
      .from('repository_items')
      .select('id, title, abstract, publication_year, author')
      .eq('tenant_id', library.code)
      .eq('status', 'published')
      .order('publication_year', { ascending: false })
      .limit(4)
      .then(({ data }) => setHighlights((data ?? []) as ResearchItem[]));

    // Course reading lists
    supabase
      .from('course_reading_lists')
      .select('id, course_title, course_code, department, semester, lecturer_id')
      .eq('is_active', true)
      .limit(6)
      .then(({ data }) => setCourseLists((data ?? []) as CourseList[]));
  }, [library.code, library.faculty]);

  const subjectChips = [
    library.faculty,
    'Research',
    'Academic Journals',
    'Course Reserves',
    'Open Access',
  ];

  const hours = [
    { day: 'Monday – Friday', time: '8:00 am – 6:00 pm' },
    { day: 'Saturday',        time: '9:00 am – 2:00 pm' },
    { day: 'Sunday',          time: 'Closed' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Section 1: Hero with subject chips ─────────────────────── */}
      <div className="text-white py-20" style={{ background: GREEN }}>
        <div className="section">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 text-xs font-medium text-white/60 mb-5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            Faculty Library
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-2">{library.name}</h1>
          <p className="text-white/50 text-base mb-4">{library.faculty}</p>
          <p className="text-white/60 text-sm max-w-2xl leading-relaxed mb-6">{library.description}</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {subjectChips.map((chip) => (
              <span
                key={chip}
                className="px-3 py-1 rounded-full text-xs font-medium border border-white/25 text-white/75"
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/catalogue"
              className="px-5 py-2 rounded-xl text-sm font-semibold text-neutral-900 hover:opacity-90 transition-opacity"
              style={{ background: GOLD }}
            >
              Browse Catalogue
            </Link>
            <Link
              to="/repository"
              className="px-5 py-2 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              Browse Repository
            </Link>
          </div>
        </div>
      </div>

      {/* ── Section 2: Faculty metrics ──────────────────────────────── */}
      <div className="section py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Catalogue Holdings"
            value={catCount !== null ? catCount : '—'}
            sub="Physical & electronic titles"
          />
          <StatCard
            label="Repository Works"
            value={repoCount !== null ? repoCount : '—'}
            sub="Faculty research outputs"
          />
          <StatCard
            label="Approved Theses"
            value={thesisCount !== null ? thesisCount : '—'}
            sub="PG dissertations & projects"
          />
        </div>
      </div>

      {/* ── Section 3: Research highlights ──────────────────────────── */}
      <div className="section pb-12">
        <SectionHeading title="Research Highlights" sub="Recent faculty research outputs in the repository" />
        {highlights.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 px-6 py-10 text-center text-neutral-400 text-sm">
            No published research outputs for this faculty yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {highlights.map((item) => (
              <Link
                key={item.id}
                to={`/repository/${item.id}`}
                className="bg-white rounded-xl border border-neutral-100 shadow-sm p-5 hover:border-primary-200 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors leading-snug line-clamp-2">
                    {item.title}
                  </div>
                  {item.publication_year && (
                    <span
                      className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(26,71,49,0.08)', color: GREEN }}
                    >
                      {item.publication_year}
                    </span>
                  )}
                </div>
                {item.author && (
                  <div className="text-xs text-neutral-500 mb-2">{item.author}</div>
                )}
                {item.abstract && (
                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{item.abstract}</p>
                )}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link to="/repository" className="text-sm font-medium hover:underline" style={{ color: GREEN }}>
            Browse full repository →
          </Link>
        </div>
      </div>

      {/* ── Section 4: Course reading lists ─────────────────────────── */}
      <div className="section pb-12">
        <SectionHeading title="Course Reading Lists" sub="Active reading lists for courses in this faculty" />
        {courseLists.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-100 px-6 py-10 text-center text-neutral-400 text-sm">
            No active reading lists at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseLists.map((cl) => (
              <Link
                key={cl.id}
                to={`/dashboard/course-reserves`}
                className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4 hover:border-primary-200 transition-colors group"
              >
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: GOLD }}
                >
                  {cl.course_code}
                </div>
                <div className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors leading-snug mb-1">
                  {cl.course_title}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {cl.department && (
                    <span className="text-xs text-neutral-400">{cl.department}</span>
                  )}
                  {cl.semester && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(26,71,49,0.08)', color: GREEN }}
                    >
                      {cl.semester}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Link to="/dashboard/course-reserves" className="text-sm font-medium hover:underline" style={{ color: GREEN }}>
            View all reading lists →
          </Link>
        </div>
      </div>

      {/* ── Section 5: About + Liaison ───────────────────────────────── */}
      <div className="section pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
            <h3 className="font-semibold text-neutral-900 mb-3">About This Library</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">{library.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Faculty Resources', 'Research Support', 'E-Journals', 'Open Access'].map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(26,71,49,0.08)', color: GREEN }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
            <h3 className="font-semibold text-neutral-900 mb-3">Opening Hours</h3>
            <div className="space-y-3">
              {hours.map((h) => (
                <div key={h.day} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">{h.day}</span>
                  <span
                    className="font-medium"
                    style={{ color: h.time === 'Closed' ? '#b91c1c' : GREEN }}
                  >
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Faculty Liaison
              </div>
              <p className="text-sm text-neutral-600">
                For subject-specific research support, ILL requests, or reading list submissions,{' '}
                <Link to="/contact" className="font-medium hover:underline" style={{ color: GREEN }}>
                  contact the library
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

// ── Coming-soon faculty library layout ────────────────────────────────────────

function ComingSoonLayout({ library }: { library: FacultyLibrary }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="text-white" style={{ background: GREEN }}>
        <div className="section pt-24 pb-16">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>›</span>
            <Link to="/faculty-libraries" className="hover:text-white transition-colors">Faculty Libraries</Link>
            <span>›</span>
            <span>{library.name}</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">{library.name}</h1>
          <p className="text-white/75 text-lg max-w-2xl">{library.description}</p>
        </div>
      </div>

      <div className="section py-16">
        <div className="max-w-xl mx-auto bg-white border border-neutral-100 rounded-2xl shadow-sm p-10 text-center">
          <div className="text-5xl mb-4" aria-hidden>🚧</div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Coming Soon</h2>
          <p className="text-neutral-600 leading-relaxed mb-6">
            The {library.name} is being established. In the meantime, please contact the Main Library for assistance
            with resources in {library.faculty.replace('Faculty of ', '')}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="text-sm font-semibold px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: GREEN }}>
              Contact the Main Library
            </Link>
            <Link to="/faculty-libraries" className="text-sm font-semibold px-6 py-3 rounded-lg border-2 transition-colors hover:bg-neutral-50" style={{ borderColor: GREEN, color: GREEN }}>
              Back to Faculty Libraries
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LibraryBranch() {

  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return <NotFound />;
  }

  const resolved = resolveLibrary(slug);

  if (!resolved) {
    return <NotFound />;
  }

  const { info, kind } = resolved;

  if ((info as { comingSoon?: boolean }).comingSoon) {
    return <ComingSoonLayout library={info as FacultyLibrary} />;
  }

  if (kind === 'faculty') {
    return <FacultyLayout library={info as FacultyLibrary} />;
  }


  return <BranchLayout library={info} kind={kind} />;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center px-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-5"
          style={{ background: GREEN }}
        >
          🏛
        </div>
        <h2 className="text-2xl font-bold text-neutral-800 mb-2">Library Not Found</h2>
        <p className="text-neutral-500 mb-6">The library you are looking for does not exist.</p>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: GREEN }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
