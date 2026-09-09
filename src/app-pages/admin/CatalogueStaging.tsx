import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Rows } from './CatalogueImportBatch';

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed with ${res.status}`);
  return json;
}

export default function CatalogueStaging() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const json = await authFetch(`/api/admin/catalogue/staging?status=pending${filter ? `&confidence=${filter}` : ''}`);
      setRows(json.rows ?? []);
    } catch (error) { setMessage((error as Error).message); }
  }
  useEffect(() => { load(); }, [filter]);

  async function approve(id: string) { await authFetch(`/api/admin/catalogue/staging/${id}/approve`, { method: 'POST', body: '{}' }); await load(); }
  async function reject(id: string) { const reason = prompt('Rejection reason:'); if (!reason) return; await authFetch(`/api/admin/catalogue/staging/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); await load(); }
  async function save(id: string, patch: Record<string, unknown>) { await authFetch(`/api/admin/catalogue/staging/${id}`, { method: 'PATCH', body: JSON.stringify({ patch }) }); await load(); }

  return <div className="max-w-6xl mx-auto space-y-5"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h1 className="text-2xl font-serif font-semibold text-primary-800">Catalogue Staging</h1><p className="text-sm text-neutral-500">Review pending staged catalogue rows across batches.</p></div><Link to="/admin/catalogue/import" className="btn-primary text-sm">Upload CSV</Link></div>{message && <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">{message}</div>}<div className="flex gap-2 flex-wrap">{['', 'clean_match', 'needs_review', 'conflict', 'no_match'].map((f) => <button key={f || 'all'} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs border ${filter === f ? 'bg-primary-700 text-white' : 'bg-white text-neutral-600'}`}>{f || 'all'}</button>)}</div><Rows rows={rows} onApprove={approve} onReject={reject} onSave={save} /></div>;
}
