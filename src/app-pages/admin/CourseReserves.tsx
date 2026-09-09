import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

interface ReadingList {
  id: string;
  course_title: string;
  course_code: string;
  department: string;
  semester: string;
  session: string;
  is_active: boolean;
  view_count: number;
  lecturer_id: string;
  created_at: string;
  lecturer_name?: string;
  item_count?: number;
  high_demand_count?: number;
}

interface ListItem {
  id: string;
  item_type: 'library' | 'oa_article' | 'uploaded_pdf';
  catalogue_item_id: string | null;
  doi: string | null;
  external_title: string | null;
  external_authors: string | null;
  external_journal: string | null;
  external_year: number | null;
  external_url: string | null;
  oa_pdf_url: string | null;
  pdf_url: string | null;
  reading_priority: 'required' | 'recommended';
  click_count: number;
  is_short_loan?: boolean;
}

const HIGH_DEMAND_THRESHOLD = 20;

export default function AdminCourseReserves() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReadingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [tab, setTab] = useState<'all' | 'high_demand'>('all');
  const [shortLoanMap, setShortLoanMap] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState('');

  useEffect(() => { fetchLists(); }, []);

  const fetchLists = async () => {
    setLoading(true);
    const { data: rawLists } = await supabase
      .from('course_reading_lists')
      .select('*, course_reading_list_items(count)')
      .order('created_at', { ascending: false });

    if (!rawLists) { setLoading(false); return; }

    // Fetch lecturer names in parallel
    const lecturerIds = [...new Set(rawLists.map((l: any) => l.lecturer_id).filter(Boolean))];
    const { data: patrons } = await supabase
      .from('patrons')
      .select('user_id, full_name')
      .in('user_id', lecturerIds);
    const nameMap: Record<string, string> = {};
    (patrons ?? []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });

    // For high-demand: count items with click_count >= threshold
    const { data: highDemandCounts } = await supabase
      .from('course_reading_list_items')
      .select('list_id')
      .gte('click_count', HIGH_DEMAND_THRESHOLD);

    const hdMap: Record<string, number> = {};
    (highDemandCounts ?? []).forEach((r: any) => {
      hdMap[r.list_id] = (hdMap[r.list_id] ?? 0) + 1;
    });

    const formatted = rawLists.map((l: any) => ({
      ...l,
      item_count: l.course_reading_list_items?.[0]?.count ?? 0,
      lecturer_name: nameMap[l.lecturer_id] ?? 'Unknown',
      high_demand_count: hdMap[l.id] ?? 0,
    }));

    setLists(formatted);
    setLoading(false);
  };

  const openList = async (list: ReadingList) => {
    setSelected(list);
    setItemsLoading(true);
    const { data } = await supabase
      .from('course_reading_list_items')
      .select('*')
      .eq('list_id', list.id)
      .order('reading_priority')
      .order('click_count', { ascending: false });

    const itemData = data ?? [];
    setItems(itemData);
    const slm: Record<string, boolean> = {};
    itemData.forEach((i: any) => { slm[i.id] = i.is_short_loan ?? false; });
    setShortLoanMap(slm);
    setItemsLoading(false);
  };

  const toggleShortLoan = async (itemId: string) => {
    setToggling(itemId);
    const next = !shortLoanMap[itemId];
    const { error } = await supabase
      .from('course_reading_list_items')
      .update({ is_short_loan: next })
      .eq('id', itemId);
    if (!error) setShortLoanMap(prev => ({ ...prev, [itemId]: next }));
    setToggling('');
  };

  const toggleListActive = async (list: ReadingList) => {
    const { error } = await supabase
      .from('course_reading_lists')
      .update({ is_active: !list.is_active })
      .eq('id', list.id);
    if (!error) {
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, is_active: !l.is_active } : l));
      if (selected?.id === list.id) setSelected(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
    }
  };

  const sendHighDemandAlert = async (list: ReadingList) => {
    if (!list.lecturer_id) return;
    const { data: patron } = await supabase
      .from('patrons')
      .select('email, full_name')
      .eq('user_id', list.lecturer_id)
      .maybeSingle();
    if (patron?.email) {
      const highItems = items.filter(i => i.click_count >= HIGH_DEMAND_THRESHOLD);
      const itemList = highItems.map(i => `<li>${i.external_title ?? '—'} (${i.click_count} views)</li>`).join('');
      const html = `<p>Dear ${patron.full_name ?? 'Lecturer'},</p><p>The following items on your reading list <strong>${list.course_code} — ${list.course_title}</strong> are experiencing high demand:</p><ul>${itemList}</ul><p>Please consider enabling short loans or acquiring additional copies. Contact the library for assistance.</p>`;
      await sendEmail(patron.email, patron.full_name ?? patron.email, `High-demand alert: ${list.course_code} reading list`, html);
      alert('Alert email sent to lecturer.');
    }
  };

  const displayedLists = tab === 'high_demand'
    ? lists.filter(l => (l.high_demand_count ?? 0) > 0)
    : lists;

  const totalViews = lists.reduce((s, l) => s + (l.view_count ?? 0), 0);
  const totalHighDemand = lists.reduce((s, l) => s + (l.high_demand_count ?? 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Course Reserves Management</h1>
        <p className="text-neutral-600 mt-1">Monitor lecturer reading lists, high-demand items, and short-loan toggles.</p>
      </div>

      <div className="card p-4 bg-primary-50 border-primary-200 text-sm text-primary-900">
        <p className="font-semibold mb-2">Data entry procedure</p>
        <p>Lecturers create or update reading lists from Lecturer Dashboard &gt; Reading Lists. Library staff then open each list here, confirm catalogue or open-access items, and toggle Short Loan for scarce/high-demand materials. If a course has no list, ask the lecturer to submit the course code, title, session, semester, department, and required/recommended items before activation.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Lists', lists.length, 'bg-primary-50 text-primary-700'],
          ['Active', lists.filter(l => l.is_active).length, 'bg-green-50 text-green-700'],
          ['High-Demand Items', totalHighDemand, 'bg-amber-50 text-amber-700'],
          ['Total Views', totalViews, 'bg-neutral-50 text-neutral-700'],
        ].map(([label, val, cls]) => (
          <div key={String(label)} className={`card p-4 ${cls}`}>
            <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
            <p className="text-2xl font-bold">{val}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {(['all', 'high_demand'] as const).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${tab === t ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
            {t === 'all' ? 'All Lists' : `High-Demand ${totalHighDemand > 0 ? `(${totalHighDemand})` : ''}`}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Lists table */}
        <div className="flex-1 card overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-neutral-400">Loading…</div>
          ) : displayedLists.length === 0 ? (
            <div className="p-8 text-center text-neutral-400">{tab === 'high_demand' ? 'No high-demand items detected.' : 'No reading lists found.'}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-50 text-left">
                <tr>
                  <th className="p-3 font-semibold">Course</th>
                  <th className="p-3 font-semibold">Lecturer</th>
                  <th className="p-3 font-semibold">Semester</th>
                  <th className="p-3 font-semibold">Items</th>
                  <th className="p-3 font-semibold">High-Demand</th>
                  <th className="p-3 font-semibold">Views</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedLists.map(list => (
                  <tr key={list.id} className={`border-b hover:bg-neutral-50 cursor-pointer ${selected?.id === list.id ? 'bg-primary-50' : ''}`} onClick={() => openList(list)}>
                    <td className="p-3">
                      <p className="font-semibold">{list.course_code}</p>
                      <p className="text-xs text-neutral-500 line-clamp-1">{list.course_title}</p>
                    </td>
                    <td className="p-3 text-xs text-neutral-600">{list.lecturer_name}</td>
                    <td className="p-3 text-xs text-neutral-500">{list.semester} · {list.session}</td>
                    <td className="p-3">
                      <span className="badge badge-primary text-xs">{list.item_count}</span>
                    </td>
                    <td className="p-3">
                      {(list.high_demand_count ?? 0) > 0 ? (
                        <span className="badge badge-warning text-xs">{list.high_demand_count} items</span>
                      ) : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="p-3 text-xs text-neutral-600">{list.view_count ?? 0}</td>
                    <td className="p-3">
                      <span className={`badge text-xs ${list.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {list.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button className="btn-outline text-xs py-1 px-2" onClick={e => { e.stopPropagation(); openList(list); }}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-[460px] shrink-0 card overflow-hidden flex flex-col max-h-[700px]">
            <div className="p-4 border-b bg-neutral-50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold">{selected.course_code} — {selected.course_title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{selected.lecturer_name} · {selected.semester} {selected.session}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">×</button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => toggleListActive(selected)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${selected.is_active ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                  {selected.is_active ? 'Deactivate List' : 'Activate List'}
                </button>
                {items.some(i => i.click_count >= HIGH_DEMAND_THRESHOLD) && (
                  <button
                    onClick={() => sendHighDemandAlert(selected)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                    Alert Lecturer
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {itemsLoading ? (
                <div className="p-6 text-center text-neutral-400 text-sm">Loading items…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-sm">No items in this list.</div>
              ) : (
                <div className="divide-y">
                  {items.map(item => {
                    const isHighDemand = item.click_count >= HIGH_DEMAND_THRESHOLD;
                    const isShortLoan = shortLoanMap[item.id] ?? false;
                    return (
                      <div key={item.id} className={`p-3 ${isHighDemand ? 'bg-amber-50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.reading_priority === 'required' ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-600'}`}>
                                {item.reading_priority}
                              </span>
                              {isHighDemand && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">High-demand</span>
                              )}
                            </div>
                            <p className="text-sm font-medium line-clamp-1">{item.external_title ?? '—'}</p>
                            {item.external_authors && <p className="text-xs text-neutral-500">{item.external_authors}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                              <span>{item.click_count} clicks</span>
                              {item.doi && <span>DOI: {item.doi}</span>}
                              {item.external_url && (
                                <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Link</a>
                              )}
                            </div>
                          </div>

                          {/* Short-loan toggle */}
                          <div className="shrink-0 flex flex-col items-center gap-1">
                            <label className="text-xs text-neutral-500 whitespace-nowrap">Short loan</label>
                            <button
                              onClick={() => toggleShortLoan(item.id)}
                              disabled={toggling === item.id}
                              className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${isShortLoan ? 'bg-primary-600' : 'bg-neutral-200'} disabled:opacity-50`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isShortLoan ? 'translate-x-4' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
