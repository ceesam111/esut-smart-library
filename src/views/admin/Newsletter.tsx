import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface Newsletter {
  id: string;
  subject: string;
  content: string;
  recipient_scope: string;
  faculty?: string;
  category?: string;
  sent_date?: string;
  status: string;
}

export default function Newsletter() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipientScope, setRecipientScope] = useState('all');
  const [selectedFaculty, setSelectedFaculty] = useState(institutionConfig.faculties[0]?.code || '');
  const [selectedCategory, setSelectedCategory] = useState('student');
  const [scheduleDatetime, setScheduleDatetime] = useState('');
  const [sendNow, setSendNow] = useState(true);

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('sent_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNewsletters(data || []);
    } catch (error) {
      console.error('Error fetching newsletters:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendNewsletter = async () => {
    if (!subject.trim() || !content.trim()) {
      alert('Subject and content are required');
      return;
    }

    try {
      const newsletter: Newsletter = {
        id: '',
        subject,
        content,
        recipient_scope: recipientScope,
        faculty: recipientScope === 'faculty' ? selectedFaculty : undefined,
        category: recipientScope === 'category' ? selectedCategory : undefined,
        sent_date: sendNow ? new Date().toISOString() : scheduleDatetime,
        status: sendNow ? 'sent' : 'scheduled',
      };

      const { error } = await supabase.from('newsletters').insert([newsletter]);

      if (error) throw error;

      resetComposer();
      fetchArchive();
    } catch (error) {
      console.error('Error sending newsletter:', error);
    }
  };

  const resetComposer = () => {
    setSubject('');
    setContent('');
    setRecipientScope('all');
    setSelectedFaculty(institutionConfig.faculties[0]?.code || '');
    setSelectedCategory('student');
    setScheduleDatetime('');
    setSendNow(true);
    setShowComposer(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Newsletter Composer</h1>
          <p className="text-gray-600 mt-2">Send targeted communications to patrons</p>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="btn-primary"
        >
          {showComposer ? 'Cancel' : 'New Newsletter'}
        </button>
      </div>

      {showComposer && (
        <div className="card space-y-6">
          <h2 className="text-2xl font-semibold">Compose Newsletter</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="label">Subject</label>
              <input
                type="text"
                className="input w-full"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Newsletter subject line"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Message Content</label>
              <textarea
                className="input w-full"
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your newsletter content here..."
              />
            </div>

            <div>
              <label className="label">Send To</label>
              <select
                className="input w-full"
                value={recipientScope}
                onChange={(e) => setRecipientScope(e.target.value)}
              >
                <option value="all">All Patrons</option>
                <option value="faculty">By Faculty</option>
                <option value="category">By Category</option>
              </select>
            </div>

            {recipientScope === 'faculty' && (
              <div>
                <label className="label">Faculty</label>
                <select
                  className="input w-full"
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                >
                  {institutionConfig.faculties.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {recipientScope === 'category' && (
              <div>
                <label className="label">Category</label>
                <select
                  className="input w-full"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="student">Students</option>
                  <option value="staff">Staff</option>
                  <option value="postdoc">Postdoc</option>
                  <option value="external">External</option>
                </select>
              </div>
            )}

            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={sendNow}
                    onChange={() => setSendNow(true)}
                  />
                  <span className="font-medium">Send Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!sendNow}
                    onChange={() => setSendNow(false)}
                  />
                  <span className="font-medium">Schedule for Later</span>
                </label>
              </div>

              {!sendNow && (
                <div>
                  <label className="label">Schedule Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    value={scheduleDatetime}
                    onChange={(e) => setScheduleDatetime(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-6 flex gap-4">
            <button onClick={resetComposer} className="btn-ghost flex-1">
              Cancel
            </button>
            <button onClick={sendNewsletter} className="btn-primary flex-1">
              {sendNow ? 'Send Now' : 'Schedule'}
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Newsletter Archive</h2>

          {newsletters.length > 0 ? (
            <div className="space-y-3">
              {newsletters.map((newsletter) => (
                <div
                  key={newsletter.id}
                  className="p-4 border rounded hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{newsletter.subject}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {newsletter.content}
                      </p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                        <span>
                          Sent to:{' '}
                          {newsletter.recipient_scope === 'all'
                            ? 'All Patrons'
                            : newsletter.recipient_scope === 'faculty'
                            ? `Faculty of ${newsletter.faculty}`
                            : `${newsletter.category} Category`}
                        </span>
                        {newsletter.sent_date && (
                          <span>
                            {new Date(newsletter.sent_date).toLocaleDateString()} at{' '}
                            {new Date(newsletter.sent_date).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        newsletter.status === 'sent' ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {newsletter.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No newsletters sent yet</p>
          )}
        </div>
      )}
    </div>
  );
}
