import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { usePageTitle } from '@/hooks/usePageTitle';

const TIMELINE = [
  {
    year: '1960s',
    text: 'University established as Enugu State University of Science and Technology — founding library collection assembled with core texts, serving the first generation of students.',
  },
  {
    year: '1980s',
    text: 'Library expanded to serve a growing student and staff population — journal subscriptions and a periodicals collection introduced, with inter-library loan partnerships established.',
  },
  {
    year: '2005',
    text: 'Digital transformation begins — a computerised catalogue introduced, moving from card catalogues to an electronic system and enabling online searches of the collection.',
  },
  {
    year: '2026',
    text: 'ESUT Smart Library launched — AI-powered, open access, and available 24/7 globally. Lexis the AI Reference Librarian, federated search across 15 sources, and digital repository go live.',
  },
];

const STATS = [
  { icon: '📚', value: '12,400+', label: 'Catalogue Items' },
  { icon: '📄', value: '3,200+', label: 'Open Access Journals' },
  { icon: '🎓', value: '890+', label: 'Theses & Projects' },
  { icon: '🏛', value: institutionConfig.libraryMode === 'multi' ? '9' : '1', label: institutionConfig.libraryMode === 'multi' ? 'Library Locations' : 'Library' },
];

const LIBRARIES = [
  { name: institutionConfig.mainLibrary.name, slug: institutionConfig.mainLibrary.slug, desc: institutionConfig.mainLibrary.description },
  ...(institutionConfig.libraryMode === 'multi' ? institutionConfig.branchLibraries.map(l => ({ name: l.name, slug: l.slug, desc: l.description })) : []),
  ...institutionConfig.facultyLibraries.map(l => ({ name: l.name, slug: l.slug, desc: l.description })),
];

export default function About() {
  usePageTitle('About the Library');
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="pt-20" style={{ background: '#1A4731' }}>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">About ESUT Library</h1>
          <p className="text-lg md:text-xl text-white/80">
            Serving Knowledge Since the University's Founding — Now Powered by Artificial Intelligence
          </p>
        </div>
      </div>

      {/* Mission */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6" style={{ color: 'var(--color-primary)' }}>Our Mission</h2>
          <div className="prose prose-lg text-neutral-700 leading-relaxed space-y-4">
            <p>
              The ESUT Library exists to support the academic, research, and professional development of every student, lecturer,
              and researcher at Enugu State University of Science and Technology. Our mission is to provide universal access to
              knowledge — in print, digital, and open access formats — enabling the university community to learn, discover, and
              contribute to the global knowledge economy.
            </p>
            <p>
              As the intellectual nerve centre of one of Nigeria's foremost universities of education, the ESUT Library maintains
              collections spanning education, sciences, arts, management, vocational studies, and the humanities. Our digital
              platform — the ESUT Smart Library — extends this service beyond our walls, making our holdings accessible
              twenty-four hours a day from any device, anywhere in Nigeria and beyond.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 px-6 bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-3xl mb-1">{s.icon}</div>
              <p className="text-3xl font-bold" style={{ color: '#C9A84C' }}>{s.value}</p>
              <p className="text-sm text-neutral-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* History timeline */}
      <section className="py-16 px-6 bg-neutral-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-neutral-900 mb-10">Our History</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />
            <div className="space-y-8">
              {TIMELINE.map((item) => (
                <div key={item.year} className="relative pl-12">
                  <div
                    className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                    style={{ background: '#1A4731' }}
                  >
                    ★
                  </div>
                  <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
                    <p className="text-sm font-bold mb-1" style={{ color: '#C9A84C' }}>{item.year}</p>
                    <p className="text-neutral-700 text-sm leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Libraries */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Our Libraries</h2>
          <p className="text-neutral-500 mb-8">Library locations serving every corner of ESUT campus and the wider Enugu community.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {LIBRARIES.map((lib) => (
              <Link
                key={lib.slug}
                to={`/library/${lib.slug}`}
                className="block p-5 bg-white rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🏛</span>
                  <div>
                    <p className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors">{lib.name}</p>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{lib.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 text-center" style={{ background: '#1A4731' }}>
        <div className="max-w-2xl mx-auto text-white">
          <h2 className="text-3xl font-bold mb-3">Ready to Get Started?</h2>
          <p className="text-white/80 mb-8 text-lg">Register for your free library account and start accessing thousands of resources today.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/register" className="px-8 py-3 rounded-full font-semibold text-neutral-900 hover:opacity-90 transition-opacity" style={{ background: '#C9A84C' }}>
              Register Now
            </Link>
            <Link to="/catalogue" className="px-8 py-3 rounded-full font-semibold border border-white/50 text-white hover:bg-white/10 transition-colors">
              Browse Catalogue
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
