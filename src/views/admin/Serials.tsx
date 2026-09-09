import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { format, addDays, addWeeks, addMonths, addQuarters, addYears, isPast, isWithinInterval, addDays as dateFnsAddDays } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string; name: string;
}

interface Subscription {
  id: string; title: string; publisher: string; issn: string; issn_online: string;
  frequency: string; start_date: string; renewal_date: string; cost_per_year: number;
  currency: string; supplier_id: string; faculty_code: string; location: string;
  call_number: string; status: string; notes: string;
  acquisition_suppliers?: { name: string };
}

interface Issue {
  id: string; subscription_id: string; volume: string; issue_number: string;
  predicted_date: string; actual_arrival_date: string; status: string;
  notes: string; claim_sent_at: string; created_at: string;
  serials_subscriptions?: { title: string };
}

interface RoutingEntry {
  id: string; subscription_id: string; issue_id: string; patron_name: string;
  patron_email: string; sequence_order: number; routed_at: string; returned_at: string;
}

type Tab = 'subscriptions' | 'tracker' | 'routing' | 'missing';

const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual', 'irregular'];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success-100 text-success-700',
  suspended: 'bg-warning-100 text-warning-700',
  cancelled: 'bg-error-100 text-error-600',
  pending: 'bg-neutral-100 text-neutral-600',
  expected: 'bg-primary-50 text-primary-700',
  received: 'bg-success-100 text-success-700',
  missing: 'bg-error-100 text-error-600',
  claimed: 'bg-warning-100 text-warning-700',
  never_published: 'bg-neutral-100 text-neutral-500',
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  try { return format(new Date(s), 'dd MMM yyyy'); } catch { return s; }
}

function fmtMoney(n: number, currency = 'NGN') {
  return `${currency} ${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${className ?? 'bg-neutral-100 text-neutral-600'}`}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function nextIssueDates(frequency: string, fromDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  let current = fromDate;
  for (let i = 0; i < count; i++) {
    switch (frequency) {
      case 'daily':      current = addDays(current, 1); break;
      case 'weekly':     current = addWeeks(current, 1); break;
      case 'fortnightly':current = addWeeks(current, 2); break;
      case 'monthly':    current = addMonths(current, 1); break;
      case 'bimonthly':  current = addMonths(current, 2); break;
      case 'quarterly':  current = addQuarters(current, 1); break;
      case 'semiannual': current = addMonths(current, 6); break;
      case 'annual':     current = addYears(current, 1); break;
      default:           current = addMonths(current, 1);
    }
    dates.push(current);
  }
  return dates;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Serials() {
  const [tab, setTab] = useState<Tab>('subscriptions');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'tracker',       label: 'Issue Tracker' },
    { id: 'routing',       label: 'Routing Lists' },
    { id: 'missing',       label: 'Missing Issues' },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Serials Management</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Manage journal subscriptions, track issues, route periodicals and claim missing items
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-neutral-200 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? 'border-primary-700 text-primary-700 bg-primary-50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'subscriptions' && <SubscriptionsTab />}
          {tab === 'tracker'       && <IssueTrackerTab />}
          {tab === 'routing'       && <RoutingTab />}
          {tab === 'missing'       && <MissingIssuesTab />}
        </div>
      </div>
    </div>
  );
}

// ── Subscriptions Tab ─────────────────────────────────────────────────────────
function SubscriptionsTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');

  const blank = {
    title: '', publisher: '', issn: '', issn_online: '', frequency: 'monthly',
    start_date: '', renewal_date: '', cost_per_year: '', currency: 'NGN',
    supplier_id: '', faculty_code: '', location: '', call_number: '', status: 'active', notes: '',
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('serials_subscriptions')
      .select('*, acquisition_suppliers(name)')
      .order('title');
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const [{ data: s }, { data: sup }] = await Promise.all([
      q,
      supabase.from('acquisition_suppliers').select('id, name').eq('is_active', true).order('name'),
    ]);
    setSubs(s ?? []);
    setSuppliers(sup ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(blank); setShowForm(true); };
  const openEdit = (s: Subscription) => {
    setEditing(s);
    setForm({
      title: s.title, publisher: s.publisher ?? '', issn: s.issn ?? '',
      issn_online: s.issn_online ?? '', frequency: s.frequency,
      start_date: s.start_date ?? '', renewal_date: s.renewal_date ?? '',
      cost_per_year: String(s.cost_per_year), currency: s.currency,
      supplier_id: s.supplier_id ?? '', faculty_code: s.faculty_code ?? '',
      location: s.location ?? '', call_number: s.call_number ?? '',
      status: s.status, notes: s.notes ?? '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title, publisher: form.publisher || null, issn: form.issn || null,
      issn_online: form.issn_online || null, frequency: form.frequency,
      start_date: form.start_date || null, renewal_date: form.renewal_date || null,
      cost_per_year: +form.cost_per_year || 0, currency: form.currency,
      supplier_id: form.supplier_id || null, faculty_code: form.faculty_code || null,
      location: form.location || null, call_number: form.call_number || null,
      status: form.status, notes: form.notes || null,
    };
    if (editing) {
      await supabase.from('serials_subscriptions')
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('serials_subscriptions').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const renewalWarning = (date: string | null) => {
    if (!date) return false;
    try {
      const d = new Date(date);
      return isWithinInterval(d, { start: new Date(), end: dateFnsAddDays(new Date(), 60) });
    } catch { return false; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5">
          {['all', 'active', 'suspended', 'cancelled', 'pending'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={openNew} className="btn-primary text-sm">Add Subscription</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : subs.length === 0 ? (
        <EmptyState message="No subscriptions found" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left p-3 font-semibold text-neutral-700">Title</th>
                <th className="text-left p-3 font-semibold text-neutral-700">ISSN</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Frequency</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Renewal</th>
                <th className="text-right p-3 font-semibold text-neutral-700">Annual Cost</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3">
                    <p className="font-medium text-neutral-800 line-clamp-1">{s.title}</p>
                    {s.publisher && <p className="text-xs text-neutral-500">{s.publisher}</p>}
                    {s.faculty_code && <p className="text-xs text-neutral-400">{s.faculty_code}</p>}
                  </td>
                  <td className="p-3 font-mono text-xs text-neutral-600">{s.issn || '—'}</td>
                  <td className="p-3 text-neutral-600 capitalize">{s.frequency}</td>
                  <td className="p-3">
                    <span className={`text-sm ${renewalWarning(s.renewal_date) ? 'text-warning-700 font-semibold' : 'text-neutral-600'}`}>
                      {fmtDate(s.renewal_date)}
                    </span>
                    {renewalWarning(s.renewal_date) && (
                      <p className="text-xs text-warning-600 font-medium">Renewing soon</p>
                    )}
                  </td>
                  <td className="p-3 text-right font-medium text-neutral-800">
                    {fmtMoney(s.cost_per_year, s.currency)}
                  </td>
                  <td className="p-3"><Badge label={s.status} className={STATUS_COLORS[s.status]} /></td>
                  <td className="p-3">
                    <button onClick={() => openEdit(s)} className="text-xs text-primary-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Subscription' : 'Add Subscription'} onClose={() => setShowForm(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Title <span className="text-error-500">*</span></label>
                <input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Publisher</label>
                <input className="input" value={form.publisher} onChange={(e) => setForm((p) => ({ ...p, publisher: e.target.value }))} />
              </div>
              <div>
                <label className="label">Supplier</label>
                <select className="input" value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">None</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Print ISSN</label>
                <input className="input font-mono" value={form.issn} onChange={(e) => setForm((p) => ({ ...p, issn: e.target.value }))} placeholder="XXXX-XXXX" />
              </div>
              <div>
                <label className="label">Online ISSN</label>
                <input className="input font-mono" value={form.issn_online} onChange={(e) => setForm((p) => ({ ...p, issn_online: e.target.value }))} placeholder="XXXX-XXXX" />
              </div>
              <div>
                <label className="label">Frequency</label>
                <select className="input capitalize" value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Faculty / Collection</label>
                <select className="input" value={form.faculty_code} onChange={(e) => setForm((p) => ({ ...p, faculty_code: e.target.value }))}>
                  <option value="">General</option>
                  {institutionConfig.faculties.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Renewal Date</label>
                <input type="date" className="input" value={form.renewal_date} onChange={(e) => setForm((p) => ({ ...p, renewal_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Annual Cost (NGN)</label>
                <input type="number" className="input" min={0} step={100} value={form.cost_per_year}
                  onChange={(e) => setForm((p) => ({ ...p, cost_per_year: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input capitalize" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {['active', 'pending', 'suspended', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location / Shelf</label>
                <input className="input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div>
                <label className="label">Call Number</label>
                <input className="input font-mono" value={form.call_number} onChange={(e) => setForm((p) => ({ ...p, call_number: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={save} disabled={saving || !form.title.trim()}
                className="btn-primary flex-1 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Subscription'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Issue Tracker Tab ─────────────────────────────────────────────────────────
function IssueTrackerTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [issues, setIssues] = useState<Record<string, Issue[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newIssue, setNewIssue] = useState({
    volume: '', issue_number: '', predicted_date: '', actual_arrival_date: '', status: 'expected',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: i }] = await Promise.all([
      supabase.from('serials_subscriptions').select('*').eq('status', 'active').order('title'),
      supabase.from('serials_issues').select('*').order('predicted_date', { ascending: false }),
    ]);
    setSubs(s ?? []);
    const map: Record<string, Issue[]> = {};
    (i ?? []).forEach((issue) => {
      if (!map[issue.subscription_id]) map[issue.subscription_id] = [];
      map[issue.subscription_id].push(issue);
    });
    setIssues(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  const generatePredicted = async (sub: Subscription) => {
    if (!sub.start_date || sub.frequency === 'irregular') return;
    const existing = issues[sub.id] ?? [];
    const lastDate = existing.length > 0
      ? new Date(existing[0].predicted_date)
      : new Date(sub.start_date);
    const next = nextIssueDates(sub.frequency, lastDate, 6);
    const inserts = next.map((d, i) => ({
      subscription_id: sub.id,
      issue_number: `${existing.length + i + 1}`,
      predicted_date: d.toISOString().slice(0, 10),
      status: 'expected',
    }));
    await supabase.from('serials_issues').insert(inserts);
    load();
  };

  const addIssue = async (subId: string) => {
    if (!newIssue.issue_number.trim()) return;
    setSaving(true);
    await supabase.from('serials_issues').insert({
      subscription_id: subId, volume: newIssue.volume || null,
      issue_number: newIssue.issue_number,
      predicted_date: newIssue.predicted_date || null,
      actual_arrival_date: newIssue.actual_arrival_date || null,
      status: newIssue.status,
    });
    setSaving(false);
    setAdding(null);
    setNewIssue({ volume: '', issue_number: '', predicted_date: '', actual_arrival_date: '', status: 'expected' });
    load();
  };

  const updateIssueStatus = async (id: string, status: string, subId: string) => {
    const patch: any = { status };
    if (status === 'received') patch.actual_arrival_date = new Date().toISOString().slice(0, 10);
    await supabase.from('serials_issues').update(patch).eq('id', id);
    setIssues((prev) => ({
      ...prev,
      [subId]: prev[subId].map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  };

  const overdueCount = (subId: string) =>
    (issues[subId] ?? []).filter(
      (i) => i.status === 'expected' && i.predicted_date && isPast(new Date(i.predicted_date))
    ).length;

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : subs.length === 0 ? (
        <EmptyState message="No active subscriptions. Add subscriptions in the Subscriptions tab." />
      ) : (
        subs.map((sub) => {
          const subIssues = issues[sub.id] ?? [];
          const overdue = overdueCount(sub.id);
          return (
            <div key={sub.id} className="border border-neutral-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggle(sub.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${expanded === sub.id ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-800 truncate">{sub.title}</p>
                    <p className="text-xs text-neutral-500 capitalize">
                      {sub.frequency} · {subIssues.length} issue{subIssues.length !== 1 ? 's' : ''} tracked
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {overdue > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-error-100 text-error-700">
                      {overdue} overdue
                    </span>
                  )}
                  <Badge label={sub.status} className={STATUS_COLORS[sub.status]} />
                </div>
              </button>

              {expanded === sub.id && (
                <div className="border-t border-neutral-200 bg-neutral-50">
                  <div className="flex gap-2 p-3 border-b border-neutral-200">
                    <button onClick={() => setAdding(sub.id)} className="btn-outline text-xs py-1.5 px-3">
                      + Add Issue
                    </button>
                    {sub.start_date && sub.frequency !== 'irregular' && (
                      <button onClick={() => generatePredicted(sub)} className="btn-ghost text-xs py-1.5 px-3">
                        Generate Next 6 Predicted
                      </button>
                    )}
                  </div>

                  {adding === sub.id && (
                    <div className="p-3 border-b border-neutral-200 bg-white">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <input className="input text-xs py-1.5" placeholder="Vol." value={newIssue.volume}
                          onChange={(e) => setNewIssue((p) => ({ ...p, volume: e.target.value }))} />
                        <input className="input text-xs py-1.5" placeholder="Issue No. *" value={newIssue.issue_number}
                          onChange={(e) => setNewIssue((p) => ({ ...p, issue_number: e.target.value }))} />
                        <input type="date" className="input text-xs py-1.5" value={newIssue.predicted_date}
                          onChange={(e) => setNewIssue((p) => ({ ...p, predicted_date: e.target.value }))} />
                        <select className="input text-xs py-1.5 capitalize" value={newIssue.status}
                          onChange={(e) => setNewIssue((p) => ({ ...p, status: e.target.value }))}>
                          {['expected', 'received', 'missing', 'claimed', 'never_published'].map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setAdding(null)} className="btn-ghost text-xs py-1 px-3">Cancel</button>
                        <button onClick={() => addIssue(sub.id)} disabled={saving || !newIssue.issue_number}
                          className="btn-primary text-xs py-1 px-3 disabled:opacity-50">
                          {saving ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {subIssues.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-400 text-center">No issues tracked yet</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="text-left p-3 font-semibold text-neutral-600">Vol / Issue</th>
                          <th className="text-left p-3 font-semibold text-neutral-600">Predicted</th>
                          <th className="text-left p-3 font-semibold text-neutral-600">Arrived</th>
                          <th className="text-left p-3 font-semibold text-neutral-600">Status</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {subIssues.map((issue) => {
                          const isOverdue = issue.status === 'expected' && issue.predicted_date && isPast(new Date(issue.predicted_date));
                          return (
                            <tr key={issue.id} className={`border-b border-neutral-100 ${isOverdue ? 'bg-error-50' : 'hover:bg-white'}`}>
                              <td className="p-3 font-medium text-neutral-700">
                                {issue.volume ? `Vol. ${issue.volume}, ` : ''}No. {issue.issue_number}
                              </td>
                              <td className="p-3 text-neutral-500">{fmtDate(issue.predicted_date)}</td>
                              <td className="p-3 text-neutral-500">{fmtDate(issue.actual_arrival_date)}</td>
                              <td className="p-3"><Badge label={issue.status} className={STATUS_COLORS[issue.status]} /></td>
                              <td className="p-3">
                                {issue.status === 'expected' && (
                                  <div className="flex gap-2">
                                    <button onClick={() => updateIssueStatus(issue.id, 'received', sub.id)}
                                      className="text-success-700 hover:underline font-medium">Received</button>
                                    {isOverdue && (
                                      <button onClick={() => updateIssueStatus(issue.id, 'missing', sub.id)}
                                        className="text-error-600 hover:underline font-medium">Flag Missing</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Routing Tab ───────────────────────────────────────────────────────────────
function RoutingTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [routing, setRouting] = useState<Record<string, RoutingEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEntry, setNewEntry] = useState({ patron_name: '', patron_email: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('serials_subscriptions').select('*').eq('status', 'active').order('title'),
      supabase.from('serials_routing').select('*').order('sequence_order'),
    ]);
    setSubs(s ?? []);
    const map: Record<string, RoutingEntry[]> = {};
    (r ?? []).forEach((entry) => {
      if (!map[entry.subscription_id]) map[entry.subscription_id] = [];
      map[entry.subscription_id].push(entry);
    });
    setRouting(map);
    setLoading(false);
    if (!selected && s?.length) setSelected(s[0].id);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const currentList = routing[selected] ?? [];

  const addEntry = async () => {
    if (!newEntry.patron_name.trim() || !selected) return;
    setSaving(true);
    await supabase.from('serials_routing').insert({
      subscription_id: selected,
      patron_name: newEntry.patron_name,
      patron_email: newEntry.patron_email || null,
      sequence_order: currentList.length + 1,
    });
    setSaving(false);
    setShowAdd(false);
    setNewEntry({ patron_name: '', patron_email: '' });
    load();
  };

  const removeEntry = async (id: string) => {
    await supabase.from('serials_routing').delete().eq('id', id);
    load();
  };

  const moveEntry = async (id: string, dir: -1 | 1) => {
    const list = [...currentList].sort((a, b) => a.sequence_order - b.sequence_order);
    const idx = list.findIndex((e) => e.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    await Promise.all([
      supabase.from('serials_routing').update({ sequence_order: list[swapIdx].sequence_order }).eq('id', list[idx].id),
      supabase.from('serials_routing').update({ sequence_order: list[idx].sequence_order }).eq('id', list[swapIdx].id),
    ]);
    load();
  };

  const markRouted = async (id: string) => {
    await supabase.from('serials_routing').update({ routed_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  const markReturned = async (id: string) => {
    await supabase.from('serials_routing').update({ returned_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : subs.length === 0 ? (
        <EmptyState message="No active subscriptions for routing" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Subscription selector */}
          <div className="lg:col-span-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Subscription</h3>
            <div className="space-y-1">
              {subs.map((s) => (
                <button key={s.id} onClick={() => setSelected(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    selected === s.id
                      ? 'bg-primary-700 text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}>
                  <p className="font-medium truncate">{s.title}</p>
                  <p className={`text-xs capitalize ${selected === s.id ? 'text-primary-200' : 'text-neutral-400'}`}>
                    {s.frequency}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Routing list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Routing List ({currentList.length})
              </h3>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-1.5 px-3">
                Add Member
              </button>
            </div>

            {currentList.length === 0 ? (
              <EmptyState message="No routing list set up for this subscription" />
            ) : (
              <div className="space-y-2">
                {[...currentList].sort((a, b) => a.sequence_order - b.sequence_order).map((entry, i, arr) => (
                  <div key={entry.id}
                    className="border border-neutral-200 rounded-xl p-3 flex items-center gap-3 bg-white">
                    <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-neutral-800">{entry.patron_name}</p>
                      {entry.patron_email && <p className="text-xs text-neutral-400">{entry.patron_email}</p>}
                      <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                        {entry.routed_at && <span>Sent {fmtDate(entry.routed_at)}</span>}
                        {entry.returned_at && <span className="text-success-600">Returned {fmtDate(entry.returned_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!entry.routed_at && (
                        <button onClick={() => markRouted(entry.id)}
                          className="text-xs text-primary-600 hover:underline px-1">Route</button>
                      )}
                      {entry.routed_at && !entry.returned_at && (
                        <button onClick={() => markReturned(entry.id)}
                          className="text-xs text-success-600 hover:underline px-1">Returned</button>
                      )}
                      <button disabled={i === 0} onClick={() => moveEntry(entry.id, -1)}
                        className="p-1 text-neutral-300 hover:text-neutral-600 disabled:opacity-20">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button disabled={i === arr.length - 1} onClick={() => moveEntry(entry.id, 1)}
                        className="p-1 text-neutral-300 hover:text-neutral-600 disabled:opacity-20">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button onClick={() => removeEntry(entry.id)}
                        className="p-1 text-neutral-300 hover:text-error-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAdd && (
              <div className="border border-primary-200 bg-primary-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Name <span className="text-error-500">*</span></label>
                    <input className="input text-sm" value={newEntry.patron_name}
                      onChange={(e) => setNewEntry((p) => ({ ...p, patron_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label text-xs">Email</label>
                    <input type="email" className="input text-sm" value={newEntry.patron_email}
                      onChange={(e) => setNewEntry((p) => ({ ...p, patron_email: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs py-1.5 px-3">Cancel</button>
                  <button onClick={addEntry} disabled={saving || !newEntry.patron_name.trim()}
                    className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
                    {saving ? 'Adding…' : 'Add to List'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Missing Issues Tab ────────────────────────────────────────────────────────
function MissingIssuesTab() {
  const [issues, setIssues] = useState<(Issue & { subscription_title: string; subscription_publisher: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimDraft, setClaimDraft] = useState<{ subject: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('serials_issues')
      .select('*, serials_subscriptions(title, publisher, issn, acquisition_suppliers(name, email))')
      .in('status', ['missing', 'claimed'])
      .order('predicted_date', { ascending: true });
    setIssues(
      (data ?? []).map((i) => ({
        ...i,
        subscription_title: i.serials_subscriptions?.title ?? '',
        subscription_publisher: i.serials_subscriptions?.publisher ?? '',
      }))
    );
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generateClaimEmail = (issue: any) => {
    const sup = issue.serials_subscriptions?.acquisition_suppliers;
    const sub = issue.serials_subscriptions;
    const body = `Dear ${sup?.name ?? 'Supplier'},\n\nWe wish to bring to your attention that the following issue has not been received:\n\nJournal: ${sub?.title ?? 'N/A'}\nISSN: ${sub?.issn ?? 'N/A'}\nVolume/Issue: ${issue.volume ? `Vol. ${issue.volume}, ` : ''}No. ${issue.issue_number}\nExpected Date: ${fmtDate(issue.predicted_date)}\n\nKindly arrange for a replacement copy or advise on the expected delivery date at your earliest convenience.\n\nYours faithfully,\nAcquisitions Librarian\nESUT Smart Library`;
    setClaimDraft({
      subject: `Missing Issue Claim — ${sub?.title ?? 'Journal'} No. ${issue.issue_number}`,
      body,
    });
  };

  const markClaimed = async (id: string) => {
    setSaving(true);
    await supabase.from('serials_issues')
      .update({ status: 'claimed', claim_sent_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
    load();
  };

  const flagMissing = async (id: string) => {
    await supabase.from('serials_issues').update({ status: 'missing' }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="py-12 text-center text-neutral-400 text-sm">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-medium text-neutral-700">No missing issues</p>
          <p className="text-sm text-neutral-400 mt-1">Flag overdue issues in the Issue Tracker tab</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left p-3 font-semibold text-neutral-700">Journal</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Vol / Issue</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Expected</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Claim Sent</th>
                <th className="text-left p-3 font-semibold text-neutral-700">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3">
                    <p className="font-medium text-neutral-800 line-clamp-1">{issue.subscription_title}</p>
                    {issue.subscription_publisher && (
                      <p className="text-xs text-neutral-500">{issue.subscription_publisher}</p>
                    )}
                  </td>
                  <td className="p-3 text-neutral-700">
                    {issue.volume ? `Vol. ${issue.volume}, ` : ''}No. {issue.issue_number}
                  </td>
                  <td className="p-3 text-neutral-500 whitespace-nowrap">{fmtDate(issue.predicted_date)}</td>
                  <td className="p-3 text-neutral-500 whitespace-nowrap">
                    {issue.claim_sent_at ? fmtDate(issue.claim_sent_at) : '—'}
                  </td>
                  <td className="p-3"><Badge label={issue.status} className={STATUS_COLORS[issue.status]} /></td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => generateClaimEmail(issue)}
                        className="text-xs text-primary-600 hover:underline font-medium">
                        Draft Claim
                      </button>
                      {issue.status === 'missing' && (
                        <button onClick={() => markClaimed(issue.id)} disabled={saving}
                          className="text-xs text-neutral-500 hover:text-neutral-700">
                          Mark Claimed
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {claimDraft && (
        <Modal title="Supplier Claim Email" onClose={() => setClaimDraft(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <label className="label">Subject</label>
              <input className="input" value={claimDraft.subject}
                onChange={(e) => setClaimDraft((p) => p && { ...p, subject: e.target.value })} />
            </div>
            <div>
              <label className="label">Email Body</label>
              <textarea className="input font-mono text-xs" rows={12} value={claimDraft.body}
                onChange={(e) => setClaimDraft((p) => p && { ...p, body: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(claimDraft.body)}
                className="btn-ghost flex-1 text-sm">
                Copy to Clipboard
              </button>
              <a href={`mailto:?subject=${encodeURIComponent(claimDraft.subject)}&body=${encodeURIComponent(claimDraft.body)}`}
                className="btn-primary flex-1 text-center text-sm">
                Open in Email Client
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-neutral-800">{title}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-neutral-400">
      <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}
