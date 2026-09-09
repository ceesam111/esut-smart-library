import { useState } from 'react';
import { Link } from 'react-router-dom';

type Group = 'Print' | 'Digital' | 'Audiovisual' | 'Special Collections';
type Access = 'On-site' | 'Open Access' | 'Licensed' | 'On Request';
type Availability = 'Available' | 'Reference Only' | 'On Request';

export interface ResourceType {
  name: string;
  group: Group;
  icon: string;
  description: string;
  discipline: string;
  access: Access;
  availability: Availability;
  link: string;
}

const q = (s: string) => `/catalogue?q=${encodeURIComponent(s)}`;

export const RESOURCE_TYPES: ResourceType[] = [
  // ── Print ──────────────────────────────────────────────
  { name: 'Books', group: 'Print', icon: '📚', description: 'General monographs and academic titles across all subjects.', discipline: 'General', access: 'On-site', availability: 'Available', link: q('books') },
  { name: 'Textbooks', group: 'Print', icon: '📗', description: 'Course textbooks and recommended readings for programmes.', discipline: 'Education', access: 'On-site', availability: 'Available', link: q('textbook') },
  { name: 'Reference Books', group: 'Print', icon: '📘', description: 'Authoritative works consulted for specific facts.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: q('reference') },
  { name: 'Encyclopaedias', group: 'Print', icon: '📙', description: 'Comprehensive reference sets covering broad knowledge areas.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: q('encyclopaedia') },
  { name: 'Dictionaries', group: 'Print', icon: '🔤', description: 'Language, subject and specialised dictionaries.', discipline: 'Languages', access: 'On-site', availability: 'Reference Only', link: q('dictionary') },
  { name: 'Atlases', group: 'Print', icon: '🗺️', description: 'Bound collections of maps and geographic data.', discipline: 'Geography', access: 'On-site', availability: 'Reference Only', link: q('atlas') },
  { name: 'Almanacs', group: 'Print', icon: '📅', description: 'Annual compendia of facts, statistics and events.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: q('almanac') },
  { name: 'Yearbooks', group: 'Print', icon: '📆', description: 'Annual reviews of a year in a field or institution.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: q('yearbook') },
  { name: 'Handbooks', group: 'Print', icon: '📓', description: 'Concise practical guides and manuals for a subject.', discipline: 'General', access: 'On-site', availability: 'Available', link: q('handbook') },
  { name: 'Journals', group: 'Print', icon: '📰', description: 'Printed scholarly and professional periodicals.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: q('journal') },
  { name: 'Newspapers', group: 'Print', icon: '🗞️', description: 'Current and archived national and local newspapers.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: q('newspaper') },
  { name: 'Magazines', group: 'Print', icon: '📔', description: 'Popular and special-interest periodical publications.', discipline: 'General', access: 'On-site', availability: 'Available', link: q('magazine') },
  { name: 'Maps', group: 'Print', icon: '🧭', description: 'Topographic, thematic and historical map sheets.', discipline: 'Geography', access: 'On-site', availability: 'Reference Only', link: q('map') },
  { name: 'Theses', group: 'Print', icon: '🎓', description: 'Postgraduate theses submitted to the institution.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: '/theses' },
  { name: 'Dissertations', group: 'Print', icon: '📜', description: 'Doctoral dissertations and long research essays.', discipline: 'General', access: 'On-site', availability: 'Reference Only', link: '/theses' },
  { name: 'Conference Proceedings', group: 'Print', icon: '🏛️', description: 'Collected papers presented at academic conferences.', discipline: 'General', access: 'On-site', availability: 'Available', link: q('proceedings') },
  { name: 'Government Documents', group: 'Print', icon: '🏢', description: 'Official publications, gazettes and policy papers.', discipline: 'Social Sciences', access: 'On-site', availability: 'Reference Only', link: q('government') },
  { name: 'Standards', group: 'Print', icon: '📐', description: 'Technical and industry standards documents.', discipline: 'Technology', access: 'On-site', availability: 'Reference Only', link: q('standards') },
  { name: 'Pamphlets', group: 'Print', icon: '📄', description: 'Short informational booklets and leaflets.', discipline: 'General', access: 'On-site', availability: 'Available', link: q('pamphlet') },
  { name: 'Manuscripts', group: 'Print', icon: '✒️', description: 'Handwritten and unpublished original documents.', discipline: 'Humanities', access: 'On Request', availability: 'Reference Only', link: q('manuscript') },

  // ── Digital ────────────────────────────────────────────
  { name: 'E-Books', group: 'Digital', icon: '💻', description: 'Electronic books readable online and offline.', discipline: 'General', access: 'Open Access', availability: 'Available', link: '/categories' },
  { name: 'E-Journals', group: 'Digital', icon: '🖥️', description: 'Electronic scholarly journals and articles.', discipline: 'General', access: 'Licensed', availability: 'Available', link: '/databases' },
  { name: 'Databases', group: 'Digital', icon: '🗄️', description: 'Subscribed and open research databases.', discipline: 'General', access: 'Licensed', availability: 'Available', link: '/databases' },
  { name: 'Digital Archives', group: 'Digital', icon: '🗃️', description: 'Digitised historical and institutional collections.', discipline: 'Humanities', access: 'Open Access', availability: 'Available', link: '/repository' },
  { name: 'Institutional Repository', group: 'Digital', icon: '📥', description: "The institution's open research output collection.", discipline: 'General', access: 'Open Access', availability: 'Available', link: '/repository' },
  { name: 'E-Theses', group: 'Digital', icon: '🎓', description: 'Electronic theses and dissertations.', discipline: 'General', access: 'Open Access', availability: 'Available', link: '/theses' },
  { name: 'Streaming Audio', group: 'Digital', icon: '🔊', description: 'Streamed lectures, music and spoken-word content.', discipline: 'Arts', access: 'Licensed', availability: 'Available', link: q('audio') },
  { name: 'Streaming Video', group: 'Digital', icon: '🎬', description: 'Educational and documentary video on demand.', discipline: 'Arts', access: 'Licensed', availability: 'Available', link: q('video') },
  { name: 'Podcasts', group: 'Digital', icon: '🎙️', description: 'Episodic audio programmes and series.', discipline: 'General', access: 'Open Access', availability: 'Available', link: q('podcast') },
  { name: 'Datasets', group: 'Digital', icon: '📊', description: 'Research data and statistical collections.', discipline: 'Sciences', access: 'Open Access', availability: 'Available', link: '/repository' },
  { name: 'Preprints', group: 'Digital', icon: '⚛️', description: 'Pre-publication research manuscripts.', discipline: 'Sciences', access: 'Open Access', availability: 'Available', link: '/categories' },
  { name: 'Open Access Resources', group: 'Digital', icon: '🌐', description: 'Freely available scholarly content worldwide.', discipline: 'General', access: 'Open Access', availability: 'Available', link: '/categories' },

  // ── Audiovisual ────────────────────────────────────────
  { name: 'DVDs', group: 'Audiovisual', icon: '📀', description: 'Film, documentary and instructional discs.', discipline: 'Arts', access: 'On-site', availability: 'Available', link: q('dvd') },
  { name: 'CDs', group: 'Audiovisual', icon: '💿', description: 'Audio and data compact discs.', discipline: 'Arts', access: 'On-site', availability: 'Available', link: q('cd') },
  { name: 'Microfilm', group: 'Audiovisual', icon: '🎞️', description: 'Reel-based miniaturised document archives.', discipline: 'History', access: 'On-site', availability: 'Reference Only', link: q('microfilm') },
  { name: 'Microfiche', group: 'Audiovisual', icon: '🗂️', description: 'Flat-sheet microform document archives.', discipline: 'History', access: 'On-site', availability: 'Reference Only', link: q('microfiche') },
  { name: 'Slides', group: 'Audiovisual', icon: '🖼️', description: 'Photographic and presentation slide collections.', discipline: 'Arts', access: 'On-site', availability: 'Reference Only', link: q('slides') },
  { name: 'Photographs', group: 'Audiovisual', icon: '📷', description: 'Historical and documentary photographic prints.', discipline: 'History', access: 'On-site', availability: 'Reference Only', link: q('photographs') },
  { name: 'Audio Recordings', group: 'Audiovisual', icon: '🎵', description: 'Recorded lectures, oral histories and music.', discipline: 'Arts', access: 'On-site', availability: 'Available', link: q('audio recording') },
  { name: 'Video Recordings', group: 'Audiovisual', icon: '📹', description: 'Recorded events, lectures and documentaries.', discipline: 'Arts', access: 'On-site', availability: 'Available', link: q('video recording') },

  // ── Special Collections ────────────────────────────────
  { name: 'Rare Books', group: 'Special Collections', icon: '📕', description: 'Scarce, antique and valuable printed works.', discipline: 'Humanities', access: 'On Request', availability: 'Reference Only', link: q('rare books') },
  { name: 'Archival Materials', group: 'Special Collections', icon: '🗄️', description: 'Institutional records and primary source archives.', discipline: 'History', access: 'On Request', availability: 'Reference Only', link: q('archives') },
  { name: 'Special Reports', group: 'Special Collections', icon: '📋', description: 'Commissioned and restricted-circulation reports.', discipline: 'Social Sciences', access: 'On Request', availability: 'On Request', link: q('special report') },
  { name: 'Grey Literature', group: 'Special Collections', icon: '📑', description: 'Working papers, white papers and unpublished material.', discipline: 'General', access: 'Open Access', availability: 'Available', link: q('grey literature') },
  { name: 'Patents', group: 'Special Collections', icon: '⚙️', description: 'Granted patents and intellectual property records.', discipline: 'Technology', access: 'Open Access', availability: 'Reference Only', link: q('patents') },
  { name: 'Technical Reports', group: 'Special Collections', icon: '🛠️', description: 'Engineering and scientific technical documentation.', discipline: 'Technology', access: 'On Request', availability: 'Available', link: q('technical report') },
];

const GROUPS: Group[] = ['Print', 'Digital', 'Audiovisual', 'Special Collections'];
const DISCIPLINES = [...new Set(RESOURCE_TYPES.map(r => r.discipline))].sort();
const ACCESS_TYPES: Access[] = ['On-site', 'Open Access', 'Licensed', 'On Request'];
const AVAILABILITIES: Availability[] = ['Available', 'Reference Only', 'On Request'];

const GROUP_COLORS: Record<Group, string> = {
  Print: 'bg-blue-100 text-blue-700',
  Digital: 'bg-teal-100 text-teal-700',
  Audiovisual: 'bg-purple-100 text-purple-700',
  'Special Collections': 'bg-amber-100 text-amber-700',
};

export default function ResourceTypesExplorer() {
  const [type, setType] = useState('');
  const [format, setFormat] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [access, setAccess] = useState('');
  const [availability, setAvailability] = useState('');

  const filtered = RESOURCE_TYPES.filter(r =>
    (!type || r.name === type) &&
    (!format || r.group === format) &&
    (!discipline || r.discipline === discipline) &&
    (!access || r.access === access) &&
    (!availability || r.availability === availability),
  );

  const reset = () => { setType(''); setFormat(''); setDiscipline(''); setAccess(''); setAvailability(''); };
  const hasFilters = type || format || discipline || access || availability;

  const selCls = 'border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <>
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 mb-8 flex items-start gap-3">
        <span className="text-2xl">🧩</span>
        <div>
          <h3 className="font-bold text-neutral-900 mb-1">All Resource Types</h3>
          <p className="text-neutral-600 text-sm leading-relaxed">
            Explore every format held or accessed by the library — across Print, Digital, Audiovisual and Special Collections.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={format} onChange={e => setFormat(e.target.value)} className={selCls}>
          <option value="">All Formats</option>
          {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className={selCls}>
          <option value="">All Resource Types</option>
          {RESOURCE_TYPES.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <select value={discipline} onChange={e => setDiscipline(e.target.value)} className={selCls}>
          <option value="">All Disciplines</option>
          {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={access} onChange={e => setAccess(e.target.value)} className={selCls}>
          <option value="">All Access Types</option>
          {ACCESS_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={availability} onChange={e => setAvailability(e.target.value)} className={selCls}>
          <option value="">All Availability</option>
          {AVAILABILITIES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {hasFilters && (
          <button onClick={reset} className="text-sm font-medium text-primary-700 hover:underline px-2">Clear filters</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-neutral-100 rounded-2xl">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-neutral-500">No resource types match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.name} className="bg-white border border-neutral-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary-200 transition-all flex flex-col">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-3xl">{r.icon}</span>
                <div className="min-w-0">
                  <h3 className="font-bold text-neutral-900 leading-tight">{r.name}</h3>
                  <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${GROUP_COLORS[r.group]}`}>{r.group}</span>
                </div>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed flex-1">{r.description}</p>
              <div className="flex flex-wrap gap-1.5 my-3">
                <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{r.access}</span>
                <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{r.availability}</span>
              </div>
              <Link to={r.link} className="mt-auto text-center text-sm font-semibold py-2 rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: '#1A4731' }}>
                Browse {r.name} →
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
