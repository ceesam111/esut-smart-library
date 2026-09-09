import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

interface ProfileCard {
  id: string;
  slug: string;
  salutation: string | null;
  first_name: string;
  middle_name: string | null;
  surname: string;
  academic_rank: string | null;
  department: string | null;
  specialisations: string[];
  orcid_id: string | null;
  orcid_verified: boolean;
  google_scholar_id: string | null;
  h_index: number | null;
  total_citations: number | null;
  profile_photo_url: string | null;
  last_updated_at: string | null;
  pub_count?: number;
}

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'publications', label: 'Most Publications' },
  { value: 'citations', label: 'Most Citations' },
  { value: 'updated', label: 'Recently Updated' },
];

const RANK_OPTIONS = [
  'All Ranks',
  'Professor',
  'Associate Professor',
  'Reader',
  'Chief Lecturer',
  'Principal Lecturer',
  'Senior Lecturer',
  'Lecturer I',
  'Lecturer II',
  'Assistant Lecturer',
  'Graduate Assistant',
];

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0].slice(0, 2);
  return (
    <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl shrink-0">
      {initials.toUpperCase()}
    </div>
  );
}

export default function Lecturers() {
  usePageTitle('Lecturers & Researchers');
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [rank, setRank] = useState('All Ranks');
  const [sort, setSort] = useState('name');
  const [departments, setDepartments] = useState<string[]>([]);
  const [pubCounts, setPubCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('researcher_profiles')
        .select('id, slug, salutation, first_name, middle_name, surname, academic_rank, department, specialisations, orcid_id, orcid_verified, google_scholar_id, h_index, total_citations, profile_photo_url, last_updated_at')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .order('surname', { ascending: true });

      const items = data ?? [];
      setProfiles(items as ProfileCard[]);

      const uniqueDepts = [...new Set(items.map((p) => p.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts.sort());

      // Fetch publication counts
      if (items.length > 0) {
        const ids = items.map((p) => p.id);
        const { data: pubs } = await supabase
          .from('researcher_publications')
          .select('researcher_id')
          .in('researcher_id', ids);

        const counts: Record<string, number> = {};
        for (const pub of pubs ?? []) {
          counts[pub.researcher_id] = (counts[pub.researcher_id] || 0) + 1;
        }
        setPubCounts(counts);
      }

      setLoading(false);
    };
    load();
  }, []);

  const filtered = profiles
    .filter((p) => {
      const fullName = `${p.salutation ?? ''} ${p.first_name} ${p.middle_name ?? ''} ${p.surname}`.toLowerCase();
      const spec = p.specialisations.join(' ').toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || fullName.includes(q) || (p.department ?? '').toLowerCase().includes(q) || spec.includes(q);
      const matchDept = department === 'All Departments' || p.department === department;
      const matchRank = rank === 'All Ranks' || p.academic_rank === rank;
      return matchSearch && matchDept && matchRank;
    })
    .sort((a, b) => {
      if (sort === 'name') return `${a.surname}${a.first_name}`.localeCompare(`${b.surname}${b.first_name}`);
      if (sort === 'publications') return (pubCounts[b.id] ?? 0) - (pubCounts[a.id] ?? 0);
      if (sort === 'citations') return (b.total_citations ?? 0) - (a.total_citations ?? 0);
      if (sort === 'updated') return (b.last_updated_at ?? '').localeCompare(a.last_updated_at ?? '');
      return 0;
    });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div
        className="py-20 px-4 text-white"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
      >
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium uppercase tracking-wider text-white/70 mb-3">Academic Staff</p>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
            ESUT Academic Staff &amp; Researchers
          </h1>
          <p className="text-white/80 max-w-2xl text-lg">
            Explore the research profiles, publications, and expertise of Enugu State University of Science and
            Education's academic staff.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5 mb-8 flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, department, or keyword…"
            className="input flex-1 text-sm"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="input text-sm sm:w-56"
          >
            <option>All Departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="input text-sm sm:w-48"
          >
            {RANK_OPTIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input text-sm sm:w-48"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <div className="text-5xl mb-4">🔍</div>
            <div className="text-lg font-medium text-neutral-600">No profiles found</div>
            <div className="text-sm mt-1">Try adjusting your search or filters.</div>
          </div>
        ) : (
          <>
            <p className="text-sm text-neutral-500 mb-5">{filtered.length} profile{filtered.length !== 1 ? 's' : ''} found</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((profile) => {
                const fullName = `${profile.salutation ? profile.salutation + ' ' : ''}${profile.first_name} ${profile.surname}`;
                return (
                  <div
                    key={profile.id}
                    className="bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all p-6 flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-4">
                      {profile.profile_photo_url ? (
                        <img
                          src={profile.profile_photo_url}
                          alt={fullName}
                          className="w-20 h-20 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <Initials name={`${profile.first_name} ${profile.surname}`} />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-neutral-900 leading-snug">{fullName}</div>
                        {profile.academic_rank && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-teal-50 text-teal-700 rounded-full">
                            {profile.academic_rank}
                          </span>
                        )}
                        {profile.department && (
                          <div className="text-xs text-neutral-500 mt-1 truncate">{profile.department}</div>
                        )}
                      </div>
                    </div>

                    {profile.specialisations.length > 0 && (
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        {profile.specialisations.slice(0, 2).join(' · ')}
                      </p>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {profile.orcid_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                          <span className="text-xs">✓</span> ORCID
                        </span>
                      )}
                      {profile.google_scholar_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-700 rounded-full border border-primary-200">
                          Scholar
                        </span>
                      )}
                      {profile.h_index != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full">
                          h-index: {profile.h_index}
                        </span>
                      )}
                      {profile.total_citations != null && profile.total_citations > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full">
                          {profile.total_citations.toLocaleString()} citations
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/lecturers/${profile.slug}`}
                      className="mt-auto btn-outline text-sm py-2 text-center rounded-lg font-medium"
                    >
                      View Profile
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
