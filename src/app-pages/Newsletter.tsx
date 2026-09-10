import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Link } from 'react-router-dom';

interface Issue {
  id: string;
  subject: string;
  content: string;
  sent_date: string | null;
  recipient_scope: string;
}

const GREEN = '#6B1D2A';
const GOLD  = '#D4A017';

export default function Newsletter() {
  usePageTitle('Newsletter Archive');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Issue | null>(null);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('newsletter_issues')
        .select('id, subject, content, sent_date, recipient_scope')
        .eq('status', 'sent')
        .order('sent_date', { ascending: false });
      setIssues(data ?? []);
      setLoading(false);
    })();
  }, []);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!subscribeEmail.trim()) return;
    setSubscribing(true);
    await supabase.from('newsletter_subscribers').upsert({ email: subscribeEmail.trim(), status: 'active' }, { onConflict: 'email', ignoreDuplicates: true });
    setSubscribing(false);
    setSubscribed(true);
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="section py-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-4 font-medium">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>›</span>
              <span>Newsletter</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Library Newsletter</h1>
            <p className="text-white/75 text-lg">
              News, resources, acquisitions, and updates from {institutionConfig.shortName} Library.
            </p>
          </div>
        </div>
      </div>

      <div className="section py-12">
        <div className="grid lg:grid-cols-3 gap-10">

          {/* Archive grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900">
                Past Issues
                {issues.length > 0 && <span className="text-neutral-400 font-normal text-sm ml-2">({issues.length})</span>}
              </h2>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-neutral-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-20 bg-white border border-neutral-100 rounded-2xl">
                <div className="text-5xl mb-4">📰</div>
                <p className="text-neutral-500 font-medium">No issues published yet.</p>
                <p className="text-neutral-400 text-sm mt-1">Subscribe below to be notified when the first issue is sent.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {issues.map((issue, idx) => (
                  <button
                    key={issue.id}
                    onClick={() => setSelected(issue)}
                    className="text-left bg-white border border-neutral-200 rounded-2xl p-5 hover:shadow-md hover:border-primary-200 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: GREEN }}>
                        #{issues.length - idx}
                      </span>
                      {issue.recipient_scope && issue.recipient_scope !== 'all' && (
                        <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full capitalize">
                          {issue.recipient_scope}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors line-clamp-2 leading-snug mb-2">
                      {issue.subject}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      {issue.sent_date
                        ? new Date(issue.sent_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'Date unknown'}
                    </p>
                    {issue.content && (
                      <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{issue.content.slice(0, 100)}&hellip;</p>
                    )}
                    <div className="mt-3 text-xs font-medium flex items-center gap-1 text-primary-600 group-hover:underline">
                      Read issue →
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Subscribe */}
            <div className="rounded-xl p-6 text-white" style={{ background: GREEN }}>
              <div className="text-2xl mb-3">📬</div>
              <h3 className="font-bold text-lg mb-1">Subscribe</h3>
              <p className="text-white/75 text-sm mb-4 leading-relaxed">
                Get the latest library news and updates delivered straight to your inbox.
              </p>
              {subscribed ? (
                <div className="bg-white/20 rounded-lg px-4 py-3 text-sm font-medium">
                  ✓ You're subscribed! Watch for our next issue.
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-2">
                  <input
                    type="email"
                    value={subscribeEmail}
                    onChange={e => setSubscribeEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm text-neutral-900 border-0 focus:outline-none focus:ring-2 focus:ring-white"
                  />
                  <button
                    type="submit"
                    disabled={subscribing}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-neutral-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ background: GOLD }}
                  >
                    {subscribing ? 'Subscribing…' : 'Subscribe Free'}
                  </button>
                </form>
              )}
            </div>

            {/* Quick links */}
            <div className="bg-white border border-neutral-100 rounded-xl p-5">
              <h3 className="font-bold text-neutral-900 mb-3">Library Updates</h3>
              <div className="space-y-2">
                {[
                  { label: 'Latest Blog Posts', to: '/blog' },
                  { label: 'Upcoming Events', to: '/events' },
                  { label: 'New Arrivals', to: '/catalogue?filter=new' },
                  { label: 'Library Feed', to: '/feed' },
                ].map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between py-2 text-sm text-neutral-600 hover:text-primary-700 border-b border-neutral-50 last:border-0 transition-colors"
                  >
                    {item.label}
                    <span className="text-neutral-300">→</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-5">
              <p className="text-xs text-neutral-500 leading-relaxed">
                Issues are sent to registered patrons at {institutionConfig.name}.
                We respect your privacy and you can unsubscribe at any time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="text-white px-6 py-5 rounded-t-2xl" style={{ background: GREEN }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-lg leading-tight">{selected.subject}</h2>
                  <p className="text-white/60 text-sm mt-1">
                    {selected.sent_date
                      ? new Date(selected.sent_date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
                      : ''}
                    {selected.recipient_scope && selected.recipient_scope !== 'all' && ` · ${selected.recipient_scope}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-white/60 hover:text-white text-2xl shrink-0 leading-none mt-0.5"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-neutral-700 text-sm leading-relaxed whitespace-pre-wrap">{selected.content}</div>
              <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
