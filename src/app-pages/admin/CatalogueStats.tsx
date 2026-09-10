import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

interface FormatCount  { format: string; count: number }
interface BranchCount  { branch: string; count: number }
interface MonthlyCount { month: string; count: number }
interface TopItem      { title: string; authors: string; loans: number }
interface NeverItem    { id: string; title: string; authors: string; format: string; year: number }
interface SubjectCount { subject: string; count: number }
interface AuthorCount { author: string; count: number }

interface ShelfOccupancy {
  shelf_code: string;
  library_name: string;
  floor_room: string;
  description: string | null;
  subject_range: string | null;
  capacity: number;
  items_held: number;
  pct: number;
}

interface LibraryItemCount { library: string; count: number }
interface UnassignedItem   { id: string; title: string; authors: string; format: string; year: number }

const COLORS = ['#1F4E79', '#D4A017', '#005F73', '#2D6A4F', '#6B4226', '#7B3F84'];

function textList(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value ?? '');
}

export default function CatalogueStats() {
  const [byFormat,   setByFormat]   = useState<FormatCount[]>([]);
  const [byBranch,   setByBranch]   = useState<BranchCount[]>([]);
  const [monthly,    setMonthly]    = useState<MonthlyCount[]>([]);
  const [topItems,   setTopItems]   = useState<TopItem[]>([]);
  const [neverItems, setNeverItems] = useState<NeverItem[]>([]);
  const [subjects,   setSubjects]   = useState<SubjectCount[]>([]);
  const [authors,    setAuthors]    = useState<AuthorCount[]>([]);
  const [formatFilter, setFormatFilter] = useState('');
  const [totals,     setTotals]     = useState({ items: 0, copies: 0, loans: 0 });
  const [loading,    setLoading]    = useState(true);

  // Shelf & location report state
  const [shelfOccupancy,   setShelfOccupancy]   = useState<ShelfOccupancy[]>([]);
  const [byLibrary,        setByLibrary]        = useState<LibraryItemCount[]>([]);
  const [unassignedItems,  setUnassignedItems]  = useState<UnassignedItem[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadByFormat(),
      loadByBranch(),
      loadMonthly(),
      loadTopItems(),
      loadNeverBorrowed(),
      loadSubjects(),
      loadAuthors(),
      loadTotals(),
      loadShelfOccupancy(),
      loadByLibrary(),
      loadUnassigned(),
    ]);
    setLoading(false);
  };

  const loadAuthors = async () => {
    const { data } = await supabase.from('catalogue_items').select('authors');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => {
      const values = Array.isArray(r.authors) ? r.authors : String(r.authors ?? '').split(/[;,|]/);
      values.map((s) => String(s).trim()).filter(Boolean).forEach((s) => { map[s] = (map[s] ?? 0) + 1; });
    });
    setAuthors(Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([author, count]) => ({ author, count })));
  };

  const loadByFormat = async () => {
    const { data } = await supabase.from('catalogue_items').select('format');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => { map[r.format] = (map[r.format] ?? 0) + 1; });
    setByFormat(Object.entries(map).map(([format, count]) => ({ format, count })).sort((a, b) => b.count - a.count));
  };

  const loadByBranch = async () => {
    const { data } = await supabase.from('catalogue_items').select('faculty_code');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => { const k = r.faculty_code || 'Main'; map[k] = (map[k] ?? 0) + 1; });
    setByBranch(Object.entries(map).map(([branch, count]) => ({ branch, count })).sort((a, b) => b.count - a.count));
  };

  const loadMonthly = async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);

    const { data } = await supabase
      .from('catalogue_items')
      .select('created_at')
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
      if (key in map) map[key]++;
    });
    setMonthly(Object.entries(map).map(([month, count]) => ({ month, count })));
  };

  const loadTopItems = async () => {
    const { data } = await supabase
      .from('loans')
      .select('catalogue_item_id')
      .not('catalogue_item_id', 'is', null);
    if (!data) return;

    const map: Record<string, number> = {};
    data.forEach((r) => { map[r.catalogue_item_id] = (map[r.catalogue_item_id] ?? 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 20);

    if (sorted.length === 0) { setTopItems([]); return; }

    const { data: items } = await supabase
      .from('catalogue_items')
      .select('id, title, authors')
      .in('id', sorted.map(([id]) => id));

    const lookup: Record<string, { title: string; authors: string }> = {};
    (items ?? []).forEach((r) => { lookup[r.id] = { title: r.title, authors: textList(r.authors) }; });

    setTopItems(sorted.map(([id, loans]) => ({
      title:   lookup[id]?.title   ?? '(Unknown)',
      authors: lookup[id]?.authors ?? '',
      loans,
    })));
  };

  const loadNeverBorrowed = async () => {
    const { data: loanedIds } = await supabase
      .from('loans')
      .select('catalogue_item_id')
      .not('catalogue_item_id', 'is', null);
    const loaned = new Set((loanedIds ?? []).map((r) => r.catalogue_item_id));

    const { data } = await supabase
      .from('catalogue_items')
      .select('id, title, authors, format, year')
      .order('created_at', { ascending: true });
    if (!data) return;
    setNeverItems(data.filter((r) => !loaned.has(r.id)).slice(0, 50));
  };

  const loadSubjects = async () => {
    const { data } = await supabase.from('catalogue_items').select('subjects');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => {
      const values = Array.isArray(r.subjects) ? r.subjects : String(r.subjects ?? '').split(/[;,|]/);
      values.map((s) => String(s).trim()).filter(Boolean).forEach((s) => {
        map[s] = (map[s] ?? 0) + 1;
      });
    });
    setSubjects(
      Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([subject, count]) => ({ subject, count }))
    );
  };

  const loadShelfOccupancy = async () => {
    const [{ data: shelves }, { data: itemCounts }] = await Promise.all([
      supabase.from('library_shelves').select('shelf_code, library_name, floor_room, description, subject_range, capacity').eq('status', 'active').order('shelf_code'),
      supabase.from('catalogue_items').select('shelf_code'),
    ]);
    if (!shelves) return;
    const countMap: Record<string, number> = {};
    (itemCounts ?? []).forEach((r) => { if (r.shelf_code) countMap[r.shelf_code] = (countMap[r.shelf_code] ?? 0) + 1; });
    setShelfOccupancy(
      shelves.map((s) => {
        const held = countMap[s.shelf_code] ?? 0;
        return { ...s, items_held: held, pct: s.capacity > 0 ? Math.round((held / s.capacity) * 100) : 0 };
      })
    );
  };

  const loadByLibrary = async () => {
    const { data } = await supabase.from('catalogue_items').select('library_code');
    if (!data) return;
    const map: Record<string, number> = {};
    data.forEach((r) => { const k = r.library_code || 'Unassigned'; map[k] = (map[k] ?? 0) + 1; });
    setByLibrary(Object.entries(map).map(([library, count]) => ({ library, count })).sort((a, b) => b.count - a.count));
  };

  const loadUnassigned = async () => {
    const { data } = await supabase
      .from('catalogue_items')
      .select('id, title, authors, format, year')
      .is('shelf_code', null)
      .order('created_at', { ascending: false })
      .limit(50);
    setUnassignedItems(data ?? []);
  };

  const loadTotals = async () => {
    const [{ count: items }, { count: copies }, { count: loans }] = await Promise.all([
      supabase.from('catalogue_items').select('id', { count: 'exact', head: true }),
      supabase.from('catalogue_copies').select('id', { count: 'exact', head: true }),
      supabase.from('loans').select('id', { count: 'exact', head: true }),
    ]);
    setTotals({ items: items ?? 0, copies: copies ?? 0, loans: loans ?? 0 });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
          <span className="text-sm text-gray-500">Loading statistics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Catalogue Statistics</h1>
        <p className="text-gray-600 mt-1">Collection overview, total holdings, authors, branch/faculty analytics and usage filters.</p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div>
          <label className="label">Format Filter</label>
          <select className="input" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
            <option value="">All Formats</option>
            {byFormat.map((f) => <option key={f.format} value={f.format}>{f.format}</option>)}
          </select>
        </div>
        <div className="text-sm text-neutral-500">Total holdings are counted across all branch libraries, faculty libraries and central holdings.</div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Items',  value: totals.items  },
          { label: 'Total Copies', value: totals.copies },
          { label: 'Total Loans',  value: totals.loans  },
        ].map((k) => (
          <div key={k.label} className="card text-center">
            <div className="text-4xl font-bold text-primary-800">{k.value.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Items by Format */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Items by Format</h2>
          {byFormat.length === 0 ? (
          <p className="text-gray-400 text-sm">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formatFilter ? byFormat.filter((f) => f.format === formatFilter) : byFormat} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="format" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Items" radius={[4, 4, 0, 0]}>
                {byFormat.map((_, i) => (
                  <rect key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Authors</h2>
          {authors.length === 0 ? <p className="text-gray-400 text-sm">No author data yet.</p> : <div className="space-y-2">{authors.map((a) => <div key={a.author} className="flex justify-between border-b border-neutral-100 pb-2 text-sm"><span>{a.author}</span><span className="font-semibold">{a.count}</span></div>)}</div>}
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Branches and Faculties</h2>
          {byBranch.length === 0 ? <p className="text-gray-400 text-sm">No branch data yet.</p> : <div className="space-y-2">{byBranch.map((b) => <div key={b.branch} className="flex justify-between border-b border-neutral-100 pb-2 text-sm"><span>{b.branch}</span><span className="font-semibold">{b.count}</span></div>)}</div>}
        </div>
      </div>

      {/* Items by Branch / Faculty */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Items by Location / Faculty</h2>
        {byBranch.length === 0 ? (
          <p className="text-gray-400 text-sm">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byBranch} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Items" fill="#005F73" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Items added per month */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Items Added — Last 12 Months</h2>
        {monthly.every((m) => m.count === 0) ? (
          <p className="text-gray-400 text-sm">No items added in the last 12 months.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" name="Items Added" stroke="#D4A017" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subject coverage */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Subject Coverage (Top 20)</h2>
        {subjects.length === 0 ? (
          <p className="text-gray-400 text-sm">No subject data found.</p>
        ) : (
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={s.subject} className="flex items-center gap-3">
                <div className="w-48 text-sm truncate text-gray-700">{s.subject}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(s.count / subjects[0].count) * 100}%`,
                      background: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
                <div className="w-10 text-right text-sm font-semibold">{s.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 20 most borrowed */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Top 20 Most Borrowed</h2>
        {topItems.length === 0 ? (
          <p className="text-gray-400 text-sm">No loan data found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">#</th>
                  <th className="text-left p-3 font-semibold">Title</th>
                  <th className="text-left p-3 font-semibold">Authors</th>
                  <th className="text-left p-3 font-semibold">Times Borrowed</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold text-primary-700">{i + 1}</td>
                    <td className="p-3 font-medium">{item.title}</td>
                    <td className="p-3 text-gray-600">{item.authors}</td>
                    <td className="p-3">
                      <span className="font-bold text-green-700">{item.loans}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Never borrowed */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Items Never Borrowed</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use this list for collection review — consider weeding or promoting these items.
        </p>
        {neverItems.length === 0 ? (
          <p className="text-gray-400 text-sm">All items have been borrowed at least once.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">Title</th>
                  <th className="text-left p-3 font-semibold">Authors</th>
                  <th className="text-left p-3 font-semibold">Format</th>
                  <th className="text-left p-3 font-semibold">Year</th>
                </tr>
              </thead>
              <tbody>
                {neverItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <a href={`/catalogue/${item.id}`} className="text-primary-700 hover:underline">
                        {item.title}
                      </a>
                    </td>
                    <td className="p-3 text-gray-600">{item.authors}</td>
                    <td className="p-3">
                      <span className="badge badge-secondary text-xs">{item.format}</span>
                    </td>
                    <td className="p-3 text-gray-600">{item.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {neverItems.length === 50 && (
              <p className="text-xs text-gray-400 px-3 py-2 border-t">Showing first 50 items.</p>
            )}
          </div>
        )}
      </div>
      {/* ── Shelf & Location Report ─────────────────────────────────────── */}
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-2xl font-bold mb-1">Shelf & Location Report</h2>
        <p className="text-gray-500 text-sm mb-6">Physical shelf occupancy, items per library, and unassigned items.</p>
      </div>

      {/* Items by Library */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Items by Library</h2>
        {byLibrary.length === 0 ? (
          <p className="text-gray-400 text-sm">No location data yet. Assign library codes when cataloguing items.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byLibrary} layout="vertical" margin={{ top: 4, right: 24, left: 80, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="library" tick={{ fontSize: 12 }} width={72} />
              <Tooltip />
              <Bar dataKey="count" name="Items" fill="#1F4E79" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Shelf Occupancy Overview */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Shelf Occupancy Overview</h2>
        {shelfOccupancy.length === 0 ? (
          <p className="text-gray-400 text-sm">No shelves configured yet. Add shelves in the <a href="/admin/shelves" className="text-primary-700 underline">Shelf Registry</a>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">Shelf Code</th>
                  <th className="text-left p-3 font-semibold">Library</th>
                  <th className="text-left p-3 font-semibold">Floor</th>
                  <th className="text-left p-3 font-semibold">Description</th>
                  <th className="text-left p-3 font-semibold">Subject</th>
                  <th className="text-right p-3 font-semibold">Items</th>
                  <th className="text-right p-3 font-semibold">Cap.</th>
                  <th className="text-left p-3 font-semibold w-32">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {shelfOccupancy.map((s) => {
                  const color = s.pct < 50 ? '#16a34a' : s.pct < 80 ? '#d97706' : '#dc2626';
                  return (
                    <tr key={s.shelf_code} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-mono font-semibold text-primary-700 text-xs">{s.shelf_code}</td>
                      <td className="p-3 text-gray-700 text-xs">{s.library_name}</td>
                      <td className="p-3 text-gray-500 text-xs">{s.floor_room}</td>
                      <td className="p-3 text-gray-600 text-xs">{s.description ?? '—'}</td>
                      <td className="p-3 text-gray-500 text-xs">{s.subject_range ?? '—'}</td>
                      <td className="p-3 text-right font-semibold">{s.items_held}</td>
                      <td className="p-3 text-right text-gray-500">{s.capacity}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.pct, 100)}%`, background: color }} />
                          </div>
                          <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{s.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Items Without Shelf Assignment */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Items Without Shelf Assignment</h2>
        <p className="text-sm text-gray-500 mb-4">
          These items have no shelf code. Edit them to assign a physical location.
        </p>
        {unassignedItems.length === 0 ? (
          <p className="text-gray-400 text-sm">All items have a shelf assignment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 font-semibold">Title</th>
                  <th className="text-left p-3 font-semibold">Authors</th>
                  <th className="text-left p-3 font-semibold">Format</th>
                  <th className="text-left p-3 font-semibold">Year</th>
                </tr>
              </thead>
              <tbody>
                {unassignedItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <a href={`/admin/catalogue`} className="text-primary-700 hover:underline">{item.title}</a>
                    </td>
                    <td className="p-3 text-gray-600">{item.authors}</td>
                    <td className="p-3">
                      <span className="badge badge-secondary text-xs">{item.format}</span>
                    </td>
                    <td className="p-3 text-gray-600">{item.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unassignedItems.length === 50 && (
              <p className="text-xs text-gray-400 px-3 py-2 border-t">Showing first 50 items.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
