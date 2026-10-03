import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AnalyticsData {
  checkouts: number;
  activeBorrowers: number;
  currentLoans: number;
  overdueLoans: number;
  catalogueSearches: number;
  zeroResultSearches: number;
  repositoryViews: number;
  repositoryDownloads: number;
  topTitles: Array<{ title: string; count: number }>;
  topRepositoryItems: Array<{ id: string; count: number }>;
  daily: Record<string, Record<string, number>>;
}

export default function Analytics() {
  const navigate = useNavigate();
  const { loading: authLoading, hasRole } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?days=${days}`)
      .then(r => r.ok ? r.json() : { data: null })
      .then(result => setData(result.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (authLoading) return <div className="p-8 text-sm text-neutral-500">Loading...</div>;
  if (!hasRole('super_admin', 'librarian', 'catalog_admin')) {
    return <div className="p-8"><div className="card p-8 max-w-lg"><h1 className="font-semibold text-lg mb-2">Admin access required</h1></div></div>;
  }

  const kpis = [
    { label: 'Checkouts', value: data?.checkouts ?? 0, color: 'bg-blue-50 text-blue-700' },
    { label: 'Active Borrowers', value: data?.activeBorrowers ?? 0, color: 'bg-green-50 text-green-700' },
    { label: 'Current Loans', value: data?.currentLoans ?? 0, color: 'bg-purple-50 text-purple-700' },
    { label: 'Overdue Loans', value: data?.overdueLoans ?? 0, color: 'bg-red-50 text-red-700' },
    { label: 'Catalogue Searches', value: data?.catalogueSearches ?? 0, color: 'bg-amber-50 text-amber-700' },
    { label: 'Zero-Result Searches', value: data?.zeroResultSearches ?? 0, color: 'bg-red-50 text-red-700' },
    { label: 'Repository Views', value: data?.repositoryViews ?? 0, color: 'bg-sky-50 text-sky-700' },
    { label: 'Repository Downloads', value: data?.repositoryDownloads ?? 0, color: 'bg-indigo-50 text-indigo-700' },
  ];

  const dailyDays = Object.keys(data?.daily ?? {}).sort();
  const maxDaily = Math.max(1, ...dailyDays.map(d => Object.values(data?.daily?.[d] ?? {}).reduce((a, b) => a + b, 0)));

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Analytics Dashboard</h1>
          <p className="text-neutral-500 mt-1">Real usage data from analytics events</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin')} className="btn-ghost">Back</button>
          <select className="input max-w-[140px]" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-neutral-400">Loading analytics...</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-xl p-4 ${kpi.color}`}>
            <p className="text-2xl font-bold">{kpi.value.toLocaleString()}</p>
            <p className="text-sm mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold text-neutral-800 mb-3">Daily Activity (last {days} days)</h2>
          {dailyDays.length === 0 ? (
            <p className="text-sm text-neutral-400">No activity recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {dailyDays.slice(-14).reverse().map(day => {
                const counts = data?.daily?.[day] ?? {};
                const total = Object.values(counts).reduce((a, b) => a + b, 0);
                const pct = Math.round((total / maxDaily) * 100);
                return (
                  <div key={day} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-neutral-500">{day}</span>
                    <div className="flex-1 bg-neutral-100 rounded-full h-4 overflow-hidden">
                      <div className="bg-primary-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-neutral-600">{total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-neutral-800 mb-3">Top Titles (by checkouts)</h2>
          {data?.topTitles?.length === 0 ? (
            <p className="text-sm text-neutral-400">No checkout data yet.</p>
          ) : (
            <div className="space-y-2">
              {data?.topTitles?.slice(0, 10).map((t, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-neutral-700 truncate mr-2">{t.title}</span>
                  <span className="text-neutral-500 font-mono">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-neutral-800 mb-3">Top Repository Items (by downloads)</h2>
        {data?.topRepositoryItems?.length === 0 ? (
          <p className="text-sm text-neutral-400">No download data yet.</p>
        ) : (
          <div className="space-y-2">
            {data?.topRepositoryItems?.slice(0, 10).map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-neutral-700 font-mono">{item.id}</span>
                <span className="text-neutral-500">{item.count} downloads</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
