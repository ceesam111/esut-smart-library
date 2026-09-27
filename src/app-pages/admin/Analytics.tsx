import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#6B1D2A', '#CC0000', '#df4468', '#f4a3b3', '#8B0000', '#FF6B6B'];

interface AnalyticsData {
  pageViews: number;
  searches: number;
  downloads: number;
  logins: number;
  registrations: number;
  topPaths: [string, number][];
  daily: { date: string; count: number }[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || 'Failed to load');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="p-6 text-neutral-500">Loading analytics…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-6 text-neutral-500">No data</div>;

  const eventBreakdown = [
    { name: 'Page Views', value: data.pageViews },
    { name: 'Searches', value: data.searches },
    { name: 'Downloads', value: data.downloads },
    { name: 'Logins', value: data.logins },
    { name: 'Registrations', value: data.registrations },
  ].filter((d) => d.value > 0);

  const topPathsData = data.topPaths.map(([path, count]) => ({ path: path.length > 30 ? path.slice(0, 30) + '…' : path, count }));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Page Views', value: data.pageViews },
          { label: 'Searches', value: data.searches },
          { label: 'Downloads', value: data.downloads },
          { label: 'Logins', value: data.logins },
          { label: 'Registrations', value: data.registrations },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <div className="text-2xl font-bold text-neutral-900">{kpi.value.toLocaleString()}</div>
            <div className="text-sm text-neutral-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-neutral-900 mb-4">Daily Activity</h2>
        {data.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6B1D2A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-neutral-400 text-sm">No activity recorded yet. Events will appear as users interact with the platform.</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-neutral-900 mb-4">Event Breakdown</h2>
          {eventBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={eventBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {eventBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-neutral-400 text-sm">No events recorded yet.</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-neutral-900 mb-4">Top Pages</h2>
          {topPathsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topPathsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="path" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6B1D2A" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-neutral-400 text-sm">No page views recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
