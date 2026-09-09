import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Resource3DBookCard } from '@/components/resource/Resource3DBookCard';

interface Candidate {
  id: string;
  title: string | null;
  authors: string[];
  source_name: string;
  status: string;
  confidence: string;
  rights_status: string | null;
  licence: string | null;
  discovery_source: string;
  search_query: string | null;
  source_url: string | null;
  download_url: string | null;
  duplicate_of: string | null;
  created_at: string;
}

interface SourceDefinition {
  sourceType: string;
  name: string;
  category: string;
  requiresKey: boolean;
  keyEnv?: string;
  rightsBehavior: string;
  downloadPolicy: string;
  enabled?: boolean;
  limitPerRun?: number;
  priority?: number;
  missingApiKey?: boolean;
}

function unwrapApi<T = any>(payload: any): T {
  return payload && payload.success === true && 'data' in payload ? payload.data : payload;
}

export default function Harvest() {
  const [query, setQuery] = useState('education open textbook');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [sourceRegistry, setSourceRegistry] = useState<SourceDefinition[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [limitPerSource, setLimitPerSource] = useState(5);
  const [notice, setNotice] = useState<string | null>(null);

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  }

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/harvest', { headers: await authHeaders() });
      const raw = await response.json();
      const data = unwrapApi(raw);
      if (!response.ok) throw new Error(raw.error?.message || raw.error || 'Could not load harvest data.');
      setCandidates(data.candidates ?? []);
      setLogs(data.logs ?? []);
      setRuns(data.runs ?? []);
      const controls = data.sourceControls ?? data.sourceRegistry ?? [];
      setSourceRegistry(controls);
      if (!selectedSources.size && controls.length) {
        setSelectedSources(new Set(controls.filter((source: SourceDefinition) => source.enabled !== false && !source.missingApiKey).map((source: SourceDefinition) => source.sourceType)));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load harvest data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function runHarvest(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/harvest', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ query, limitPerSource, sourceTypes: [...selectedSources] }) });
      const raw = await response.json();
      const data = unwrapApi(raw);
      if (!response.ok) throw new Error(raw.error?.message || raw.error || 'Harvest failed.');
      setNotice(`Harvest finished. Staged ${data.candidates?.length ?? 0}; duplicates ${data.duplicateCount ?? 0}.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Harvest failed.');
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, action: 'approve' | 'reject') {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/harvest/candidates/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ reason: 'Reviewed by librarian' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || data.error || `${action} failed.`);
      setNotice(action === 'approve' ? 'Candidate added to catalogue.' : 'Candidate rejected.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${action} failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function saveSource(source: SourceDefinition, patch: Partial<SourceDefinition>) {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/harvest', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ sourceType: source.sourceType, ...patch }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || data.error || 'Could not save source settings.');
      await load();
      setNotice('Source setting saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save source settings.');
    } finally {
      setLoading(false);
    }
  }

  async function batchAct(action: 'approve' | 'reject') {
    const ids = [...selectedCandidates];
    if (!ids.length) return;
    setLoading(true);
    try {
      for (const id of ids) await act(id, action);
      setSelectedCandidates(new Set());
      setNotice(`${ids.length} candidate(s) ${action === 'approve' ? 'approved' : 'rejected'}.`);
    } finally {
      setLoading(false);
    }
  }

  const visibleCandidates = candidates.filter((candidate) => statusFilter === 'all' || candidate.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Open-Access Harvest</h1>
        <p className="text-sm text-neutral-500">Stage metadata from trusted open-access sources. Legal files are queued for B2 instead of blocking search.</p>
      </div>

      {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</div>}

      <form onSubmit={runHarvest} className="bg-white rounded-xl border p-4 flex flex-col md:flex-row gap-3">
        <input className="input flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="education, science teaching, open textbook..." />
        <input className="input md:w-32" type="number" min={1} max={20} value={limitPerSource} onChange={(event) => setLimitPerSource(Number(event.target.value))} title="Limit per source" />
        <button className="btn-primary px-5" disabled={loading}>{loading ? 'Working...' : 'Run harvest'}</button>
      </form>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Source Controls</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sourceRegistry.map((source) => (
            <label key={source.sourceType} className="rounded-lg border border-neutral-200 p-3 text-sm flex gap-3 items-start">
              <input
                type="checkbox"
                checked={selectedSources.has(source.sourceType)}
                disabled={source.missingApiKey}
                onChange={(event) => {
                  saveSource(source, { enabled: event.target.checked });
                  setSelectedSources((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(source.sourceType); else next.delete(source.sourceType);
                  return next;
                  });
                }}
              />
              <span>
                <span className="font-semibold text-neutral-800">{source.name}</span>
                <span className="block text-xs text-neutral-500">{source.category} • {source.downloadPolicy} • limit {source.limitPerRun ?? 5}</span>
                <span className="block text-[11px] text-neutral-400">{source.missingApiKey ? `Missing ${source.keyEnv}` : source.requiresKey ? `Uses ${source.keyEnv}` : 'No key required'} • {source.rightsBehavior}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="font-semibold">Candidate Review</div>
            <div className="flex flex-wrap gap-2">
              <select className="input text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="needs_review">Needs review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="duplicate">Duplicate</option>
                <option value="all">All</option>
              </select>
              <button className="btn-primary text-xs" disabled={loading || !selectedCandidates.size} onClick={() => batchAct('approve')}>Approve selected</button>
              <button className="btn-outline text-xs" disabled={loading || !selectedCandidates.size} onClick={() => batchAct('reject')}>Reject selected</button>
            </div>
          </div>
          <div className="divide-y">
            {visibleCandidates.map((candidate) => (
              <div key={candidate.id} className="p-4">
                <label className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
                  <input type="checkbox" checked={selectedCandidates.has(candidate.id)} onChange={(event) => setSelectedCandidates((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(candidate.id); else next.delete(candidate.id);
                    return next;
                  })} />
                  Select for batch review
                </label>
                <Resource3DBookCard
                  id={candidate.id}
                  title={candidate.title || 'Untitled resource'}
                  authors={candidate.authors}
                  resourceType={candidate.discovery_source === 'search_discovery' ? 'article' : 'book'}
                  coverUrl={null}
                  spineText={candidate.source_name}
                  status={candidate.status}
                  confidence={candidate.confidence}
                  category={candidate.rights_status || candidate.licence}
                  actions={(
                    <>
                      <span className="text-xs font-semibold rounded-full bg-primary-100 text-primary-800 px-2 py-0.5">{candidate.source_name}</span>
                      {candidate.rights_status && <span className="text-xs rounded-full bg-green-100 text-green-800 px-2 py-0.5">{candidate.rights_status}</span>}
                      {candidate.duplicate_of && <span className="text-xs rounded-full bg-red-100 text-red-800 px-2 py-0.5">duplicate</span>}
                      {candidate.source_url && <a className="btn-outline text-xs" href={candidate.source_url} target="_blank" rel="noreferrer">View source</a>}
                      {candidate.download_url && ['open', 'public_domain'].includes(candidate.rights_status ?? '') && <a className="btn-outline text-xs" href={candidate.download_url} target="_blank" rel="noreferrer">Legal download</a>}
                      <button className="btn-primary text-xs" disabled={loading || candidate.status === 'approved' || candidate.status === 'duplicate'} onClick={() => act(candidate.id, 'approve')}>Approve</button>
                      <button className="btn-outline text-xs" disabled={loading || candidate.status === 'rejected'} onClick={() => act(candidate.id, 'reject')}>Reject</button>
                    </>
                  )}
                />
              </div>
            ))}
            {!visibleCandidates.length && <div className="p-8 text-center text-sm text-neutral-500">No candidates match this filter.</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Recent Runs</h2>
            <div className="space-y-2 text-xs text-neutral-600">
              {runs.slice(0, 8).map((run) => <div key={run.id} className="border rounded-lg p-2"><b>{run.status}</b> · {run.search_query || run.job_name}<br />found {run.total_found}, staged {run.staged_count}, duplicates {run.skipped_duplicates}</div>)}
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Discovery Logs</h2>
            <div className="space-y-2 text-xs text-neutral-600">
              {logs.slice(0, 10).map((log) => <div key={log.id} className="border rounded-lg p-2"><b>{log.search_query}</b><br />local {log.local_result_quality}; external {log.external_result_count}; staged {log.staged_count}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
