import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface BranchRow {
  id: string;
  code: string;
  name: string;
  location: string | null;
  capacity: number;
  capacity_mode: 'informational' | 'warning' | 'enforced';
  warn_threshold_pct: number;
  active: boolean;
}

interface BranchForm {
  id: string;
  code: string;
  name: string;
  location: string;
  capacity: string;
  capacityMode: 'informational' | 'warning' | 'enforced';
  warnThresholdPct: string;
  active: boolean;
  reason: string;
}

const emptyForm: BranchForm = {
  id: '', code: '', name: '', location: '', capacity: '50',
  capacityMode: 'informational', warnThresholdPct: '80', active: true, reason: '',
};

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

export default function AccessBranches() {
  const { t } = useI18n();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data: BranchRow[] = await authFetch('/api/access/branches');
      setBranches(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startEdit(b: BranchRow) {
    setForm({
      id: b.id, code: b.code, name: b.name, location: b.location ?? '',
      capacity: String(b.capacity), capacityMode: b.capacity_mode,
      warnThresholdPct: String(b.warn_threshold_pct), active: b.active, reason: '',
    });
    setMessage('');
    setError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authFetch('/api/access/branches', {
        method: 'POST',
        body: JSON.stringify({
          id: form.id || undefined,
          code: form.code,
          name: form.name,
          location: form.location,
          capacity: Number(form.capacity),
          capacityMode: form.capacityMode,
          warnThresholdPct: Number(form.warnThresholdPct),
          active: form.active,
          reason: form.reason || undefined,
        }),
      });
      if (result.ok) {
        setMessage(t('slaas.branchSaved'));
        setForm(emptyForm);
        await load();
      } else if (result.error === 'DUPLICATE_CODE') {
        setError(`${t('slaas.code')}: ${form.code} — DUPLICATE_CODE`);
      } else if (result.error === 'BRANCH_NOT_FOUND') {
        setError(t('slaas.branchNotFound'));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.branches')}</h1>
        <p className="text-sm text-neutral-500">{t('slaas.capacityMode')} · {t('slaas.warnThreshold')}</p>
      </div>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm" role="alert">{error}</div>}

      <section className="card p-4">
        <h2 className="font-semibold text-neutral-800 mb-3">{form.id ? t('slaas.editBranch') : t('slaas.addBranch')}</h2>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.code')}</span>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required maxLength={32} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.name')}</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required maxLength={200} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.location')}</span>
            <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} maxLength={300} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.capacity')}</span>
            <input type="number" min={0} max={100000} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} required className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.capacityMode')}</span>
            <select value={form.capacityMode} onChange={(e) => setForm((f) => ({ ...f, capacityMode: e.target.value as BranchForm['capacityMode'] }))} className="input block mt-1">
              <option value="informational">informational</option>
              <option value="warning">warning</option>
              <option value="enforced">enforced</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.warnThreshold')}</span>
            <input type="number" min={0} max={100} value={form.warnThresholdPct} onChange={(e) => setForm((f) => ({ ...f, warnThresholdPct: e.target.value }))} className="input block mt-1" />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            {t('slaas.active')}
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.reason')}</span>
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} maxLength={500} className="input block mt-1" />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary">{t('slaas.saveBranch')}</button>
            {form.id && <button type="button" className="btn-outline" onClick={() => setForm(emptyForm)}>{t('slaas.addBranch')}</button>}
          </div>
        </form>
      </section>

      <section className="card p-4 overflow-x-auto">
        <h2 className="font-semibold text-neutral-800 mb-3">{t('slaas.branches')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="py-2">{t('slaas.code')}</th>
              <th className="py-2">{t('slaas.name')}</th>
              <th className="py-2">{t('slaas.location')}</th>
              <th className="py-2 text-right">{t('slaas.capacity')}</th>
              <th className="py-2">{t('slaas.capacityMode')}</th>
              <th className="py-2 text-right">{t('slaas.warnThreshold')}</th>
              <th className="py-2">{t('slaas.active')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 && <tr><td colSpan={8} className="py-3 text-neutral-500">{t('slaas.noData')}</td></tr>}
            {branches.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100">
                <td className="py-2 font-mono text-xs">{b.code}</td>
                <td className="py-2 font-medium">{b.name}</td>
                <td className="py-2 text-neutral-600">{b.location ?? '—'}</td>
                <td className="py-2 text-right">{b.capacity}</td>
                <td className="py-2">{b.capacity_mode}</td>
                <td className="py-2 text-right">{b.warn_threshold_pct}%</td>
                <td className="py-2">{b.active ? '✓' : '✗'}</td>
                <td className="py-2 text-right">
                  <button type="button" onClick={() => startEdit(b)} className="btn-outline text-xs px-3 py-1">{t('slaas.editBranch')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
