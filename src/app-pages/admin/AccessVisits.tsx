import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface BranchRow {
  id: string;
  name: string;
}

interface VisitRow {
  id: string;
  patron_id: string | null;
  visitor_id: string | null;
  branch_id: string;
  status: 'checked_in' | 'checked_out' | 'auto_closed';
  entry_method: string;
  exit_method: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  duration_minutes: number | null;
  correction_reason: string | null;
  corrected_at: string | null;
  is_observed: boolean;
  library_branches: { name: string; code: string } | Array<{ name: string; code: string }> | null;
  patrons: { full_name: string; patron_category: string; department: string | null } | Array<{ full_name: string; patron_category: string; department: string | null }> | null;
}

interface CorrectionTarget {
  id: string;
  label: string;
  status: string;
  checked_out_at: string | null;
}

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

function embedName(value: VisitRow['library_branches'] | VisitRow['patrons'], key: 'name' | 'full_name'): string {
  const obj = Array.isArray(value) ? value[0] : value;
  if (!obj) return '—';
  const record = obj as Record<string, unknown>;
  const raw = record[key];
  return typeof raw === 'string' ? raw : '—';
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  return toLocalInputValue(new Date(iso));
}

export default function AccessVisits() {
  const { t, formatDate } = useI18n();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'checked_out' | 'auto_closed'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [newStatus, setNewStatus] = useState<'checked_in' | 'checked_out' | 'auto_closed'>('checked_out');
  const [newCheckedOutAt, setNewCheckedOutAt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authFetch('/api/access/branches')
      .then((data: BranchRow[]) => setBranches(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status: statusFilter });
      if (branchFilter) params.set('branchId', branchFilter);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      const data = await authFetch(`/api/access/visits?${params.toString()}`);
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [branchFilter, from, page, pageSize, statusFilter, to]);

  useEffect(() => { void load(); }, [load]);

  function openCorrection(row: VisitRow) {
    const name = embedName(row.patrons, 'full_name');
    setTarget({ id: row.id, label: name, status: row.status, checked_out_at: row.checked_out_at });
    setNewStatus(row.status === 'checked_in' ? 'checked_out' : row.status);
    setNewCheckedOutAt(toDatetimeLocalValue(row.checked_out_at));
    setReason('');
    setMessage('');
  }

  async function submitCorrection() {
    if (!target) return;
    if (reason.trim().length < 3) {
      setError(t('slaas.correctionReason'));
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authFetch('/api/access/corrections', {
        method: 'POST',
        body: JSON.stringify({
          visitId: target.id,
          newStatus,
          newCheckedOutAt: newStatus === 'checked_in' ? null : new Date(newCheckedOutAt).toISOString(),
          reason: reason.trim(),
        }),
      });
      if (result.ok) {
        setMessage(t('slaas.correctionSuccess'));
        setTarget(null);
        await load();
      } else {
        setError(result.error ?? t('slaas.errorGeneric'));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportUrl(format: 'csv' | 'xlsx'): string {
    const params = new URLSearchParams({ format, pageSize: '5000' });
    if (branchFilter) params.set('branchId', branchFilter);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(to).toISOString());
    return `/api/access/export?${params.toString()}`;
  }

  async function download(format: 'csv' | 'xlsx') {
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('You must be signed in.');
      const res = await fetch(exportUrl(format), { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || `Export failed with ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slaas-visits-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.visits')}</h1>
        <p className="text-sm text-neutral-500">{t('slaas.analyticsTitle')}</p>
      </div>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm" role="alert">{error}</div>}

      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.branch')}</span>
            <select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }} className="input block mt-1">
              <option value="">{t('slaas.allBranches')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.accountStatus')}</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }} className="input block mt-1">
              <option value="all">{t('slaas.allStatuses')}</option>
              <option value="checked_in">{t('slaas.statusCheckedIn')}</option>
              <option value="checked_out">{t('slaas.statusCheckedOut')}</option>
              <option value="auto_closed">{t('slaas.statusAutoClosed')}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.from')}</span>
            <input type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.to')}</span>
            <input type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="input block mt-1" />
          </label>
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={() => void download('csv')} className="btn-outline text-sm">{t('slaas.exportCsv')}</button>
            <button type="button" onClick={() => void download('xlsx')} className="btn-outline text-sm">{t('slaas.exportXlsx')}</button>
          </div>
        </div>
      </section>

      <section className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="py-2">{t('slaas.patron')}</th>
              <th className="py-2">{t('slaas.branch')}</th>
              <th className="py-2">{t('slaas.accountStatus')}</th>
              <th className="py-2">{t('slaas.timestamp')}</th>
              <th className="py-2">{t('slaas.durationMin')}</th>
              <th className="py-2">{t('slaas.correctedFlag')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-4 text-neutral-500">{t('slaas.noData')}</td></tr>}
            {rows.map((row) => {
              const patronName = row.visitor_id ? t('slaas.visitor') : embedName(row.patrons, 'full_name');
              return (
                <tr key={row.id} className="border-b border-neutral-100">
                  <td className="py-2 font-medium">{patronName}</td>
                  <td className="py-2">{embedName(row.library_branches, 'name')}</td>
                  <td className="py-2">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${row.status === 'checked_in' ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-600'}`}>
                      {row.status === 'checked_in' ? t('slaas.statusCheckedIn') : row.status === 'checked_out' ? t('slaas.statusCheckedOut') : t('slaas.statusAutoClosed')}
                    </span>
                  </td>
                  <td className="py-2 text-xs">{formatDate(row.checked_in_at, 'long')}</td>
                  <td className="py-2 text-right">{row.duration_minutes ?? '—'}</td>
                  <td className="py-2">{row.corrected_at ? `✓ ${row.correction_reason ?? ''}` : '—'}</td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => openCorrection(row)} className="btn-outline text-xs px-3 py-1">{t('slaas.correctVisit')}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-neutral-500">{total} — {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-outline text-xs px-3 py-1">←</button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-outline text-xs px-3 py-1">→</button>
          </div>
        </div>
      </section>

      {target && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('slaas.correctVisit')}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h2 className="font-semibold text-neutral-800">{t('slaas.correctVisit')} — {target.label}</h2>
            <label className="block text-sm">
              <span className="text-neutral-600">{t('slaas.newStatus')}</span>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as typeof newStatus)} className="input block mt-1">
                <option value="checked_out">{t('slaas.statusCheckedOut')}</option>
                <option value="auto_closed">{t('slaas.statusAutoClosed')}</option>
                <option value="checked_in">{t('slaas.statusCheckedIn')}</option>
              </select>
            </label>
            {newStatus !== 'checked_in' && (
              <label className="block text-sm">
                <span className="text-neutral-600">{t('slaas.newCheckoutTime')}</span>
                <input type="datetime-local" value={newCheckedOutAt} onChange={(e) => setNewCheckedOutAt(e.target.value)} className="input block mt-1" />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-neutral-600">{t('slaas.correctionReason')} *</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} rows={3} className="input block mt-1" />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setTarget(null)} className="btn-outline text-sm">{t('slaas.cancel')}</button>
              <button type="button" onClick={() => void submitCorrection()} disabled={busy} className="btn-primary text-sm">{t('slaas.applyCorrection')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
