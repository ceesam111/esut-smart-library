import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface NewsletterIssue {
  id: string;
  title: string;
  issue_number: string;
  published_date: string;
  excerpt: string;
  cover_image: string | null;
  content_url: string;
}

export default function Newsletter() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState('');

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('newsletter_issues')
      .select('*')
      .order('published_date', { ascending: false });

    if (error) {
      console.error('Error fetching newsletter issues:', error);
    } else {
      setIssues(data || []);
    }
    setLoading(false);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubscribeLoading(true);
    setSubscribeMessage('');

    try {
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .insert([
          {
            email: email,
            subscribed_at: new Date().toISOString(),
            active: true
          }
        ]);

      if (error) {
        if (error.code === '23505') {
          setSubscribeMessage('This email is already subscribed.');
        } else {
          setSubscribeMessage('Error subscribing. Please try again.');
        }
      } else {
        setSubscribeMessage('Successfully subscribed! Check your email for confirmation.');
        setEmail('');
      }
    } catch (err) {
      setSubscribeMessage('Error subscribing. Please try again.');
    }

    setSubscribeLoading(false);
    setTimeout(() => setSubscribeMessage(''), 5000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Newsletter</h1>
        <p className="text-gray-600">Stay updated with the latest from {institutionConfig.name}</p>
      </div>

      <div className="section max-w-2xl mb-12">
        <div className="card bg-gradient-to-r from-primary-50 to-indigo-50 border border-primary-200">
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Subscribe to Our Newsletter</h2>
            <p className="text-gray-700 mb-6">
              Get the latest news, updates, and curated content delivered to your inbox monthly.
            </p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input flex-1"
                required
              />
              <button
                type="submit"
                disabled={subscribeLoading}
                className="btn-primary"
              >
                {subscribeLoading ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
            {subscribeMessage && (
              <p className={`mt-4 text-sm ${subscribeMessage.includes('Successfully') ? 'text-green-600' : 'text-amber-600'}`}>
                {subscribeMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="text-2xl font-bold mb-8">Archive</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin">Loading...</div>
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No newsletter issues published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {issues.map(issue => (
              <div key={issue.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
                {issue.cover_image && (
                  <div className="h-40 bg-gray-200 overflow-hidden">
                    <img
                      src={issue.cover_image}
                      alt={issue.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge badge-primary">Issue {issue.issue_number}</span>
                    <span className="text-xs text-gray-500">{formatDate(issue.published_date)}</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{issue.title}</h3>
                  <p className="text-gray-600 mb-6">{issue.excerpt}</p>
                  <a
                    href={issue.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary inline-block"
                  >
                    Read Issue
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
