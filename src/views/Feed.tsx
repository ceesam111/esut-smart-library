import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FeedEvent {
  id: string;
  user_id: string;
  user_name: string;
  activity_type: 'reviewed' | 'added_to_reading_list' | 'submitted' | 'published';
  item_id: string;
  item_title: string;
  item_type: string;
  created_at: string;
  likes_count: number;
  user_liked: boolean;
}

interface DiscoursePost {
  id: string;
  title: string;
  url: string;
  created_at: string;
  replies: number;
  likes: number;
}

export default function Feed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [discoursesPosts, setDiscoursePosts] = useState<DiscoursePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [likedEvents, setLikedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCurrentUser();
    fetchFeedEvents();
    fetchDiscoursePosts();
  }, []);

  const getCurrentUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      setUserId(data.session.user.id);
    }
  };

  const fetchFeedEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feed_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching feed events:', error);
    } else {
      setEvents(data || []);
      const liked = new Set(
        (data || [])
          .filter(e => e.user_liked)
          .map(e => e.id)
      );
      setLikedEvents(liked);
    }
    setLoading(false);
  };

  const fetchDiscoursePosts = async () => {
    const { data, error } = await supabase
      .from('discourse_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching Discourse posts:', error);
    } else {
      setDiscoursePosts(data || []);
    }
  };

  const handleLike = async (eventId: string) => {
    if (!userId) return;

    const isLiked = likedEvents.has(eventId);
    const newLikedEvents = new Set(likedEvents);

    if (isLiked) {
      newLikedEvents.delete(eventId);
    } else {
      newLikedEvents.add(eventId);
    }

    setLikedEvents(newLikedEvents);

    const { error } = await supabase
      .from('feed_event_likes')
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          created_at: new Date().toISOString()
        },
        { onConflict: 'event_id,user_id' }
      );

    if (error) {
      console.error('Error updating like:', error);
      setLikedEvents(likedEvents);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getActivityDescription = (type: string) => {
    switch (type) {
      case 'reviewed':
        return 'reviewed';
      case 'added_to_reading_list':
        return 'added to reading list';
      case 'submitted':
        return 'submitted';
      case 'published':
        return 'published';
      default:
        return 'posted';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Community Feed</h1>
        <p className="text-gray-600">See what your colleagues are contributing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="section">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin">Loading...</div>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No activity yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(event => (
                  <div key={event.id} className="card p-6 hover:shadow-md transition-shadow">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold text-sm">
                          {getInitials(event.user_name)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm">
                              <span className="font-semibold text-gray-900">{event.user_name}</span>
                              {' '}
                              <span className="text-gray-600">{getActivityDescription(event.activity_type)}</span>
                            </p>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              {event.item_title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {event.item_type} • {formatDate(event.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleLike(event.id)}
                            className={`flex-shrink-0 text-sm font-medium transition-colors ${
                              likedEvents.has(event.id)
                                ? 'text-red-600'
                                : 'text-gray-500 hover:text-red-600'
                            }`}
                          >
                            ♥ {event.likes_count}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="section">
            <h2 className="text-lg font-bold mb-4">Latest Discourse Posts</h2>
            {discoursesPosts.length === 0 ? (
              <p className="text-sm text-gray-600">No posts yet.</p>
            ) : (
              <div className="space-y-4">
                {discoursesPosts.map(post => (
                  <a
                    key={post.id}
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all"
                  >
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-primary">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>{post.replies} replies</span>
                      <span>♥ {post.likes}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
            <a
              href="/discourse"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-sm mt-4 w-full text-center"
            >
              View All Discussions
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
