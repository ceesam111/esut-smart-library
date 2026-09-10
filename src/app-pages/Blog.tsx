import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image: string | null;
  author: string;
  published_date: string | null;
  created_at: string;
  category: string;
  tags: string;
}

const PAGE_SIZE = 9;

const CATEGORY_COLORS: Record<string, string> = {
  News: 'bg-primary-100 text-primary-700',
  Research: 'bg-teal-100 text-teal-700',
  Events: 'bg-amber-100 text-amber-700',
  Acquisitions: 'bg-emerald-100 text-emerald-700',
  Announcement: 'bg-red-100 text-red-700',
  Technology: 'bg-cyan-100 text-cyan-700',
  'Staff Pick': 'bg-green-100 text-green-700',
  'Student Voice': 'bg-orange-100 text-orange-700',
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'bg-neutral-100 text-neutral-600';
}

const HERO_IMAGE = '/nigerian-library-people.svg';

export default function Blog() {
  usePageTitle('Library Blog');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadPosts(); }, [page, category]);

  async function loadCategories() {
    const { data } = await supabase
      .from('blog_posts')
      .select('category')
      .eq('status', 'published')
      .not('category', 'is', null);
    const unique = [...new Set((data ?? []).map(r => r.category).filter(Boolean))].sort();
    setCategories(unique);
  }

  async function loadPosts() {
    setLoading(true);
    let query = supabase
      .from('blog_posts')
      .select('id, slug, title, excerpt, cover_image_url, cover_image, author, published_date, created_at, category, tags', { count: 'exact' })
      .eq('status', 'published')
      .order('published_date', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (category) query = query.eq('category', category);
    const { data, count } = await query;
    setPosts(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const coverOf = (p: BlogPost) => p.cover_image_url || p.cover_image;
  const featuredPost = posts[0];
  const restPosts = posts.slice(1);

  return (
    <div>
      {/* Hero banner */}
      <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
        <img
          src={HERO_IMAGE}
          alt="Library Blog"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        <div className="relative section py-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Blog</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Library Blog</h1>
            <p className="text-white/80 text-lg leading-relaxed">
              News, research insights, acquisitions, and updates from ESUT Library.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-10">
        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => { setCategory(''); setPage(0); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !category ? 'bg-primary-700 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              All Posts
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(0); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat ? 'bg-primary-700 text-white' : `${categoryColor(cat)} hover:opacity-80`
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-neutral-100">
                <div className="h-48 bg-neutral-100 animate-pulse" />
                <div className="p-5 space-y-2">
                  <div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-neutral-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 bg-white border border-neutral-100 rounded-2xl">
            <div className="text-5xl mb-4">📰</div>
            <p className="text-neutral-500 font-medium text-lg">No posts found.</p>
            <p className="text-neutral-400 text-sm mt-1">Check back soon for library news and updates.</p>
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featuredPost && page === 0 && !category && (
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group flex flex-col md:flex-row gap-0 bg-white rounded-2xl border border-neutral-100 overflow-hidden hover:shadow-xl transition-shadow mb-8"
              >
                <div className="md:w-2/5 h-56 md:h-auto overflow-hidden bg-neutral-100 shrink-0">
                  {coverOf(featuredPost) ? (
                    <img
                      src={coverOf(featuredPost)!}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center">
                      <span className="text-6xl text-white/20">📰</span>
                    </div>
                  )}
                </div>
                <div className="p-7 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: '#6B1D2A' }}>
                      Featured
                    </span>
                    {featuredPost.category && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryColor(featuredPost.category)}`}>
                        {featuredPost.category}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900 group-hover:text-primary-700 transition-colors mb-2 leading-snug">
                    {featuredPost.title}
                  </h2>
                  {featuredPost.excerpt && (
                    <p className="text-neutral-500 text-sm leading-relaxed line-clamp-3">{featuredPost.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3 mt-4 text-xs text-neutral-400">
                    <span>{featuredPost.author || 'ESUT Library'}</span>
                    <span>·</span>
                    <span>
                      {featuredPost.published_date
                        ? new Date(featuredPost.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                        : new Date(featuredPost.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(page === 0 && !category ? restPosts : posts).map(post => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg transition-shadow bg-white"
                >
                  <div className="h-48 overflow-hidden bg-neutral-100">
                    {coverOf(post) ? (
                      <img
                        src={coverOf(post)!}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
                        <span className="text-4xl text-primary-200">📰</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {post.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(post.category)}`}>
                          {post.category}
                        </span>
                      )}
                    </div>
                    <h2 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-neutral-400">{post.author || 'ESUT Library'}</span>
                      <span className="text-xs text-neutral-400">
                        {post.published_date
                          ? new Date(post.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-sm border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-50 transition-colors"
            >
              ← Prev
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-9 h-9 text-sm rounded-lg transition-colors ${
                  page === i ? 'bg-primary-700 text-white' : 'border border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 text-sm border border-neutral-300 rounded-lg disabled:opacity-40 hover:bg-neutral-50 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
