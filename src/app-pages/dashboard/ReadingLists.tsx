import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ReadingList {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  item_count: number;
}

interface ListItem {
  id: string;
  catalogue_item_id: string | null;
  item_type: string;
  item_title: string | null;
  item_authors: string | null;
  notes: string | null;
}

export default function ReadingLists() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [patronId, setPatronId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<ReadingList | null>(null);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate('/login'); return; }

      const { data: p } = await supabase.from('patrons').select('id').eq('user_id', userData.user.id).maybeSingle();
      if (!p) { setLoading(false); return; }
      setPatronId(p.id);
      await loadLists(p.id);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const loadLists = async (pid: string) => {
    const { data } = await supabase.from('reading_lists').select('id, name, description, is_public').eq('patron_id', pid).order('created_at', { ascending: false });
    const withCounts = await Promise.all((data ?? []).map(async (list) => {
      const { count } = await supabase.from('reading_list_items').select('*', { count: 'exact', head: true }).eq('reading_list_id', list.id);
      return { ...list, item_count: count ?? 0 };
    }));
    setLists(withCounts);
  };

  const openList = async (list: ReadingList) => {
    setSelectedList(list);
    setLoadingItems(true);
    const { data } = await supabase.from('reading_list_items')
      .select('id, catalogue_item_id, item_type, item_title, item_authors, notes')
      .eq('reading_list_id', list.id)
      .order('created_at', { ascending: false });
    setListItems(data ?? []);
    setLoadingItems(false);
  };

  const createList = async () => {
    if (!newName.trim() || !patronId) return;
    setCreating(true);
    const { data, error } = await supabase.from('reading_lists').insert({
      patron_id: patronId, name: newName.trim(),
      description: newDesc.trim() || null, is_public: newPublic,
    }).select('id, name, description, is_public').single();
    if (!error && data) {
      setLists(prev => [{ ...data, item_count: 0 }, ...prev]);
      setShowCreateModal(false);
      setNewName(''); setNewDesc(''); setNewPublic(false);
    }
    setCreating(false);
  };

  const togglePublic = async (listId: string, current: boolean) => {
    await supabase.from('reading_lists').update({ is_public: !current }).eq('id', listId);
    setLists(prev => prev.map(l => l.id === listId ? { ...l, is_public: !current } : l));
    if (selectedList?.id === listId) setSelectedList(prev => prev ? { ...prev, is_public: !current } : null);
  };

  const deleteList = async (listId: string) => {
    if (!confirm('Delete this reading list and all its items?')) return;
    setDeletingId(listId);
    await supabase.from('reading_lists').delete().eq('id', listId);
    setLists(prev => prev.filter(l => l.id !== listId));
    if (selectedList?.id === listId) setSelectedList(null);
    setDeletingId(null);
  };

  const removeItem = async (itemId: string) => {
    await supabase.from('reading_list_items').delete().eq('id', itemId);
    setListItems(prev => prev.filter(i => i.id !== itemId));
    setLists(prev => prev.map(l => l.id === selectedList?.id ? { ...l, item_count: l.item_count - 1 } : l));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
          <span className="text-sm text-neutral-500">Loading reading lists…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">Reading Lists</h1>
          <p className="text-neutral-500 text-sm mt-1">Organise your research and course materials</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New List
        </button>
      </div>

      {selectedList ? (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedList(null)} className="text-primary-600 hover:text-primary-800 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="font-semibold text-neutral-800">{selectedList.name}</h2>
                {selectedList.description && <p className="text-xs text-neutral-500 mt-0.5">{selectedList.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => togglePublic(selectedList.id, selectedList.is_public)}
                className={`badge cursor-pointer transition-colors ${selectedList.is_public ? 'badge-success' : 'badge-secondary'}`}>
                {selectedList.is_public ? 'Public' : 'Private'}
              </button>
              <button onClick={() => deleteList(selectedList.id)} disabled={deletingId === selectedList.id}
                className="p-1.5 rounded text-error-500 hover:bg-error-50 transition-colors disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>

          <div className="p-6">
            {loadingItems ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
              </div>
            ) : listItems.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />
                </svg>
                <p className="text-neutral-500 mb-4">No items in this list yet</p>
                <Link to="/catalogue" className="btn-primary text-sm">Browse Catalogue</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {listItems.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-4 p-4 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge text-xs capitalize">{item.item_type}</span>
                      </div>
                      <p className="font-medium text-neutral-800 text-sm leading-tight">
                        {item.item_title ?? 'Untitled'}
                      </p>
                      {item.item_authors && (
                        <p className="text-xs text-neutral-500 mt-0.5">{item.item_authors}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-neutral-600 mt-1 italic">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.catalogue_item_id && (
                        <Link to={`/catalogue/${item.catalogue_item_id}`} className="btn-outline text-xs py-1.5 px-3">View</Link>
                      )}
                      <button onClick={() => removeItem(item.id)} className="btn-ghost text-xs py-1.5 px-3 text-error-600 hover:bg-error-50">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {lists.length === 0 ? (
            <div className="card p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-neutral-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="font-semibold text-neutral-700 mb-2">No Reading Lists Yet</h3>
              <p className="text-neutral-500 text-sm mb-6">Create your first list to organise course materials and research.</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">Create First List</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map(list => (
                <div key={list.id} className="card p-5 hover:shadow-card-hover transition-shadow cursor-pointer group"
                  onClick={() => openList(list)}>
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3 className="font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors leading-tight">{list.name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={e => { e.stopPropagation(); togglePublic(list.id, list.is_public); }}
                        className={`badge cursor-pointer text-xs transition-colors ${list.is_public ? 'badge-success' : 'badge-secondary'}`}>
                        {list.is_public ? 'Public' : 'Private'}
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteList(list.id); }}
                        disabled={deletingId === list.id}
                        className="p-1 rounded text-neutral-400 hover:text-error-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {list.description && (
                    <p className="text-xs text-neutral-500 mb-3 leading-relaxed line-clamp-2">{list.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-sm">
                    <span className="text-neutral-500">{list.item_count} {list.item_count === 1 ? 'item' : 'items'}</span>
                    <svg className="w-4 h-4 text-primary-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-serif font-semibold text-primary-800">New Reading List</h2>
            <div>
              <label className="label text-xs font-semibold text-neutral-600 block mb-1">List Name *</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g., Education Theory Resources"
                className="input w-full" autoFocus
                onKeyDown={e => e.key === 'Enter' && createList()} />
            </div>
            <div>
              <label className="label text-xs font-semibold text-neutral-600 block mb-1">Description (optional)</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Add notes about this list"
                className="input w-full resize-none" rows={2} />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={newPublic} onChange={e => setNewPublic(e.target.checked)} className="rounded" />
              <span className="text-sm text-neutral-600">Make this list public (visible to other patrons)</span>
            </label>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowCreateModal(false); setNewName(''); setNewDesc(''); setNewPublic(false); }}
                disabled={creating} className="btn-outline flex-1">Cancel</button>
              <button onClick={createList} disabled={!newName.trim() || creating} className="btn-primary flex-1 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
