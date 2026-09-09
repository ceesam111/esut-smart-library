import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string;
  faculty: string;
  category: string;
  body: string;
  tags: string;
  seo_title: string;
  seo_description: string;
  status: 'draft' | 'published';
  comments_enabled: boolean;
  created_at: string;
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BlogPost>({
    id: '',
    title: '',
    slug: '',
    cover_image_url: '',
    faculty: institutionConfig.faculties[0]?.code || '',
    category: 'news',
    body: '',
    tags: '',
    seo_title: '',
    seo_description: '',
    status: 'draft',
    comments_enabled: true,
    created_at: new Date().toISOString(),
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleInputChange = (field: keyof BlogPost, value: any) => {
    if (field === 'title') {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
        slug: generateSlug(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const savePost = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      alert('Title and body are required');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('blog_posts')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blog_posts').insert([formData]);
        if (error) throw error;
      }

      resetForm();
      fetchPosts();
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      title: '',
      slug: '',
      cover_image_url: '',
      faculty: institutionConfig.faculties[0]?.code || '',
      category: 'news',
      body: '',
      tags: '',
      seo_title: '',
      seo_description: '',
      status: 'draft',
      comments_enabled: true,
      created_at: new Date().toISOString(),
    });
    setEditingId(null);
    setShowForm(false);
  };

  const editPost = (post: BlogPost) => {
    setFormData(post);
    setEditingId(post.id);
    setShowForm(true);
  };

  if (loading) {
    return <div className="p-8">Loading blog posts...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Blog Management</h1>
          <p className="text-gray-600 mt-2">Create and manage blog posts</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          New Post
        </button>
      </div>

      {!showForm && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-3 font-semibold">Title</th>
                <th className="text-left p-3 font-semibold">Slug</th>
                <th className="text-left p-3 font-semibold">Faculty</th>
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Published</th>
                <th className="text-left p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{post.title}</td>
                  <td className="p-3 text-gray-600">{post.slug}</td>
                  <td className="p-3">{post.faculty}</td>
                  <td className="p-3">
                    <span className="badge badge-secondary">{post.category}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        post.status === 'published' ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">
                    {new Date(post.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 space-y-1">
                    <button
                      onClick={() => editPost(post)}
                      className="btn-outline text-xs py-1 px-2 block"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="btn-outline text-red-600 text-xs py-1 px-2 block"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {posts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No blog posts yet</p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="text-2xl font-semibold mb-6">
            {editingId ? 'Edit Post' : 'Create New Post'}
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="label">Title</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Post title"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Slug (auto-generated)</label>
                <input
                  type="text"
                  className="input w-full bg-gray-100"
                  value={formData.slug}
                  disabled
                />
              </div>

              <div>
                <label className="label">Faculty</label>
                <select
                  className="input w-full"
                  value={formData.faculty}
                  onChange={(e) => handleInputChange('faculty', e.target.value)}
                >
                  {institutionConfig.faculties.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  className="input w-full"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  <option value="news">News</option>
                  <option value="announcement">Announcement</option>
                  <option value="update">Update</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="research">Research</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label">Cover Image URL</label>
                <input
                  type="url"
                  className="input w-full"
                  value={formData.cover_image_url}
                  onChange={(e) => handleInputChange('cover_image_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Body / Content</label>
                <textarea
                  className="input w-full"
                  rows={10}
                  value={formData.body}
                  onChange={(e) => handleInputChange('body', e.target.value)}
                  placeholder="Write your post content here..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  placeholder="e.g., library, research, announcement"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">SEO Title</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.seo_title}
                  onChange={(e) => handleInputChange('seo_title', e.target.value)}
                  placeholder="SEO title (for search engines)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">SEO Description</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={formData.seo_description}
                  onChange={(e) => handleInputChange('seo_description', e.target.value)}
                  placeholder="Meta description for search engines"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.comments_enabled}
                    onChange={(e) => handleInputChange('comments_enabled', e.target.checked)}
                  />
                  <span className="font-medium">Enable Comments</span>
                </label>
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  className="input w-full"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value as 'draft' | 'published')}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <button onClick={resetForm} className="btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={savePost} className="btn-primary flex-1">
                {editingId ? 'Update Post' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
