import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface Club {
  id: string;
  name: string;
  description: string | null;
  faculty_code: string | null;
  creator_name: string | null;
  is_public: boolean;
  cover_image: string | null;
  member_count: number;
  created_at: string;
  created_by: string;
}

interface Post {
  id: string;
  club_id: string;
  user_id: string;
  patron_name: string | null;
  parent_id: string | null;
  body: string;
  created_at: string;
  replies?: Post[];
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Initials({ name, size = 'md' }: { name: string | null; size?: 'sm' | 'md' }) {
  const letters = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0
      ${size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'}`}>
      {letters}
    </div>
  );
}

function PostThread({ post, depth = 0, onReply, currentUserId }: {
  post: Post; depth?: number; onReply: (parentId: string, body: string) => void; currentUserId: string | null;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-neutral-100 pl-4' : ''}>
      <div className="flex gap-3 mb-3">
        <Initials name={post.patron_name} size={depth > 0 ? 'sm' : 'md'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-neutral-700">{post.patron_name ?? 'Anonymous'}</span>
            <span className="text-xs text-neutral-400">{timeAgo(post.created_at)}</span>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed">{post.body}</p>
          {currentUserId && depth < 2 && (
            <button onClick={() => setReplyOpen(v => !v)}
              className="text-xs text-primary-600 hover:underline mt-1">
              {replyOpen ? 'Cancel' : 'Reply'}
            </button>
          )}
          {replyOpen && (
            <div className="flex gap-2 mt-2">
              <input type="text" value={replyBody} onChange={e => setReplyBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && replyBody.trim()) { onReply(post.id, replyBody.trim()); setReplyBody(''); setReplyOpen(false); } }}
                placeholder="Write a reply…" className="input flex-1 text-xs py-1.5" autoFocus />
              <button onClick={() => { if (replyBody.trim()) { onReply(post.id, replyBody.trim()); setReplyBody(''); setReplyOpen(false); } }}
                disabled={!replyBody.trim()}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">Post</button>
            </div>
          )}
        </div>
      </div>
      {post.replies?.map(r => (
        <PostThread key={r.id} post={r} depth={depth + 1} onReply={onReply} currentUserId={currentUserId} />
      ))}
    </div>
  );
}

export default function BookClubs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeClubId = searchParams.get('club');

  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeClub, setActiveClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClub, setLoadingClub] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [patron, setPatron] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', faculty_code: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        const { data: p } = await supabase.from('patrons').select('id, full_name, faculty_code').eq('user_id', u.id).maybeSingle();
        setPatron(p);
      }
      const { data } = await supabase.from('book_clubs').select('*').order('created_at', { ascending: false });
      setClubs(data ?? []);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!activeClubId) { setActiveClub(null); return; }
    const club = clubs.find(c => c.id === activeClubId);
    if (club) openClub(club);
  }, [activeClubId, clubs]);

  const openClub = async (club: Club) => {
    setActiveClub(club);
    setLoadingClub(true);
    setSearchParams({ club: club.id });

    const [{ data: rawPosts }, { data: mems }] = await Promise.all([
      supabase.from('club_posts').select('*').eq('club_id', club.id).order('created_at', { ascending: true }),
      supabase.from('club_members').select('*').eq('club_id', club.id),
    ]);

    // Thread posts
    const allPosts: Post[] = rawPosts ?? [];
    const topLevel = allPosts.filter(p => !p.parent_id);
    const withReplies = topLevel.map(p => ({
      ...p,
      replies: allPosts.filter(r => r.parent_id === p.id).map(r => ({
        ...r,
        replies: allPosts.filter(rr => rr.parent_id === r.id),
      })),
    }));
    setPosts(withReplies);
    setMembers(mems ?? []);
    if (user) {
      setIsMember(mems?.some(m => m.user_id === user.id) ?? false);
    }
    setLoadingClub(false);
  };

  const joinClub = async () => {
    if (!user || !activeClub) return;
    setJoining(true);
    const { error } = await supabase.from('club_members').insert({
      club_id: activeClub.id, user_id: user.id, patron_name: patron?.full_name ?? user.email,
    });
    if (!error) {
      setIsMember(true);
      setMembers(prev => [...prev, { user_id: user.id, patron_name: patron?.full_name }]);
      await supabase.from('book_clubs').update({ member_count: activeClub.member_count + 1 }).eq('id', activeClub.id);
      setActiveClub(prev => prev ? { ...prev, member_count: prev.member_count + 1 } : null);
      supabase.from('feed_events').insert({
        user_id: user.id, patron_name: patron?.full_name ?? user.email,
        faculty_code: patron?.faculty_code ?? null, event_type: 'club_joined',
        payload: { club_id: activeClub.id, club_name: activeClub.name },
      });
    }
    setJoining(false);
  };

  const leaveClub = async () => {
    if (!user || !activeClub) return;
    await supabase.from('club_members').delete().eq('club_id', activeClub.id).eq('user_id', user.id);
    setIsMember(false);
    setMembers(prev => prev.filter(m => m.user_id !== user.id));
    const newCount = Math.max(0, activeClub.member_count - 1);
    await supabase.from('book_clubs').update({ member_count: newCount }).eq('id', activeClub.id);
    setActiveClub(prev => prev ? { ...prev, member_count: newCount } : null);
  };

  const submitPost = async (parentId: string | null, body: string) => {
    if (!body.trim() || !user) return;
    if (!parentId) setSubmittingPost(true);
    const { data, error } = await supabase.from('club_posts').insert({
      club_id: activeClub!.id, user_id: user.id,
      patron_name: patron?.full_name ?? user.email,
      parent_id: parentId, body: body.trim(),
    }).select().single();
    if (!error && data) {
      if (parentId) {
        setPosts(prev => prev.map(p => {
          if (p.id === parentId) return { ...p, replies: [...(p.replies ?? []), data] };
          const updatedReplies = p.replies?.map(r => r.id === parentId ? { ...r, replies: [...(r.replies ?? []), data] } : r);
          return { ...p, replies: updatedReplies };
        }));
      } else {
        setPosts(prev => [...prev, { ...data, replies: [] }]);
        setNewPost('');
      }
    }
    if (!parentId) setSubmittingPost(false);
  };

  const createClub = async () => {
    if (!form.name.trim() || !user) return;
    setCreating(true);
    const { data, error } = await supabase.from('book_clubs').insert({
      name: form.name.trim(), description: form.description.trim() || null,
      faculty_code: form.faculty_code.trim() || null,
      created_by: user.id, creator_name: patron?.full_name ?? user.email,
    }).select().single();
    if (!error && data) {
      setClubs(prev => [data, ...prev]);
      // auto-join
      await supabase.from('club_members').insert({
        club_id: data.id, user_id: user.id, patron_name: patron?.full_name ?? user.email, role: 'admin',
      });
      setShowCreateModal(false);
      setForm({ name: '', description: '', faculty_code: '' });
      openClub(data);
    }
    setCreating(false);
  };

  return (
    <div className="pt-16 bg-neutral-50 min-h-screen">
      <div className="section py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-primary-800">Book Clubs</h1>
            <p className="text-neutral-500 text-sm mt-1">Join faculty reading groups and discuss books together</p>
          </div>
          {user && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Club
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Club list */}
          <div className={`space-y-3 ${activeClub ? 'hidden lg:block' : ''}`}>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="card p-5 h-28 animate-pulse bg-neutral-200" />)}
              </div>
            ) : clubs.length === 0 ? (
              <div className="card p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-neutral-500 text-sm">No book clubs yet.</p>
                {user && <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm mt-3">Create First Club</button>}
              </div>
            ) : (
              clubs.map(club => (
                <button key={club.id} onClick={() => openClub(club)}
                  className={`card p-4 w-full text-left transition-all hover:shadow-card-hover
                    ${activeClub?.id === club.id ? 'ring-2 ring-primary-500 shadow-card-hover' : ''}`}>
                  <div className="flex gap-3">
                    {club.cover_image ? (
                      <img src={club.cover_image} alt={club.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-neutral-800 leading-tight">{club.name}</p>
                      {club.faculty_code && <p className="text-xs text-neutral-400 mt-0.5">{club.faculty_code}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-xs text-neutral-400">{club.member_count} members</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Club detail */}
          <div className="lg:col-span-2">
            {!activeClub ? (
              <div className="card p-12 text-center hidden lg:flex flex-col items-center">
                <svg className="w-16 h-16 text-neutral-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-neutral-500">Select a book club to view discussions</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                {/* Club header */}
                <div className="px-6 py-4 border-b border-neutral-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button onClick={() => { setActiveClub(null); setSearchParams({}); }}
                        className="lg:hidden text-primary-600 hover:text-primary-800 mt-1">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <div>
                        <h2 className="font-semibold text-neutral-800">{activeClub.name}</h2>
                        {activeClub.description && <p className="text-xs text-neutral-500 mt-0.5">{activeClub.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {activeClub.faculty_code && <span className="badge text-xs">{activeClub.faculty_code}</span>}
                          <span className="text-xs text-neutral-400">{activeClub.member_count} members</span>
                          <span className="text-xs text-neutral-400">by {activeClub.creator_name ?? 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    {user && (
                      isMember ? (
                        <button onClick={leaveClub} className="btn-outline text-xs shrink-0">Leave Club</button>
                      ) : (
                        <button onClick={joinClub} disabled={joining} className="btn-primary text-xs shrink-0 disabled:opacity-50">
                          {joining ? 'Joining…' : 'Join Club'}
                        </button>
                      )
                    )}
                    {!user && (
                      <Link to="/login" className="btn-outline text-xs shrink-0">Sign in to join</Link>
                    )}
                  </div>
                </div>

                {/* Discussion threads */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm text-neutral-700">Discussion</h3>
                    <span className="text-xs text-neutral-400">{members.length} members</span>
                  </div>

                  {loadingClub ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4 mb-5 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                      {posts.length === 0 ? (
                        <p className="text-neutral-400 text-sm text-center py-6">
                          {isMember || !user ? 'No posts yet. Start the discussion!' : 'Join the club to see and post discussions.'}
                        </p>
                      ) : (
                        posts.map(p => (
                          <PostThread key={p.id} post={p} onReply={submitPost} currentUserId={isMember ? user?.id ?? null : null} />
                        ))
                      )}
                    </div>
                  )}

                  {/* New post form */}
                  {isMember ? (
                    <div className="border-t border-neutral-100 pt-4 flex gap-3">
                      <Initials name={patron?.full_name ?? user?.email ?? '?'} />
                      <div className="flex-1">
                        <textarea value={newPost} onChange={e => setNewPost(e.target.value)}
                          placeholder="Share your thoughts with the club…"
                          rows={2} className="input w-full resize-none text-sm" />
                        <div className="flex justify-end mt-2">
                          <button onClick={() => submitPost(null, newPost)} disabled={!newPost.trim() || submittingPost}
                            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
                            {submittingPost ? 'Posting…' : 'Post'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : user ? (
                    <div className="border-t border-neutral-100 pt-4">
                      <p className="text-sm text-neutral-500">
                        <button onClick={joinClub} className="text-primary-600 font-medium hover:underline">Join this club</button> to participate in discussions.
                      </p>
                    </div>
                  ) : (
                    <div className="border-t border-neutral-100 pt-4">
                      <Link to="/login" className="btn-outline text-sm">Sign in to participate</Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create club modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-serif font-semibold text-primary-800">Create Book Club</h2>
            <div>
              <label className="label text-xs font-semibold text-neutral-600 block mb-1">Club Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Early Childhood Education Readers" className="input w-full" autoFocus />
            </div>
            <div>
              <label className="label text-xs font-semibold text-neutral-600 block mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What will this club focus on?" rows={2} className="input w-full resize-none" />
            </div>
            <div>
              <label className="label text-xs font-semibold text-neutral-600 block mb-1">Faculty Code (optional)</label>
              <input type="text" value={form.faculty_code} onChange={e => setForm(f => ({ ...f, faculty_code: e.target.value }))}
                placeholder="e.g., EDUC, SCI" className="input w-full" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowCreateModal(false); setForm({ name: '', description: '', faculty_code: '' }); }}
                disabled={creating} className="btn-outline flex-1">Cancel</button>
              <button onClick={createClub} disabled={!form.name.trim() || creating}
                className="btn-primary flex-1 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Club'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
