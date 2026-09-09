import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image: string | null;
  author: string;
  published_date: string;
  category: string;
  content?: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetchPost();
    checkAuthentication();
  }, [slug]);

  const checkAuthentication = async () => {
    const { data } = await supabase.auth.getSession();
    setIsAuthenticated(!!data.session);
  };

  const fetchPost = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error) {
      console.error('Error fetching blog post:', error);
    } else if (data) {
      setPost(data);
      fetchRelatedPosts(data.category);
      fetchComments(data.id);
    }
    setLoading(false);
  };

  const fetchRelatedPosts = async (category: string) => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, cover_image, author, published_date, category')
      .eq('category', category)
      .eq('status', 'published')
      .neq('slug', slug)
      .limit(3)
      .order('published_date', { ascending: false });

    if (!error) {
      setRelatedPosts(data || []);
    }
  };

  const fetchComments = async (postId: string) => {
    const { data, error } = await supabase
      .from('blog_comments')
      .select('id, author, content, created_at')
      .eq('post_id', postId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (!error) {
      setComments(data || []);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPexelsPlaceholder = () => {
    return 'https://images.pexels.com/photos/3587620/pexels-photo-3587620.jpeg?auto=compress&cs=tinysrgb&w=800';
  };

  if (loading) {
    return (
      <div className="page flex justify-center py-12">
        <div className="animate-spin">Loading...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="page">
        <div className="section text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Link to="/blog" className="btn-primary">Back to Blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <article className="section max-w-4xl">
        <Link to="/blog" className="text-primary hover:underline text-sm mb-4 inline-block">← Back to Blog</Link>

        {post.cover_image && (
          <div className="mb-8 -mx-4 md:mx-0 md:rounded-lg overflow-hidden h-96">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="badge badge-primary">{post.category}</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
          <div className="flex items-center justify-between pb-6 border-b border-gray-200">
            <div>
              <div className="font-semibold text-gray-800">{post.author}</div>
              <div className="text-sm text-gray-600">{formatDate(post.published_date)}</div>
            </div>
            <div className="text-sm text-gray-600">
              5 min read
            </div>
          </div>
        </div>

        <div className="prose prose-sm max-w-none mb-12">
          <p className="text-lg text-gray-700 mb-6">{post.excerpt}</p>
          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </div>
        </div>

        <div className="border-t border-b border-gray-200 py-6 mb-12">
          <h2 className="text-xl font-semibold mb-4">Comments ({comments.length})</h2>
          {!isAuthenticated ? (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 text-center">
              <p className="text-gray-700 mb-4">Please sign in to view and post comments.</p>
              <Link to="/login" className="btn-primary">Sign In</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-600">No comments yet.</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-800">{comment.author}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(comment.created_at)}
                      </div>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {relatedPosts.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Related Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map(relPost => (
                <Link key={relPost.id} to={`/blog/${relPost.slug}`} className="card overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-40 bg-gray-200 overflow-hidden">
                    <img
                      src={relPost.cover_image || getPexelsPlaceholder()}
                      alt={relPost.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="badge badge-primary text-xs">{relPost.category}</span>
                    </div>
                    <h3 className="font-semibold mb-2 line-clamp-2">{relPost.title}</h3>
                    <p className="text-xs text-gray-500">{formatDate(relPost.published_date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
