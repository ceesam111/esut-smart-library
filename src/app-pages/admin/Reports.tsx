import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhysicalData {
  building_sqm: number;
  seating_capacity: number;
  computer_terminals: number;
  reading_rooms: number;
  group_study_rooms: number;
  internet_speed_mbps: number;
}

interface LiveStats {
  total_catalogue: number;
  total_repo: number;
  total_patrons: number;
  total_loans_year: number;
  total_ill_year: number;
  total_theses: number;
  total_events: number;
  professional_librarians: number;
}

interface OperationalFilter {
  from: string;
  to: string;
  report: string;
}

const DEFAULT_PHYSICAL: PhysicalData = {
  building_sqm: 450,
  seating_capacity: 120,
  computer_terminals: 25,
  reading_rooms: 3,
  group_study_rooms: 5,
  internet_speed_mbps: 100,
};

const TABS = ['NUC Compliance', 'Annual Returns', 'Operational Reports'] as const;
type Tab = (typeof TABS)[number];

// ─── NUC Compliance Row ────────────────────────────────────────────────────────

function statusOf(current: number, benchmark: number): 'met' | 'partial' | 'unmet' {
  if (current >= benchmark) return 'met';
  if (current >= benchmark * 0.8) return 'partial';
  return 'unmet';
}

function Badge({ status }: { status: 'met' | 'partial' | 'unmet' }) {
  const cls =
    status === 'met'
      ? 'bg-green-100 text-green-700'
      : status === 'partial'
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  const label = status === 'met' ? 'Met' : status === 'partial' ? 'Partial' : 'Unmet';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [tab, setTab] = useState<Tab>('NUC Compliance');
  const [physical, setPhysical] = useState<PhysicalData>(DEFAULT_PHYSICAL);
  const [physicalDirty, setPhysicalDirty] = useState(false);
  const [savingPhysical, setSavingPhysical] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [scheduleMonthly, setScheduleMonthly] = useState(true);
  const [opFilter, setOpFilter] = useState<OperationalFilter>({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    report: 'circulation',
  });
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null);

  // Load saved physical snapshot + live stats
  useEffect(() => {
    const load = async () => {
      // Saved physical data
      const { data: snapshot } = await supabase
        .from('report_snapshots')
        .select('data')
        .eq('section', 'physical_infrastructure')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapshot?.data) setPhysical({ ...DEFAULT_PHYSICAL, ...snapshot.data });

      // Live stats from DB
      const [
        catalogue,
        repo,
        patrons,
        loansYear,
        illYear,
        theses,
        events,
      ] = await Promise.all([
        supabase.from('catalogue_items').select('id', { count: 'exact', head: true }),
        supabase.from('repository_items').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('patrons').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('loans').select('id', { count: 'exact', head: true })
          .gte('loan_date', new Date(new Date().getFullYear(), 0, 1).toISOString()),
        supabase.from('ill_requests').select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString()),
        supabase.from('theses').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .gte('start_at', new Date(new Date().getFullYear(), 0, 1).toISOString()),
      ]);

      setLiveStats({
        total_catalogue: catalogue.count ?? 0,
        total_repo: repo.count ?? 0,
        total_patrons: patrons.count ?? 0,
        total_loans_year: loansYear.count ?? 0,
        total_ill_year: illYear.count ?? 0,
        total_theses: theses.count ?? 0,
        total_events: events.count ?? 0,
        professional_librarians: institutionConfig.totalStaff || 8,
      });
      setLoadingStats(false);
    };
    load();
  }, []);

  const savePhysical = async () => {
    setSavingPhysical(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('report_snapshots').insert({
      section: 'physical_infrastructure',
      data: physical,
      recorded_by: user?.id,
    });
    setSavingPhysical(false);
    setPhysicalDirty(false);
  };

  const updatePhysical = (key: keyof PhysicalData, val: number) => {
    setPhysical((p) => ({ ...p, [key]: val }));
    setPhysicalDirty(true);
  };

  const enrolment = institutionConfig.totalEnrolment || 10000;
  const patronRatio = liveStats ? Math.round(enrolment / Math.max(liveStats.professional_librarians, 1)) : 0;

  // NUC minimum benchmarks
  const nucSections = liveStats
    ? [
        {
          title: 'Section A: Physical Library Infrastructure',
          note: 'Manual figures — update and save below.',
          rows: [
            { metric: 'Library Floor Space', current: physical.building_sqm, benchmark: 400, unit: 'sq. metres', note: '' },
            { metric: 'Seating Capacity', current: physical.seating_capacity, benchmark: 100, unit: 'seats', note: 'NUC min 1 seat per 10 students' },
            { metric: 'Computer Terminals', current: physical.computer_terminals, benchmark: 30, unit: 'units', note: '' },
            { metric: 'Reading Rooms', current: physical.reading_rooms, benchmark: 2, unit: 'rooms', note: '' },
            { metric: 'Group Study Rooms', current: physical.group_study_rooms, benchmark: 3, unit: 'rooms', note: '' },
            { metric: 'Internet Speed', current: physical.internet_speed_mbps, benchmark: 50, unit: 'Mbps', note: '' },
          ],
        },
        {
          title: 'Section B: Collections',
          note: 'Auto-computed from catalogue.',
          rows: [
            { metric: 'Total Catalogued Items', current: liveStats.total_catalogue, benchmark: 12000, unit: 'volumes', note: 'NUC BMAS Section 5' },
            { metric: 'Digital Repository Items (Published)', current: liveStats.total_repo, benchmark: 2000, unit: 'items', note: '' },
            { metric: 'Thesis Records', current: liveStats.total_theses, benchmark: 500, unit: 'records', note: '' },
          ],
        },
        {
          title: 'Section C: Digital Services',
          note: 'Auto-computed from system records.',
          rows: [
            { metric: 'Active Patrons', current: liveStats.total_patrons, benchmark: Math.round(enrolment * 0.6), unit: 'patrons', note: 'Target: 60% of enrolment registered' },
            { metric: 'Loans Issued (This Year)', current: liveStats.total_loans_year, benchmark: 5000, unit: 'loans', note: '' },
            { metric: 'ILL Requests (This Year)', current: liveStats.total_ill_year, benchmark: 200, unit: 'requests', note: '' },
            { metric: 'Library Events (This Year)', current: liveStats.total_events, benchmark: 12, unit: 'events', note: '' },
          ],
        },
        {
          title: 'Section D: Staff Establishment',
          note: 'Update staff count in institution config.',
          rows: [
            { metric: 'Professional Librarians', current: liveStats.professional_librarians, benchmark: 5, unit: 'staff', note: 'NUC minimum 5 professionals' },
            { metric: 'Librarian-to-Student Ratio', current: patronRatio, benchmark: 500, unit: ':1 (lower is better)', note: 'NUC benchmark ≤500:1', invert: true },
          ],
        },
      ]
    : [];

  const allRows = nucSections.flatMap((s) => s.rows);
  const metCount = allRows.filter((r) =>
    (r as { invert?: boolean }).invert ? r.current <= r.benchmark : statusOf(r.current, r.benchmark) === 'met'
  ).length;
  const compliancePct = allRows.length ? Math.round((metCount / allRows.length) * 100) : 0;

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => `"${row[h] ?? ''}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportNUCReport = () => {
    const rows = nucSections.flatMap((s) =>
      s.rows.map((r) => ({
        Section: s.title,
        Metric: r.metric,
        'Current Value': r.current,
        Benchmark: r.benchmark,
        Unit: r.unit,
        Status: (r as { invert?: boolean }).invert
          ? r.current <= r.benchmark ? 'Met' : 'Unmet'
          : statusOf(r.current, r.benchmark),
      }))
    );
    exportCSV(rows, `NUC_Compliance_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const annualReturnStats = liveStats ? [
    { label: 'Total Enrolment', value: (institutionConfig.totalEnrolment || 0).toLocaleString(), sub: 'Students registered', detail: 'Entered in institution configuration. Update totalEnrolment when Registry releases the approved enrolment figure.' },
    { label: 'Registered Patrons', value: liveStats.total_patrons.toLocaleString(), sub: 'Active library accounts', detail: 'Generated from active patrons. Use Admin > Patrons or Patrons CSV Import to add staff/students; withdrawn, graduated, retired, or disengaged patrons are excluded from active use.' },
    { label: 'Catalogue Holdings', value: liveStats.total_catalogue.toLocaleString(), sub: 'Total catalogued items', detail: 'Generated from catalogue_items. Use Catalogue > Add New, CSV Import, Copy Cataloguing, or Catalogue Staging to add books, journals, articles, projects, dissertations, theses, and e-resources.' },
    { label: 'Loans Issued (YTD)', value: liveStats.total_loans_year.toLocaleString(), sub: 'Circulations this year', detail: 'Generated from loan transactions for the current calendar year.' },
    { label: 'ILL Requests (YTD)', value: liveStats.total_ill_year.toLocaleString(), sub: 'Interlibrary loans', detail: 'Generated from interlibrary loan requests created this year. Use Admin > ILL to update request status.' },
    { label: 'Repository Items', value: liveStats.total_repo.toLocaleString(), sub: 'Published open-access items', detail: 'Generated from published repository items. Use Admin > Repository for uploads, review, and publication.' },
    { label: 'Thesis Records', value: liveStats.total_theses.toLocaleString(), sub: 'All thesis records', detail: 'Generated from thesis submissions and thesis records.' },
    { label: 'Events (YTD)', value: liveStats.total_events.toLocaleString(), sub: 'Library events held', detail: 'Generated from events with start dates in the current year. Use Admin > Events to create and manage events.' },
    { label: 'Professional Staff', value: liveStats.professional_librarians.toString(), sub: 'Qualified librarians', detail: 'Entered in institution configuration as totalStaff. Update when staff establishment changes.' },
  ] : [];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Reporting Centre</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {institutionConfig.regulatoryBody} &bull; Academic Session {institutionConfig.currentSession}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportNUCReport} className="btn-outline text-sm px-4 py-2">
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── NUC Compliance Tab ── */}
      {tab === 'NUC Compliance' && (
        <div className="space-y-6">
          {/* Monthly schedule toggle */}
          <div className="card bg-white rounded-xl border border-neutral-200 p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-neutral-900 text-sm">Monthly NUC Report Delivery</div>
              <div className="text-xs text-neutral-500 mt-0.5">Auto-generate and email this report at month end</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={scheduleMonthly} onChange={(e) => setScheduleMonthly(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-neutral-200 rounded-full peer peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-neutral-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          {/* Compliance summary */}
          <div className={`rounded-xl p-6 border ${compliancePct >= 80 ? 'bg-green-50 border-green-200' : compliancePct >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="text-xs text-neutral-500 mb-1">Overall NUC Compliance</div>
                <div className={`text-4xl font-bold ${compliancePct >= 80 ? 'text-green-700' : compliancePct >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                  {compliancePct}%
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Metrics Met</div>
                <div className="text-2xl font-bold text-neutral-900">{metCount} / {allRows.length}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Last Snapshot</div>
                <div className="text-sm font-semibold text-neutral-900">{new Date().toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Next Review</div>
                <div className="text-sm font-semibold text-neutral-900">30 days</div>
              </div>
            </div>
          </div>

          {loadingStats ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
            </div>
          ) : (
            nucSections.map((section, si) => (
              <div key={si} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
                  <div className="font-semibold text-neutral-900">{section.title}</div>
                  {section.note && <div className="text-xs text-neutral-500 mt-0.5">{section.note}</div>}
                </div>

                {/* Physical inputs */}
                {si === 0 && (
                  <div className="px-6 py-5 grid sm:grid-cols-3 gap-4 border-b border-neutral-100">
                    {(Object.keys(physical) as (keyof PhysicalData)[]).map((key) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-neutral-500 block mb-1 capitalize">
                          {key.replace(/_/g, ' ')}
                        </label>
                        <input
                          type="number"
                          value={physical[key]}
                          onChange={(e) => updatePhysical(key, Number(e.target.value))}
                          className="input text-sm py-1.5"
                          min={0}
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-3 flex items-center gap-3">
                      <button
                        onClick={savePhysical}
                        disabled={!physicalDirty || savingPhysical}
                        className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
                      >
                        {savingPhysical ? 'Saving…' : 'Save Snapshot'}
                      </button>
                      {!physicalDirty && <span className="text-xs text-green-600">Saved</span>}
                    </div>
                  </div>
                )}

                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-neutral-700">Metric</th>
                      <th className="text-left p-3 font-semibold text-neutral-700">Current</th>
                      <th className="text-left p-3 font-semibold text-neutral-700">NUC Benchmark</th>
                      <th className="text-left p-3 font-semibold text-neutral-700">Unit</th>
                      <th className="text-left p-3 font-semibold text-neutral-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, ri) => {
                      const inv = (row as { invert?: boolean }).invert;
                      const status = inv
                        ? row.current <= row.benchmark ? 'met' : row.current <= row.benchmark * 1.2 ? 'partial' : 'unmet'
                        : statusOf(row.current, row.benchmark);
                      return (
                        <tr key={ri} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="p-3 font-medium text-neutral-800">
                            {row.metric}
                            {row.note && <div className="text-xs text-neutral-400 font-normal">{row.note}</div>}
                          </td>
                          <td className="p-3 font-semibold text-neutral-900">{row.current.toLocaleString()}</td>
                          <td className="p-3 text-neutral-600">{row.benchmark.toLocaleString()}</td>
                          <td className="p-3 text-neutral-500 text-xs">{row.unit}</td>
                          <td className="p-3"><Badge status={status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100 flex gap-4 text-xs">
                  {(['met', 'partial', 'unmet'] as const).map((s) => {
                    const count = section.rows.filter((r) => {
                      const inv = (r as { invert?: boolean }).invert;
                      const st = inv
                        ? r.current <= r.benchmark ? 'met' : r.current <= r.benchmark * 1.2 ? 'partial' : 'unmet'
                        : statusOf(r.current, r.benchmark);
                      return st === s;
                    }).length;
                    const cls = s === 'met' ? 'text-green-600' : s === 'partial' ? 'text-yellow-600' : 'text-red-600';
                    return count > 0 ? (
                      <span key={s} className={cls}>{count} {s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    ) : null;
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Annual Returns Tab ── */}
      {tab === 'Annual Returns' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-6">
              Annual Returns — Governing Council Format
            </h2>
            <p className="text-sm text-neutral-500 mb-6">
              Internal governing council report. Click any return card to view what records make up the figure and where to enter or edit source data.
            </p>
            {liveStats ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {annualReturnStats.map((stat) => (
                  <button key={stat.label} onClick={() => setExpandedReturn(expandedReturn === stat.label ? null : stat.label)} className="text-left bg-neutral-50 rounded-lg p-4 border border-neutral-100 hover:border-primary-300">
                    <div className="text-xs text-neutral-500 mb-1">{stat.label}</div>
                    <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                    <div className="text-xs text-neutral-400 mt-1">{stat.sub}</div>
                    {expandedReturn === stat.label && <div className="mt-3 rounded-lg bg-white border border-neutral-200 p-3 text-xs text-neutral-600 leading-relaxed">{stat.detail}</div>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => liveStats && exportCSV([
                { Metric: 'Total Enrolment', Value: institutionConfig.totalEnrolment || 0 },
                { Metric: 'Registered Patrons', Value: liveStats.total_patrons },
                { Metric: 'Catalogue Holdings', Value: liveStats.total_catalogue },
                { Metric: 'Loans Issued YTD', Value: liveStats.total_loans_year },
                { Metric: 'ILL Requests YTD', Value: liveStats.total_ill_year },
                { Metric: 'Repository Items', Value: liveStats.total_repo },
                { Metric: 'Thesis Records', Value: liveStats.total_theses },
                { Metric: 'Events YTD', Value: liveStats.total_events },
                { Metric: 'Professional Librarians', Value: liveStats.professional_librarians },
              ], `Annual_Returns_${new Date().getFullYear()}.csv`)}
              className="btn-outline text-sm px-5 py-2"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* ── Operational Reports Tab ── */}
      {tab === 'Operational Reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">Operational Reports</h2>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="label text-xs">Report Type</label>
                <select
                  value={opFilter.report}
                  onChange={(e) => setOpFilter((f) => ({ ...f, report: e.target.value }))}
                  className="input text-sm"
                >
                  <option value="circulation">Circulation</option>
                  <option value="patron_analytics">Patron Analytics</option>
                  <option value="repository_usage">Repository Usage</option>
                  <option value="course_reserves">Course Reserves</option>
                  <option value="nuc_project_pipeline">NUC Project Pipeline</option>
                  <option value="ai_librarian">AI Reference Librarian</option>
                  <option value="acquisitions">Acquisitions</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">From</label>
                <input
                  type="date"
                  value={opFilter.from}
                  onChange={(e) => setOpFilter((f) => ({ ...f, from: e.target.value }))}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="label text-xs">To</label>
                <input
                  type="date"
                  value={opFilter.to}
                  onChange={(e) => setOpFilter((f) => ({ ...f, to: e.target.value }))}
                  className="input text-sm"
                />
              </div>
            </div>

            <div className="border border-neutral-200 rounded-lg p-8 text-center text-neutral-400">
              <div className="text-4xl mb-3">📊</div>
              <div className="font-medium text-neutral-600 mb-1">
                {opFilter.report.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Report
              </div>
              <div className="text-sm">
                {opFilter.from} → {opFilter.to}
              </div>
              <div className="mt-4 text-xs text-neutral-400">
                Connect a business intelligence tool to the Supabase read replica for full operational dashboards,
                or use the CSV export from the relevant admin section.
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <a
                href={`/admin/${opFilter.report === 'circulation' ? 'catalogue' : opFilter.report === 'nuc_project_pipeline' ? 'repository' : opFilter.report === 'ai_librarian' ? 'content-engine' : opFilter.report}`}
                className="btn-outline text-sm px-5 py-2"
              >
                Open {opFilter.report.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Manager
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
