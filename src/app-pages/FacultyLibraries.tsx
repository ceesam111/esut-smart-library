import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { institutionConfig } from '@config/institution.config';

const GREEN = '#6B1D2A';
const GOLD = '#D4A017';

interface FacultyLibraryCard {
  name: string;
  slug: string;
  code: string;
  subjects: string[];
  comingSoon?: boolean;
}

const FACULTY_LIBRARIES: FacultyLibraryCard[] = [
  {
    name: 'Faculty of Science Library',
    slug: 'faculty-science',
    code: 'SCI',
    subjects: ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science'],
  },
  {
    name: 'Faculty of Education Library',
    slug: 'faculty-education',
    code: 'EDU',
    subjects: ['Pedagogy', 'Curriculum', 'Educational Psychology', 'Teacher Education'],
  },
  {
    name: 'Faculty of Management & Social Sciences Library',
    slug: 'faculty-management-social',
    code: 'MSS',
    subjects: ['Business', 'Economics', 'Sociology', 'Political Science', 'Mass Communication'],
  },
  {
    name: 'Faculty of Vocational & Technical Education Library',
    slug: 'faculty-vocational-technical',
    code: 'VTE',
    subjects: ['Home Economics', 'Agricultural Education', 'Fine Arts', 'Technical Studies'],
  },
  {
    name: 'Faculty of Arts Library',
    slug: 'faculty-arts',
    code: 'ART',
    subjects: ['English', 'Linguistics', 'History', 'Religious Studies', 'Philosophy', 'Theatre Arts'],
  },
  {
    name: 'Faculty of Agriculture Library',
    slug: 'faculty-agriculture',
    code: 'AGR',
    subjects: ['Crop Science', 'Animal Science', 'Soil Science', 'Agricultural Economics', 'Food Technology'],
    comingSoon: true,
  },
];

export default function FacultyLibraries() {
  usePageTitle('Faculty Libraries');

  return (
    <div>
      {/* Full-width banner — brand green, white text, clears fixed navbar */}
      <div className="text-white" style={{ background: GREEN }}>
        <div className="section pt-24 pb-12">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>›</span>
            <span>Faculty Libraries</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Faculty Libraries</h1>
          <p className="text-white/75 text-lg max-w-3xl">
            Specialised collections supporting teaching and research across {institutionConfig.name}&apos;s faculties.
            Each faculty library curates resources for its disciplines while remaining part of one connected network.
          </p>
        </div>
      </div>

      <div className="section py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FACULTY_LIBRARIES.map((lib) => (
            <div
              key={lib.slug}
              className="bg-white border border-neutral-100 rounded-2xl p-6 flex flex-col hover:shadow-lg hover:border-primary-200 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold font-mono shrink-0"
                  style={{ background: GREEN }}
                >
                  {lib.code}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-neutral-900 leading-snug">{lib.name}</h2>
                  {lib.comingSoon && (
                    <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.18)', color: '#8a6d1f' }}>
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {lib.subjects.map((s) => (
                  <span key={s} className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                    {s}
                  </span>
                ))}
              </div>

              <Link
                to={`/library/${lib.slug}`}
                className="mt-auto text-center text-sm font-semibold py-2.5 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Visit Library →
              </Link>
            </div>
          ))}
        </div>

        {/* Union catalogue note */}
        <div className="mt-10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ background: 'rgba(61,17,34,0.06)', border: '1px solid rgba(61,17,34,0.12)' }}>
          <span className="text-3xl" aria-hidden>🔗</span>
          <p className="text-sm text-neutral-700 leading-relaxed flex-1">
            Resources catalogued in any faculty library are discoverable across all branches through our{' '}
            <Link to="/catalogue" className="font-semibold hover:underline" style={{ color: GREEN }}>Union Catalogue</Link>.
          </p>
          <Link to="/catalogue" className="text-sm font-semibold px-5 py-2.5 rounded-lg text-white transition-opacity hover:opacity-90 shrink-0" style={{ background: GOLD, color: '#1a1a1a' }}>
            Search Union Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
