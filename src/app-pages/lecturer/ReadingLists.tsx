import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ReadingList {
  id: string;
  course_title: string;
  course_code: string;
  department: string;
  semester: string;
  session: string;
  is_active: boolean;
  view_count: number;
  item_count?: number;
  created_at: string;
}

interface ListItem {
  id: string;
  list_id: string;
  item_type: 'library' | 'oa_article' | 'uploaded_pdf';
  catalogue_item_id: string | null;
  doi: string | null;
  external_title: string | null;
  external_authors: string | null;
  external_journal: string | null;
  external_year: number | null;
  external_url: string | null;
  pdf_url: string | null;
  oa_pdf_url: string | null;
  reading_priority: 'required' | 'recommended';
  click_count: number;
  created_at: string;
}

interface CrossrefWork {
  title: string[];
  author?: { given?: string; family: string }[];
  'container-title'?: string[];
  published?: { 'date-parts': number[][] };
  URL?: string;
}

const SEMESTERS = ['First Semester', 'Second Semester', 'Harmattan', 'Rain'];
const SESSIONS = ['2025/2026', '2024/2025', '2023/2024'];

export default function LecturerReadingLists() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  // Create list modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newList, setNewList] = useState({ course_title: '', course_code: '', department: '', semester: SEMESTERS[0], session: SESSIONS[0] });

  // Active list panel
  const [activeList, setActiveList] = useState<ReadingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Add item modal
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemType, setAddItemType] = useState<'library' | 'oa_article' | 'uploaded_pdf'>('oa_article');
  const [addPriority, setAddPriority] = useState<'required' | 'recommended'>('required');
  const [doiInput, setDoiInput] = useState('');
  const [doiLookup, setDoiLookup] = useState<{ title: string; authors: string; journal: string; year: number; url: string; oaUrl: string } | null>(null);
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiError, setDoiError] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Catalogue search for library type
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueResults, setCatalogueResults] = useState<any[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [selectedCatalogue, setSelectedCatalogue] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);
      await fetchLists(user.id);
    })();
  }, []);

  const fetchLists = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('course_reading_lists')
      .select('*, course_reading_list_items(count)')
      .eq('lecturer_id', uid)
      .order('created_at', { ascending: false });

    const withCount = (data ?? []).map((l: any) => ({
      ...l,
      item_count: l.course_reading_list_items?.[0]?.count ?? 0,
    }));
    setLists(withCount);
    setLoading(false);
  };

  const handleCreateList = async () => {
    if (!newList.course_title.trim() || !newList.course_code.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from('course_reading_lists').insert({
      ...newList,
      lecturer_id: userId,
      is_active: true,
    }).select().single();
    if (!error && data) {
      setLists(prev => [{ ...data, item_count: 0 }, ...prev]);
      setShowCreate(false);
      setNewList({ course_title: '', course_code: '', department: '', semester: SEMESTERS[0], session: SESSIONS[0] });
      openList({ ...data, item_count: 0 });
    }
    setCreating(false);
  };

  const openList = async (list: ReadingList) => {
    setActiveList(list);
    setItemsLoading(true);
    const { data } = await supabase
      .from('course_reading_list_items')
      .select('*')
      .eq('list_id', list.id)
      .order('reading_priority')
      .order('created_at');
    setItems(data ?? []);
    setItemsLoading(false);
  };

  const toggleActive = async (list: ReadingList) => {
    const { error } = await supabase
      .from('course_reading_lists')
      .update({ is_active: !list.is_active })
      .eq('id', list.id);
    if (!error) {
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, is_active: !l.is_active } : l));
      if (activeList?.id === list.id) setActiveList(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
    }
  };

  // DOI lookup via Crossref + Unpaywall
  const lookupDoi = async (doi: string) => {
    const clean = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');
    if (!clean) return;
    setDoiLoading(true);
    setDoiError('');
    setDoiLookup(null);
    try {
      const [crRes, upRes] = await Promise.all([
        fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`),
        fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(clean)}?email=library@esut.edu.ng`),
      ]);
      if (!crRes.ok) throw new Error('DOI not found in Crossref. Check the DOI and try again.');
      const crData = await crRes.json();
      const work: CrossrefWork = crData.message;

      const title = work.title?.[0] ?? '';
      const authors = (work.author ?? []).map(a => `${a.given ?? ''} ${a.family}`.trim()).join(', ');
      const journal = work['container-title']?.[0] ?? '';
      const year = work.published?.['date-parts']?.[0]?.[0] ?? 0;
      const url = work.URL ?? `https://doi.org/${clean}`;

      let oaUrl = '';
      if (upRes.ok) {
        const upData = await upRes.json();
        oaUrl = upData.best_oa_location?.url_for_pdf ?? upData.best_oa_location?.url ?? '';
      }

      setDoiLookup({ title, authors, journal, year, url, oaUrl });
    } catch (e: any) {
      setDoiError(e.message ?? 'Failed to look up DOI');
    } finally {
      setDoiLoading(false);
    }
  };

  const searchCatalogue = async (q: string) => {
    if (!q.trim()) { setCatalogueResults([]); return; }
    setCatalogueLoading(true);
    const { data } = await supabase
      .from('catalogue_items')
      .select('id, title, authors, call_number')
      .ilike('title', `%${q}%`)
      .limit(8);
    setCatalogueResults(data ?? []);
    setCatalogueLoading(false);
  };

  const uploadPdf = async (file: File): Promise<string> => {
    const path = `course-reserves/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('repository').upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    const { data: { publicUrl } } = supabase.storage.from('repository').getPublicUrl(path);
    return publicUrl;
  };

  const handleAddItem = async () => {
    if (!activeList) return;
    setAddingItem(true);
    try {
      let payload: Partial<ListItem> = {
        list_id: activeList.id,
        item_type: addItemType,
        reading_priority: addPriority,
      };

      if (addItemType === 'oa_article') {
        if (!doiLookup) throw new Error('Run a DOI lookup first');
        payload = {
          ...payload,
          doi: doiInput.trim().replace(/^https?:\/\/doi\.org\//i, ''),
          external_title: doiLookup.title,
          external_authors: doiLookup.authors,
          external_journal: doiLookup.journal,
          external_year: doiLookup.year || null,
          external_url: doiLookup.url,
          oa_pdf_url: doiLookup.oaUrl || null,
        };
      } else if (addItemType === 'library') {
        if (!selectedCatalogue) throw new Error('Select a catalogue item');
        payload = {
          ...payload,
          catalogue_item_id: selectedCatalogue.id,
          external_title: selectedCatalogue.title,
          external_authors: Array.isArray(selectedCatalogue.authors)
            ? selectedCatalogue.authors.join(', ')
            : selectedCatalogue.authors ?? '',
        };
      } else if (addItemType === 'uploaded_pdf') {
        if (!pdfFile) throw new Error('Select a PDF file to upload');
        setPdfUploading(true);
        const url = await uploadPdf(pdfFile);
        setPdfUploading(false);
        payload = { ...payload, pdf_url: url, external_title: pdfFile.name.replace(/\.pdf$/i, '') };
      }

      const { data, error } = await supabase.from('course_reading_list_items').insert(payload).select().single();
      if (error) throw new Error(error.message);
      setItems(prev => [...prev, data]);
      setLists(prev => prev.map(l => l.id === activeList.id ? { ...l, item_count: (l.item_count ?? 0) + 1 } : l));

      // Reset form
      setDoiInput(''); setDoiLookup(null); setDoiError('');
      setCatalogueSearch(''); setCatalogueResults([]); setSelectedCatalogue(null);
      setPdfFile(null);
      setShowAddItem(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAddingItem(false);
      setPdfUploading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setDeletingItemId(itemId);
    const { error } = await supabase.from('course_reading_list_items').delete().eq('id', itemId);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== itemId));
      setLists(prev => prev.map(l => l.id === activeList?.id ? { ...l, item_count: Math.max((l.item_count ?? 1) - 1, 0) } : l));
    }
    setDeletingItemId('');
  };

  const itemTitle = (item: ListItem) =>
    item.external_title ?? item.pdf_url?.split('/').pop() ?? '—';

  const itemAuthors = (item: ListItem) =>
    item.external_authors ?? (item.catalogue_item_id ? 'Library item' : '');

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Course Reading Lists</h1>
          <p className="text-neutral-600 mt-1">Create and manage reading lists for your students.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + New Reading List
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Lists', lists.length],
          ['Active', lists.filter(l => l.is_active).length],
          ['Total Items', lists.reduce((s, l) => s + (l.item_count ?? 0), 0)],
          ['Total Views', lists.reduce((s, l) => s + (l.view_count ?? 0), 0)],
        ].map(([label, val]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-xs text-neutral-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-primary-700">{val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* List panel */}
        <div className="flex-1 card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-neutral-400">Loading…</div>
          ) : lists.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-neutral-600 font-medium">No reading lists yet.</p>
              <p className="text-neutral-400 text-sm mt-1">Create your first reading list to get started.</p>
            </div>
          ) : (
            <div className="divide-y">
              {lists.map(list => (
                <div key={list.id}
                  className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-neutral-50 transition-colors ${activeList?.id === list.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''}`}
                  onClick={() => openList(list)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm truncate">{list.course_code} — {list.course_title}</p>
                      <span className={`badge text-xs shrink-0 ${list.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {list.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">{list.semester} · {list.session} · {list.item_count ?? 0} items · {list.view_count} views</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); toggleActive(list); }}
                    className="text-xs btn-outline py-1 px-2 shrink-0"
                  >
                    {list.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Items panel */}
        {activeList && (
          <div className="w-[480px] shrink-0 card overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-neutral-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{activeList.course_code} — {activeList.course_title}</p>
                <p className="text-xs text-neutral-500">{activeList.semester} · {activeList.session}</p>
              </div>
              <button onClick={() => { setShowAddItem(true); setAddItemType('oa_article'); setDoiInput(''); setDoiLookup(null); setDoiError(''); setSelectedCatalogue(null); setCatalogueSearch(''); setPdfFile(null); }}
                className="btn-primary text-xs py-2 px-3">
                + Add Item
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {itemsLoading ? (
                <div className="p-6 text-center text-neutral-400 text-sm">Loading items…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-sm">No items yet. Add resources for your students.</div>
              ) : (
                <div className="divide-y">
                  {['required', 'recommended'].map(priority => {
                    const group = items.filter(i => i.reading_priority === priority);
                    if (group.length === 0) return null;
                    return (
                      <div key={priority}>
                        <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${priority === 'required' ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-500'}`}>
                          {priority}
                        </div>
                        {group.map(item => (
                          <div key={item.id} className="px-4 py-3 flex items-start gap-3 hover:bg-neutral-50">
                            <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${item.item_type === 'library' ? 'bg-primary-500' : item.item_type === 'oa_article' ? 'bg-green-500' : 'bg-amber-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2">{itemTitle(item)}</p>
                              {itemAuthors(item) && <p className="text-xs text-neutral-500 mt-0.5">{itemAuthors(item)}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.item_type === 'library' ? 'bg-primary-50 text-primary-700' : item.item_type === 'oa_article' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {item.item_type === 'library' ? 'Library' : item.item_type === 'oa_article' ? 'OA Article' : 'PDF Upload'}
                                </span>
                                {item.external_journal && <span className="text-xs text-neutral-400 truncate">{item.external_journal}</span>}
                                {item.external_year && <span className="text-xs text-neutral-400">({item.external_year})</span>}
                                <span className="text-xs text-neutral-400 ml-auto">{item.click_count} clicks</span>
                              </div>
                              {item.doi && <p className="text-xs text-neutral-400 mt-0.5">DOI: {item.doi}</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              disabled={deletingItemId === item.id}
                              className="text-neutral-300 hover:text-red-500 transition-colors text-lg leading-none shrink-0 mt-0.5"
                              title="Remove item"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create list modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold">New Reading List</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Course Code *</label>
                <input className="input w-full" value={newList.course_code} onChange={e => setNewList(p => ({ ...p, course_code: e.target.value }))} placeholder="e.g. EDU 301" />
              </div>
              <div>
                <label className="label">Course Title *</label>
                <input className="input w-full" value={newList.course_title} onChange={e => setNewList(p => ({ ...p, course_title: e.target.value }))} placeholder="Introduction to Education" />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input w-full" value={newList.department} onChange={e => setNewList(p => ({ ...p, department: e.target.value }))} placeholder="e.g. Dept. of Education" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Semester</label>
                  <select className="input w-full" value={newList.semester} onChange={e => setNewList(p => ({ ...p, semester: e.target.value }))}>
                    {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Session</label>
                  <select className="input w-full" value={newList.session} onChange={e => setNewList(p => ({ ...p, session: e.target.value }))}>
                    {SESSIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={handleCreateList}
                disabled={creating || !newList.course_title.trim() || !newList.course_code.trim()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add item modal */}
      {showAddItem && activeList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddItem(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold">Add Reading List Item</h3>

            {/* Type selector */}
            <div className="flex gap-2">
              {(['library', 'oa_article', 'uploaded_pdf'] as const).map(t => (
                <button key={t}
                  onClick={() => { setAddItemType(t); setDoiLookup(null); setDoiError(''); setSelectedCatalogue(null); setCatalogueSearch(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${addItemType === t ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-400'}`}>
                  {t === 'library' ? 'Library Item' : t === 'oa_article' ? 'OA Article (DOI)' : 'Upload PDF'}
                </button>
              ))}
            </div>

            {/* Priority */}
            <div>
              <label className="label text-sm">Reading Priority</label>
              <div className="flex gap-2">
                {(['required', 'recommended'] as const).map(p => (
                  <button key={p}
                    onClick={() => setAddPriority(p)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${addPriority === p ? (p === 'required' ? 'bg-red-600 text-white border-red-600' : 'bg-neutral-700 text-white border-neutral-700') : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* OA Article via DOI */}
            {addItemType === 'oa_article' && (
              <div className="space-y-3">
                <label className="label text-sm">DOI *</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={doiInput}
                    onChange={e => setDoiInput(e.target.value)}
                    placeholder="10.1234/example or full DOI URL"
                    onKeyDown={e => e.key === 'Enter' && lookupDoi(doiInput)}
                  />
                  <button onClick={() => lookupDoi(doiInput)} disabled={doiLoading || !doiInput.trim()} className="btn-outline px-4 disabled:opacity-50">
                    {doiLoading ? (
                      <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    ) : 'Lookup'}
                  </button>
                </div>
                {doiError && <p className="text-xs text-red-600">{doiError}</p>}
                {doiLookup && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1 text-sm">
                    <p className="font-semibold text-green-800">{doiLookup.title}</p>
                    {doiLookup.authors && <p className="text-green-700 text-xs">{doiLookup.authors}</p>}
                    <p className="text-green-600 text-xs">{doiLookup.journal}{doiLookup.year ? ` (${doiLookup.year})` : ''}</p>
                    {doiLookup.oaUrl ? (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Open Access PDF available
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600">No open-access PDF found — link only</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Library catalogue */}
            {addItemType === 'library' && (
              <div className="space-y-3">
                <label className="label text-sm">Search Catalogue *</label>
                <input
                  className="input w-full"
                  value={catalogueSearch}
                  onChange={e => { setCatalogueSearch(e.target.value); searchCatalogue(e.target.value); }}
                  placeholder="Search by title…"
                />
                {catalogueLoading && <p className="text-xs text-neutral-400">Searching…</p>}
                {catalogueResults.length > 0 && !selectedCatalogue && (
                  <div className="border rounded-xl overflow-hidden divide-y max-h-40 overflow-y-auto">
                    {catalogueResults.map(r => (
                      <button key={r.id} onClick={() => { setSelectedCatalogue(r); setCatalogueResults([]); setCatalogueSearch(r.title); }}
                        className="w-full text-left p-2.5 hover:bg-primary-50 text-sm transition-colors">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-neutral-400">{r.call_number}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCatalogue && (
                  <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary-800">{selectedCatalogue.title}</p>
                      <p className="text-xs text-primary-600 mt-0.5">{selectedCatalogue.call_number}</p>
                    </div>
                    <button onClick={() => { setSelectedCatalogue(null); setCatalogueSearch(''); }} className="text-neutral-400 hover:text-red-500 text-lg leading-none ml-3">×</button>
                  </div>
                )}
              </div>
            )}

            {/* PDF upload */}
            {addItemType === 'uploaded_pdf' && (
              <div className="space-y-2">
                <label className="label text-sm">Upload PDF *</label>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
                <button onClick={() => fileRef.current?.click()} className="btn-outline w-full text-sm">
                  {pdfFile ? pdfFile.name : 'Choose PDF file…'}
                </button>
                {pdfFile && <p className="text-xs text-neutral-500">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</p>}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddItem(false)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={handleAddItem}
                disabled={addingItem || pdfUploading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {pdfUploading ? 'Uploading PDF…' : addingItem ? 'Adding…' : 'Add to List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
