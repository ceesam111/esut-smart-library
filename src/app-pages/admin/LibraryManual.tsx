import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLibraryManual() {
  const [title, setTitle] = useState('ESUT Library Manual');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/library-manual')
      .then((res) => res.json())
      .then((json) => {
        if (json.manual?.title) setTitle(json.manual.title);
        if (json.manual?.body) setBody(json.manual.body);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/admin/library-manual', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title, body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save manual.');
      setMessage('Library Manual saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save manual.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Library Manual</h1>
        <p className="text-sm text-neutral-500">Publish instructions, library rules, borrowing guides, and study support notes for users.</p>
      </div>
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Manual Content</label>
          <textarea className="input min-h-[360px] font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Enter library manual content..." />
          <p className="text-xs text-neutral-400 mt-1">Plain text is supported. Use short headings and spacing for readability.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Manual'}</button>
          {message && <span className="text-sm text-neutral-600">{message}</span>}
        </div>
      </div>
    </div>
  );
}
