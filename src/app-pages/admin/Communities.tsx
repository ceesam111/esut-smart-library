import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  faculty_code: string | null;
  logo_url: string | null;
  sort_order: number | null;
  created_at: string;
  collections?: Collection[];
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  community_id: string;
  sort_order: number | null;
  created_at: string;
}

export default function Communities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'communities' | 'collections'>('communities');
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [communityForm, setCommunityForm] = useState({
    name: '',
    slug: '',
    description: '',
    faculty_code: '',
    sort_order: 0,
  });

  const [collectionForm, setCollectionForm] = useState({
    name: '',
    slug: '',
    description: '',
    community_id: '',
    sort_order: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: communitiesData, error: commErr } = await supabase
        .from('repository_communities')
        .select('*, repository_collections(*)')
        .order('sort_order', { ascending: true });

      if (commErr) throw commErr;
      setCommunities(communitiesData ?? []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...communityForm,
        slug: communityForm.slug || communityForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: communityForm.description || null,
        faculty_code: communityForm.faculty_code || null,
      };

      if (editingCommunity) {
        const { error } = await supabase
          .from('repository_communities')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingCommunity.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('repository_communities').insert(data);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingCommunity(null);
      setCommunityForm({ name: '', slug: '', description: '', faculty_code: '', sort_order: 0 });
      fetchData();
    } catch (error) {
      console.error('Error saving community:', error);
    }
  };

  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...collectionForm,
        slug: collectionForm.slug || collectionForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: collectionForm.description || null,
      };

      if (editingCollection) {
        const { error } = await supabase
          .from('repository_collections')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingCollection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('repository_collections').insert(data);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingCollection(null);
      setCollectionForm({ name: '', slug: '', description: '', community_id: '', sort_order: 0 });
      fetchData();
    } catch (error) {
      console.error('Error saving collection:', error);
    }
  };

  const handleDeleteCommunity = async (id: string) => {
    if (!confirm('Delete this community and all its collections?')) return;
    try {
      await supabase.from('repository_collections').delete().eq('community_id', id);
      const { error } = await supabase.from('repository_communities').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting community:', error);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Delete this collection?')) return;
    try {
      const { error } = await supabase.from('repository_collections').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting collection:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <BackButton />
          <h1 className="text-4xl font-bold text-gray-900">Communities & Collections</h1>
          <p className="text-gray-600 mt-2">Manage repository structure</p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('communities')}
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'communities'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Communities ({communities.length})
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-6 py-3 rounded-lg font-semibold ${
              activeTab === 'collections'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Collections ({communities.reduce((acc, c) => acc + (c.collections?.length ?? 0), 0)})
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingCommunity(null);
              setEditingCollection(null);
              if (activeTab === 'communities') {
                setCommunityForm({ name: '', slug: '', description: '', faculty_code: '', sort_order: 0 });
              } else {
                setCollectionForm({ name: '', slug: '', description: '', community_id: communities[0]?.id ?? '', sort_order: 0 });
              }
            }}
            className="ml-auto px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
          >
            + Add {activeTab === 'communities' ? 'Community' : 'Collection'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingCommunity || editingCollection ? 'Edit' : 'Add New'}{' '}
              {activeTab === 'communities' ? 'Community' : 'Collection'}
            </h2>
            <form onSubmit={activeTab === 'communities' ? handleCommunitySubmit : handleCollectionSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={activeTab === 'communities' ? communityForm.name : collectionForm.name}
                    onChange={(e) =>
                      activeTab === 'communities'
                        ? setCommunityForm({ ...communityForm, name: e.target.value })
                        : setCollectionForm({ ...collectionForm, name: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    value={activeTab === 'communities' ? communityForm.slug : collectionForm.slug}
                    onChange={(e) =>
                      activeTab === 'communities'
                        ? setCommunityForm({ ...communityForm, slug: e.target.value })
                        : setCollectionForm({ ...collectionForm, slug: e.target.value })
                    }
                    placeholder="auto-generated from name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={activeTab === 'communities' ? communityForm.description : collectionForm.description}
                  onChange={(e) =>
                    activeTab === 'communities'
                      ? setCommunityForm({ ...communityForm, description: e.target.value })
                      : setCollectionForm({ ...collectionForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {activeTab === 'communities' ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Faculty Code</label>
                    <input
                      type="text"
                      value={communityForm.faculty_code}
                      onChange={(e) => setCommunityForm({ ...communityForm, faculty_code: e.target.value })}
                      placeholder="e.g., SCI, ENG"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={communityForm.sort_order}
                      onChange={(e) => setCommunityForm({ ...communityForm, sort_order: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Community *</label>
                    <select
                      value={collectionForm.community_id}
                      onChange={(e) => setCollectionForm({ ...collectionForm, community_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select community...</option>
                      {communities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={collectionForm.sort_order}
                      onChange={(e) => setCollectionForm({ ...collectionForm, sort_order: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
                  {editingCommunity || editingCollection ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCommunity(null);
                    setEditingCollection(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'communities' ? (
          <div className="grid gap-4">
            {communities.map((community) => (
              <div key={community.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{community.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">/{community.slug}</p>
                    {community.description && (
                      <p className="text-gray-600 mt-2">{community.description}</p>
                    )}
                    <div className="flex gap-4 mt-3 text-sm text-gray-500">
                      {community.faculty_code && <span>Faculty: {community.faculty_code}</span>}
                      <span>{community.collections?.length ?? 0} collections</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCommunity(community);
                        setCommunityForm({
                          name: community.name,
                          slug: community.slug,
                          description: community.description ?? '',
                          faculty_code: community.faculty_code ?? '',
                          sort_order: community.sort_order ?? 0,
                        });
                        setShowForm(true);
                      }}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCommunity(community.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {community.collections && community.collections.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Collections:</p>
                    <div className="flex flex-wrap gap-2">
                      {community.collections.map((col) => (
                        <span key={col.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                          {col.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Community</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {communities.flatMap((c) =>
                  (c.collections ?? []).map((col) => (
                    <tr key={col.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{col.name}</td>
                      <td className="px-6 py-4 text-gray-600">{c.name}</td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-sm">/{col.slug}</td>
                      <td className="px-6 py-4 flex gap-3">
                        <button
                          onClick={() => {
                            setEditingCollection(col);
                            setCollectionForm({
                              name: col.name,
                              slug: col.slug,
                              description: col.description ?? '',
                              community_id: col.community_id,
                              sort_order: col.sort_order ?? 0,
                            });
                            setShowForm(true);
                          }}
                          className="text-primary-600 hover:text-primary-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCollection(col.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
