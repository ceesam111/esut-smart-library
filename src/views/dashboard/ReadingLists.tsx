import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ReadingList {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  item_count: number;
}

interface ReadingListItem {
  id: string;
  item_title: string;
  item_authors: string;
  item_id: string;
}

interface ListWithItems extends ReadingList {
  items?: ReadingListItem[];
}

export default function ReadingLists() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ListWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [patronId, setPatronId] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [listItems, setListItems] = useState<ReadingListItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  useEffect(() => {
    const fetchReadingLists = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate('/login');
          return;
        }

        const { data: patronData, error: patronError } = await supabase
          .from('patrons')
          .select('id')
          .eq('user_id', userData.user.id)
          .single();

        if (patronError) throw patronError;
        setPatronId(patronData.id);

        const { data: listsData, error: listsError } = await supabase
          .from('reading_lists')
          .select('id, name, description, is_public')
          .eq('patron_id', patronData.id)
          .order('created_at', { ascending: false });

        if (listsError) throw listsError;

        const listsWithCounts = await Promise.all(
          (listsData || []).map(async (list) => {
            const { count, error: countError } = await supabase
              .from('reading_list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', list.id);

            return {
              ...list,
              item_count: count || 0,
            };
          })
        );

        setLists(listsWithCounts);
      } catch (error) {
        console.error('Error fetching reading lists:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReadingLists();
  }, [navigate]);

  const handleSelectList = async (listId: string) => {
    setSelectedList(listId);
    try {
      const { data: items, error } = await supabase
        .from('reading_list_items')
        .select('id, item_title, item_authors, item_id')
        .eq('list_id', listId);

      if (error) throw error;
      setListItems(items || []);
    } catch (error) {
      console.error('Error fetching list items:', error);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !patronId) return;

    setCreatingList(true);
    try {
      const { data, error } = await supabase
        .from('reading_lists')
        .insert([
          {
            patron_id: patronId,
            name: newListName,
            description: newListDescription || null,
            is_public: false,
          },
        ])
        .select();

      if (error) throw error;

      setLists([
        ...lists,
        {
          ...data[0],
          item_count: 0,
        },
      ]);

      setShowCreateModal(false);
      setNewListName('');
      setNewListDescription('');
    } catch (error) {
      console.error('Error creating list:', error);
    } finally {
      setCreatingList(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('reading_list_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setListItems(listItems.filter((item) => item.id !== itemId));
      setLists(
        lists.map((list) =>
          list.id === selectedList
            ? { ...list, item_count: list.item_count - 1 }
            : list
        )
      );
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleTogglePublic = async (listId: string, isPublic: boolean) => {
    try {
      const { error } = await supabase
        .from('reading_lists')
        .update({ is_public: !isPublic })
        .eq('id', listId);

      if (error) throw error;

      setLists(
        lists.map((list) =>
          list.id === listId ? { ...list, is_public: !isPublic } : list
        )
      );
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reading lists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Reading Lists</h1>
            <p className="text-gray-600 mt-2">Organize your research materials</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary px-6 py-3 rounded font-semibold"
          >
            + New List
          </button>
        </div>

        {selectedList ? (
          <div className="card bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 p-6 flex justify-between items-center">
              <button
                onClick={() => setSelectedList(null)}
                className="text-primary-700 hover:underline font-semibold mb-4"
              >
                ← Back to Lists
              </button>
            </div>

            <div className="p-6">
              {listItems.length > 0 ? (
                <div className="space-y-3">
                  {listItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {item.item_title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.item_authors}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <a
                          href={`/catalogue/${item.item_id}`}
                          className="btn-outline px-3 py-1 rounded text-sm font-semibold whitespace-nowrap"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="btn-ghost px-3 py-1 rounded text-sm font-semibold text-red-600 whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">No items in this list yet</p>
                  <a
                    href="/catalogue"
                    className="btn-primary inline-block px-4 py-2 rounded font-semibold"
                  >
                    Add Items from Catalogue
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.length > 0 ? (
              lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleSelectList(list.id)}
                  className="card bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {list.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePublic(list.id, list.is_public);
                      }}
                      className={`badge px-2 py-1 rounded text-xs font-semibold ${
                        list.is_public
                          ? 'badge-success'
                          : 'badge-secondary'
                      }`}
                    >
                      {list.is_public ? 'Public' : 'Private'}
                    </button>
                  </div>

                  {list.description && (
                    <p className="text-sm text-gray-600 mb-4">
                      {list.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">
                      {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                    </span>
                    <span className="text-primary-700 font-semibold">→</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full card bg-white rounded-lg shadow p-12 text-center">
                <div className="mb-4 text-5xl">📚</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Reading Lists Yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first reading list to organize course materials and
                  research.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary inline-block px-6 py-2 rounded font-semibold"
                >
                  Create First List
                </button>
              </div>
            )}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
            <div className="card bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Create New List
              </h2>

              <div className="mb-4">
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  List Name
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Quantum Physics Research"
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-6">
                <label className="label block text-sm font-semibold text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Add notes about this list"
                  className="input w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewListName('');
                    setNewListDescription('');
                  }}
                  className="btn-outline flex-1 px-4 py-2 rounded font-semibold"
                  disabled={creatingList}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateList}
                  className="btn-primary flex-1 px-4 py-2 rounded font-semibold disabled:opacity-50"
                  disabled={!newListName.trim() || creatingList}
                >
                  {creatingList ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        <a href="/dashboard" className="btn-ghost px-4 py-2 rounded font-semibold mt-6 block w-fit">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
