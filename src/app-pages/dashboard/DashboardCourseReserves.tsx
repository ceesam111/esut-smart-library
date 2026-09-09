import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface CourseList {
  id: string;
  course_code: string;
  course_title: string;
  semester: string;
  session: string;
  department: string;
  is_active: boolean;
  items: CourseItem[];
}

interface CourseItem {
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
}

const HIGH_DEMAND_THRESHOLD = 20;

export default function DashboardCourseReserves() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<CourseList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [patronId, setPatronId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data: patron } = await supabase
        .from('patrons')
        .select('id, department')
        .eq('user_id', user.id)
        .maybeSingle();

      setPatronId(patron?.id ?? '');

      // Load active reading lists — public (no auth filter on department for now)
      const { data: rawLists } = await supabase
        .from('course_reading_lists')
        .select('*, course_reading_list_items(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const formatted = (rawLists ?? []).map((l: any) => ({
        id: l.id,
        course_code: l.course_code,
        course_title: l.course_title,
        semester: l.semester,
        session: l.session,
        department: l.department,
        is_active: l.is_active,
        items: (l.course_reading_list_items ?? []).sort((a: CourseItem, b: CourseItem) =>
          a.reading_priority === 'required' && b.reading_priority !== 'required' ? -1 : 1
        ),
      }));

      setLists(formatted);
      setLoading(false);
    })();
  }, [navigate]);

  const recordClick = async (item: CourseItem) => {
    if (tracking === item.id) return;
    setTracking(item.id);

    // Increment click count — fire-and-forget direct update (no RPC required)
    supabase.from('course_reading_list_items')
      .update({ click_count: item.click_count + 1 })
      .eq('id', item.id);

    // Log reserve click for patron
    if (patronId) {
      await supabase.from('reserve_clicks').insert({ item_id: item.id, patron_id: patronId });
    }

    setTracking('');
  };

  const openLink = (item: CourseItem) => {
    recordClick(item);
    const url = item.oa_pdf_url || item.pdf_url || item.external_url || (item.doi ? `https://doi.org/${item.doi}` : null);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const catalogueHref = (item: CourseItem) =>
    item.catalogue_item_id ? `/catalogue/${item.catalogue_item_id}` : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500 text-sm">Loading course reading lists…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Course Reading Lists</h1>
          <p className="text-neutral-500 mt-2">Required and recommended materials for your courses.</p>
        </div>

        {lists.length === 0 ? (
          <div className="card bg-white p-12 text-center rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">No active reading lists</h3>
            <p className="text-neutral-500 text-sm mb-6">Your lecturers haven't published any reading lists yet.</p>
            <a href="/dashboard" className="btn-primary inline-block px-6 py-2">Back to Dashboard</a>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map(list => {
              const required = list.items.filter(i => i.reading_priority === 'required');
              const recommended = list.items.filter(i => i.reading_priority !== 'required');
              const highDemandCount = list.items.filter(i => i.click_count >= HIGH_DEMAND_THRESHOLD).length;
              const isOpen = expanded === list.id;

              return (
                <div key={list.id} className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : list.id)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-neutral-900">{list.course_code}</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-600 text-sm">{list.semester} {list.session}</span>
                        {highDemandCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">
                            {highDemandCount} high-demand
                          </span>
                        )}
                      </div>
                      <p className="text-neutral-700 font-medium">{list.course_title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {required.length} required · {recommended.length} recommended
                        {list.department && ` · ${list.department}`}
                      </p>
                    </div>
                    <svg className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-neutral-100 px-6 py-4 bg-neutral-50 space-y-4">
                      {list.items.length === 0 && (
                        <p className="text-neutral-400 text-sm text-center py-4">No items in this list yet.</p>
                      )}

                      {required.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-red-700 mb-3">Required Reading</h4>
                          <div className="space-y-2">
                            {required.map(item => <ItemCard key={item.id} item={item} onOpen={openLink} catalogueHref={catalogueHref(item)} isTracking={tracking === item.id} />)}
                          </div>
                        </div>
                      )}

                      {recommended.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">Recommended Reading</h4>
                          <div className="space-y-2">
                            {recommended.map(item => <ItemCard key={item.id} item={item} onOpen={openLink} catalogueHref={catalogueHref(item)} isTracking={tracking === item.id} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <a href="/dashboard" className="btn-ghost px-4 py-2 rounded-lg font-medium mt-6 inline-block text-sm">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}

function ItemCard({ item, onOpen, catalogueHref, isTracking }: {
  item: CourseItem;
  onOpen: (item: CourseItem) => void;
  catalogueHref: string | null;
  isTracking: boolean;
}) {
  const isHighDemand = item.click_count >= HIGH_DEMAND_THRESHOLD;
  const hasAccess = !!(item.oa_pdf_url || item.pdf_url || item.external_url || item.doi || item.catalogue_item_id);

  return (
    <div className={`bg-white rounded-xl p-4 border flex items-start gap-4 ${item.reading_priority === 'required' ? 'border-l-4 border-l-red-400 border-neutral-100' : 'border-neutral-100'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-0.5">
          <p className="font-semibold text-sm text-neutral-900 line-clamp-2">{item.external_title ?? '—'}</p>
          {isHighDemand && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">High demand</span>
          )}
        </div>
        {item.external_authors && <p className="text-xs text-neutral-500 mb-0.5">{item.external_authors}</p>}
        <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-400">
          {item.external_journal && <span>{item.external_journal}</span>}
          {item.external_year && <span>({item.external_year})</span>}
          {item.doi && <span>DOI: {item.doi}</span>}
          <span className={`px-1.5 py-0.5 rounded font-medium ${item.item_type === 'library' ? 'bg-primary-50 text-primary-700' : item.item_type === 'oa_article' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {item.item_type === 'library' ? 'Library' : item.item_type === 'oa_article' ? 'OA Article' : 'PDF'}
          </span>
        </div>
        {isHighDemand && (
          <p className="text-xs text-amber-600 mt-1">This item is in high demand. Visit the library for physical access if online unavailable.</p>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-2 items-end">
        {item.catalogue_item_id && catalogueHref ? (
          <a href={catalogueHref} className="btn-outline text-xs py-1.5 px-3 whitespace-nowrap">
            Library Catalogue
          </a>
        ) : hasAccess ? (
          <button onClick={() => onOpen(item)} disabled={isTracking} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap disabled:opacity-50">
            {item.oa_pdf_url || item.pdf_url ? 'Open PDF' : 'Access Article'}
          </button>
        ) : (
          <span className="text-xs text-neutral-400 italic">No online access</span>
        )}
      </div>
    </div>
  );
}
