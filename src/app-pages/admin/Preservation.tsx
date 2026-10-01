import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'overview' | 'files' | 'incidents' | 'restore';

interface Overview {
  generatedAt: string;
  files: { total: number; due: number; byResult: Record<string, number> };
  incidents: { open: number; acknowledged: number; resolved: number; recent: Incident[] };
  restoreRuns: RestoreRun[];
  events: { last7Days: number; byType: Record<string, number> };
  queue: { pendingJobs: number; runningJobs: number; failedJobs: number };
  schedules: Array<{ id: string; job_type: string; label: string; enabled: boolean; interval_minutes: number; next_run_at: string | null; last_run_at: string | null }>;
  storage: Array<{ provider: string; active: boolean; inactiveReason: string | null }>;
}

interface Incident {
  id: string;
  repository_file_id: string;
  incident_type: string;
  status: string;
  expected_checksum: string | null;
  observed_checksum: string | null;
  created_at: string;
  resolution_note: string | null;
}

interface FileRow {
  id: string;
  original_filename: string;
  storage_provider: string | null;
  checksum: string | null;
  checksum_algorithm: string;
  checksum_calculated_at: string | null;
  last_verified_at: string | null;
  next_verification_at: string | null;
  last_verification_result: string | null;
  observed_checksum: string | null;
  preservation_status: string;
}

interface RestoreRun {
  id: string;
  aip_path: string;
  target: string;
  status: string;
  file_count: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

const RESULT_CLASS: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-700',
  MISMATCH: 'bg-red-100 text-red-700',
  MISSING: 'bg-amber-100 text-amber-800',
  ERROR: 'bg-orange-100 text-orange-700',
  PENDING: 'bg-sky-100 text-sky-700',
  never: 'bg-neutral-100 text-neutral-500',
};

function badge(value: string, fallback = 'bg-neutral-100 text-neutral-600') {
  return `px-2 py-0.5 rounded-full text-[10px] font-semibold ${RESULT_CLASS[value] ?? fallback}`;
}

function prettyDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

function short(value: string | null | undefined, size = 12) {
  if (!value) return '—';
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

export default function Preservation() {
  const { loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [restore, setRestore] = useState({ aipPath: '', target: 'isolated' });

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
    try {
      const [overviewJson, filesJson] = await Promise.all([
        authFetch('/api/preservation/overview'),
        authFetch('/api/preservation/files?limit=100'),
      ]);
      setOverview(overviewJson.data);
      setFiles(filesJson.data ?? []);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) { void load(); } }, [authLoading, load]);

  async function runAction(key: string, fn: () => Promise<void>) {
    setWorking(key);
    setMessage('');
    try {
      await fn();
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking('');
    }
  }

  function incidentAction(id: string, action: 'acknowledged' | 'resolved') {
    return () => {
      void runAction(`${id}-${action}`, async () => {
      const note = action === 'resolved' ? window.prompt('Resolution note (optional)') ?? '' : '';
      await authFetch('/api/preservation/incidents', { method: 'PATCH', body: JSON.stringify({ id, action, note: note || null }) });
      setMessage(`Incident ${action}.`);
      });
    }
  }

  function recheck(fileId: string) {
    return () => {
      void runAction(`recheck-${fileId}`, async () => {
      const json = await authFetch('/api/preservation/files', { method: 'POST', body: JSON.stringify({ action: 'recheck', fileId }) });
      setMessage(json.data?.queued ? 'Verification queued.' : 'Joined the existing verification queue.');
      });
    }
  }

  function submitRestore(event: React.FormEvent) {
    event.preventDefault();
    void runAction('restore', async () => {
      await authFetch('/api/preservation/restore', { method: 'POST', body: JSON.stringify(restore) });
      setMessage(`Restore completed into ${restore.target}.`);
      setRestore((prev) => ({ ...prev, aipPath: '' }));
    });
  }

  if (loading) return <div className="p-6 text-sm text-neutral-500">Loading preservation status…</div>;

  const counts = overview?.files.byResult ?? {};

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Preservation & Fixity</h1>
          <p className="text-sm text-neutral-500">Checksum verification, incidents, BagIt AIP exports and controlled restores.</p>
        </div>
        <button onClick={() => void load()} className="btn-outline text-xs px-3 py-2">Refresh</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['overview', 'files', 'incidents', 'restore'] as Tab[]).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border ${tab === value ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-neutral-600 border-neutral-200'}`}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {message && <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">{message}</div>}

      {tab === 'overview' && overview && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Active files', value: overview.files.total },
              { label: 'Verification due', value: overview.files.due },
              { label: 'Open incidents', value: overview.incidents.open },
              { label: 'Acknowledged', value: overview.incidents.acknowledged },
              { label: 'Queued jobs', value: overview.queue.pendingJobs },
              { label: 'Events (7d)', value: overview.events.last7Days },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="text-xs font-semibold text-neutral-500">{card.label}</div>
                <div className="text-2xl font-bold text-neutral-900 mt-1">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">Fixity states</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(counts).map(([state, value]) => (
                  <span key={state} className={badge(state)}>{state}: {value}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">Storage providers</h2>
              <div className="space-y-2">
                {overview.storage.map((store) => (
                  <div key={store.provider} className="flex items-start justify-between gap-3 text-sm">
                    <span className="font-semibold text-neutral-800">{store.provider}</span>
                    <span className={`text-xs font-semibold ${store.active ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {store.active ? 'active' : `inactive — ${store.inactiveReason ?? 'not configured'}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900 mb-3">Schedules</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2 pr-3">Job type</th>
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2 pr-3">Enabled</th>
                    <th className="py-2 pr-3">Interval (min)</th>
                    <th className="py-2 pr-3">Next run</th>
                    <th className="py-2">Last run</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-t border-neutral-100">
                      <td className="py-2 pr-3 font-mono">{schedule.job_type}</td>
                      <td className="py-2 pr-3">{schedule.label}</td>
                      <td className="py-2 pr-3">{schedule.enabled ? 'yes' : 'no'}</td>
                      <td className="py-2 pr-3">{schedule.interval_minutes}</td>
                      <td className="py-2 pr-3">{prettyDate(schedule.next_run_at)}</td>
                      <td className="py-2">{prettyDate(schedule.last_run_at)}</td>
                    </tr>
                  ))}
                  {!overview.schedules.length && (
                    <tr className="border-t border-neutral-100"><td className="py-3 text-neutral-400" colSpan={6}>No preservation schedules found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold text-neutral-900 mb-3">Repository files</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Expected</th>
                  <th className="py-2 pr-3">Observed</th>
                  <th className="py-2 pr-3">Result</th>
                  <th className="py-2 pr-3">Last verified</th>
                  <th className="py-2 pr-3">Next due</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-t border-neutral-100">
                    <td className="py-2 pr-3 font-medium text-neutral-800">{file.original_filename}</td>
                    <td className="py-2 pr-3">{file.storage_provider ?? 'supabase'}</td>
                    <td className="py-2 pr-3 font-mono" title={file.checksum ?? ''}>{short(file.checksum)}</td>
                    <td className="py-2 pr-3 font-mono" title={file.observed_checksum ?? ''}>{short(file.observed_checksum)}</td>
                    <td className="py-2 pr-3"><span className={badge(file.last_verification_result ?? 'never')}>{file.last_verification_result ?? 'never'}</span></td>
                    <td className="py-2 pr-3">{prettyDate(file.last_verified_at)}</td>
                    <td className="py-2 pr-3">{prettyDate(file.next_verification_at)}</td>
                    <td className="py-2">
                      <button
                        onClick={recheck(file.id)}
                        disabled={!!working}
                        className="btn-outline text-[11px] px-2 py-1 disabled:opacity-50"
                      >
                        {working === `recheck-${file.id}` ? 'Queueing…' : 'Recheck'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!files.length && <tr className="border-t border-neutral-100"><td className="py-3 text-neutral-400" colSpan={8}>No repository files.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-neutral-400 mt-3">Recheck queues work for the worker; hashing never runs in this request or the browser.</p>
        </div>
      )}

      {tab === 'incidents' && overview && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold text-neutral-900 mb-3">Preservation incidents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Expected</th>
                  <th className="py-2 pr-3">Observed</th>
                  <th className="py-2 pr-3">Opened</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.incidents.recent.map((incident) => (
                  <tr key={incident.id} className="border-t border-neutral-100">
                    <td className="py-2 pr-3 font-semibold">{incident.incident_type}</td>
                    <td className="py-2 pr-3"><span className={badge(incident.status, 'bg-neutral-100 text-neutral-600')}>{incident.status}</span></td>
                    <td className="py-2 pr-3 font-mono" title={incident.repository_file_id}>{short(incident.repository_file_id, 8)}</td>
                    <td className="py-2 pr-3 font-mono">{short(incident.expected_checksum)}</td>
                    <td className="py-2 pr-3 font-mono">{short(incident.observed_checksum)}</td>
                    <td className="py-2 pr-3">{prettyDate(incident.created_at)}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        {(incident.status === 'open' || incident.status === 'acknowledged') && (
                          <button
                            onClick={incidentAction(incident.id, 'resolved')}
                            disabled={!!working}
                            className="btn-outline text-[11px] px-2 py-1 disabled:opacity-50"
                          >
                            {working === `${incident.id}-resolved` ? 'Saving…' : 'Resolve'}
                          </button>
                        )}
                        {incident.status === 'open' && (
                          <button
                            onClick={incidentAction(incident.id, 'acknowledged')}
                            disabled={!!working}
                            className="btn-outline text-[11px] px-2 py-1 disabled:opacity-50"
                          >
                            {working === `${incident.id}-acknowledged` ? 'Saving…' : 'Acknowledge'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!overview.incidents.recent.length && (
                  <tr className="border-t border-neutral-100"><td className="py-3 text-neutral-400" colSpan={7}>No preservation incidents recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'restore' && overview && (
        <div className="space-y-5">
          <form onSubmit={submitRestore} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-neutral-900">Controlled restore</h2>
            <p className="text-xs text-neutral-500">
              Restores validate the AIP first and write to isolated, test or staging destinations only. Source records are never overwritten.
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-neutral-600 md:col-span-2">AIP path
                <input
                  value={restore.aipPath}
                  onChange={(event) => setRestore((prev) => ({ ...prev, aipPath: event.target.value }))}
                  placeholder="item-00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </label>
              <label className="text-xs font-semibold text-neutral-600">Target
                <select
                  value={restore.target}
                  onChange={(event) => setRestore((prev) => ({ ...prev, target: event.target.value }))}
                  className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="isolated">isolated</option>
                  <option value="test">test</option>
                  <option value="staging">staging</option>
                </select>
              </label>
            </div>
            <button className="btn-primary text-sm px-4 py-2 disabled:opacity-50" disabled={!!working || !restore.aipPath.trim()}>
              {working === 'restore' ? 'Restoring…' : 'Run restore'}
            </button>
          </form>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900 mb-3">Restore runs</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2 pr-3">AIP</th>
                    <th className="py-2 pr-3">Target</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Files</th>
                    <th className="py-2 pr-3">Started</th>
                    <th className="py-2">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.restoreRuns.map((run) => (
                    <tr key={run.id} className="border-t border-neutral-100" title={run.error ?? ''}>
                      <td className="py-2 pr-3 font-mono">{run.aip_path}</td>
                      <td className="py-2 pr-3">{run.target}</td>
                      <td className="py-2 pr-3"><span className={badge(run.status, 'bg-neutral-100 text-neutral-600')}>{run.status}</span></td>
                      <td className="py-2 pr-3">{run.file_count ?? '—'}</td>
                      <td className="py-2 pr-3">{prettyDate(run.created_at)}</td>
                      <td className="py-2">{prettyDate(run.completed_at)}</td>
                    </tr>
                  ))}
                  {!overview.restoreRuns.length && (
                    <tr className="border-t border-neutral-100"><td className="py-3 text-neutral-400" colSpan={6}>No restore runs recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
