import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';

interface Issue {
  id: string;
  subject: string;
  content: string;
  recipient_scope: string;
  status: string;
  sent_date: string | null;
  open_rate: number | null;
  brevo_campaign_id: string | null;
  created_at: string;
}

const BLANK_ISSUE: Omit<Issue, 'id' | 'created_at'> = {
  subject: '',
  content: '',
  recipient_scope: 'all',
  status: 'draft',
  sent_date: null,
  open_rate: null,
  brevo_campaign_id: null,
};

type Tab = 'compose' | 'preview' | 'history';

export default function Newsletter() {
  const [tab, setTab] = useState<Tab>('history');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_ISSUE });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('newsletter_issues')
      .select('id, subject, content, recipient_scope, status, sent_date, open_rate, brevo_campaign_id, created_at')
      .order('created_at', { ascending: false });
    setIssues(data ?? []);
    setLoading(false);
  }

  function newDraft() {
    setEditingId(null);
    setForm({ ...BLANK_ISSUE });
    setTab('compose');
    setMessage('');
  }

  function editIssue(issue: Issue) {
    setEditingId(issue.id);
    setForm({
      subject: issue.subject,
      content: issue.content,
      recipient_scope: issue.recipient_scope,
      status: issue.status,
      sent_date: issue.sent_date,
      open_rate: issue.open_rate,
      brevo_campaign_id: issue.brevo_campaign_id,
    });
    setTab('compose');
    setMessage('');
  }

  async function saveDraft() {
    if (!form.subject.trim() || !form.content.trim()) return;
    setSaving(true);
    if (editingId) {
      await supabase.from('newsletter_issues').update({ subject: form.subject, content: form.content, recipient_scope: form.recipient_scope }).eq('id', editingId);
    } else {
      const { data } = await supabase.from('newsletter_issues').insert({ ...form, status: 'draft' }).select('id').single();
      if (data) setEditingId(data.id);
    }
    setSaving(false);
    setMessage('Draft saved.');
    load();
  }

  async function sendNow() {
    if (!form.subject.trim() || !form.content.trim()) return;
    setSending(true);
    setMessage('');

    // Determine recipients
    let emailRecipients: { name: string; email: string }[] = [];
    let query = supabase.from('patrons').select('full_name, email').not('email', 'is', null).eq('status', 'active');
    if (form.recipient_scope !== 'all') {
      query = query.eq('patron_category', form.recipient_scope);
    }
    const { data: patrons } = await query;
    emailRecipients = (patrons ?? []).filter(p => p.email).map(p => ({ name: p.full_name ?? p.email, email: p.email! }));

    if (emailRecipients.length === 0) {
      setSending(false);
      setMessage('No recipients found for the selected scope.');
      return;
    }

    // Send via edge function (batches emails)
    let sent = 0;
    const html = buildEmailHtml(form.subject, form.content);
    for (const r of emailRecipients) {
      await supabase.functions.invoke('send-email', {
        body: { to: r.email, to_name: r.name, subject: form.subject, html },
      });
      sent++;
    }

    const now = new Date().toISOString();
    if (editingId) {
      await supabase.from('newsletter_issues').update({ status: 'sent', sent_date: now, subject: form.subject, content: form.content, recipient_scope: form.recipient_scope }).eq('id', editingId);
    } else {
      await supabase.from('newsletter_issues').insert({ ...form, status: 'sent', sent_date: now });
    }

    setSending(false);
    setMessage(`Sent to ${sent} recipients.`);
    setTab('history');
    load();
  }

  function buildEmailHtml(subject: string, body: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
              <tr style="background:#0f3460;"><td style="padding:28px 40px;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${institutionConfig.name}</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Library Newsletter</p>
              </td></tr>
              <tr><td style="padding:36px 40px;">
                <h2 style="margin:0 0 20px;color:#1a1a2e;font-size:20px;">${subject}</h2>
                <div style="color:#444;font-size:15px;line-height:1.7;">${body.replace(/\n/g, '<br/>')}</div>
              </td></tr>
              <tr style="background:#f8f8f8;"><td style="padding:20px 40px;text-align:center;">
                <p style="margin:0;color:#999;font-size:12px;">${institutionConfig.name} · Library Services</p>
                <p style="margin:4px 0 0;color:#999;font-size:12px;">To unsubscribe, contact the library directly.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;
  }

  const scopeLabel = (scope: string) => {
    if (scope === 'all') return 'All Patrons';
    return scope;
  };

  const statusColor = (s: string) => ({
    draft: 'bg-neutral-100 text-neutral-600',
    sent: 'bg-green-100 text-green-700',
    scheduled: 'bg-amber-100 text-amber-700',
  }[s] ?? 'bg-neutral-100 text-neutral-600');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Newsletter</h1>
          <p className="text-sm text-neutral-500 mt-1">Compose and send newsletters to library patrons.</p>
        </div>
        <button
          onClick={newDraft}
          className="bg-primary-700 hover:bg-primary-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + New Newsletter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg mb-6 w-fit">
        {(['history', 'compose', 'preview'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
              <p className="text-neutral-400 text-sm">No newsletters yet. Click "+ New Newsletter" to get started.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Recipients</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Sent</th>
                    <th className="text-right px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {issues.map(issue => (
                    <tr key={issue.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-neutral-900 max-w-xs truncate">{issue.subject || '(no subject)'}</td>
                      <td className="px-4 py-3 text-neutral-500">{scopeLabel(issue.recipient_scope)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {issue.sent_date ? new Date(issue.sent_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {issue.status === 'draft' && (
                          <button
                            onClick={() => editIssue(issue)}
                            className="text-xs text-primary-700 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Compose tab */}
      {tab === 'compose' && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2.5 rounded-lg">{message}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Subject *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Library Updates — July 2025"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Recipients</label>
            <select
              value={form.recipient_scope}
              onChange={e => setForm(f => ({ ...f, recipient_scope: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Patrons</option>
              <option value="Undergraduate">Undergraduates</option>
              <option value="Postgraduate Taught">Postgraduate Taught</option>
              <option value="Postgraduate Research">Postgraduate Research</option>
              <option value="Staff">Staff</option>
              <option value="Alumni">Alumni</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Body *</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={12}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono"
              placeholder="Write your newsletter content here. Plain text or basic HTML accepted."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => setTab('preview')}
              className="px-4 py-2 text-sm border border-primary-300 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
            >
              Preview
            </button>
            <button
              onClick={sendNow}
              disabled={sending || !form.subject.trim() || !form.content.trim()}
              className="px-5 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending…' : 'Send Now'}
            </button>
          </div>
        </div>
      )}

      {/* Preview tab */}
      {tab === 'preview' && (
        <div>
          <div className="bg-neutral-800 rounded-t-xl px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-neutral-400 text-xs ml-2">Email Preview</span>
          </div>
          <div
            className="bg-neutral-100 rounded-b-xl p-6 overflow-auto"
            style={{ maxHeight: '65vh' }}
          >
            {form.subject ? (
              <div
                dangerouslySetInnerHTML={{ __html: buildEmailHtml(form.subject, form.content) }}
                className="scale-90 origin-top"
              />
            ) : (
              <p className="text-center text-neutral-400 text-sm py-16">
                Go to the Compose tab and enter a subject and content to preview.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
