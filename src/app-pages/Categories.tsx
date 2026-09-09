import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { usePageTitle } from '@/hooks/usePageTitle';
import ResourceTypesExplorer, { RESOURCE_TYPES } from '@/components/ResourceTypesExplorer';

interface Category {
  name: string;
  slug: string;
  icon: string;
  subject: string;
  description: string;
}

const CATEGORY_DEFS: Category[] = [
  { name: 'Education',          slug: 'education',       icon: '🎓', subject: 'Education',             description: 'Pedagogy, curriculum, teaching methods and educational policy' },
  { name: 'Sciences',           slug: 'sciences',        icon: '🔬', subject: 'Biology',               description: 'Biology, Chemistry, Physics, Earth Sciences and Natural Sciences' },
  { name: 'Arts & Humanities',  slug: 'arts',            icon: '🎨', subject: 'History',               description: 'History, Literature, Philosophy, Fine Arts and Cultural Studies' },
  { name: 'Social Sciences',    slug: 'social-sciences', icon: '👥', subject: 'Sociology',             description: 'Sociology, Psychology, Political Science and Anthropology' },
  { name: 'Management',         slug: 'management',      icon: '💼', subject: 'Business Administration', description: 'Business Administration, Accounting, Economics and Finance' },
  { name: 'Technology',         slug: 'technology',      icon: '💻', subject: 'Computer Science',      description: 'Computer Science, Information Technology and Engineering' },
  { name: 'Languages',          slug: 'languages',       icon: '🗣️', subject: 'English Language',      description: 'English, Yoruba, French, Linguistics and Communication Studies' },
  { name: 'Mathematics',        slug: 'mathematics',     icon: '📐', subject: 'Mathematics',           description: 'Pure Mathematics, Statistics, Applied Mathematics and Research Methods' },
  { name: 'Agriculture',        slug: 'agriculture',     icon: '🌾', subject: 'Agricultural Science',  description: 'Agricultural Science, Food Technology and Environmental Studies' },
  { name: 'Vocational Studies', slug: 'vocational',      icon: '🔧', subject: 'Vocational Education',  description: 'Technical Education, Vocational Training and Home Economics' },
];

const OA_DATABASES = [
  {
    name: 'DOAJ',
    fullName: 'Directory of Open Access Journals',
    url: 'https://doaj.org',
    icon: '📰',
    desc: 'Over 20,000 peer-reviewed open access journals across all disciplines.',
    color: 'bg-teal-50 border-teal-200',
    type: 'Journals',
  },
  {
    name: 'OpenAlex',
    fullName: 'OpenAlex — Open Scholarly Graph',
    url: 'https://openalex.org',
    icon: '🔭',
    desc: 'Free, open catalogue of 250M+ scholarly works, authors, institutions and concepts.',
    color: 'bg-sky-50 border-sky-200',
    type: 'Articles',
  },
  {
    name: 'CORE',
    fullName: 'CORE — Open Research',
    url: 'https://core.ac.uk',
    icon: '⭕',
    desc: 'World\'s largest collection of open access research papers — 200M+ free articles.',
    color: 'bg-orange-50 border-orange-200',
    type: 'Articles',
  },
  {
    name: 'AJOL',
    fullName: 'African Journals Online',
    url: 'https://www.ajol.info',
    icon: '🌍',
    desc: 'The leading platform for African-published research journals and articles.',
    color: 'bg-green-50 border-green-200',
    type: 'Journals',
  },
  {
    name: 'PubMed Central',
    fullName: 'PubMed Central (PMC)',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/',
    icon: '🏥',
    desc: 'Free full-text archive of biomedical and life sciences literature from NIH.',
    color: 'bg-red-50 border-red-200',
    type: 'Biomedical',
  },
  {
    name: 'ERIC',
    fullName: 'Education Resources Information Center',
    url: 'https://eric.ed.gov',
    icon: '🎒',
    desc: 'US Department of Education\'s free library for education research and information.',
    color: 'bg-amber-50 border-amber-200',
    type: 'Education',
  },
  {
    name: 'DOAB',
    fullName: 'Directory of Open Access Books',
    url: 'https://www.doabooks.org',
    icon: '📚',
    desc: 'Peer-reviewed open access academic books from publishers worldwide.',
    color: 'bg-purple-50 border-purple-200',
    type: 'eBooks',
  },
  {
    name: 'Open Library',
    fullName: 'Internet Archive Open Library',
    url: 'https://openlibrary.org',
    icon: '🏛️',
    desc: 'Over 20 million freely borrowable books and texts from the Internet Archive.',
    color: 'bg-cyan-50 border-cyan-200',
    type: 'eBooks',
  },
  {
    name: 'Project Gutenberg',
    fullName: 'Project Gutenberg',
    url: 'https://www.gutenberg.org',
    icon: '📖',
    desc: '70,000+ free public domain eBooks — classic literature and reference texts.',
    color: 'bg-lime-50 border-lime-200',
    type: 'eBooks',
  },
  {
    name: 'arXiv',
    fullName: 'arXiv Preprint Server',
    url: 'https://arxiv.org',
    icon: '⚛️',
    desc: 'Free preprints in Physics, Mathematics, Computer Science, Economics and more.',
    color: 'bg-indigo-50 border-indigo-200',
    type: 'Preprints',
  },
  {
    name: 'Semantic Scholar',
    fullName: 'Semantic Scholar',
    url: 'https://www.semanticscholar.org',
    icon: '🧪',
    desc: 'AI-powered research tool with 200M+ academic papers, free to access.',
    color: 'bg-blue-50 border-blue-200',
    type: 'Articles',
  },
  {
    name: 'BASE',
    fullName: 'Bielefeld Academic Search Engine',
    url: 'https://www.base-search.net',
    icon: '🔍',
    desc: 'One of the world\'s most voluminous academic search engines — 300M+ documents.',
    color: 'bg-rose-50 border-rose-200',
    type: 'Articles',
  },
];

const TYPE_COLORS: Record<string, string> = {
  Journals: 'bg-teal-100 text-teal-700',
  Articles: 'bg-blue-100 text-blue-700',
  eBooks: 'bg-purple-100 text-purple-700',
  Biomedical: 'bg-red-100 text-red-700',
  Education: 'bg-amber-100 text-amber-700',
  Preprints: 'bg-indigo-100 text-indigo-700',
};

export default function Categories() {
  usePageTitle('Browse Resources');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subjects' | 'types' | 'oa'>('subjects');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;
    const types = RESOURCE_TYPES.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        r.discipline.toLowerCase().includes(q),
    );
    const subjects = CATEGORY_DEFS.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
    const collections = OA_DATABASES.filter(
      db =>
        db.name.toLowerCase().includes(q) ||
        db.fullName.toLowerCase().includes(q) ||
        db.desc.toLowerCase().includes(q) ||
        db.type.toLowerCase().includes(q),
    );
    return { types, subjects, collections, total: types.length + subjects.length + collections.length };
  }, [q]);

  useEffect(() => {
    async function load() {
      const { count: totalCount } = await supabase
        .from('catalogue_items')
        .select('*', { count: 'exact', head: true });
      setTotal(totalCount ?? 0);

      const results = await Promise.all(
        CATEGORY_DEFS.map(c =>
          supabase
            .from('catalogue_items')
            .select('*', { count: 'exact', head: true })
            .ilike('subjects_text', `%${c.subject}%`)
        )
      );

      const map: Record<string, number> = {};
      CATEGORY_DEFS.forEach((c, i) => { map[c.slug] = results[i].count ?? 0; });
      setCounts(map);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="section py-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Browse Resources</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Browse Resources</h1>
            <p className="text-white/75 text-lg">
              Explore {institutionConfig.name}&apos;s collections by subject or access free online resources.
              {total > 0 && <span className="ml-2 text-white/50 text-base">— {total.toLocaleString()} items in catalogue</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        {/* Global search */}
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search resource types, subjects, and collections…"
              className="w-full pl-12 pr-10 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xl leading-none"
              >
                ×
              </button>
            )}
          </div>
          {results && (
            <p className="text-sm text-neutral-500 mt-2">
              {results.total} result{results.total === 1 ? '' : 's'} for “{query.trim()}”
            </p>
          )}
        </div>

        {results ? (
          <SearchResults results={results} />
        ) : (
        <>
        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-8 w-fit">

          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'subjects' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Subject Categories
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'types' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Resource Types
          </button>
          <button
            onClick={() => setActiveTab('oa')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'oa' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Free Online Collections
          </button>
        </div>

        {activeTab === 'types' && <ResourceTypesExplorer />}


        {activeTab === 'subjects' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {CATEGORY_DEFS.map(category => (
                <Link
                  key={category.slug}
                  to={`/catalogue?subject=${encodeURIComponent(category.subject)}`}
                  className="group bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary-200 transition-all"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">
                      {category.icon}
                    </div>
                    <h3 className="font-bold text-sm text-neutral-900 mb-1">{category.name}</h3>
                    <p className="text-xs text-neutral-400 mb-3 line-clamp-2">{category.description}</p>
                    <div className="mt-auto">
                      <p className="text-xs text-neutral-500 mb-2">
                        {loading ? (
                          <span className="inline-block w-10 h-3 bg-neutral-200 rounded animate-pulse" />
                        ) : (
                          `${(counts[category.slug] ?? 0).toLocaleString()} items`
                        )}
                      </p>
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: '#1A4731' }}>
                        Browse →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 bg-neutral-50 border border-neutral-200 rounded-2xl p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-neutral-900 mb-1">Can't find what you need?</h3>
                  <p className="text-neutral-600 text-sm">
                    Use advanced search across all categories, or ask our AI librarian for help.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link to="/search/global" className="btn-primary">Advanced Search</Link>
                  <Link to="/ai-librarian" className="btn-outline">Ask the AI Reference Librarian</Link>
                  <a href={`mailto:${institutionConfig.supportEmail}`} className="btn-ghost">Email a Librarian</a>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'oa' && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-8 flex items-start gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <h3 className="font-bold text-green-900 mb-1">Free Open Access Collections</h3>
                <p className="text-green-800 text-sm leading-relaxed">
                  These are globally available open-access databases, eBook libraries, and journal platforms — all completely free to use.
                  ESUT Library's content engine also harvests from many of these sources to populate our local catalogue.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {OA_DATABASES.map(db => (
                <a
                  key={db.name}
                  href={db.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex flex-col bg-white border rounded-2xl p-5 hover:shadow-lg transition-all ${db.color}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{db.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors">{db.name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[db.type] ?? 'bg-neutral-100 text-neutral-600'}`}>
                          {db.type}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{db.fullName}</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed flex-1">{db.desc}</p>
                  <div className="mt-4 text-xs font-semibold text-primary-700 flex items-center gap-1 group-hover:underline">
                    Open Free Resource
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-10 grid sm:grid-cols-3 gap-4">
              <Link to="/databases" className="bg-white border border-neutral-200 rounded-xl p-5 hover:shadow-md transition-shadow group">
                <div className="text-2xl mb-2">🗄️</div>
                <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors mb-1">Licensed Databases</h3>
                <p className="text-sm text-neutral-500">Access our subscribed and institutionally-licensed research databases.</p>
              </Link>
              <Link to="/catalogue" className="bg-white border border-neutral-200 rounded-xl p-5 hover:shadow-md transition-shadow group">
                <div className="text-2xl mb-2">📚</div>
                <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors mb-1">Library Catalogue</h3>
                <p className="text-sm text-neutral-500">Search all physical and electronic resources held by ESUT Library.</p>
              </Link>
              <Link to="/repository" className="bg-white border border-neutral-200 rounded-xl p-5 hover:shadow-md transition-shadow group">
                <div className="text-2xl mb-2">📄</div>
                <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors mb-1">Institutional Repository</h3>
                <p className="text-sm text-neutral-500">ESUT research outputs, theses, dissertations and publications.</p>
              </Link>
            </div>
          </>
        )}
        </>
        )}
      </div>

    </div>
  );
}

interface SearchResultsProps {
  results: {
    types: typeof RESOURCE_TYPES;
    subjects: Category[];
    collections: typeof OA_DATABASES;
    total: number;
  };
}

function SearchResults({ results }: SearchResultsProps) {
  if (results.total === 0) {
    return (
      <div className="text-center py-16 bg-white border border-neutral-100 rounded-2xl">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-neutral-500">No matches found. Try a different keyword.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {results.types.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-4">
            Resource Types <span className="text-neutral-400">({results.types.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.types.map(r => (
              <Link
                key={r.name}
                to={r.link}
                className="bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary-200 transition-all flex flex-col"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-3xl">{r.icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-neutral-900 leading-tight">{r.name}</h3>
                    <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{r.group}</span>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed flex-1">{r.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.subjects.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-4">
            Subject Categories <span className="text-neutral-400">({results.subjects.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {results.subjects.map(c => (
              <Link
                key={c.slug}
                to={`/catalogue?subject=${encodeURIComponent(c.subject)}`}
                className="group bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary-200 transition-all"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="text-4xl mb-3">{c.icon}</div>
                  <h3 className="font-bold text-sm text-neutral-900 mb-1">{c.name}</h3>
                  <p className="text-xs text-neutral-400 line-clamp-2">{c.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.collections.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-4">
            Free Online Collections <span className="text-neutral-400">({results.collections.length})</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.collections.map(db => (
              <a
                key={db.name}
                href={db.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex flex-col bg-white border rounded-2xl p-5 hover:shadow-lg transition-all ${db.color}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{db.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors">{db.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[db.type] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {db.type}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{db.fullName}</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed flex-1">{db.desc}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
