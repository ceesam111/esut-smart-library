import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { institutionConfig } from '@config/institution.config';
import { supabase } from '@/lib/supabase';

interface KPI {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  link: string;
}

interface FineSummary { count: number; amount: number }

interface RecentItem {
  label: string;
  meta: string;
  at: string;
  badge: string;
  badgeColor: string;
}

interface BranchStats {
  catalogue: number;
  available: number;
  loans: number;
  patrons: number;
  reservations: number;
}

interface CirculationRules {
  reservation_expiry_days: number;
  undergraduate_loan_days: number;
  postgraduate_loan_days: number;
  academic_staff_loan_days: number;
  non_academic_staff_loan_days: number;
  default_loan_days: number;
  fine_rate_per_day: number;
  fine_grace_days: number;
  fine_max_amount: number;
  fines_suspended: boolean;
}

const QUICK_ACTIONS = [
  { label: 'Add Catalog Item',         href: '/admin/catalog/add',    icon: '📖' },
  { label: 'Deposit to Repository',    href: '/admin/ir/deposit',     icon: '⬆️' },
  { label: 'Process IR Queue',         href: '/admin/repository',     icon: '📂' },
  { label: 'Circulation Desk',         href: '/admin/circulation',    icon: '🔄' },
  { label: 'View Analytics',           href: '/admin/analytics',      icon: '📈' },
  { label: 'Generate Reports',         href: '/admin/reports',        icon: '📊' },
  { label: 'Manage Patrons',           href: '/admin/patrons',        icon: '👥' },
  { label: 'Configure Calendar',       href: '/admin/calendar',       icon: '📅' },
  { label: 'Content Engine',           href: '/admin/content-engine', icon: '🤖' },
];

export default function Admin() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const branchOptions = [
    { label: institutionConfig.libraryMode === 'multi' ? 'All Branches' : 'All', slug: 'all', code: 'all' },
    { label: institutionConfig.mainLibrary.name, slug: institutionConfig.mainLibrary.slug, code: institutionConfig.mainLibrary.code },
    ...(institutionConfig.libraryMode === 'multi' ? institutionConfig.branchLibraries.map((b) => ({ label: b.name, slug: b.slug, code: b.code })) : []),
    ...institutionConfig.facultyLibraries.map((b) => ({ label: b.name, slug: b.slug, code: b.code })),
  ];
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branchStats, setBranchStats] = useState<BranchStats>({ catalogue: 0, available: 0, loans: 0, patrons: 0, reservations: 0 });
  const [rules, setRules] = useState<CirculationRules>({ reservation_expiry_days: 7, undergraduate_loan_days: 14, postgraduate_loan_days: 30, academic_staff_loan_days: 90, non_academic_staff_loan_days: 21, default_loan_days: 14, fine_rate_per_day: 50, fine_grace_days: 0, fine_max_amount: 0, fines_suspended: false });
  const [rulesMsg, setRulesMsg] = useState('');
  const [fineSummary, setFineSummary] = useState<FineSummary>({ count: 0, amount: 0 });

  useEffect(() => { load(); }, []);
  useEffect(() => { loadBranchStats(selectedBranch); }, [selectedBranch]);

  async function load() {
    try {
      const [
        { count: items },
        { count: patrons },
        { count: pendingRepo },
        { count: pendingRequests },
        { count: pendingResearchers },
        { count: theses },
        repoRows,
        patronRows,
        requestRows,
        settingsRow,
        finesRows,
      ] = await Promise.all([
        supabase.from('catalogue_items').select('*', { count: 'exact', head: true }),
        supabase.from('patrons').select('*', { count: 'exact', head: true }),
        supabase.from('repository_items').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('resource_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('researchers').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('repository_items').select('*', { count: 'exact', head: true })
          .in('item_type', ['Undergraduate Long Essay', 'Final Year Project', 'Thesis'])
          .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString()),
        supabase.from('repository_items').select('id, title, created_at, status').order('created_at', { ascending: false }).limit(4),
        supabase.from('patrons').select('id, full_name, created_at, category').order('created_at', { ascending: false }).limit(3),
        supabase.from('resource_requests').select('id, title, created_at').order('created_at', { ascending: false }).limit(3),
        supabase.from('app_settings').select('value').eq('key', 'circulation_rules').maybeSingle(),
        supabase.from('fines').select('amount').eq('status', 'unpaid'),
      ]);

      const settingsValue = settingsRow.data?.value as Partial<CirculationRules> | undefined;
      if (settingsValue) setRules((prev) => ({ ...prev, ...settingsValue }));

      setKpis([
        { label: 'Catalogue Items',    value: (items ?? 0).toLocaleString(),   icon: '📚', color: '#6B1D2A', link: '/admin/catalogue' },
        { label: 'Registered Patrons', value: (patrons ?? 0).toLocaleString(), icon: '👥', color: '#005F73', link: '/admin/patrons' },
        { label: 'Pending Repository', value: pendingRepo ?? 0,                icon: '📂', color: (pendingRepo ?? 0) > 0 ? '#B5451B' : '#2D6A4F', link: '/admin/repository' },
        { label: 'Pending Requests',   value: pendingRequests ?? 0,            icon: '📩', color: (pendingRequests ?? 0) > 0 ? '#B5451B' : '#2D6A4F', link: '/admin/ill' },
        { label: 'Pending Researchers',value: pendingResearchers ?? 0,         icon: '🔬', color: (pendingResearchers ?? 0) > 0 ? '#B5451B' : '#2D6A4F', link: '/admin/researchers' },
        { label: 'Theses This Year',   value: (theses ?? 0).toLocaleString(),  icon: '🎓', color: '#1F4E79', link: '/admin/theses' },
      ]);
      const fineAmount = (finesRows.data ?? []).reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0);
      setFineSummary({ count: finesRows.data?.length ?? 0, amount: fineAmount });

      const allRecent: RecentItem[] = [
        ...((repoRows.data ?? []).map(r => ({
          label: r.title ?? 'Untitled submission',
          meta: 'Repository submission',
          at: r.created_at,
          badge: r.status === 'submitted' ? 'Pending' : r.status,
          badgeColor: r.status === 'submitted' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700',
        }))),
        ...((patronRows.data ?? []).map(r => ({
          label: r.full_name ?? 'New patron',
          meta: `New patron — ${r.category ?? 'patron'}`,
          at: r.created_at,
          badge: 'New',
          badgeColor: 'bg-blue-100 text-blue-700',
        }))),
        ...((requestRows.data ?? []).map(r => ({
          label: r.title ?? 'Resource request',
          meta: 'Resource request',
          at: r.created_at,
          badge: 'Request',
          badgeColor: 'bg-purple-100 text-purple-700',
        }))),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);

      setRecent(allRecent);
      await loadBranchStats(selectedBranch);
    } catch (err) {
      console.error('Admin dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBranchStats(branch: string) {
    const option = branchOptions.find((b) => b.slug === branch) ?? branchOptions[0];
    const catalogueQuery = supabase.from('catalogue_items').select('id, available_copies', { count: 'exact' });
    if (option.slug !== 'all') catalogueQuery.or(`library_slug.eq.${option.slug},library_code.eq.${option.code},branch_origin.eq.${option.code}`);
    const catalogue = await catalogueQuery;
    const itemIds = (catalogue.data ?? []).map((row: any) => row.id);
    const available = (catalogue.data ?? []).reduce((sum: number, row: any) => sum + (Number(row.available_copies) || 0), 0);
    const [loans, reservations, patrons] = await Promise.all([
      itemIds.length ? supabase.from('loans').select('id', { count: 'exact', head: true }).in('catalogue_item_id', itemIds).eq('status', 'active') : Promise.resolve({ count: 0 }),
      itemIds.length ? supabase.from('reservations').select('id', { count: 'exact', head: true }).in('catalogue_item_id', itemIds).in('status', ['pending', 'ready_for_collection']) : Promise.resolve({ count: 0 }),
      option.slug === 'all'
        ? supabase.from('patrons').select('id', { count: 'exact', head: true }).eq('status', 'active')
        : supabase.from('patrons').select('id', { count: 'exact', head: true }).or(`preferred_branch.ilike.%${option.label}%,faculty_code.eq.${option.code}`).eq('status', 'active'),
    ]);
    setBranchStats({ catalogue: catalogue.count ?? 0, available, loans: loans.count ?? 0, reservations: reservations.count ?? 0, patrons: patrons.count ?? 0 });
  }

  async function saveRules() {
    setRulesMsg('Saving...');
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'circulation_rules', value: rules, description: 'Editable circulation rules for reservation expiry and loan periods.', updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setRulesMsg(error ? error.message : 'Rules saved.');
    if (!error) setTimeout(() => setRulesMsg(''), 3000);
  }

  const fmt = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.round((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900">
          {institutionConfig.shortName} Library — Admin Dashboard
        </h1>
        <p className="text-neutral-500 mt-1 text-sm">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.link}
            className="bg-white rounded-2xl border border-neutral-200 p-5 text-center hover:shadow-md transition-all group"
          >
            <div className="text-2xl mb-1">{k.icon}</div>
            <div className="text-2xl font-bold group-hover:opacity-80 transition-opacity" style={{ color: k.color }}>
              {k.value}
            </div>
            <div className="text-xs text-neutral-500 mt-1 leading-tight">{k.label}</div>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-red-800">Fine Monitor</h2>
            <p className="text-sm text-red-700/80">Auto-calculated overdue fines from return/check-in workflows.</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm"><div className="text-2xl font-bold text-red-700">{fineSummary.count}</div><div className="text-xs text-red-500">Unpaid fines</div></div>
            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm"><div className="text-2xl font-bold text-red-700">₦{fineSummary.amount.toLocaleString()}</div><div className="text-xs text-red-500">Outstanding</div></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-800">{institutionConfig.libraryMode === 'multi' ? 'Branch Analytics' : 'Library Analytics'}</h2>
              <p className="text-xs text-neutral-500 mt-1">Complete {institutionConfig.libraryMode === 'multi' ? 'branch-level' : ''} detail for collections, patrons, circulation, and pending requests.</p>
            </div>
            <select className="input text-sm sm:w-64" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
              {branchOptions.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ['Catalogue', branchStats.catalogue],
              ['Available', branchStats.available],
              ['Active Loans', branchStats.loans],
              ['Active Patrons', branchStats.patrons],
              ['Open Requests', branchStats.reservations],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-primary-50 p-4 text-center">
                <div className="text-xl font-bold text-primary-800">{Number(value).toLocaleString()}</div>
                <div className="mt-1 text-[11px] font-medium text-primary-700/70">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-neutral-800">Circulation Rules</h2>
            <p className="text-xs text-neutral-500 mt-1">Editable by admin, super admin, and librarians. Reservation expiry defaults to 1 week.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(rules).map(([key, value]) => (
              <label key={key} className="text-xs font-semibold text-neutral-500">
                {key.replace(/_/g, ' ')}
                {typeof value === 'boolean' ? (
                  <select className="input mt-1 text-sm" value={value ? 'true' : 'false'} onChange={(e) => setRules((prev) => ({ ...prev, [key]: e.target.value === 'true' }))}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                ) : (
                  <input type="number" min={key === 'fine_max_amount' || key === 'fine_grace_days' ? 0 : 1} className="input mt-1 text-sm" value={value} onChange={(e) => setRules((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))} />
                )}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveRules} className="btn-primary text-sm">Save Rules</button>
            {rulesMsg && <span className="text-xs text-neutral-500">{rulesMsg}</span>}
          </div>
        </section>
      </div>

      {/* Quick actions + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Quick actions */}
        <div>
          <h2 className="text-base font-bold text-neutral-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                to={a.href}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-sm transition-all group"
              >
                <span className="text-xl">{a.icon}</span>
                <span className="text-xs font-semibold text-neutral-700 group-hover:text-primary-700 transition-colors leading-tight">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-base font-bold text-neutral-800 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-400">No recent activity yet.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {recent.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{item.label}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{item.meta}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                      <span className="text-xs text-neutral-400">{fmt(item.at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System status */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h2 className="text-base font-bold text-neutral-800 mb-4">System Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Database',       status: 'Healthy' },
            { label: 'API Services',   status: 'Operational' },
            { label: 'Authentication', status: 'Active' },
            { label: 'Edge Functions', status: 'Running' },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <span className="text-xs font-medium text-neutral-700">{s.label}</span>
              <span className="text-xs font-bold text-green-700">{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
