import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface BranchRow {
  id: string;
  name: string;
  active: boolean;
}

interface VisitorRow {
  id: string;
  full_name: string;
  organization: string | null;
  purpose: string | null;
  host_department: string | null;
  created_at: string;
}

interface PassRow {
  id: string;
  visitor_id: string;
  branch_id: string | null;
  valid_from: string;
  valid_until: string;
  status: string;
  created_at: string;
  access_visitors?: { full_name: string } | Array<{ full_name: string }> | null;
  library_branches?: { name: string } | Array<{ name: string }> | null;
}

interface VisitorForm {
  fullName: string;
  organization: string;
  purpose: string;
  hostDepartment: string;
  contactEmail: string;
  contactPhone: string;
}

const emptyForm: VisitorForm = { fullName: '', organization: '', purpose: '', hostDepartment: '', contactEmail: '', contactPhone: '' };

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

function pickRelated(value: unknown): string | null {
  if (!value) return null;
  const pick = (candidate: unknown): string | null => {
    if (Array.isArray(candidate)) return candidate.length > 0 ? pick(candidate[0]) : null;
    if (candidate && typeof candidate === 'object') {
      const obj = candidate as Record<string, unknown>;
      const name = obj.name ?? obj.full_name;
      if (typeof name === 'string') return name;
    }
    return null;
  };
  return pick(value);
}

export default function AccessVisitors() {
  const { t, formatDate } = useI18n();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [form, setForm] = useState<VisitorForm>(emptyForm);
  const [branchId, setBranchId] = useState('');
  const [selectedVisitorId, setSelectedVisitorId] = useState('');
  const [validForMinutes, setValidForMinutes] = useState('60');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [issuedCredential, setIssuedCredential] = useState<string | null>(null);
  const [issuedPass, setIssuedPass] = useState<{ visitorName: string; validUntil: string; branchName: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [branchData, visitorData] = await Promise.all([
        authFetch('/api/access/branches') as Promise<BranchRow[]>,
        authFetch('/api/access/visitors') as Promise<{ visitors: VisitorRow[]; passes: PassRow[] }>,
      ]);
      const active = branchData.filter((b) => b.active);
      setBranches(active);
      if (active[0]) setBranchId((current) => current || active[0].id);
      setVisitors(visitorData.visitors);
      setPasses(visitorData.passes);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await authFetch('/api/access/visitors', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          organization: form.organization,
          purpose: form.purpose,
          hostDepartment: form.hostDepartment,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
        }),
      });
      setMessage(t('slaas.visitorRegistered'));
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function issuePass() {
    if (!selectedVisitorId || !branchId) {
      setError(t('slaas.selectBranch'));
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    setIssuedCredential(null);
    setIssuedPass(null);
    try {
      const result = await authFetch('/api/access/visitor-passes', {
        method: 'POST',
        body: JSON.stringify({ visitorId: selectedVisitorId, branchId, validForMinutes: Number(validForMinutes) }),
      });
      if (result.ok && result.credential && result.pass) {
        setIssuedCredential(result.credential);
        setIssuedPass({
          visitorName: result.pass.visitorName,
          validUntil: result.pass.validUntil,
          branchName: branches.find((b) => b.id === result.pass?.branchId)?.name ?? null,
        });
        setMessage(t('slaas.passIssued'));
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

  async function revokePass(passId: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authFetch('/api/access/visitor-passes', {
        method: 'PATCH',
        body: JSON.stringify({ passId }),
      });
      if (result.ok) {
        setMessage(t('slaas.passRevoked'));
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.visitors')}</h1>
        <p className="text-sm text-neutral-500">{t('slaas.registerVisitor')} · {t('slaas.issuePass')}</p>
      </div>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm" role="alert">{error}</div>}

      <section className="card p-4">
        <h2 className="font-semibold text-neutral-800 mb-3">{t('slaas.registerVisitor')}</h2>
        <form onSubmit={register} className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.fullName')} *</span>
            <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required minLength={2} maxLength={200} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.organization')}</span>
            <input value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} maxLength={200} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.purpose')}</span>
            <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} maxLength={300} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.hostDepartment')}</span>
            <input value={form.hostDepartment} onChange={(e) => setForm((f) => ({ ...f, hostDepartment: e.target.value }))} maxLength={200} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.contactEmail')}</span>
            <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} maxLength={320} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.contactPhone')}</span>
            <input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} maxLength={32} className="input block mt-1" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">{t('slaas.register')}</button>
          </div>
        </form>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-neutral-800">{t('slaas.issuePass')}</h2>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.visitor')}</span>
            <select value={selectedVisitorId} onChange={(e) => setSelectedVisitorId(e.target.value)} className="input block mt-1">
              <option value="">—</option>
              {visitors.map((v) => <option key={v.id} value={v.id}>{v.full_name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.branch')}</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input block mt-1">
              <option value="">—</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.validForMinutes')}</span>
            <input type="number" min={5} max={1440} value={validForMinutes} onChange={(e) => setValidForMinutes(e.target.value)} className="input block mt-1" />
          </label>
          <button type="button" onClick={() => void issuePass()} disabled={busy} className="btn-primary">{t('slaas.issuePass')}</button>
        </div>

        {issuedCredential && (
          <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-4" data-testid="issued-pass">
            <div className="bg-white p-2 rounded-lg">
              <QRCodeSVG value={issuedCredential} size={120} level="M" />
            </div>
            <div className="text-sm text-green-900">
              <div className="font-semibold">{issuedPass?.visitorName}</div>
              {issuedPass?.branchName && <div>{t('slaas.branch')}: {issuedPass.branchName}</div>}
              <div>{t('slaas.validUntil')}: {issuedPass ? new Date(issuedPass.validUntil).toLocaleString() : ''}</div>
              <p className="text-xs mt-1 text-green-700">{t('slaas.qrHint')}</p>
            </div>
          </div>
        )}
      </section>

      <section className="card p-4 overflow-x-auto">
        <h2 className="font-semibold text-neutral-800 mb-3">{t('slaas.passes')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="py-2">{t('slaas.visitor')}</th>
              <th className="py-2">{t('slaas.branch')}</th>
              <th className="py-2">{t('slaas.validUntil')}</th>
              <th className="py-2">{t('slaas.accountStatus')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {passes.length === 0 && <tr><td colSpan={5} className="py-3 text-neutral-500">{t('slaas.noData')}</td></tr>}
            {passes.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="py-2 font-medium">{pickRelated(p.access_visitors) ?? '—'}</td>
                <td className="py-2">{pickRelated(p.library_branches) ?? '—'}</td>
                <td className="py-2">{formatDate(p.valid_until, 'long')}</td>
                <td className="py-2">
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${p.status === 'active' ? 'bg-green-100 text-green-800' : p.status === 'revoked' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                    {p.status === 'active' ? t('slaas.passActive') : p.status === 'revoked' ? t('slaas.passRevoked') : p.status === 'used' ? t('slaas.passUsed') : t('slaas.passExpired')}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {p.status === 'active' && (
                    <button type="button" onClick={() => void revokePass(p.id)} className="btn-outline text-xs px-3 py-1 text-red-700 border-red-200">{t('slaas.revoke')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
