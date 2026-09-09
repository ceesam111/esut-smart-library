import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { usePageTitle } from '@/hooks/usePageTitle';

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  indexedPages: number;
  downloads: number;
  oaiRecords: number;
  doisMinted: number;
  orcidStaff: number;
  totalCitations: number;
}

interface TopLecturer {
  slug: string;
  salutation: string | null;
  first_name: string;
  surname: string;
  department: string | null;
  h_index: number | null;
  total_citations: number | null;
  profile_photo_url: string | null;
}

interface TopPublication {
  id: string;
  title: string;
  authors: string | null;
  year: number | null;
  journal: string | null;
  citation_count: number | null;
}

interface AggMetrics {
  totalPubs: number;
  totalCitations: number;
  avgHIndex: number | null;
  orcidRate: number;
}

interface RankRow { initiative_key: string; rank_text: string | null; rank_year: number | null; }
interface ActionRow { action_id: number; status: string; }

// ── Static data ──────────────────────────────────────────────────────────────

const INITIATIVES = [
  {
    key: 'ncce',
    name: 'NUC Minimum Standards',
    contribution: 'The ESUT Library platform automatically generates NUC volume-per-programme compliance reports from live catalogue data. Every resource added to the catalogue directly improves the institution\'s NUC collection adequacy score.',
    actions: ['Submit to NUC portal', 'Populate catalogue to 2,500 volumes per programme'],
  },
  {
    key: 'webometrics',
    name: 'Webometrics (Cybermetrics Lab)',
    contribution: 'Every lecturer profile page, repository document, and catalogue item is indexed by Google — growing ESUT\'s web presence score. The OAI-PMH endpoint enables global metadata harvesters to index ESUT\'s research output automatically.',
    actions: ['Submit to Webometrics repository list', 'Achieve 100 published repository items'],
  },
  {
    key: 'the',
    name: 'THE World University Rankings',
    contribution: 'Lecturer profiles with ORCID linkage and citation tracking directly feed into the research impact indicators measured by THE. Published repository items with DOIs are citable globally.',
    actions: ['All staff to add ORCID', 'Ensure all publications have DOIs'],
  },
  {
    key: 'qs',
    name: 'QS World University Rankings',
    contribution: 'Public lecturer profiles with citation metrics and H-index data contribute to the citations per faculty indicator used by QS. Global visibility of ESUT research improves academic reputation scores.',
    actions: ['All staff to add Google Scholar ID', 'Publish researcher profiles'],
  },
  {
    key: 'google_scholar',
    name: 'Google Scholar Metrics',
    contribution: 'Lecturer profiles linked to Google Scholar aggregate the institution\'s citation metrics. All published repository items are indexable by Google Scholar via structured metadata.',
    actions: ['Link library domain to Google Scholar institutional profile', 'Ensure all repository items have abstracts'],
  },
  {
    key: 'scimago',
    name: 'SCImago Institutions Rankings',
    contribution: 'Repository items published with Scopus Author IDs on lecturer profiles contribute to SCImago output and impact scores. OAI-PMH harvesting by Scopus databases improves institutional indexing.',
    actions: ['All staff to add Scopus Author ID', 'Register with SCImago'],
  },
  {
    key: 'ui_greenmetric',
    name: 'UI GreenMetric',
    contribution: 'The ESUT Smart Library replaces physical resource circulation and paper-based processes with digital alternatives, directly reducing the institution\'s carbon footprint and contributing to UI GreenMetric sustainability indicators.',
    actions: ['Track digital vs physical resource access ratio in analytics'],
  },
  {
    key: 'nirf',
    name: 'NIRF (Nigeria)',
    contribution: 'Digital resource availability and patron registration rates are direct NIRF measurement points for Teaching, Learning and Resources. Repository output and citation tracking contribute to Research and Professional Practice.',
    actions: ['Maintain patron registration above 80% of total enrolment', 'Submit NIRF data annually'],
  },
];

const ACTIONS = [
  { id: 1,  label: 'Submit sitemap.xml to Google Search Console',             impact: 'Critical' },
  { id: 2,  label: 'Register OAI-PMH with OpenDOAR',                          impact: 'High' },
  { id: 3,  label: 'Submit OAI-PMH to BASE (Bielefeld)',                       impact: 'High' },
  { id: 4,  label: 'Submit ESUT to Webometrics repository list',              impact: 'Critical' },
  { id: 5,  label: 'All lecturers to add ORCID to profiles',                   impact: 'High' },
  { id: 6,  label: 'All lecturers to add Google Scholar ID',                    impact: 'High' },
  { id: 7,  label: 'Achieve 100 published repository items',                   impact: 'High' },
  { id: 8,  label: 'Achieve 50 published lecturer profiles',                   impact: 'High' },
  { id: 9,  label: 'Achieve 2,500 volumes per NUC programme',                 impact: 'Critical' },
  { id: 10, label: 'Submit ESUT to AJOL (African Journals Online)',            impact: 'Moderate' },
  { id: 11, label: 'Register on SCImago institutions database',                 impact: 'High' },
  { id: 12, label: 'Link ESUT domain to Google Scholar institution',           impact: 'High' },
  { id: 13, label: 'All publications to have DOI on ORCID',                    impact: 'High' },
  { id: 14, label: 'Submit Bing Webmaster Tools sitemap',                       impact: 'Moderate' },
  { id: 15, label: 'Complete annual NIRF data submission',                      impact: 'High' },
];

// ── Animated counter ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ── Stat card ────────────────────────────────────────────────────────────────

const STAT_ICONS: Record<string, string> = {
  indexedPages:   '📄',
  downloads:      '📥',
  oaiRecords:     '🌐',
  doisMinted:     '🔗',
  orcidStaff:     '👨‍🏫',
  totalCitations: '📖',
};

const STAT_LABELS: Record<string, string> = {
  indexedPages:   'Platform Pages Indexed',
  downloads:      'Research Downloads',
  oaiRecords:     'Records Harvestable Globally',
  doisMinted:     'Permanent Identifiers',
  orcidStaff:     'ORCID-Verified Staff',
  totalCitations: 'Citations Tracked',
};

function StatCard({ field, value }: { field: string; value: number }) {
  const display = useCountUp(value);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 flex flex-col gap-3">
      <div className="text-3xl">{STAT_ICONS[field]}</div>
      <div className="text-4xl font-bold text-primary-800 tabular-nums leading-none">
        {display.toLocaleString()}
      </div>
      <div className="text-sm text-neutral-500 font-medium leading-tight">{STAT_LABELS[field]}</div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'done') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      ✅ Done
    </span>
  );
  if (status === 'in_progress') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      🔄 In Progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-500">
      ⬜ Not Started
    </span>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  const cls =
    impact === 'Critical' ? 'bg-red-50 text-red-700' :
    impact === 'High'     ? 'bg-primary-50 text-primary-700' :
                            'bg-neutral-100 text-neutral-500';
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {impact}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WebometricsPage() {
  usePageTitle('Webometrics');
  const [stats, setStats]         = useState<Stats | null>(null);
  const [topLecturers, setTopLecturers] = useState<TopLecturer[]>([]);
  const [topPubs, setTopPubs]     = useState<TopPublication[]>([]);
  const [aggMetrics, setAggMetrics] = useState<AggMetrics | null>(null);
  const [ranks, setRanks]         = useState<Record<string, RankRow>>({});
  const [actions, setActions]     = useState<Record<number, string>>({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    const [
      catalogueRes,
      repoRes,
      lecturerProfilesRes,
      blogRes,
      cmsPagesRes,
      oaiRes,
      doisRes,
      orcidRes,
      citationsRes,
      topLecturersRes,
      topPubsRes,
      aggPubsRes,
      ranksRes,
      actionsRes,
    ] = await Promise.all([
      supabase.from('catalogue_items').select('id', { count: 'exact', head: true }),
      supabase.from('repository_items').select('download_count').eq('status', 'published'),
      supabase.from('researcher_profiles').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('visibility', 'public'),
      supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('cms_pages').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('repository_items').select('id', { count: 'exact', head: true }).eq('visibility', 'global').eq('status', 'published'),
      supabase.from('repository_items').select('id', { count: 'exact', head: true }).not('doi', 'is', null),
      supabase.from('researcher_profiles').select('id', { count: 'exact', head: true }).not('orcid_id', 'is', null).eq('status', 'published'),
      supabase.from('researcher_profiles').select('total_citations').eq('status', 'published'),
      supabase.from('researcher_profiles').select('slug, salutation, first_name, surname, department, h_index, total_citations, profile_photo_url').eq('status', 'published').order('total_citations', { ascending: false }).limit(10),
      supabase.from('researcher_publications').select('id, title, authors, year, journal, citation_count').order('citation_count', { ascending: false, nullsFirst: false }).limit(10),
      supabase.from('researcher_publications').select('citation_count'),
      supabase.from('webometrics_ranks').select('*'),
      supabase.from('webometrics_actions').select('*'),
    ]);

    // Compute indexed pages
    const catCount   = catalogueRes.count ?? 0;
    const repoCount  = (repoRes.data ?? []).length;
    const lecCount   = lecturerProfilesRes.count ?? 0;
    const blogCount  = blogRes.count ?? 0;
    const cmsCount   = cmsPagesRes.count ?? 0;
    // fixed public routes (/catalogue, /repository, /lecturers, /databases, /events, /blog, /forum, /thesis, /about, /contact, etc.)
    const staticRoutes = 20;
    const indexedPages = catCount + repoCount + (lecCount as number) + blogCount + cmsCount + staticRoutes;

    // Downloads
    const downloads = (repoRes.data ?? []).reduce((s, r) => s + (r.download_count ?? 0), 0);

    // Citations
    const totalCitations = (citationsRes.data ?? []).reduce((s, r) => s + (r.total_citations ?? 0), 0);

    setStats({
      indexedPages,
      downloads,
      oaiRecords:     oaiRes.count ?? 0,
      doisMinted:     doisRes.count ?? 0,
      orcidStaff:     orcidRes.count ?? 0,
      totalCitations,
    });

    setTopLecturers((topLecturersRes.data ?? []) as TopLecturer[]);
    setTopPubs((topPubsRes.data ?? []) as TopPublication[]);

    // Aggregate metrics
    const pubRows = aggPubsRes.data ?? [];
    const totalPubs = pubRows.length;
    const totalPubCitations = pubRows.reduce((s: number, r: { citation_count: number | null }) => s + (r.citation_count ?? 0), 0);

    const hData = (topLecturersRes.data ?? []).map((r) => r.h_index).filter((h): h is number => h !== null);
    const avgHIndex = hData.length ? Math.round((hData.reduce((a, b) => a + b, 0) / hData.length) * 10) / 10 : null;

    const totalProfiles = lecturerProfilesRes.count ?? 0;
    const orcidCount    = orcidRes.count ?? 0;
    const orcidRate = totalProfiles > 0 ? Math.round((orcidCount / totalProfiles) * 100) : 0;

    setAggMetrics({ totalPubs, totalCitations: totalPubCitations, avgHIndex, orcidRate });

    // Ranks map
    const rankMap: Record<string, RankRow> = {};
    (ranksRes.data ?? []).forEach((r) => { rankMap[r.initiative_key] = r; });
    setRanks(rankMap);

    // Actions map
    const actMap: Record<number, string> = {};
    (actionsRes.data ?? []).forEach((r) => { actMap[r.action_id] = r.status; });
    setActions(actMap);

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <div className="bg-primary-800 text-white py-16">
        <div className="section">
          <div className="text-xs font-semibold text-primary-300 uppercase tracking-wider mb-3">
            {institutionConfig.shortName} Library
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
            Webometrics &amp; Visibility
          </h1>
          <p className="text-primary-200 text-lg max-w-2xl">
            Tracking ESUT's digital research footprint, global ranking initiatives, and
            platform-driven academic visibility.
          </p>
        </div>
      </div>

      <div className="section py-12 space-y-16">

        {/* ── Part 1: Stat cards ─────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
          </div>
        ) : stats && (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(Object.keys(STAT_LABELS) as (keyof Stats)[]).map((field) => (
                <StatCard key={field} field={field} value={stats[field]} />
              ))}
            </div>
          </section>
        )}

        {/* ── Part 2: Initiative cards ──────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-serif font-bold text-neutral-900 mb-1">
            Ranking Initiative Contributions
          </h2>
          <p className="text-neutral-500 text-sm mb-8">
            How the ESUT Smart Library platform directly contributes to each ranking framework.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {INITIATIVES.map((init) => {
              const rank = ranks[init.key];
              return (
                <div key={init.key} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-neutral-900 text-base leading-snug">
                      {init.name}
                    </h3>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      rank?.rank_text && rank.rank_text !== 'Not yet ranked'
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      {rank?.rank_text ?? 'Not yet ranked'}
                      {rank?.rank_year ? ` (${rank.rank_year})` : ''}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-600 leading-relaxed">{init.contribution}</p>

                  <div className="border-t border-neutral-100 pt-3">
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      Actions Required
                    </div>
                    <ul className="space-y-1">
                      {init.actions.map((a, i) => (
                        <li key={i} className="text-xs text-neutral-600 flex gap-2">
                          <span className="text-primary-500 shrink-0">→</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Part 3: Research Impact ───────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-serif font-bold text-neutral-900 mb-1">
            ESUT Research Impact
          </h2>
          <p className="text-neutral-500 text-sm mb-8">
            Aggregated citation and output metrics from published lecturer profiles.
          </p>

          {/* Aggregate metrics strip */}
          {aggMetrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Total Publications Tracked', value: aggMetrics.totalPubs.toLocaleString() },
                { label: 'Total Citations',             value: aggMetrics.totalCitations.toLocaleString() },
                { label: 'Average H-Index',             value: aggMetrics.avgHIndex !== null ? aggMetrics.avgHIndex.toString() : '—' },
                { label: 'ORCID Adoption Rate',         value: `${aggMetrics.orcidRate}%` },
              ].map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-neutral-100 shadow-sm px-5 py-4 text-center">
                  <div className="text-2xl font-bold text-primary-800">{m.value}</div>
                  <div className="text-xs text-neutral-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Top 10 Lecturers table */}
          <h3 className="font-semibold text-neutral-800 text-base mb-3">
            Top 10 Most Cited Lecturers
          </h3>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden mb-10">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">H-Index</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Citations</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider w-28 hidden md:table-cell"></th>
                  </tr>
                </thead>
                <tbody>
                  {topLecturers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-400 text-sm">
                        No published lecturer profiles yet.
                      </td>
                    </tr>
                  ) : topLecturers.map((lec, idx) => {
                    const name = [lec.salutation, lec.first_name, lec.surname].filter(Boolean).join(' ');
                    return (
                      <tr key={lec.slug} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {lec.profile_photo_url ? (
                              <img src={lec.profile_photo_url} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                                {lec.first_name[0]}{lec.surname[0]}
                              </div>
                            )}
                            <span className="font-medium text-neutral-900">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs hidden sm:table-cell">{lec.department ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-neutral-700">{lec.h_index ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary-700">{(lec.total_citations ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Link to={`/lecturers/${lec.slug}`} className="text-xs text-primary-600 hover:underline font-medium">
                            View Profile →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 10 Publications table */}
          <h3 className="font-semibold text-neutral-800 text-base mb-3">
            Top 10 Most Cited Publications
          </h3>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden md:table-cell">Authors</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden sm:table-cell w-16">Year</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Journal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Citations</th>
                  </tr>
                </thead>
                <tbody>
                  {topPubs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-neutral-400 text-sm">
                        No publications tracked yet.
                      </td>
                    </tr>
                  ) : topPubs.map((pub) => (
                    <tr key={pub.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-neutral-900 max-w-xs">
                        <span className="line-clamp-2">{pub.title}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs max-w-[160px] truncate hidden md:table-cell">
                        {pub.authors ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-xs hidden sm:table-cell">{pub.year ?? '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs max-w-[140px] truncate hidden lg:table-cell">
                        {pub.journal ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary-700">
                        {(pub.citation_count ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Part 4: Visibility Action Centre ─────────────────────────── */}
        <section>
          <h2 className="text-2xl font-serif font-bold text-neutral-900 mb-1">
            Visibility Action Centre
          </h2>
          <p className="text-neutral-500 text-sm mb-8">
            Platform-wide checklist for maximising ESUT's search engine and global indexing presence.
          </p>

          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider w-36">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider w-28 hidden sm:table-cell">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIONS.map((action) => (
                    <tr key={action.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{action.id}</td>
                      <td className="px-4 py-3 text-neutral-800 font-medium">{action.label}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={actions[action.id] ?? 'not_started'} />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <ImpactBadge impact={action.impact} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
