import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BackButton from '@/components/BackButton';
import ShareButtons from '@/components/ShareButtons';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image: string | null;
  author: string;
  published_date: string | null;
  created_at: string;
  category: string;
  tags: string;
  content: string;
  body: any;
  comments_enabled: boolean;
  seo_title: string | null;
  seo_description: string | null;
}

interface Comment {
  id: string;
  patron_id: string | null;
  author_name: string;
  body: string;
  approved: boolean;
  created_at: string;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [commentName, setCommentName] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [commentSent, setCommentSent] = useState(false);

  useEffect(() => {
    if (!slug) return;
    load(slug);
  }, [slug]);

  async function load(slug: string) {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPost(data as BlogPost);

    const [relRes, comRes] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, cover_image, author, published_date, created_at, category')
        .eq('status', 'published')
        .eq('category', data.category)
        .neq('id', data.id)
        .limit(3),
      supabase
        .from('blog_comments')
        .select('id, patron_id, author_name, body, approved, created_at')
        .eq('post_id', data.id)
        .eq('approved', true)
        .order('created_at'),
    ]);

    setRelated((relRes.data ?? []) as BlogPost[]);
    setComments(comRes.data ?? []);
    setLoading(false);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!post || !commentName.trim() || !commentBody.trim()) return;
    setCommenting(true);
    await supabase.from('blog_comments').insert({
      post_id: post.id,
      author_name: commentName.trim(),
      body: commentBody.trim(),
      approved: false,
    });
    setCommenting(false);
    setCommentSent(true);
    setCommentName('');
    setCommentBody('');
  }

  const coverOf = (p: any) => p.cover_image_url || p.cover_image;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-700 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-5xl font-bold text-neutral-200 mb-4">404</p>
        <h1 className="text-xl font-semibold text-neutral-800 mb-2">Post not found</h1>
        <Link to="/blog" className="text-primary-700 hover:underline text-sm font-medium">Back to Blog</Link>
      </div>
    );
  }

  const displayContent = post.content || (post.body && typeof post.body === 'object' ? JSON.stringify(post.body, null, 2) : '');

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <BackButton />
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-400 mb-6">
        <Link to="/blog" className="hover:text-primary-700 transition-colors">Blog</Link>
        <span>/</span>
        <span className="text-neutral-600 truncate max-w-xs">{post.title}</span>
      </div>

      {post.category && (
        <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-primary-50 text-primary-700 mb-4">
          {post.category}
        </span>
      )}

      <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 leading-tight mb-4">{post.title}</h1>

      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500 mb-8">
        <span>By {post.author || 'ESUT Library'}</span>
        <span>·</span>
        <span>
          {post.published_date
            ? new Date(post.published_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
            : new Date(post.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {coverOf(post) && (
        <img
          src={coverOf(post)}
          alt={post.title}
          className="w-full h-64 md:h-80 object-cover rounded-2xl mb-10 shadow-sm"
        />
      )}

      <article className="prose prose-lg prose-neutral max-w-none mb-12">
        {displayContent && displayContent.startsWith('<') ? (
          <div dangerouslySetInnerHTML={{ __html: displayContent }} />
        ) : (
          <p className="whitespace-pre-wrap text-neutral-700 leading-relaxed">{displayContent}</p>
        )}
      </article>

      {post.tags && (
        <div className="flex flex-wrap gap-2 mb-8 pb-8 border-b border-neutral-100">
          {post.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
            <span key={tag} className="text-xs bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      )}

      <div className="mb-12 pb-12 border-b border-neutral-100">
        <ShareButtons title={post.title} />
      </div>

      {/* Comments */}
      {post.comments_enabled && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-neutral-900 mb-6">
            Comments {comments.length > 0 && <span className="text-neutral-400 font-normal text-base">({comments.length})</span>}
          </h2>
          {comments.length === 0 && (
            <p className="text-neutral-400 text-sm mb-6">No comments yet. Be the first to comment.</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0 text-sm">
                {(c.author_name || 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm text-neutral-900">{c.author_name}</span>
                  <span className="text-xs text-neutral-400">
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 mt-1 leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}

          <div className="mt-8 bg-neutral-50 rounded-xl p-5 border border-neutral-200">
            <h3 className="font-semibold text-neutral-900 mb-4 text-sm">Leave a comment</h3>
            {commentSent ? (
              <p className="text-sm text-green-700">Thank you! Your comment is awaiting moderation.</p>
            ) : (
              <form onSubmit={submitComment} className="space-y-3">
                <input
                  required
                  value={commentName}
                  onChange={e => setCommentName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <textarea
                  required
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  rows={4}
                  placeholder="Write your comment…"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={commenting}
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  {commenting ? 'Posting…' : 'Post Comment'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-neutral-900 mb-5">More in {post.category}</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {related.map(r => (
              <Link
                key={r.id}
                to={`/blog/${r.slug}`}
                className="group rounded-xl overflow-hidden border border-neutral-100 hover:shadow-md transition-shadow"
              >
                <div className="h-28 bg-neutral-100 overflow-hidden">
                  {coverOf(r) ? (
                    <img src={coverOf(r)} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-primary-50 flex items-center justify-center text-2xl text-primary-200">📰</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-neutral-900 line-clamp-2 group-hover:text-primary-700 transition-colors">{r.title}</p>
                  <p className="text-xs text-neutral-400 mt-1">{r.author || 'ESUT Library'}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
