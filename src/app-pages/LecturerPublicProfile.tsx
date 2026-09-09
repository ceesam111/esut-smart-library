import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

interface ResearcherProfile {
  id: string;
  slug: string;
  salutation: string | null;
  first_name: string;
  middle_name: string | null;
  surname: string;
  academic_rank: string | null;
  employment_status: string | null;
  department: string | null;
  programmes_taught: string[];
  institution: string;
  institutional_email: string | null;
  phone: string | null;
  office_location: string | null;
  highest_qualification: { degree: string; field: string; institution: string; year: number } | null;
  other_qualifications: Array<{ degree: string; field: string; institution: string; year: number }>;
  professional_memberships: string[];
  specialisations: string[];
  research_keywords: string[];
  biography: string | null;
  orcid_id: string | null;
  orcid_verified: boolean;
  google_scholar_id: string | null;
  researchgate_url: string | null;
  academia_url: string | null;
  h_index: number | null;
  total_citations: number | null;
  i10_index: number | null;
  supervision_phd_completed: number;
  supervision_phd_current: number;
  supervision_med_completed: number;
  supervision_med_current: number;
  profile_photo_url: string | null;
  visibility: string;
  last_updated_at: string | null;
}

interface Publication {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal_or_publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  publication_type: string;
  citation_count: number;
  apa_formatted: string | null;
}

interface Grant {
  id: string;
  title: string | null;
  funding_body: string | null;
  amount: string | null;
  year: number | null;
  role: string | null;
}

type Tab = 'biography' | 'publications' | 'grants' | 'teaching';
type PubFilter = 'all' | 'journal' | 'book' | 'chapter' | 'conference';

function Initials({ name, size = 'lg' }: { name: string; size?: 'lg' | 'sm' }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  const cls = size === 'lg'
    ? 'w-64 h-64 text-5xl'
    : 'w-20 h-20 text-2xl';
  return (
    <div className={`rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold ${cls}`}>
      {initials.toUpperCase()}
    </div>
  );
}

export default function LecturerPublicProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<ResearcherProfile | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('biography');
  const [pubFilter, setPubFilter] = useState<PubFilter>('all');
  const [pubSort, setPubSort] = useState<'newest' | 'cited'>('newest');

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from('researcher_profiles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (!profileData) { setLoading(false); return; }
      setProfile(profileData as ResearcherProfile);

      const [pubRes, grantRes] = await Promise.all([
        supabase.from('researcher_publications').select('*').eq('researcher_id', profileData.id).order('year', { ascending: false }),
        supabase.from('researcher_grants').select('*').eq('researcher_id', profileData.id).order('year', { ascending: false }),
      ]);

      setPublications((pubRes.data ?? []) as Publication[]);
      setGrants((grantRes.data ?? []) as Grant[]);
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-neutral-500">
        <div className="text-5xl">404</div>
        <div className="font-medium text-neutral-700">Profile not found</div>
        <Link to="/lecturers" className="text-primary-600 hover:underline text-sm">Back to Directory</Link>
      </div>
    );
  }

  const fullName = [profile.salutation, profile.first_name, profile.middle_name, profile.surname]
    .filter(Boolean).join(' ');
  const shortName = `${profile.first_name} ${profile.surname}`;
  const sameAs = [
    profile.orcid_id ? `https://orcid.org/${profile.orcid_id}` : null,
    profile.google_scholar_id ? `https://scholar.google.com/citations?user=${profile.google_scholar_id}` : null,
    profile.researchgate_url,
    profile.academia_url,
  ].filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    jobTitle: profile.academic_rank ?? undefined,
    worksFor: {
      '@type': 'Organization',
      name: profile.institution ?? 'Enugu State University of Science and Technology',
    },
    affiliation: profile.department ?? undefined,
    email: profile.visibility === 'public' && profile.institutional_email ? profile.institutional_email : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    knowsAbout: profile.specialisations.length ? profile.specialisations : undefined,
  };

  // Inject JSON-LD and page title for SEO
  useEffect(() => {
    document.title = `${fullName} — ${profile.department ?? 'ESUT'} — ESUT Library`;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'person-jsonld';
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      document.title = 'ESUT Library';
      document.getElementById('person-jsonld')?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const filteredPubs = publications
    .filter((p) => pubFilter === 'all' || p.publication_type === pubFilter)
    .sort((a, b) =>
      pubSort === 'newest'
        ? (b.year ?? 0) - (a.year ?? 0)
        : (b.citation_count ?? 0) - (a.citation_count ?? 0)
    );

  const pubTypeCounts: Record<string, number> = {};
  for (const p of publications) {
    pubTypeCounts[p.publication_type] = (pubTypeCounts[p.publication_type] || 0) + 1;
  }

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'biography', label: 'Biography', icon: '📖' },
    { id: 'publications', label: `Publications (${publications.length})`, icon: '📄' },
    { id: 'grants', label: 'Grants & Supervision', icon: '🎓' },
    { id: 'teaching', label: 'Teaching', icon: '📚' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-neutral-100 py-3 px-4">
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-neutral-500">
            <Link to="/" className="hover:text-primary-700">Home</Link>
            <span>/</span>
            <Link to="/lecturers" className="hover:text-primary-700">Our Lecturers</Link>
            <span>/</span>
            <span className="text-neutral-700 font-medium">{shortName}</span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          <BackButton />
          <div className="flex flex-col lg:flex-row gap-8">
            {/* ── Left column ── */}
            <aside className="lg:w-64 shrink-0">
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 space-y-5 lg:sticky lg:top-24">
                {/* Photo */}
                <div className="flex justify-center">
                  {profile.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt={fullName}
                      className="w-40 h-40 lg:w-52 lg:h-52 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-40 h-40 lg:w-52 lg:h-52 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-5xl">
                      {`${profile.first_name[0]}${profile.surname[0]}`}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="text-center">
                  <div className="font-bold text-neutral-900 text-xl leading-tight">{fullName}</div>
                  {profile.academic_rank && (
                    <span className="inline-block mt-2 px-3 py-0.5 text-xs font-semibold bg-teal-50 text-teal-700 rounded-full">
                      {profile.academic_rank}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1 text-xs text-neutral-600 border-t border-neutral-100 pt-4">
                  {profile.department && (
                    <div className="flex gap-2"><span className="text-neutral-400 w-4">🏛</span>{profile.department}</div>
                  )}
                  <div className="flex gap-2"><span className="text-neutral-400 w-4">🎓</span>{profile.institution}</div>
                  {profile.visibility === 'public' && profile.institutional_email && (
                    <a
                      href={`mailto:${profile.institutional_email}`}
                      className="flex gap-2 text-primary-600 hover:underline"
                    >
                      <span className="text-neutral-400 w-4">✉</span>{profile.institutional_email}
                    </a>
                  )}
                </div>

                {/* Identity badges */}
                <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                  {profile.orcid_id && (
                    <a
                      href={`https://orcid.org/${profile.orcid_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-700 rounded-full border border-green-200 hover:bg-green-100 transition-colors"
                    >
                      ORCID {profile.orcid_verified && '✓'}
                    </a>
                  )}
                  {profile.google_scholar_id && (
                    <a
                      href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary-50 text-primary-700 rounded-full border border-primary-200 hover:bg-primary-100 transition-colors"
                    >
                      Google Scholar
                    </a>
                  )}
                  {profile.researchgate_url && (
                    <a
                      href={profile.researchgate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-teal-50 text-teal-700 rounded-full border border-teal-200 hover:bg-teal-100 transition-colors"
                    >
                      ResearchGate
                    </a>
                  )}
                  {profile.academia_url && (
                    <a
                      href={profile.academia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-neutral-100 text-neutral-700 rounded-full border border-neutral-200 hover:bg-neutral-200 transition-colors"
                    >
                      Academia.edu
                    </a>
                  )}
                </div>

                {/* Impact metrics */}
                {(profile.h_index != null || profile.total_citations != null || profile.i10_index != null) && (
                  <div className="border-t border-neutral-100 pt-4 space-y-2">
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Impact Metrics</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {profile.h_index != null && (
                        <div className="bg-neutral-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-neutral-900">{profile.h_index}</div>
                          <div className="text-xs text-neutral-500">h-index</div>
                        </div>
                      )}
                      {profile.total_citations != null && (
                        <div className="bg-neutral-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-neutral-900">{profile.total_citations.toLocaleString()}</div>
                          <div className="text-xs text-neutral-500">Citations</div>
                        </div>
                      )}
                      {profile.i10_index != null && (
                        <div className="bg-neutral-50 rounded-lg p-2">
                          <div className="text-lg font-bold text-neutral-900">{profile.i10_index}</div>
                          <div className="text-xs text-neutral-500">i10-index</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {profile.last_updated_at && (
                  <div className="text-xs text-neutral-400 text-center border-t border-neutral-100 pt-3">
                    Updated {new Date(profile.last_updated_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            </aside>

            {/* ── Right column ── */}
            <div className="flex-1 min-w-0">
              {/* Tabs */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="border-b border-neutral-200 flex overflow-x-auto">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        tab === t.id
                          ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                          : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                      }`}
                    >
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* ── Biography ── */}
                  {tab === 'biography' && (
                    <div className="space-y-6">
                      {profile.biography && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Research Statement</h3>
                          <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap text-sm">{profile.biography}</p>
                        </div>
                      )}

                      {profile.specialisations.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Areas of Specialisation</h3>
                          <div className="flex flex-wrap gap-2">
                            {profile.specialisations.map((s) => (
                              <span key={s} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profile.research_keywords.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Research Keywords</h3>
                          <div className="flex flex-wrap gap-2">
                            {profile.research_keywords.map((k) => (
                              <span key={k} className="px-2.5 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                                {k}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profile.highest_qualification && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Qualifications</h3>
                          <div className="space-y-2">
                            <div className="flex gap-3 items-start bg-neutral-50 rounded-lg p-3">
                              <span className="text-lg">🎓</span>
                              <div className="text-sm">
                                <div className="font-semibold text-neutral-800">
                                  {profile.highest_qualification.degree} — {profile.highest_qualification.field}
                                </div>
                                <div className="text-neutral-500">
                                  {profile.highest_qualification.institution}
                                  {profile.highest_qualification.year ? `, ${profile.highest_qualification.year}` : ''}
                                </div>
                              </div>
                            </div>
                            {(profile.other_qualifications ?? []).map((q, i) => (
                              <div key={i} className="flex gap-3 items-start bg-neutral-50 rounded-lg p-3">
                                <span className="text-lg">📜</span>
                                <div className="text-sm">
                                  <div className="font-semibold text-neutral-800">{q.degree} — {q.field}</div>
                                  <div className="text-neutral-500">{q.institution}{q.year ? `, ${q.year}` : ''}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(profile.professional_memberships ?? []).length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Professional Memberships</h3>
                          <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-600">
                            {(profile.professional_memberships ?? []).map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Publications ── */}
                  {tab === 'publications' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(['all', 'journal', 'book', 'chapter', 'conference'] as PubFilter[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => setPubFilter(f)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              pubFilter === f
                                ? 'bg-primary-600 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                          >
                            {f === 'all' ? `All (${publications.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)}s (${pubTypeCounts[f] ?? 0})`}
                          </button>
                        ))}
                        <select
                          value={pubSort}
                          onChange={(e) => setPubSort(e.target.value as 'newest' | 'cited')}
                          className="ml-auto text-xs border border-neutral-200 rounded-lg px-2 py-1 bg-white"
                        >
                          <option value="newest">Newest First</option>
                          <option value="cited">Most Cited</option>
                        </select>
                      </div>

                      {filteredPubs.length === 0 ? (
                        <div className="text-center py-8 text-neutral-400 text-sm">No publications in this category.</div>
                      ) : (
                        <div className="space-y-4">
                          {filteredPubs.map((pub) => (
                            <div key={pub.id} className="border border-neutral-200 rounded-xl p-4 hover:border-neutral-300 transition-colors">
                              <div className="flex flex-wrap gap-2 mb-2">
                                {pub.year && (
                                  <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-xs font-semibold">{pub.year}</span>
                                )}
                                <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium capitalize">{pub.publication_type}</span>
                              </div>
                              <p className="text-sm text-neutral-700 leading-relaxed">
                                {pub.apa_formatted ?? pub.title}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {pub.doi && (
                                  <a
                                    href={`https://doi.org/${pub.doi}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-600 rounded text-xs font-medium transition-colors"
                                  >
                                    🔗 DOI
                                  </a>
                                )}
                                {pub.citation_count > 0 && (
                                  <span className="inline-flex items-center px-2.5 py-1 bg-neutral-50 text-neutral-500 rounded text-xs">
                                    Cited by {pub.citation_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Grants & Supervision ── */}
                  {tab === 'grants' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900 mb-4">Grants &amp; Research Funding</h3>
                        {grants.length === 0 ? (
                          <p className="text-sm text-neutral-400">No grants recorded.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-neutral-50 border-b border-neutral-200">
                                <tr>
                                  <th className="text-left p-3 font-semibold text-neutral-700">Grant Title</th>
                                  <th className="text-left p-3 font-semibold text-neutral-700">Funder</th>
                                  <th className="text-left p-3 font-semibold text-neutral-700">Year</th>
                                  <th className="text-left p-3 font-semibold text-neutral-700">Role</th>
                                  <th className="text-left p-3 font-semibold text-neutral-700">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grants.map((g) => (
                                  <tr key={g.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                                    <td className="p-3 font-medium text-neutral-800">{g.title ?? '—'}</td>
                                    <td className="p-3 text-neutral-600">{g.funding_body ?? '—'}</td>
                                    <td className="p-3 text-neutral-600">{g.year ?? '—'}</td>
                                    <td className="p-3 text-neutral-600">{g.role ?? '—'}</td>
                                    <td className="p-3 text-neutral-600">{g.amount ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-neutral-900 mb-4">Postgraduate Supervision</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { label: 'PhD Completed', value: profile.supervision_phd_completed },
                            { label: 'PhD Current', value: profile.supervision_phd_current },
                            { label: 'M.Ed. Completed', value: profile.supervision_med_completed },
                            { label: 'M.Ed. Current', value: profile.supervision_med_current },
                          ].map((item) => (
                            <div key={item.label} className="bg-neutral-50 rounded-xl p-4 text-center border border-neutral-100">
                              <div className="text-2xl font-bold text-neutral-900">{item.value}</div>
                              <div className="text-xs text-neutral-500 mt-1">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Teaching ── */}
                  {tab === 'teaching' && (
                    <div className="space-y-6">
                      {profile.programmes_taught.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Programmes Taught</h3>
                          <div className="flex flex-wrap gap-2">
                            {profile.programmes_taught.map((p) => (
                              <span key={p} className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-sm">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(profile.office_location || profile.phone) && (
                        <div>
                          <h3 className="text-base font-semibold text-neutral-900 mb-3">Contact &amp; Office</h3>
                          <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-sm text-neutral-700">
                            {profile.office_location && (
                              <div className="flex gap-2"><span>📍</span> {profile.office_location}</div>
                            )}
                            {profile.phone && (
                              <div className="flex gap-2"><span>📞</span> {profile.phone}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
