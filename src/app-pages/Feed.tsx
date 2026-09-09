import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuth } from '@/hooks/useAuth';

interface FeedEvent {
  id: string;
  user_id: string;
  patron_name: string | null;
  faculty_code: string | null;
  event_type: string;
  payload: Record<string, any>;
  likes_count: number;
  created_at: string;
  is_removed?: boolean;
  removed_reason?: string | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function eventDescription(event: FeedEvent): { verb: string; detail: string; link?: string } {
  const p = event.payload;
  switch (event.event_type) {
    case 'review_created':
      return {
        verb: `rated ${['', '★', '★★', '★★★', '★★★★', '★★★★★'][p.rating] ?? ''}`,
        detail: p.item_title ?? 'an item',
        link: p.item_type === 'catalogue' ? `/catalogue/${p.item_id}` : `/repository/${p.item_id}`,
      };
    case 'list_item_added':
      return {
        verb: 'added',
        detail: `${p.item_title ?? 'an item'} to "${p.list_name ?? 'a reading list'}"`,
        link: p.item_type === 'catalogue' ? `/catalogue/${p.item_id}` : `/repository/${p.item_id}`,
      };
    case 'reading_list_created':
      return { verb: 'created a reading list:', detail: `"${p.list_name ?? 'Untitled'}"` };
    case 'club_joined':
      return { verb: 'joined book club', detail: p.club_name ?? 'a club' };
    case 'discussion_posted':
      return {
        verb: 'commented on',
        detail: p.item_title ?? 'an item',
        link: p.item_type === 'catalogue' ? `/catalogue/${p.item_id}` : `/repository/${p.item_id}`,
      };
    default:
      return { verb: 'posted activity on', detail: p.item_title ?? 'the platform' };
  }
}

const AVATAR_COLORS = [
  'bg-primary-100 text-primary-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const MAX_POST = 600;

export default function Feed() {
  usePageTitle('Community Feed');
  const { user, profile, hasRole } = useAuth();
  const userId = user?.id ?? null;
  const isModerator = hasRole('librarian', 'faculty_librarian', 'super_admin');

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');

  // composer
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('feed_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    setEvents((data as FeedEvent[]) ?? []);

    if (userId) {
      const [{ data: likes }, { data: reports }] = await Promise.all([
        supabase.from('feed_event_likes').select('event_id').eq('user_id', userId),
        supabase.from('feed_event_reports').select('event_id').eq('user_id', userId),
      ]);
      setLikedIds(new Set((likes ?? []).map((l: any) => l.event_id)));
      setReportedIds(new Set((reports ?? []).map((r: any) => r.event_id)));
    } else {
      setLikedIds(new Set());
      setReportedIds(new Set());
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text || !userId || posting) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('feed_events')
      .insert({
        user_id: userId,
        patron_name: profile?.full_name ?? 'A patron',
        faculty_code: profile?.faculty_code ?? null,
        event_type: 'user_post',
        payload: { text },
        likes_count: 0,
      })
      .select('*')
      .single();
    setPosting(false);
    if (!error && data) {
      setEvents(prev => [data as FeedEvent, ...prev]);
      setDraft('');
    }
  };

  const handleLike = async (eventId: string) => {
    if (!userId) return;
    const wasLiked = likedIds.has(eventId);
    setLikedIds(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(eventId) : next.add(eventId);
      return next;
    });
    const current = events.find(e => e.id === eventId)?.likes_count ?? 0;
    const nextCount = Math.max(0, current + (wasLiked ? -1 : 1));
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, likes_count: nextCount } : e));
    if (wasLiked) {
      await supabase.from('feed_event_likes').delete().eq('event_id', eventId).eq('user_id', userId);
    } else {
      await supabase.from('feed_event_likes').insert({ event_id: eventId, user_id: userId });
    }
    await supabase.from('feed_events').update({ likes_count: nextCount }).eq('id', eventId);
  };

  const handleReport = async (eventId: string) => {
    if (!userId || reportedIds.has(eventId)) return;
    const reason = window.prompt('Why are you reporting this post? (optional)') ?? '';
    setReportedIds(prev => new Set(prev).add(eventId));
    await supabase.from('feed_event_reports').insert({ event_id: eventId, user_id: userId, reason: reason.trim() || null });
  };

  const handleRemove = async (eventId: string) => {
    if (!isModerator) return;
    const reason = window.prompt('Reason for removing this post? (optional)') ?? '';
    const { error } = await supabase
      .from('feed_events')
      .update({ is_removed: true, removed_by: userId, removed_reason: reason.trim() || null, removed_at: new Date().toISOString() })
      .eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, is_removed: true, removed_reason: reason.trim() || null } : e));
    }
  };

  const handleRestore = async (eventId: string) => {
    if (!isModerator) return;
    const { error } = await supabase
      .from('feed_events')
      .update({ is_removed: false, removed_by: null, removed_reason: null, removed_at: null })
      .eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, is_removed: false, removed_reason: null } : e));
    }
  };

  const EVENT_TYPES = [
    { key: 'all', label: 'All Activity' },
    { key: 'user_post', label: 'Posts' },
    { key: 'review_created', label: 'Reviews' },
    { key: 'list_item_added', label: 'Reading Lists' },
    { key: 'discussion_posted', label: 'Discussions' },
    { key: 'club_joined', label: 'Book Clubs' },
  ];

  const visible = events.filter(e => isModerator || !e.is_removed);
  const filtered = filter === 'all' ? visible : visible.filter(e => e.event_type === filter);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="section py-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Community Feed</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Community Feed</h1>
            <p className="text-white/75 text-lg">Share what you're reading and see what colleagues are discussing.</p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main feed */}
          <div className="lg:col-span-2 space-y-4">

            {/* Composer */}
            {userId ? (
              <div className="card p-5">
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(profile?.full_name ?? null)}`}>
                    {initials(profile?.full_name ?? null)}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.slice(0, MAX_POST))}
                      placeholder="Share a recommendation, question, or update with the community…"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-neutral-400">{draft.length}/{MAX_POST}</span>
                      <button
                        onClick={handlePost}
                        disabled={!draft.trim() || posting}
                        className="btn-primary px-5 py-1.5 text-sm disabled:opacity-40"
                      >
                        {posting ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-neutral-600">Sign in to post, like and report in the community feed.</p>
                <Link to="/login" className="btn-primary px-5 py-1.5 text-sm">Sign In</Link>
              </div>
            )}

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {EVENT_TYPES.map(t => (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${filter === t.key ? 'bg-primary-700 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-neutral-100 p-5 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-2/3" />
                        <div className="h-3 bg-neutral-200 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4">💬</div>
                <p className="text-neutral-500 font-medium">No activity yet.</p>
                <p className="text-neutral-400 text-sm mt-1 max-w-xs mx-auto">
                  Be the first to post, or activity appears here as colleagues review items and join discussions.
                </p>
                {!userId && (
                  <Link to="/login" className="btn-primary mt-4 inline-flex">Sign In to Join</Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(event => {
                  const liked = likedIds.has(event.id);
                  const reported = reportedIds.has(event.id);
                  const isPost = event.event_type === 'user_post';
                  const desc = isPost ? null : eventDescription(event);
                  return (
                    <div key={event.id} className={`card p-5 hover:shadow-card-hover transition-shadow ${event.is_removed ? 'opacity-60 border-red-200' : ''}`}>
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(event.patron_name)}`}>
                          {initials(event.patron_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isPost ? (
                            <>
                              <p className="text-sm font-semibold text-neutral-800">{event.patron_name ?? 'A patron'}</p>
                              <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap break-words">{event.payload?.text}</p>
                            </>
                          ) : (
                            <p className="text-sm leading-relaxed">
                              <span className="font-semibold text-neutral-800">{event.patron_name ?? 'A patron'}</span>
                              {' '}
                              <span className="text-neutral-600">{desc!.verb}</span>
                              {' '}
                              {desc!.link ? (
                                <Link to={desc!.link} className="font-medium text-primary-700 hover:underline">{desc!.detail}</Link>
                              ) : (
                                <span className="font-medium text-neutral-800">{desc!.detail}</span>
                              )}
                            </p>
                          )}

                          {event.is_removed && (
                            <p className="text-xs text-red-500 mt-1 font-medium">
                              Removed by a librarian{event.removed_reason ? ` — ${event.removed_reason}` : ''}
                            </p>
                          )}

                          <div className="flex items-center flex-wrap gap-3 mt-2">
                            {event.faculty_code && (
                              <span className="text-xs text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded-full">{event.faculty_code}</span>
                            )}
                            <span className="text-xs text-neutral-400">{timeAgo(event.created_at)}</span>
                            <button
                              onClick={() => handleLike(event.id)}
                              disabled={!userId}
                              className={`flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40
                                ${liked ? 'text-red-500' : 'text-neutral-400 hover:text-red-500'}`}
                            >
                              <svg className="w-3.5 h-3.5" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                              {event.likes_count > 0 && event.likes_count}
                            </button>

                            {userId && event.user_id !== userId && !event.is_removed && (
                              <button
                                onClick={() => handleReport(event.id)}
                                disabled={reported}
                                className="text-xs font-medium text-neutral-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                              >
                                {reported ? 'Reported' : 'Report'}
                              </button>
                            )}

                            {isModerator && (
                              event.is_removed ? (
                                <button onClick={() => handleRestore(event.id)} className="text-xs font-medium text-green-600 hover:underline">
                                  Restore
                                </button>
                              ) : (
                                <button onClick={() => handleRemove(event.id)} className="text-xs font-medium text-red-500 hover:underline">
                                  Remove
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {!userId && (
              <div className="bg-primary-700 text-white rounded-xl p-5">
                <h3 className="font-bold mb-2">Join the Conversation</h3>
                <p className="text-white/75 text-sm mb-4">Sign in to post, like, and report content in the community feed.</p>
                <Link to="/login" className="block w-full text-center py-2.5 bg-white text-primary-700 font-semibold text-sm rounded-lg hover:bg-neutral-50 transition-colors">
                  Sign In
                </Link>
              </div>
            )}

            {isModerator && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="font-semibold text-amber-800 mb-2 text-sm">Moderation</h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Posts go live instantly — no approval needed. As a librarian you can <strong>Remove</strong> any unwanted post (and restore it later). Removed posts are hidden from members but stay visible to you.
                </p>
              </div>
            )}

            <div className="card p-5">
              <h3 className="font-semibold text-neutral-800 mb-3 text-sm">Quick Links</h3>
              <div className="space-y-1">
                {[
                  { to: '/catalogue', label: 'Browse Catalogue' },
                  { to: '/repository', label: 'Repository' },
                  { to: '/book-clubs', label: 'Book Clubs' },
                  { to: '/dashboard/reading-lists', label: 'My Reading Lists' },
                  { to: '/catalogue?filter=new', label: 'New Arrivals' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to}
                    className="flex items-center justify-between py-2 text-sm text-neutral-600 hover:text-primary-700 border-b border-neutral-50 last:border-0 transition-colors">
                    {label}
                    <span className="text-neutral-300">→</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-5">
              <h3 className="font-semibold text-neutral-800 mb-2 text-sm">About This Feed</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                The community feed mixes member posts with activity from across ESUT Library — reviews, reading lists, discussions, and book club updates. Be kind and respectful.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
