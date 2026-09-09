import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { loadLocalArray, makeId, saveLocalArray } from '@/lib/localStore';

const LOCAL_DATABASES_KEY = 'admin_databases_fallback';

interface Database {
  id: string;
  name: string;
  description: string;
  url: string | null;
  provider: string;
  type: string;
  coverage: string;
  subjects: any;
  access_type: string;
  faculty_codes: any;
  is_active: boolean;
  logo_url: string | null;
  subject_tags: string[] | null;
  content_type: string | null;
  dept_availability: string[] | null;
  access_username?: string | null;
  access_password?: string | null;
}

interface AccessRequest {
  id: string;
  database_id: string;
  patron_name: string;
  patron_email: string;
  department: string;
  reason: string;
  status: string;
  created_at: string;
}

const BLANK: Omit<Database, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  url: null,
  provider: '',
  type: 'Journal',
  coverage: '',
  subjects: null,
  access_type: 'licensed',
  faculty_codes: null,
  is_active: true,
  logo_url: null,
  subject_tags: [],
  content_type: 'Articles',
  dept_availability: [],
  access_username: null,
  access_password: null,
};

export default function Databases() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'requests'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [subjectTagInput, setSubjectTagInput] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [dbRes, reqRes] = await Promise.all([
        supabase.from('databases').select('*').order('name'),
        supabase.from('database_access_requests').select('*').order('created_at', { ascending: false }),
      ]);
      const merged = [...(dbRes.data ?? []), ...loadLocalArray<Database>(LOCAL_DATABASES_KEY).filter((local) => !(dbRes.data ?? []).some((remote) => remote.id === local.id))];
      setDatabases(merged);
      setRequests(reqRes.data ?? []);
    } catch {
      setDatabases(loadLocalArray<Database>(LOCAL_DATABASES_KEY));
      setRequests([]);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK });
    setSubjectTagInput('');
    setView('form');
  }

  function openEdit(db: Database) {
    setEditingId(db.id);
    setForm({
      name: db.name,
      description: db.description,
      url: db.url,
      provider: db.provider,
      type: db.type,
      coverage: db.coverage,
      subjects: db.subjects,
      access_type: db.access_type,
      faculty_codes: db.faculty_codes,
      is_active: db.is_active,
      logo_url: db.logo_url,
      subject_tags: db.subject_tags ?? [],
      content_type: db.content_type,
      dept_availability: db.dept_availability ?? [],
      access_username: db.access_username ?? null,
      access_password: db.access_password ?? null,
    });
    setSubjectTagInput((db.subject_tags ?? []).join(', '));
    setView('form');
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      subject_tags: subjectTagInput.split(',').map(s => s.trim()).filter(Boolean),
    };
    const row = { id: editingId ?? makeId('db'), ...payload } as Database;
    const local = loadLocalArray<Database>(LOCAL_DATABASES_KEY);
    saveLocalArray(LOCAL_DATABASES_KEY, editingId ? local.map((db) => db.id === editingId ? row : db) : [row, ...local]);
    setDatabases((current) => editingId ? current.map((db) => db.id === editingId ? row : db) : [row, ...current]);
    if (editingId) await supabase.from('databases').update(payload).eq('id', editingId);
    else await supabase.from('databases').insert(payload);
    setSaving(false);
    setView('list');
    loadAll();
  }

  async function remove(id: string) {
    if (!confirm('Delete this database?')) return;
    setDatabases((current) => current.filter((db) => db.id !== id));
    saveLocalArray(LOCAL_DATABASES_KEY, loadLocalArray<Database>(LOCAL_DATABASES_KEY).filter((db) => db.id !== id));
    await supabase.from('databases').delete().eq('id', id);
    loadAll();
  }

  async function updateRequest(id: string, status: string) {
    await supabase.from('database_access_requests').update({ status }).eq('id', id);
    setRequests(r => r.map(x => x.id === id ? { ...x, status } : x));
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const requestStatusColor = (s: string) => ({
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    denied: 'bg-red-100 text-red-600',
  }[s] ?? 'bg-neutral-100 text-neutral-600');

  if (view === 'form') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-sm text-neutral-500 hover:text-neutral-700">← Back</button>
          <h1 className="text-xl font-bold text-neutral-900">{editingId ? 'Edit Database' : 'New Database'}</h1>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. JSTOR"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Provider</label>
              <input
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. ITHAKA"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Access Username</label>
              <input value={form.access_username ?? ''} onChange={e => setForm(f => ({ ...f, access_username: e.target.value || null }))} className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Shared username" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Access Password</label>
              <input type="password" value={form.access_password ?? ''} onChange={e => setForm(f => ({ ...f, access_password: e.target.value || null }))} className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Hidden from visitors" />
              <p className="text-xs text-neutral-400 mt-1">Passwords are stored for auto-access workflows and are not displayed in public listings.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Brief description of the database"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Access URL</label>
              <input
                value={form.url ?? ''}
                onChange={e => setForm(f => ({ ...f, url: e.target.value || null }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Logo URL</label>
              <input
                value={form.logo_url ?? ''}
                onChange={e => setForm(f => ({ ...f, logo_url: e.target.value || null }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {['Journal', 'Database', 'eBook', 'Index', 'Newspaper', 'Repository'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Content Type</label>
              <input
                value={form.content_type ?? ''}
                onChange={e => setForm(f => ({ ...f, content_type: e.target.value || null }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Articles, Books…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Access Type</label>
              <select
                value={form.access_type}
                onChange={e => setForm(f => ({ ...f, access_type: e.target.value }))}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {['licensed', 'open_access', 'trial', 'request_required'].map(a => (
                  <option key={a} value={a}>{a.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Subject Tags (comma-separated)</label>
            <input
              value={subjectTagInput}
              onChange={e => setSubjectTagInput(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Biology, Chemistry, Physics"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Coverage</label>
            <input
              value={form.coverage}
              onChange={e => setForm(f => ({ ...f, coverage: e.target.value }))}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. 1994 – present"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-neutral-700">Active (visible to patrons)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !form.name.trim()}
              className="px-5 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add Database'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'requests') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-sm text-neutral-500 hover:text-neutral-700">← Back</button>
          <h1 className="text-xl font-bold text-neutral-900">Access Requests</h1>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {requests.length === 0 ? (
            <p className="text-center text-neutral-400 text-sm py-12">No access requests yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Patron</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Database</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Date</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {requests.map(r => {
                  const db = databases.find(d => d.id === r.database_id);
                  return (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-neutral-900">{r.patron_name}</p>
                        <p className="text-xs text-neutral-400">{r.patron_email}</p>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{db?.name ?? r.database_id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${requestStatusColor(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-xs">
                        {new Date(r.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => updateRequest(r.id, 'approved')}
                              className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateRequest(r.id, 'denied')}
                              className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                            >
                              Deny
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Database Directory</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage licensed and open-access databases.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('requests')}
            className={`text-sm px-4 py-2 rounded-lg font-medium border transition-colors ${
              pendingCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Access Requests {pendingCount > 0 && <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 rounded-full">{pendingCount}</span>}
          </button>
          <button
            onClick={openNew}
            className="bg-primary-700 hover:bg-primary-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Add Database
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      ) : databases.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <p className="text-neutral-400 text-sm">No databases yet. Click "+ Add Database" to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Database</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Access</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Active</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {databases.map(db => (
                <tr key={db.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {db.logo_url ? (
                        <img src={db.logo_url} alt={db.name} className="w-7 h-7 object-contain rounded" />
                      ) : (
                        <div className="w-7 h-7 bg-neutral-100 rounded flex items-center justify-center text-xs text-neutral-400 font-bold">
                          {db.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-neutral-900">{db.name}</p>
                        <p className="text-xs text-neutral-400">{db.provider}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{db.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      db.access_type === 'open_access' ? 'bg-green-100 text-green-700'
                      : db.access_type === 'licensed' ? 'bg-primary-100 text-primary-700'
                      : db.access_type === 'trial' ? 'bg-amber-100 text-amber-700'
                      : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {db.access_type?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${db.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {db.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(db)} className="text-xs text-primary-700 hover:underline">Edit</button>
                      <button onClick={() => remove(db.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
