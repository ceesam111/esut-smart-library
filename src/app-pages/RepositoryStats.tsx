import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';

const COLORS = ['#1F4E79', '#D4A017', '#005F73', '#2D6A4F', '#6B4226', '#7B3F84', '#B5451B', '#1B4F72'];

interface TypeCount    { type: string;   count: number }
interface FacultyCount { faculty: string; count: number }
interface MonthCount   { month: string;  downloads: number }
interface TopItem      { id: string; title: string; authors: string; download_count: number; view_count: number }

export default function RepositoryStats() {
  const [totalItems, setTotalItems]       = useState(0);
  const [totalDOIs, setTotalDOIs]         = useState(0);
  const [totalHarvests, setTotalHarvests] = useState(0);
  const [byType, setByType]               = useState<TypeCount[]>([]);
  const [byFaculty, setByFaculty]         = useState<FacultyCount[]>([]);
  const [monthly, setMonthly]             = useState<MonthCount[]>([]);
  const [topDownloads, setTopDownloads]   = useState<TopItem[]>([]);
  const [topViewed, setTopViewed]         = useState<TopItem[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadTotals(),
      loadByType(),
      loadByFaculty(),
      loadMonthly(),
      loadTopItems(),
    ]);
    setLoading(false);
  };

  const loadTotals = async () => {
    const [{ count: items }, { count: dois }, { count: harvests }] = await Promise.all([
      supabase.from('repository_items').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('repository_items').select('id', { count: 'exact', head: true }).neq('doi', null),
      supabase.from('harvest_log').select('id', { count: 'exact', head: true }),
    ]);
    setTotalItems(items ?? 0);
    setTotalDOIs(dois ?? 0);
    setTotalHarvests(harvests ?? 0);
  };

  const loadByType = async () => {
    const { data } = await supabase
      .from('repository_items')
      .select('item_type')
      .eq('status', 'published');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => { const t = r.item_type || 'Other'; map[t] = (map[t] ?? 0) + 1; });
    setByType(Object.entries(map).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));
  };

  const loadByFaculty = async () => {
    const { data } = await supabase
      .from('repository_items')
      .select('faculty_code')
      .eq('status', 'published');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => { const f = r.faculty_code || 'Unassigned'; map[f] = (map[f] ?? 0) + 1; });
    setByFaculty(Object.entries(map).map(([faculty, count]) => ({ faculty, count })).sort((a, b) => b.count - a.count));
  };

  const loadMonthly = async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);

    const { data } = await supabase
      .from('repository_items')
      .select('created_at, download_count')
      .eq('status', 'published')
      .gte('created_at', since.toISOString());
    if (!data) return;

    const map: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = 0;
    }
    data.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in map) map[key] += r.download_count ?? 0;
    });
    setMonthly(Object.entries(map).map(([month, downloads]) => ({ month, downloads })));
  };

  const loadTopItems = async () => {
    const [{ data: dl }, { data: vw }] = await Promise.all([
      supabase
        .from('repository_items')
        .select('id, title, authors, download_count, view_count')
        .eq('status', 'published')
        .order('download_count', { ascending: false })
        .limit(10),
      supabase
        .from('repository_items')
        .select('id, title, authors, download_count, view_count')
        .eq('status', 'published')
        .order('view_count', { ascending: false })
        .limit(10),
    ]);
    setTopDownloads((dl ?? []) as TopItem[]);
    setTopViewed((vw ?? []) as TopItem[]);
  };

  const authorStr = (authors: any): string => {
    if (Array.isArray(authors)) return authors.map((a: any) => (typeof a === 'string' ? a : a?.name ?? '')).filter(Boolean).join('; ');
    return String(authors ?? '');
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
          <span className="text-sm text-neutral-500">Loading statistics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 bg-neutral-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <BackButton />
            <h1 className="text-3xl font-bold text-neutral-900 mt-2">Repository Statistics</h1>
            <p className="text-neutral-500 mt-1">Open access usage and collection analytics for ESUT Digital Repository.</p>
          </div>
          <Link to="/repository" className="btn-outline text-sm">← Back to Repository</Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Published Items', value: totalItems,    icon: '📄' },
            { label: 'DOIs Assigned',   value: totalDOIs,     icon: '🔗' },
            { label: 'OAI-PMH Harvests',value: totalHarvests, icon: '🌐' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-neutral-200 p-6 text-center">
              <div className="text-3xl mb-1">{k.icon}</div>
              <div className="text-4xl font-bold text-primary-800">{k.value.toLocaleString()}</div>
              <div className="text-sm text-neutral-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* By type + by faculty */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Items by Type</h2>
            {byType.length === 0 ? (
              <p className="text-neutral-400 text-sm">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90} label={({ type, count }) => `${type}: ${count}`}>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Items by Faculty / Collection</h2>
            {byFaculty.length === 0 ? (
              <p className="text-neutral-400 text-sm">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byFaculty} layout="vertical" margin={{ left: 16, right: 8, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="faculty" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" name="Items" fill="#1F4E79" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Downloads per month */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Downloads — Last 12 Months</h2>
          {monthly.every((m) => m.downloads === 0) ? (
            <p className="text-neutral-400 text-sm">No download data in the last 12 months.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthly} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="downloads" name="Downloads" stroke="#D4A017" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 10 most downloaded */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Top 10 Most Downloaded</h2>
          {topDownloads.length === 0 ? (
            <p className="text-neutral-400 text-sm">No download data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">#</th>
                  <th className="text-left p-3 font-semibold">Title</th>
                  <th className="text-left p-3 font-semibold">Authors</th>
                  <th className="text-left p-3 font-semibold">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {topDownloads.map((item, i) => (
                  <tr key={item.id} className="border-b hover:bg-neutral-50">
                    <td className="p-3 font-bold text-primary-700">{i + 1}</td>
                    <td className="p-3">
                      <Link to={`/repository/${item.id}`} className="text-primary-700 hover:underline font-medium line-clamp-1">
                        {item.title}
                      </Link>
                    </td>
                    <td className="p-3 text-neutral-500 truncate max-w-xs">{authorStr(item.authors)}</td>
                    <td className="p-3 font-bold text-green-700">{(item.download_count ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top 10 most viewed */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Top 10 Most Viewed</h2>
          {topViewed.length === 0 ? (
            <p className="text-neutral-400 text-sm">No view data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">#</th>
                  <th className="text-left p-3 font-semibold">Title</th>
                  <th className="text-left p-3 font-semibold">Authors</th>
                  <th className="text-left p-3 font-semibold">Views</th>
                </tr>
              </thead>
              <tbody>
                {topViewed.map((item, i) => (
                  <tr key={item.id} className="border-b hover:bg-neutral-50">
                    <td className="p-3 font-bold text-primary-700">{i + 1}</td>
                    <td className="p-3">
                      <Link to={`/repository/${item.id}`} className="text-primary-700 hover:underline font-medium line-clamp-1">
                        {item.title}
                      </Link>
                    </td>
                    <td className="p-3 text-neutral-500 truncate max-w-xs">{authorStr(item.authors)}</td>
                    <td className="p-3 font-bold text-blue-700">{(item.view_count ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
