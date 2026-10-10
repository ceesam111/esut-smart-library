import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

interface MyVisitRow {
  id: string;
  branch_id: string;
  status: string;
  checked_in_at: string;
  checked_out_at: string | null;
  duration_minutes: number | null;
  library_branches: { name: string } | Array<{ name: string }> | null;
}

interface MyData {
  registered: boolean;
  patron?: { fullName: string; patronCategory: string; department: string | null; status: string };
  identity?: { id: string; status: string; issued_at: string | null; credential: string } | null;
  visits: MyVisitRow[];
  stats: { totalVisits: number; avgDurationMinutes: number | null; currentlyInside: boolean; visitsThisMonth: number } | null;
}

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

function branchName(row: MyVisitRow): string {
  const embed = Array.isArray(row.library_branches) ? row.library_branches[0] : row.library_branches;
  return embed?.name ?? '—';
}

export default function AccessHistory() {
  const { t, formatDate } = useI18n();
  const [data, setData] = useState<MyData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authFetch('/api/access/me')
      .then((result: MyData) => setData(result))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <div className="max-w-3xl mx-auto"><div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm" role="alert">{error}</div></div>;
  }

  if (!data) {
    return <div className="max-w-3xl mx-auto text-sm text-neutral-500">{t('dashboard.loading')}</div>;
  }

  if (!data.registered || !data.identity) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.myAccess')}</h1>
        <div className="card p-6 text-center text-sm text-neutral-600">{t('slaas.notRegistered')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.myAccess')}</h1>
        <p className="text-sm text-neutral-500">{data.patron?.fullName} · {data.patron?.patronCategory}</p>
      </div>

      <section className="card p-5 flex flex-col sm:flex-row items-center gap-5" aria-label={t('slaas.myQr')}>
        <div className="bg-white p-3 rounded-xl border border-neutral-200" data-testid="my-access-qr">
          <QRCodeSVG value={data.identity.credential} size={168} level="M" />
        </div>
        <div className="text-sm text-neutral-600 space-y-1">
          <h2 className="font-semibold text-neutral-800 text-base">{t('slaas.myQr')}</h2>
          <p>{t('slaas.qrHint')}</p>
          {data.identity.issued_at && <p className="text-xs text-neutral-500">{t('slaas.timestamp')}: {formatDate(data.identity.issued_at, 'long')}</p>}
          <p className="text-xs font-semibold text-primary-700">
            {data.stats?.currentlyInside ? `● ${t('slaas.insideBadge')}` : ''}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label={t('slaas.myStats')}>
        {[
          [t('slaas.totalVisits'), String(data.stats?.totalVisits ?? 0)],
          [t('slaas.avgDuration'), data.stats?.avgDurationMinutes != null ? `${data.stats.avgDurationMinutes} min` : '—'],
          [t('slaas.visitsThisMonth'), String(data.stats?.visitsThisMonth ?? 0)],
          [t('slaas.currentlyInside'), data.stats?.currentlyInside ? '✓' : '✗'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-neutral-50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
            <div className="text-lg font-bold text-primary-800">{value}</div>
          </div>
        ))}
      </section>

      <section className="card p-4 overflow-x-auto" aria-label={t('slaas.myHistory')}>
        <h2 className="font-semibold text-neutral-800 mb-3">{t('slaas.myHistory')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="py-2">{t('slaas.branch')}</th>
              <th className="py-2">{t('slaas.timestamp')}</th>
              <th className="py-2">{t('slaas.accountStatus')}</th>
              <th className="py-2 text-right">{t('slaas.durationMin')}</th>
            </tr>
          </thead>
          <tbody>
            {data.visits.length === 0 && <tr><td colSpan={4} className="py-3 text-neutral-500">{t('slaas.noData')}</td></tr>}
            {data.visits.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100">
                <td className="py-2">{branchName(row)}</td>
                <td className="py-2 text-xs">{formatDate(row.checked_in_at, 'long')}</td>
                <td className="py-2">
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${row.status === 'checked_in' ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-600'}`}>
                    {row.status === 'checked_in' ? t('slaas.statusCheckedIn') : row.status === 'checked_out' ? t('slaas.statusCheckedOut') : t('slaas.statusAutoClosed')}
                  </span>
                </td>
                <td className="py-2 text-right">{row.duration_minutes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
