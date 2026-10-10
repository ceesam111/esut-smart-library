import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

interface OccupancyInfo {
  branchId: string;
  currentlyInside: number;
  capacity: number;
  availableSpaces: number;
  occupancyPct: number;
  capacityMode: 'informational' | 'warning' | 'enforced';
  warnThresholdPct: number;
}

interface AnalyticsData {
  totalVisits: number;
  uniqueUsers: number;
  avgDurationMinutes: number | null;
  medianDurationMinutes: number | null;
  peakOccupancy: number;
  visitorVisits: number;
  byBranch: Array<{ branchId: string; branchName: string; totalVisits: number; uniqueUsers: number; avgDurationMinutes: number | null; visitorVisits: number }>;
  byHour: Array<{ hour: number; count: number }>;
  byWeekday: Array<{ weekday: number; count: number }>;
}

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || json.error || `Request failed with ${res.status}`);
  return json && json.success === true && 'data' in json ? json.data : json;
}

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AccessDashboard() {
  const { t, formatNumber } = useI18n();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [occupancy, setOccupancy] = useState<Record<string, OccupancyInfo>>({});
  const [error, setError] = useState('');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [from, setFrom] = useState(toLocalInputValue(monthStart));
  const [to, setTo] = useState(toLocalInputValue(now));
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const loadOccupancy = useCallback(async (list: BranchRow[]) => {
    try {
      const entries = await Promise.all(list.map(async (b) => {
        const snap: OccupancyInfo = await authFetch(`/api/access/occupancy?branchId=${encodeURIComponent(b.id)}`);
        return [b.id, snap] as const;
      }));
      setOccupancy(Object.fromEntries(entries));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ from: new Date(from).toISOString(), to: new Date(to).toISOString() });
      const data: AnalyticsData = await authFetch(`/api/access/analytics?${params.toString()}`);
      setAnalytics(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [from, to]);

  useEffect(() => {
    authFetch('/api/access/branches')
      .then((data: BranchRow[]) => {
        setBranches(data.filter((b) => b.active));
        void loadOccupancy(data.filter((b) => b.active));
      })
      .catch((err: Error) => setError(err.message));
  }, [loadOccupancy]);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const maxHour = analytics ? Math.max(1, ...analytics.byHour.map((h) => h.count)) : 1;
  const maxWeekday = analytics ? Math.max(1, ...analytics.byWeekday.map((w) => w.count)) : 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">{t('slaas.dashboard')}</h1>
          <p className="text-sm text-neutral-500">{t('slaas.analyticsTitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/access/scanner" className="btn-primary text-sm">{t('slaas.scanner')}</Link>
          <Link to="/admin/access/visitors" className="btn-outline text-sm">{t('slaas.visitors')}</Link>
          <Link to="/admin/access/branches" className="btn-outline text-sm">{t('slaas.branches')}</Link>
          <Link to="/admin/access/visits" className="btn-outline text-sm">{t('slaas.visits')}</Link>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm" role="alert">{error}</div>}

      <section aria-label={t('slaas.branches')}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => {
            const snap = occupancy[b.id];
            const pct = snap?.occupancyPct ?? 0;
            const overWarn = snap && snap.capacity > 0 && pct >= snap.warnThresholdPct;
            return (
              <div key={b.id} className="card p-4" data-testid="branch-card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-neutral-800">{b.name}</div>
                    <div className="text-xs text-neutral-500">{b.code}{b.location ? ` · ${b.location}` : ''}</div>
                  </div>
                  <span className={`text-xs font-bold rounded-full px-2 py-1 ${overWarn ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div className={`h-full ${overWarn ? 'bg-amber-500' : 'bg-primary-700'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-neutral-600">
                  <span>{t('slaas.currentlyInside')}: <strong>{snap?.currentlyInside ?? '—'}</strong></span>
                  <span>{t('slaas.capacity')}: {b.capacity}</span>
                  <span>{t('slaas.availableSpace')}: {snap?.availableSpaces ?? '—'}</span>
                </div>
              </div>
            );
          })}
          {branches.length === 0 && <p className="text-sm text-neutral-500">{t('slaas.noData')}</p>}
        </div>
      </section>

      <section className="card p-4 space-y-4" aria-label={t('slaas.analyticsTitle')}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.from')}</span>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="input block mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600">{t('slaas.to')}</span>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="input block mt-1" />
          </label>
          <button type="button" onClick={() => void loadAnalytics()} className="btn-primary text-sm">{t('slaas.apply')}</button>
        </div>

        {analytics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                [t('slaas.todaysVisits'), formatNumber(analytics.totalVisits)],
                [t('slaas.uniqueUsers'), formatNumber(analytics.uniqueUsers)],
                [t('slaas.avgDurationLabel'), analytics.avgDurationMinutes != null ? `${analytics.avgDurationMinutes}` : '—'],
                [t('slaas.peakToday'), formatNumber(analytics.peakOccupancy)],
                [t('slaas.visitorVisits'), formatNumber(analytics.visitorVisits)],
                [t('slaas.currentlyInside'), formatNumber(branches.reduce((sum, b) => sum + (occupancy[b.id]?.currentlyInside ?? 0), 0))],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-neutral-50 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
                  <div className="text-xl font-bold text-primary-800">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">{t('slaas.byBranch')}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                      <th className="py-1.5">{t('slaas.branch')}</th>
                      <th className="py-1.5 text-right">{t('slaas.scansCount')}</th>
                      <th className="py-1.5 text-right">{t('slaas.uniqueUsers')}</th>
                      <th className="py-1.5 text-right">{t('slaas.avgDurationLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byBranch.length === 0 && <tr><td colSpan={4} className="py-3 text-neutral-500">{t('slaas.noData')}</td></tr>}
                    {analytics.byBranch.map((b) => (
                      <tr key={b.branchId} className="border-b border-neutral-100">
                        <td className="py-1.5">{b.branchName}</td>
                        <td className="py-1.5 text-right">{b.totalVisits}</td>
                        <td className="py-1.5 text-right">{b.uniqueUsers}</td>
                        <td className="py-1.5 text-right">{b.avgDurationMinutes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-2">{t('slaas.byHour')}</h3>
                  <div className="flex items-end gap-1 h-28" role="img" aria-label="Visits by hour">
                    {Array.from({ length: 24 }, (_, hour) => analytics.byHour.find((h) => h.hour === hour)?.count ?? 0).map((count, hour) => (
                      <div key={hour} className="flex-1 bg-primary-600 rounded-t" style={{ height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? 4 : 0 }} title={`${hour}:00 — ${count}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-2">{t('slaas.byWeekday')}</h3>
                  <div className="flex items-end gap-2 h-24" role="img" aria-label="Visits by weekday">
                    {WEEKDAY_NAMES.map((name, idx) => {
                      const count = analytics.byWeekday.find((w) => w.weekday === idx)?.count ?? 0;
                      return (
                        <div key={name} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-primary-500 rounded-t" style={{ height: `${(count / maxWeekday) * 70}px`, minHeight: count > 0 ? 4 : 0 }} title={`${name} — ${count}`} />
                          <span className="text-[10px] text-neutral-500">{name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">{t('slaas.noData')}</p>
        )}
      </section>
    </div>
  );
}
