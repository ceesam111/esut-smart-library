import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface StagingRow {
  id: string; isbn: string | null; title: string | null; authors: string[]; publisher: string | null; year: number | null;
  edition?: string | null; language?: string | null; category?: string | null; subjects?: string[]; copies?: number;
  shelf_location?: string | null; item_type?: string; source_url?: string | null; cover_url?: string | null; notes?: string | null;
  confidence: string; status: string; raw_row: Record<string, unknown>; enriched_data: Record<string, unknown>;
}

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed with ${res.status}`);
  return json;
}

export default function CatalogueImportBatch() {
  const { batchId } = useParams();
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const json = await authFetch(`/api/admin/catalogue/import/${batchId}${filter ? `?confidence=${filter}` : ''}`);
      setRows(json.rows ?? []);
    } catch (error) { setMessage((error as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [batchId, filter]);

  async function approve(id: string) {
    await authFetch(`/api/admin/catalogue/staging/${id}/approve`, { method: 'POST', body: '{}' });
    await load();
  }

  async function save(id: string, patch: Record<string, unknown>) {
    await authFetch(`/api/admin/catalogue/staging/${id}`, { method: 'PATCH', body: JSON.stringify({ patch }) });
    await load();
  }

  async function reject(id: string) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await authFetch(`/api/admin/catalogue/staging/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    await load();
  }

  async function bulkApprove() {
    const json = await authFetch(`/api/admin/catalogue/import/${batchId}/bulk-approve-clean`, { method: 'POST', body: '{}' });
    setMessage(`${json.approved} clean-match rows approved.${json.failures?.length ? ` ${json.failures.length} failed.` : ''}`);
    await load();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-serif font-semibold text-primary-800">Import Batch Review</h1><p className="text-sm text-neutral-500 font-mono">{batchId}</p></div>
        <div className="flex gap-2"><Link to="/admin/catalogue/import" className="btn-outline text-sm">New import</Link><button onClick={bulkApprove} className="btn-primary text-sm">Bulk approve clean matches</button></div>
      </div>
      {message && <div className="rounded-lg bg-primary-50 border border-primary-200 text-primary-900 px-4 py-3 text-sm">{message}</div>}
      <div className="flex gap-2 flex-wrap">{['', 'clean_match', 'needs_review', 'conflict', 'no_match'].map((f) => <button key={f || 'all'} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs border ${filter === f ? 'bg-primary-700 text-white' : 'bg-white text-neutral-600'}`}>{f || 'all'}</button>)}</div>
      {loading ? <div className="text-neutral-500">Loading…</div> : <Rows rows={rows} onApprove={approve} onReject={reject} onSave={save} />}
    </div>
  );
}

export function Rows({ rows, onApprove, onReject, onSave }: { rows: StagingRow[]; onApprove: (id: string) => void; onReject: (id: string) => void; onSave?: (id: string, patch: Record<string, unknown>) => void }) {
  if (!rows.length) return <div className="card p-10 text-center text-neutral-500">No rows match this view.</div>;
  return <div className="space-y-3">{rows.map((row) => <EditableRow key={row.id} row={row} onApprove={onApprove} onReject={onReject} onSave={onSave} />)}</div>;
}

function EditableRow({ row, onApprove, onReject, onSave }: { row: StagingRow; onApprove: (id: string) => void; onReject: (id: string) => void; onSave?: (id: string, patch: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    isbn: row.isbn ?? '', title: row.title ?? '', authors: row.authors?.join(', ') ?? '', publisher: row.publisher ?? '',
    year: row.year ? String(row.year) : '', subjects: row.subjects?.join(', ') ?? '', copies: String(row.copies ?? 1),
    shelf_location: row.shelf_location ?? '', item_type: row.item_type ?? 'book', source_url: row.source_url ?? '', notes: row.notes ?? '',
  });

  function patch() {
    return {
      isbn: draft.isbn || null,
      title: draft.title || null,
      authors: draft.authors.split(',').map((v) => v.trim()).filter(Boolean),
      publisher: draft.publisher || null,
      year: draft.year ? Number(draft.year) : null,
      subjects: draft.subjects.split(',').map((v) => v.trim()).filter(Boolean),
      copies: Number(draft.copies) || 1,
      shelf_location: draft.shelf_location || null,
      item_type: draft.item_type,
      source_url: draft.source_url || null,
      notes: draft.notes || null,
    };
  }

  return <div className="card p-4"><div className="flex flex-col lg:flex-row lg:items-start gap-4"><div className="flex-1"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-semibold text-neutral-800">{row.title || row.isbn || 'Untitled'}</h3><span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs">{row.confidence}</span><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">{row.status}</span></div><p className="text-sm text-neutral-500 mt-1">{row.authors?.join(', ') || 'No authors'} {row.publisher ? `• ${row.publisher}` : ''} {row.year ? `• ${row.year}` : ''}</p>{editing && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">{(['isbn','title','authors','publisher','year','subjects','copies','shelf_location','source_url','notes'] as const).map((field) => <input key={field} value={draft[field]} onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))} placeholder={field} className="rounded border border-neutral-300 px-2 py-2 text-sm" />)}<select value={draft.item_type} onChange={(e) => setDraft((d) => ({ ...d, item_type: e.target.value }))} className="rounded border border-neutral-300 px-2 py-2 text-sm"><option value="book">book</option><option value="journal">journal</option><option value="ebook">ebook</option><option value="database">database</option></select></div>}<details className="mt-3"><summary className="text-xs text-primary-700 cursor-pointer">Compare raw and enriched data</summary><div className="grid md:grid-cols-2 gap-3 mt-2"><pre className="text-xs bg-neutral-50 rounded p-3 overflow-auto">{JSON.stringify(row.raw_row, null, 2)}</pre><pre className="text-xs bg-neutral-50 rounded p-3 overflow-auto">{JSON.stringify(row.enriched_data, null, 2)}</pre></div></details></div><div className="flex flex-wrap gap-2"><button onClick={() => setEditing((value) => !value)} className="btn-outline text-sm px-4 py-2">{editing ? 'Close' : 'Edit'}</button>{editing && onSave && <button onClick={() => onSave(row.id, patch())} className="btn-primary text-sm px-4 py-2">Save</button>}<button onClick={() => onApprove(row.id)} disabled={row.status === 'approved'} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">Approve</button><button onClick={() => onReject(row.id)} disabled={row.status === 'rejected'} className="btn-outline text-sm px-4 py-2">Reject</button></div></div></div>;
}
