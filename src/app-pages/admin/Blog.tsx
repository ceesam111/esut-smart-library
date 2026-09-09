import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string | null;
  author: string;
  category: string;
  tags: string;
  body: any;
  content: string;
  status: 'draft' | 'published';
  comments_enabled: boolean;
  published_date: string | null;
  created_at: string;
}

interface BlogComment {
  id: string;
  post_id: string;
  patron_id: string | null;
  author_name: string;
  content: string;
  is_approved: boolean;
  created_at: string;
  post_title?: string;
}

const BLANK: Omit<BlogPost, 'id' | 'created_at'> = {
  title: '',
  slug: '',
  excerpt: '',
  cover_image_url: null,
  author: '',
  category: '',
  tags: '',
  body: null,
  content: '',
  status: 'draft',
  comments_enabled: true,
  published_date: null,
};

function toSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CATEGORIES = ['News', 'Research', 'Acquisitions', 'Events', 'Staff Pick', 'Student Voice', 'Technology', 'Announcement'];

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor' | 'comments'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentFilter, setCommentFilter] = useState<'pending' | 'approved'>('pending');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    load();
    loadPendingCount();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, author, category, tags, body, content, status, comments_enabled, published_date, created_at')
      .order('created_at', { ascending: false });
    setPosts(data ?? []);
    setLoading(false);
  }

  async function loadPendingCount() {
    const { count } = await supabase
      .from('blog_comments')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', false);
    setPendingCount(count ?? 0);
  }

  async function loadComments(approved: boolean) {
    setCommentsLoading(true);
    const { data } = await supabase
      .from('blog_comments')
      .select('id, post_id, patron_id, author_name, content, is_approved, created_at, blog_posts(title)')
      .eq('is_approved', approved)
      .order('created_at', { ascending: false });

    const mapped = (data ?? []).map((c: any) => ({
      ...c,
      post_title: c.blog_posts?.title ?? 'Unknown Post',
    }));
    setComments(mapped);
    setCommentsLoading(false);
  }

  async function approveComment(id: string) {
    await supabase.from('blog_comments').update({ is_approved: true }).eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
    setPendingCount(n => Math.max(0, n - 1));
  }

  async function deleteComment(id: string) {
    if (!confirm('Delete this comment permanently?')) return;
    await supabase.from('blog_comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
    if (!comments.find(c => c.id === id)?.is_approved) {
      setPendingCount(n => Math.max(0, n - 1));
    }
  }

  function openComments() {
    setCommentFilter('pending');
    loadComments(false);
    setView('comments');
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK });
    setSaved(false);
    setView('editor');
  }

  function openEdit(post: BlogPost) {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      cover_image_url: post.cover_image_url,
      author: post.author,
      category: post.category,
      tags: post.tags,
      body: post.body,
      content: post.content || '',
      status: post.status,
      comments_enabled: post.comments_enabled,
      published_date: post.published_date,
    });
    setSaved(false);
    setView('editor');
  }

  async function save(publish = false) {
    if (!form.title.trim()) return;
    setSaving(true);
    const data = {
      ...form,
      status: publish ? 'published' : form.status,
      published_date: publish && !form.published_date ? new Date().toISOString().slice(0, 10) : form.published_date,
    };

    if (editingId) {
      await supabase.from('blog_posts').update(data).eq('id', editingId);
    } else {
      const { data: row } = await supabase.from('blog_posts').insert(data).select('id').single();
      if (row) setEditingId(row.id);
    }

    setSaving(false);
    setSaved(true);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this post?')) return;
    await supabase.from('blog_posts').delete().eq('id', id);
    load();
  }

  const filtered = posts.filter(p => filter === 'all' || p.status === filter);

  const statusBadge = (s: string) => ({
    draft: 'bg-neutral-100 text-neutral-600',
    published: 'bg-green-100 text-green-700',
  }[s] ?? 'bg-neutral-100 text-neutral-600');

  if (view === 'editor') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { setView('list'); load(); }}
            className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-neutral-900">{editingId ? 'Edit Post' : 'New Post'}</h1>
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2 rounded-lg mb-4">
            Saved successfully.
          </div>
        )}

        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({
                ...f,
                title: e.target.value,
                slug: f.slug || toSlug(e.target.value),
              }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Post title"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="url-slug"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Author</label>
              <input
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Author name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tags (comma-separated)</label>
              <input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="library, news, events"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Cover Image URL</label>
            <input
              value={form.cover_image_url ?? ''}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value || null }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://images.pexels.com/..."
            />
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="Cover" className="mt-2 h-28 w-full object-cover rounded-lg" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Excerpt</label>
            <textarea
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              rows={2}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Short summary shown on the blog listing"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Body *</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={14}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono"
              placeholder="Write your post content here. HTML is supported."
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.comments_enabled}
                onChange={e => setForm(f => ({ ...f, comments_enabled: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-neutral-700">Comments enabled</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              {form.status !== 'published' && (
                <button
                  onClick={() => save(true)}
                  disabled={saving || !form.title.trim()}
                  className="px-4 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  Publish
                </button>
              )}
              {form.status === 'published' && (
                <button
                  onClick={() => save(false)}
                  disabled={saving || !form.title.trim()}
                  className="px-4 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Update'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'comments') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => { setView('list'); loadPendingCount(); }}
            className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-neutral-900">Comment Moderation</h1>
        </div>

        <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg mb-6 w-fit">
          <button
            onClick={() => { setCommentFilter('pending'); loadComments(false); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              commentFilter === 'pending' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Pending
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setCommentFilter('approved'); loadComments(true); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              commentFilter === 'approved' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Approved
          </button>
        </div>

        {commentsLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
            <p className="text-neutral-400 text-sm">
              {commentFilter === 'pending' ? 'No pending comments.' : 'No approved comments.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-neutral-900">{comment.author_name}</span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-xs text-neutral-400">
                        {new Date(comment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-xs text-neutral-500 truncate max-w-[200px]">on: {comment.post_title}</span>
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed">{comment.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!comment.is_approved && (
                      <button
                        onClick={() => approveComment(comment.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Blog</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage blog posts and articles.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openComments}
            className="relative border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Comments
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={openNew}
            className="bg-primary-700 hover:bg-primary-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg mb-6 w-fit">
        {(['all', 'draft', 'published'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {f} {f === 'all' ? `(${posts.length})` : `(${posts.filter(p => p.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <p className="text-neutral-400 text-sm">No posts found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Author</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Date</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(post => (
                <tr key={post.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-neutral-900 max-w-xs truncate">{post.title}</td>
                  <td className="px-4 py-3 text-neutral-500">{post.category || '—'}</td>
                  <td className="px-4 py-3 text-neutral-500">{post.author || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(post.status)}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {post.published_date ?? new Date(post.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(post)}
                        className="text-xs text-primary-700 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(post.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
