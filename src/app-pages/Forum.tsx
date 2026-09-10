import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

// ── Types ────────────────────────────────────────────────────────────────────

interface ForumCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  slug: string;
  sort_order: number;
  is_staff_only: boolean;
  thread_count?: number;
}

interface ForumThread {
  id: string;
  category_id: string;
  user_id: string;
  title: string;
  body: string;
  author_name: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  views: number;
  last_post_at: string;
  created_at: string;
}

interface ForumPost {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  author_name: string;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
}

type View =
  | { type: 'home' }
  | { type: 'category'; category: ForumCategory }
  | { type: 'thread'; thread: ForumThread; category: ForumCategory };

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN = '#6B1D2A';
const GOLD  = '#D4A017';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  const hue = name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}
      style={{ background: `hsl(${hue},45%,40%)` }}
    >
      {initials || '?'}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Forum() {
  usePageTitle('Community Forum');

  const [view, setView]         = useState<View>({ type: 'home' });
  const [user, setUser]         = useState<any>(null);
  const [patron, setPatron]     = useState<any>(null);
  const [isStaff, setIsStaff]   = useState(false);
  const [loading, setLoading]   = useState(true);

  // Home data
  const [categories, setCategories] = useState<ForumCategory[]>([]);

  // Category data
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  // Thread data
  const [posts, setPosts]               = useState<ForumPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [reactions, setReactions]       = useState<Record<string, number>>({});
  const [userReacted, setUserReacted]   = useState<Set<string>>(new Set());

  // Forms
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle]           = useState('');
  const [newBody, setNewBody]             = useState('');
  const [posting, setPosting]             = useState(false);

  const [replyBody, setReplyBody]   = useState('');
  const [replying, setReplying]     = useState(false);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody]           = useState('');

  const replyRef = useRef<HTMLTextAreaElement>(null);

  // ── Auth & Initial Load ────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      setUser(u ?? null);
      if (u) {
        const [patronRes, libRes] = await Promise.all([
          supabase.from('patrons').select('full_name, patron_category').eq('user_id', u.id).maybeSingle(),
          supabase.from('librarians').select('id').eq('user_id', u.id).maybeSingle(),
        ]);
        setPatron(patronRes.data);
        setIsStaff(!!libRes.data);
      }
    });
    loadCategories();
  }, []);

  // ── Category Home ──────────────────────────────────────────────────────────

  async function loadCategories() {
    setLoading(true);
    const [catsRes, threadsRes] = await Promise.all([
      supabase.from('forum_categories').select('*').order('sort_order'),
      supabase.from('forum_threads').select('id, category_id'),
    ]);
    const cats  = (catsRes.data ?? []) as ForumCategory[];
    const allTh = (threadsRes.data ?? []) as Pick<ForumThread, 'id' | 'category_id'>[];
    const counts: Record<string, number> = {};
    allTh.forEach(t => { counts[t.category_id] = (counts[t.category_id] ?? 0) + 1; });
    setCategories(cats.map(c => ({ ...c, thread_count: counts[c.id] ?? 0 })));
    setLoading(false);
  }

  // ── Thread List ────────────────────────────────────────────────────────────

  async function openCategory(cat: ForumCategory) {
    setView({ type: 'category', category: cat });
    setShowNewThread(false);
    setThreadsLoading(true);
    const { data } = await supabase
      .from('forum_threads')
      .select('*')
      .eq('category_id', cat.id)
      .order('is_pinned', { ascending: false })
      .order('last_post_at', { ascending: false });
    setThreads((data ?? []) as ForumThread[]);
    setThreadsLoading(false);
  }

  // ── Thread Detail ──────────────────────────────────────────────────────────

  async function openThread(thread: ForumThread, category: ForumCategory) {
    setView({ type: 'thread', thread, category });
    setReplyBody('');
    setEditingPostId(null);
    setPostsLoading(true);

    // Increment view count (fire-and-forget)
    supabase.from('forum_threads').update({ views: thread.views + 1 }).eq('id', thread.id);

    const [postsRes, reactionsRes] = await Promise.all([
      supabase.from('forum_posts').select('*').eq('thread_id', thread.id).order('created_at'),
      supabase.from('forum_reactions').select('post_id, user_id'),
    ]);
    const loadedPosts = (postsRes.data ?? []) as ForumPost[];
    setPosts(loadedPosts);

    const reactionData = reactionsRes.data ?? [];
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    reactionData.forEach(r => {
      counts[r.post_id] = (counts[r.post_id] ?? 0) + 1;
      if (user && r.user_id === user.id) mine.add(r.post_id);
    });
    setReactions(counts);
    setUserReacted(mine);
    setPostsLoading(false);
  }

  // ── Create Thread ──────────────────────────────────────────────────────────

  async function submitThread() {
    if (view.type !== 'category') return;
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    const authorName = patron?.full_name || user?.email?.split('@')[0] || 'Anonymous';
    const { data } = await supabase.from('forum_threads').insert({
      category_id: view.category.id,
      user_id: user.id,
      title: newTitle.trim(),
      body: newBody.trim(),
      author_name: authorName,
    }).select().maybeSingle();
    if (data) {
      setThreads(prev => [data as ForumThread, ...prev]);
      setNewTitle('');
      setNewBody('');
      setShowNewThread(false);
      // Update category thread_count in home state
      setCategories(prev => prev.map(c =>
        c.id === view.category.id ? { ...c, thread_count: (c.thread_count ?? 0) + 1 } : c
      ));
    }
    setPosting(false);
  }

  // ── Reply ──────────────────────────────────────────────────────────────────

  async function submitReply() {
    if (view.type !== 'thread') return;
    if (!replyBody.trim()) return;
    setReplying(true);
    const authorName = patron?.full_name || user?.email?.split('@')[0] || 'Anonymous';
    const { data: post } = await supabase.from('forum_posts').insert({
      thread_id: view.thread.id,
      user_id: user.id,
      body: replyBody.trim(),
      author_name: authorName,
    }).select().maybeSingle();
    if (post) {
      setPosts(prev => [...prev, post as ForumPost]);
      setReplyBody('');
      // Update thread reply_count + last_post_at
      const newCount = view.thread.reply_count + 1;
      await supabase.from('forum_threads')
        .update({ reply_count: newCount, last_post_at: new Date().toISOString() })
        .eq('id', view.thread.id);
      // Update local thread state
      setView(v => v.type === 'thread'
        ? { ...v, thread: { ...v.thread, reply_count: newCount, last_post_at: new Date().toISOString() } }
        : v
      );
    }
    setReplying(false);
  }

  // ── Edit / Delete Post ─────────────────────────────────────────────────────

  async function saveEdit(postId: string) {
    if (!editBody.trim()) return;
    await supabase.from('forum_posts').update({ body: editBody.trim(), is_edited: true, edited_at: new Date().toISOString() }).eq('id', postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, body: editBody.trim(), is_edited: true } : p));
    setEditingPostId(null);
  }

  async function deletePost(postId: string) {
    if (!confirm('Delete this reply?')) return;
    await supabase.from('forum_posts').delete().eq('id', postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (view.type === 'thread') {
      const newCount = Math.max(0, view.thread.reply_count - 1);
      await supabase.from('forum_threads').update({ reply_count: newCount }).eq('id', view.thread.id);
      setView(v => v.type === 'thread' ? { ...v, thread: { ...v.thread, reply_count: newCount } } : v);
    }
  }

  // ── React (like) ───────────────────────────────────────────────────────────

  async function toggleReaction(postId: string) {
    if (!user) return;
    if (userReacted.has(postId)) {
      await supabase.from('forum_reactions').delete().eq('post_id', postId).eq('user_id', user.id);
      setUserReacted(prev => { const s = new Set(prev); s.delete(postId); return s; });
      setReactions(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 1) - 1) }));
    } else {
      await supabase.from('forum_reactions').insert({ post_id: postId, user_id: user.id });
      setUserReacted(prev => new Set([...prev, postId]));
      setReactions(prev => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    }
  }

  // ── Staff Actions ──────────────────────────────────────────────────────────

  async function togglePin() {
    if (view.type !== 'thread') return;
    const next = !view.thread.is_pinned;
    await supabase.from('forum_threads').update({ is_pinned: next }).eq('id', view.thread.id);
    setView(v => v.type === 'thread' ? { ...v, thread: { ...v.thread, is_pinned: next } } : v);
  }

  async function toggleLock() {
    if (view.type !== 'thread') return;
    const next = !view.thread.is_locked;
    await supabase.from('forum_threads').update({ is_locked: next }).eq('id', view.thread.id);
    setView(v => v.type === 'thread' ? { ...v, thread: { ...v.thread, is_locked: next } } : v);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Hero */}
      <div className="py-14 px-4 text-white" style={{ background: GREEN }}>
        <div className="section">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>›</span>
            {view.type !== 'home' && (
              <>
                <button onClick={() => setView({ type: 'home' })} className="hover:text-white transition-colors">Forum</button>
                <span>›</span>
              </>
            )}
            {view.type === 'thread' && (
              <>
                <button onClick={() => openCategory(view.category)} className="hover:text-white transition-colors">{view.category.name}</button>
                <span>›</span>
              </>
            )}
            <span className="text-white/90">
              {view.type === 'home'     ? 'Forum' :
               view.type === 'category' ? view.category.name :
               view.thread.title}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">
            {view.type === 'home'     ? 'Community Forum' :
             view.type === 'category' ? `${view.category.icon} ${view.category.name}` :
             view.thread.title}
          </h1>
          {view.type === 'home' && (
            <p className="text-white/70 mt-2 max-w-xl">A space for patrons, researchers, and librarians to discuss, collaborate, and learn.</p>
          )}
        </div>
      </div>

      <div className="section py-8">

        {/* ── Home: category grid ─────────────────────────────────────────── */}
        {view.type === 'home' && (
          <>
            {!user && (
              <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-neutral-900 mb-1">Join the conversation</p>
                  <p className="text-sm text-neutral-500">Sign in to post threads, reply, and interact with the community.</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <Link to="/login"    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"       style={{ background: GREEN }}>Sign In</Link>
                  <Link to="/register" className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-900" style={{ background: GOLD  }}>Register</Link>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-neutral-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => openCategory(cat)}
                    className="text-left bg-white rounded-xl border border-neutral-200 p-5 hover:border-primary-300 hover:shadow-md transition-all group"
                  >
                    <div className="text-3xl mb-3">{cat.icon}</div>
                    <div className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors mb-1">{cat.name}</div>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-3">{cat.description}</p>
                    <span className="text-xs text-neutral-400">{cat.thread_count ?? 0} thread{cat.thread_count !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 bg-neutral-100 rounded-xl p-5 text-sm text-neutral-600">
              <p className="font-semibold text-neutral-800 mb-2">Community Guidelines</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Be respectful and constructive in all discussions.</li>
                <li>Stay on topic — use the appropriate category for your post.</li>
                <li>Do not share copyrighted materials or personal data of others.</li>
                <li>Posts are subject to the <Link to="/terms" className="text-primary-600 hover:underline">Library Terms of Use</Link>.</li>
                <li>Moderation decisions by library staff are final.</li>
              </ul>
            </div>
          </>
        )}

        {/* ── Category: thread list ────────────────────────────────────────── */}
        {view.type === 'category' && (
          <>
            <div className="flex items-center justify-between mb-5 gap-3">
              <button onClick={() => setView({ type: 'home' })} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All Categories
              </button>
              {user && (
                <button
                  onClick={() => setShowNewThread(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ background: GREEN }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Thread
                </button>
              )}
            </div>

            {/* New thread form */}
            {showNewThread && (
              <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-5 shadow-sm">
                <h3 className="font-semibold text-neutral-900 mb-4">New Thread in {view.category.name}</h3>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Thread title…"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <textarea
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  rows={5}
                  placeholder="Write your post…"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={submitThread}
                    disabled={posting || !newTitle.trim() || !newBody.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                    style={{ background: GREEN }}
                  >
                    {posting ? 'Posting…' : 'Post Thread'}
                  </button>
                  <button onClick={() => setShowNewThread(false)} className="px-5 py-2 rounded-lg text-sm font-semibold text-neutral-600 border border-neutral-200 hover:bg-neutral-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {threadsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-neutral-100 rounded-lg animate-pulse" />)}
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-20 bg-white border border-neutral-100 rounded-xl">
                <div className="text-5xl mb-3">{view.category.icon}</div>
                <p className="text-neutral-500 font-medium">No threads yet.</p>
                {user
                  ? <p className="text-neutral-400 text-sm mt-1">Be the first to start a discussion.</p>
                  : <p className="text-neutral-400 text-sm mt-1"><Link to="/login" className="text-primary-600 hover:underline">Sign in</Link> to start a discussion.</p>
                }
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
                {threads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => openThread(thread, view.category)}
                    className="w-full text-left flex items-start gap-3 px-5 py-4 hover:bg-neutral-50 transition-colors group"
                  >
                    <Avatar name={thread.author_name || 'A'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {thread.is_pinned && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">📌 Pinned</span>
                        )}
                        {thread.is_locked && (
                          <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">🔒 Locked</span>
                        )}
                        <span className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors truncate">{thread.title}</span>
                      </div>
                      <div className="text-xs text-neutral-400 flex items-center gap-2">
                        <span>{thread.author_name}</span>
                        <span>·</span>
                        <span>{timeAgo(thread.last_post_at)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-neutral-400 ml-2">
                      <div className="font-medium text-neutral-600">{thread.reply_count}</div>
                      <div>repl{thread.reply_count === 1 ? 'y' : 'ies'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Thread: posts + reply ────────────────────────────────────────── */}
        {view.type === 'thread' && (
          <>
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <button onClick={() => openCategory(view.category)} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {view.category.icon} {view.category.name}
              </button>
              {isStaff && (
                <div className="flex gap-2">
                  <button
                    onClick={togglePin}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      view.thread.is_pinned
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    📌 {view.thread.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={toggleLock}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      view.thread.is_locked
                        ? 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    🔒 {view.thread.is_locked ? 'Unlock' : 'Lock'}
                  </button>
                </div>
              )}
            </div>

            {/* Original post */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={view.thread.author_name || 'A'} size={10} />
                <div>
                  <p className="font-semibold text-neutral-900">{view.thread.author_name || 'Anonymous'}</p>
                  <p className="text-xs text-neutral-400">{timeAgo(view.thread.created_at)} · {view.thread.views} view{view.thread.views !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <p className="text-neutral-800 leading-relaxed whitespace-pre-wrap">{view.thread.body}</p>
            </div>

            {/* Replies */}
            {postsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />)}
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-3 mb-4">
                {posts.map((post, idx) => (
                  <div key={post.id} className="bg-white border border-neutral-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={post.author_name || 'A'} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="font-semibold text-sm text-neutral-900">{post.author_name || 'Anonymous'}</span>
                            <span className="text-xs text-neutral-400 ml-2">{timeAgo(post.created_at)}</span>
                            {post.is_edited && <span className="text-xs text-neutral-300 ml-1">(edited)</span>}
                          </div>
                          <span className="text-xs text-neutral-400">#{idx + 1}</span>
                        </div>

                        {editingPostId === post.id ? (
                          <div>
                            <textarea
                              value={editBody}
                              onChange={e => setEditBody(e.target.value)}
                              rows={4}
                              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(post.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: GREEN }}>Save</button>
                              <button onClick={() => setEditingPostId(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 border border-neutral-200 hover:bg-neutral-50">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{post.body}</p>
                        )}

                        <div className="flex items-center gap-3 mt-3">
                          {/* Like button */}
                          <button
                            onClick={() => toggleReaction(post.id)}
                            disabled={!user}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                              userReacted.has(post.id)
                                ? 'bg-primary-50 text-primary-700 border-primary-200'
                                : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300'
                            } disabled:cursor-default disabled:opacity-60`}
                          >
                            👍 {reactions[post.id] ?? 0}
                          </button>

                          {/* Edit / Delete (own post or staff) */}
                          {user && (user.id === post.user_id || isStaff) && editingPostId !== post.id && (
                            <>
                              {user.id === post.user_id && (
                                <button
                                  onClick={() => { setEditingPostId(post.id); setEditBody(post.body); }}
                                  className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => deletePost(post.id)}
                                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-neutral-400 text-sm mb-4">
                No replies yet.{user && !view.thread.is_locked ? ' Be the first to reply below.' : ''}
              </div>
            )}

            {/* Reply form */}
            {user ? (
              view.thread.is_locked ? (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-5 py-4 text-sm text-neutral-500 flex items-center gap-2">
                  🔒 This thread is locked. No new replies.
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl p-5">
                  <h3 className="font-semibold text-neutral-900 mb-3 text-sm">Post a Reply</h3>
                  <textarea
                    ref={replyRef}
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    rows={4}
                    placeholder="Write your reply…"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-3"
                  />
                  <button
                    onClick={submitReply}
                    disabled={replying || !replyBody.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                    style={{ background: GREEN }}
                  >
                    {replying ? 'Posting…' : 'Post Reply'}
                  </button>
                </div>
              )
            ) : (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-5 py-4 text-sm text-neutral-500">
                <Link to="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link> to reply to this thread.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
