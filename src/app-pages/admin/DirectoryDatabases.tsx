import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { LibraryResource, LibraryResourceAccessCode } from '@/config/libraryResources.config';

interface DirectoryEntryView {
  resource: LibraryResource;
  source: 'catalog' | 'custom';
  active: boolean;
}

interface Props {
  directory: 'open_access' | 'subscribed';
}

const TITLES: Record<Props['directory'], string> = {
  open_access: 'Open Access Databases',
  subscribed: 'Subscribed Databases',
};

const PUBLIC_PATH: Record<Props['directory'], string> = {
  open_access: '/open-access-databases',
  subscribed: '/subscribed-databases',
};

const ACCESS_CODES: LibraryResourceAccessCode[] = ['OA', 'OPEN-DATA', 'DIRECTORY', 'FREE-MIXED', 'FREE-REG', 'SUBSCRIBED'];

function blankResource(directory: Props['directory']): LibraryResource {
  return {
    id: '',
    name: '',
    description: '',
    provider: '',
    subjects: [],
    resourceType: '',
    accessType: directory === 'open_access' ? 'Open Access' : 'Institutional Subscription',
    accessCode: directory === 'open_access' ? 'OA' : 'SUBSCRIBED',
    url: '',
    imageUrl: '',
    isExternal: true,
    status: 'active',
  };
}

export default function DirectoryDatabases({ directory }: Props) {
  const [entries, setEntries] = useState<DirectoryEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<LibraryResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LibraryResource>(blankResource(directory));
  const [subjectsInput, setSubjectsInput] = useState('');

  async function authFetch(url: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('You must be signed in.');
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed with ${res.status}`);
    return json;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const json = await authFetch(`/api/admin/directory?directory=${directory}`);
      setEntries(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    }
    setLoading(false);
  }, [directory]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const r = entry.resource;
      return (
        r.name.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        r.subjects.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [entries, search]);

  function openNew() {
    setEditing(null);
    setForm(blankResource(directory));
    setSubjectsInput('');
    setMsg('');
    setView('form');
  }

  function openEdit(entry: DirectoryEntryView) {
    setEditing(entry.resource);
    setForm({ ...entry.resource, status: entry.active ? 'active' : 'inactive' });
    setSubjectsInput(entry.resource.subjects.join(', '));
    setMsg('');
    setView('form');
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      const resource: LibraryResource = {
        ...form,
        subjects: subjectsInput.split(',').map((s) => s.trim()).filter(Boolean),
        status: 'active',
      };
      const active = form.status !== 'inactive';
      if (editing) {
        await authFetch('/api/admin/directory', {
          method: 'PATCH',
          body: JSON.stringify({ directory, id: editing.id, resource, active }),
        });
        setMsg(`Saved "${resource.name}".`);
      } else {
        await authFetch('/api/admin/directory', {
          method: 'POST',
          body: JSON.stringify({ directory, resource, active }),
        });
        setMsg(`Added "${resource.name}".`);
      }
      setView('list');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    }
    setSaving(false);
  }

  async function toggleActive(entry: DirectoryEntryView) {
    setMsg('');
    try {
      await authFetch('/api/admin/directory', {
        method: 'PATCH',
        body: JSON.stringify({ directory, id: entry.resource.id, resource: entry.resource, active: !entry.active }),
      });
      setMsg(`${entry.active ? 'Hidden' : 'Shown'} "${entry.resource.name}".`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  async function remove(entry: DirectoryEntryView) {
    const isCatalog = entry.source === 'catalog';
    const question = isCatalog
      ? `Hide "${entry.resource.name}" from the public page? (You can restore it anytime.)`
      : `Permanently delete "${entry.resource.name}"?`;
    if (!window.confirm(question)) return;
    setMsg('');
    try {
      await authFetch(`/api/admin/directory?directory=${directory}&id=${encodeURIComponent(entry.resource.id)}`, {
        method: 'DELETE',
      });
      setMsg(isCatalog ? `Hidden "${entry.resource.name}".` : `Deleted "${entry.resource.name}".`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  const inputCls = 'w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  if (view === 'form') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="text-sm text-neutral-500 hover:text-neutral-700">← Back</button>
          <h1 className="text-xl font-bold text-neutral-900">
            {editing ? `Edit ${TITLES[directory]} Entry` : `New ${TITLES[directory]} Entry`}
          </h1>
        </div>
        {msg && <div className="mb-4 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3">{msg}</div>}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. DOAJ" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Provider</label>
              <input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} className={inputCls} placeholder="e.g. DOAJ" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="What does this database offer?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">URL *</label>
              <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={inputCls} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Logo / Image URL</label>
              <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} className={inputCls} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Resource Type</label>
              <input value={form.resourceType} onChange={(e) => setForm((f) => ({ ...f, resourceType: e.target.value }))} className={inputCls} placeholder="e.g. Journal Index" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Access Type</label>
              <input value={form.accessType} onChange={(e) => setForm((f) => ({ ...f, accessType: e.target.value }))} className={inputCls} placeholder="e.g. Open Access" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Access Code</label>
              <select value={form.accessCode ?? ''} onChange={(e) => setForm((f) => ({ ...f, accessCode: (e.target.value || undefined) as LibraryResourceAccessCode }))} className={inputCls}>
                <option value="">—</option>
                {ACCESS_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
              <input value={form.category ?? ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || undefined }))} className={inputCls} placeholder="e.g. Global scholarly discovery" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Subjects (comma-separated)</label>
              <input value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} className={inputCls} placeholder="Medicine, Public Health" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Access Note</label>
            <textarea value={form.accessNote ?? ''} onChange={(e) => setForm((f) => ({ ...f, accessNote: e.target.value || undefined }))} rows={2} className={`${inputCls} resize-none`} placeholder="Shown on the public card (optional)" />
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isExternal} onChange={(e) => setForm((f) => ({ ...f, isExternal: e.target.checked }))} className="rounded" />
              <span className="text-sm text-neutral-700">Opens in a new tab</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.status !== 'inactive'}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked ? 'active' : 'inactive' }))}
                className="rounded"
              />
              <span className="text-sm text-neutral-700">Visible on the public page</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setView('list')} className="px-4 py-2 text-sm border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors">Cancel</button>
            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.url.trim()}
              className="px-5 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : editing ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = entries.filter((e) => e.active).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{TITLES[directory]}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {activeCount} visible of {entries.length} total entries. Changes appear on the public page immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={PUBLIC_PATH[directory]}
            className="text-sm px-4 py-2 rounded-lg font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            View Public Page ↗
          </Link>
          <button onClick={openNew} className="bg-primary-700 hover:bg-primary-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors">
            + Add Entry
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 text-sm rounded-lg border border-green-200 bg-green-50 text-green-800 px-4 py-3">{msg}</div>}
      {error && <div className="mb-4 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">Error: {error}</div>}

      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, provider, subject…"
          className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label={`Search ${TITLES[directory]}`}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <p className="text-neutral-400 text-sm">No entries match.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase">Status</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((entry) => (
                <tr key={entry.resource.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{entry.resource.name}</p>
                    <p className="text-xs text-neutral-400">{entry.resource.provider}{entry.resource.category ? ` · ${entry.resource.category}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.source === 'custom' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      {entry.source === 'custom' ? 'Custom' : 'Catalog'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {entry.active ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(entry)} className="text-xs text-primary-700 hover:underline">Edit</button>
                      <button onClick={() => toggleActive(entry)} className="text-xs text-neutral-500 hover:underline">
                        {entry.active ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => remove(entry)} className="text-xs text-red-600 hover:underline">Delete</button>
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
