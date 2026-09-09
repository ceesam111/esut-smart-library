import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Authority {
  id: string;
  term: string;
  term_type: 'author' | 'subject' | 'series' | 'corporate' | 'geographic';
  variants: string[];
  notes: string;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

const TERM_TYPES = [
  { value: 'author',      label: 'Author Name' },
  { value: 'subject',     label: 'Subject Heading' },
  { value: 'series',      label: 'Series Title' },
  { value: 'corporate',   label: 'Corporate Body' },
  { value: 'geographic',  label: 'Geographic Name' },
];

const TYPE_BADGE: Record<string, string> = {
  author:     'bg-blue-100 text-blue-800',
  subject:    'bg-green-100 text-green-800',
  series:     'bg-amber-100 text-amber-800',
  corporate:  'bg-purple-100 text-purple-800',
  geographic: 'bg-rose-100 text-rose-800',
};

const EMPTY: Omit<Authority, 'id' | 'created_at' | 'updated_at' | 'usage_count'> = {
  term: '', term_type: 'subject', variants: [], notes: '',
};

export default function CatalogueAuthorities() {
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('');
  const [modal, setModal]             = useState<'add' | 'edit' | null>(null);
  const [form, setForm]               = useState(EMPTY);
  const [editId, setEditId]           = useState<string | null>(null);
  const [variantInput, setVariantInput] = useState('');
  const [saving, setSaving]           = useState(false);
  const [alert, setAlert]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('authority_control')
        .select('*')
        .order('term');
      if (error) throw error;
      const rows = data || [];

      // Count catalogue_items using each term
      const counts: Record<string, number> = {};
      await Promise.all(
        rows.map(async (a) => {
          const field = a.term_type === 'author' ? 'authors' : 'subjects';
          const { count } = await supabase
            .from('catalogue_items')
            .select('id', { count: 'exact', head: true })
            .ilike(field, `%${a.term}%`);
          counts[a.id] = count ?? 0;
        })
      );
      setUsageCounts(counts);
      setAuthorities(rows);
    } catch {
      showAlert('error', 'Failed to load authorities.');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const openAdd = () => {
    setForm(EMPTY);
    setVariantInput('');
    setEditId(null);
    setModal('add');
  };

  const openEdit = (a: Authority) => {
    setForm({ term: a.term, term_type: a.term_type, variants: a.variants ?? [], notes: a.notes });
    setVariantInput('');
    setEditId(a.id);
    setModal('edit');
  };

  const addVariant = () => {
    const v = variantInput.trim();
    if (v && !form.variants.includes(v)) {
      setForm((f) => ({ ...f, variants: [...f.variants, v] }));
    }
    setVariantInput('');
  };

  const removeVariant = (v: string) => {
    setForm((f) => ({ ...f, variants: f.variants.filter((x) => x !== v) }));
  };

  const handleSave = async () => {
    if (!form.term.trim()) { showAlert('error', 'Term is required.'); return; }
    setSaving(true);
    try {
      if (modal === 'add') {
        const { error } = await supabase.from('authority_control').insert({
          term: form.term.trim(),
          term_type: form.term_type,
          variants: form.variants,
          notes: form.notes,
        });
        if (error) throw error;
        showAlert('success', 'Authority term added.');
      } else {
        const { error } = await supabase.from('authority_control').update({
          term: form.term.trim(),
          term_type: form.term_type,
          variants: form.variants,
          notes: form.notes,
        }).eq('id', editId!);
        if (error) throw error;
        showAlert('success', 'Authority term updated.');
      }
      setModal(null);
      fetchAll();
    } catch (err: any) {
      showAlert('error', err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this authority term?')) return;
    const { error } = await supabase.from('authority_control').delete().eq('id', id);
    if (error) { showAlert('error', 'Delete failed.'); return; }
    showAlert('success', 'Authority term deleted.');
    fetchAll();
  };

  const filtered = authorities.filter((a) => {
    const matchSearch = !search || a.term.toLowerCase().includes(search.toLowerCase());
    const matchType   = !filterType || a.term_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Authority Control</h1>
          <p className="text-gray-600 mt-1">
            Manage controlled vocabulary for consistent headings across all catalogue records.
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          + Add Authority Term
        </button>
      </div>

      {alert && (
        <div className={`p-4 rounded-lg text-sm font-medium ${alert.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {alert.msg}
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search terms..."
          className="input flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-full sm:w-48" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {TERM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {TERM_TYPES.map((t) => (
          <div key={t.value} className="card text-center">
            <div className="text-2xl font-bold">
              {authorities.filter((a) => a.term_type === t.value).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">{t.label}s</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left p-3 font-semibold">Term</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-left p-3 font-semibold">Variants</th>
                <th className="text-left p-3 font-semibold">Items Using</th>
                <th className="text-left p-3 font-semibold">Notes</th>
                <th className="text-left p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    {search || filterType ? 'No matching authority terms.' : 'No authority terms yet. Add one to get started.'}
                  </td>
                </tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{a.term}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[a.term_type]}`}>
                      {TERM_TYPES.find((t) => t.value === a.term_type)?.label}
                    </span>
                  </td>
                  <td className="p-3">
                    {(a.variants ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {a.variants.map((v) => (
                          <span key={v} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-primary-700">
                      {usageCounts[a.id] ?? 0}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 max-w-xs truncate">{a.notes || '—'}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => openEdit(a)} className="btn-outline text-xs py-1 px-2">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-xs py-1 px-2 rounded border border-red-300 text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-gray-500 border-t">
            {filtered.length} of {authorities.length} terms
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-xl font-bold">
              {modal === 'add' ? 'Add Authority Term' : 'Edit Authority Term'}
            </h2>

            <div>
              <label className="label">Term <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input w-full"
                value={form.term}
                onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                placeholder="e.g. Achebe, Chinua"
              />
            </div>

            <div>
              <label className="label">Type</label>
              <select
                className="input w-full"
                value={form.term_type}
                onChange={(e) => setForm((f) => ({ ...f, term_type: e.target.value as Authority['term_type'] }))}
              >
                {TERM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Variants / Alternate Forms</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="input flex-1"
                  value={variantInput}
                  onChange={(e) => setVariantInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVariant())}
                  placeholder="Enter variant and press Enter"
                />
                <button type="button" onClick={addVariant} className="btn-outline">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.variants.map((v) => (
                  <span key={v} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {v}
                    <button onClick={() => removeVariant(v)} className="text-gray-400 hover:text-red-500 ml-1">✕</button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input w-full"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this term"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModal(null)} className="btn-outline">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
