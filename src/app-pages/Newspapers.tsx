import { useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { newspapersData, flagFor, type Newspaper } from '@/data/newspapers';

const GREEN = '#6B1D2A';
const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const CATEGORY_COLORS: Record<string, string> = {
  'General News': 'bg-blue-100 text-blue-700',
  Investigative: 'bg-rose-100 text-rose-700',
  'Business & Finance': 'bg-amber-100 text-amber-700',
  'Government & Wire Service': 'bg-slate-100 text-slate-700',
  'Hausa-Language': 'bg-emerald-100 text-emerald-700',
  Diaspora: 'bg-purple-100 text-purple-700',
  'Pan-African': 'bg-teal-100 text-teal-700',
  'Entertainment & Lifestyle': 'bg-pink-100 text-pink-700',
};

function NewspaperCard({ paper }: { paper: Newspaper }) {
  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-5 flex flex-col hover:shadow-lg hover:border-primary-200 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0" aria-hidden>{flagFor(paper.country)}</span>
          <h3 className="font-bold text-neutral-900 leading-tight truncate">{paper.name}</h3>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,71,49,0.08)', color: GREEN }}>{paper.zone}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[paper.category] ?? 'bg-neutral-100 text-neutral-600'}`}>{paper.category}</span>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed flex-1">{paper.description}</p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
        <span className="text-xs text-neutral-400">{paper.country} · {paper.language}</span>
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ background: GREEN }}
        >
          Read Now →
        </a>
      </div>
    </div>
  );
}

export default function Newspapers() {
  usePageTitle('Newspapers');

  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [country, setCountry] = useState('');
  const [continent, setContinent] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');

  const zones = useMemo(() => uniqueSorted(newspapersData.map(n => n.zone)), []);
  const countries = useMemo(() => uniqueSorted(newspapersData.map(n => n.country)), []);
  const continents = useMemo(() => uniqueSorted(newspapersData.map(n => n.continent)), []);
  const languages = useMemo(() => uniqueSorted(newspapersData.map(n => n.language)), []);
  const categories = useMemo(() => uniqueSorted(newspapersData.map(n => n.category)), []);

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    return newspapersData.filter(n =>
      (!q || n.name.toLowerCase().includes(q)) &&
      (!zone || n.zone === zone) &&
      (!country || n.country === country) &&
      (!continent || n.continent === continent) &&
      (!language || n.language === language) &&
      (!category || n.category === category),
    );
  }, [name, zone, country, continent, language, category]);

  const hasFilters = name || zone || country || continent || language || category;
  const reset = () => { setName(''); setZone(''); setCountry(''); setContinent(''); setLanguage(''); setCategory(''); };

  const selCls = 'border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div>
      {/* Banner — full width brand green, clears fixed navbar */}
      <div className="text-white" style={{ background: GREEN }}>
        <div className="section pt-24 pb-12">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
            <a href="/" className="hover:text-white transition-colors">Home</a>
            <span>›</span>
            <span>Newspapers</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">Newspapers & News Sources</h1>
          <p className="text-white/75 text-lg max-w-3xl">
            A curated gateway to {newspapersData.length} Nigerian and international newspapers — across every geopolitical zone,
            continent, and beat. Read major titles directly within the library or open them in a new tab.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="section pt-6">
        <div className="flex gap-2 border-b border-neutral-200">
          <span
            className="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            Newspaper Titles
          </span>
          <a
            href="/newspapers/articles"
            className="px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-neutral-500 hover:text-neutral-800"
          >
            Article Index →
          </a>
        </div>
      </div>

      <div className="section py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Search by name…"
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-56 flex-1"
          />
          <select value={zone} onChange={e => setZone(e.target.value)} className={selCls}>
            <option value="">All Zones</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select value={country} onChange={e => setCountry(e.target.value)} className={selCls}>
            <option value="">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={continent} onChange={e => setContinent(e.target.value)} className={selCls}>
            <option value="">All Continents</option>
            {continents.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={language} onChange={e => setLanguage(e.target.value)} className={selCls}>
            <option value="">All Languages</option>
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} className={selCls}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {hasFilters && (
            <button onClick={reset} className="text-sm font-medium text-primary-700 hover:underline px-2">Clear filters</button>
          )}
        </div>

        {/* Live count */}
        <p className="text-sm text-neutral-500 mb-6">
          Showing <span className="font-semibold text-neutral-800">{filtered.length}</span> of {newspapersData.length} newspapers
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-neutral-100 rounded-2xl">
            <div className="text-4xl mb-3">🗞️</div>
            <p className="text-neutral-500">No newspapers match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(paper => (
              <NewspaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
