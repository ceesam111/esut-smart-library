import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'overview' | 'queue' | 'runs' | 'templates' | 'automation' | 'metrics' | 'settings' | 'health';

interface AgentJob {
  id: string;
  job_type: string;
  agent_name: string;
  status: string;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_by: string | null;
  created_at: string;
  finished_at: string | null;
}

interface AgentRun {
  id: string;
  agent_name: string;
  job_type: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface AgentSetting {
  id: string;
  agent_name: string;
  enabled: boolean;
  risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  max_daily_jobs: number;
  notes: string | null;
}

interface AgentTemplate {
  id: string;
  label: string;
  agent_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  requires_approval: boolean;
  created_at: string;
}

interface AgentSchedule {
  id: string;
  label: string;
  agent_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  interval_minutes: number;
  next_run_at: string;
  last_run_at: string | null;
}

const AGENTS = [
  { name: 'Cardo', area: 'Catalogue Intelligence', jobType: 'catalogue.enrich', description: 'Enriches catalogue staging rows and prepares import records for librarian review.' },
  { name: 'Hari', area: 'Resource Discovery', jobType: 'resources.harvest', description: 'Queues open-access resource discovery and legal-resource ingestion workflows.' },
  { name: 'Thesia', area: 'Repository', jobType: 'repository.extractMetadata', description: 'Stages repository metadata cleanup for human approval.' },
  { name: 'Penna', area: 'Communications', jobType: 'communications.draftNewsletter', description: 'Drafts newsletters and communication items for approval.' },
  { name: 'Norma', area: 'Compliance', jobType: null, description: 'Reserved for accreditation and compliance evidence-pack workflows.' },
  { name: 'Sysa', area: 'System Operations', jobType: 'system.healthCheck', description: 'Runs worker health checks and tenant operations summaries.' },
  { name: 'Cizo', area: 'Circulation', jobType: 'circulation.overdueReminders', description: 'Summarizes overdue circulation work for staff follow-up.' },
];

const QUICK_JOBS = [
  { label: 'Health Check', jobType: 'system.healthCheck', payload: {} },
  { label: 'Weekly Report Draft', jobType: 'reports.weeklyTenantReport', payload: {} },
  { label: 'Harvest Education Resources', jobType: 'resources.harvest', payload: { query: 'education open access Nigeria' } },
  { label: 'Overdue Summary', jobType: 'circulation.overdueReminders', payload: {} },
];

function statusClass(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'running') return 'bg-blue-100 text-blue-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'cancelled') return 'bg-neutral-200 text-neutral-600';
  return 'bg-amber-100 text-amber-700';
}

function prettyDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function Agents() {
  const { loading: authLoading, hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [settings, setSettings] = useState<AgentSetting[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [customJob, setCustomJob] = useState({ jobType: 'resources.harvest', payload: '{\n  "query": "education open access Nigeria"\n}', priority: 7 });
  const [newTemplate, setNewTemplate] = useState({ label: '', agentName: 'Hari', jobType: 'resources.harvest', payload: '{\n  "query": "education open access Nigeria"\n}', priority: 7 });
  const [newSchedule, setNewSchedule] = useState({ label: '', agentName: 'Sysa', jobType: 'system.healthCheck', payload: '{}', priority: 7, intervalMinutes: 1440 });

  const canControlQueue = hasRole('super_admin', 'librarian');

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
      const [jobJson, runJson, settingsJson, templatesJson, schedulesJson] = await Promise.all([
        authFetch('/api/admin/agents/jobs?status=all'),
        authFetch('/api/admin/agents/runs?status=all'),
        authFetch('/api/admin/agents/settings'),
        authFetch('/api/admin/agents/templates'),
        authFetch('/api/admin/agents/schedules'),
      ]);
      setJobs(jobJson.jobs ?? []);
      setRuns(runJson.runs ?? []);
      setSettings(settingsJson.settings ?? []);
      setTemplates(templatesJson.templates ?? []);
      setSchedules(schedulesJson.schedules ?? []);
      if (canControlQueue) {
        const healthJson = await authFetch('/api/admin/agents/health').catch((error) => ({ reachable: false, error: (error as Error).message }));
        const metricsJson = await authFetch('/api/admin/agents/metrics').catch((error) => ({ error: (error as Error).message }));
        setHealth(healthJson);
        setMetrics(metricsJson.metrics ?? metricsJson);
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [canControlQueue]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const counts = useMemo(() => {
    const byStatus = jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});
    return { total: jobs.length, pending: byStatus.pending ?? 0, running: byStatus.running ?? 0, failed: byStatus.failed ?? 0, completed: byStatus.completed ?? 0 };
  }, [jobs]);

  async function createJob(jobType: string, payload: Record<string, unknown>, priority = 7, templateId?: string) {
    setWorking(jobType); setMessage('');
    try {
      await authFetch('/api/admin/agents/jobs', { method: 'POST', body: JSON.stringify({ jobType, payload, priority, templateId }) });
      setMessage(`Queued ${jobType}.`);
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function createCustomJob(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createJob(customJob.jobType, JSON.parse(customJob.payload || '{}'), customJob.priority);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid JSON payload.');
    }
  }

  async function runTemplate(template: AgentTemplate) {
    await createJob(template.job_type, template.payload ?? {}, template.priority, template.id);
  }

  async function saveSetting(setting: AgentSetting) {
    setWorking(`setting-${setting.agent_name}`); setMessage('');
    try {
      await authFetch('/api/admin/agents/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          agentName: setting.agent_name,
          enabled: setting.enabled,
          riskLevel: setting.risk_level,
          requiresApproval: setting.requires_approval,
          maxDailyJobs: setting.max_daily_jobs,
          notes: setting.notes,
        }),
      });
      setMessage(`Saved ${setting.agent_name} settings.`);
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setWorking('template'); setMessage('');
    try {
      await authFetch('/api/admin/agents/templates', {
        method: 'POST',
        body: JSON.stringify({ ...newTemplate, payload: JSON.parse(newTemplate.payload || '{}') }),
      });
      setMessage('Template created.');
      setNewTemplate({ label: '', agentName: 'Hari', jobType: 'resources.harvest', payload: '{\n  "query": "education open access Nigeria"\n}', priority: 7 });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid template payload.');
    } finally {
      setWorking(null);
    }
  }

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    setWorking('schedule'); setMessage('');
    try {
      await authFetch('/api/admin/agents/schedules', {
        method: 'POST',
        body: JSON.stringify({ ...newSchedule, payload: JSON.parse(newSchedule.payload || '{}') }),
      });
      setMessage('Schedule created.');
      setNewSchedule({ label: '', agentName: 'Sysa', jobType: 'system.healthCheck', payload: '{}', priority: 7, intervalMinutes: 1440 });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid schedule payload.');
    } finally {
      setWorking(null);
    }
  }

  async function act(jobId: string, action: 'retry' | 'cancel') {
    setWorking(`${action}-${jobId}`); setMessage('');
    try {
      await authFetch(`/api/admin/agents/jobs/${jobId}/${action}`, { method: 'POST', body: '{}' });
      setMessage(action === 'retry' ? 'Job requeued.' : 'Job cancelled.');
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  if (authLoading || loading) return <div className="p-8 text-sm text-neutral-500">Loading AI agents...</div>;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">AI Agent Workers</h1>
          <p className="text-sm text-neutral-500 mt-1">Monitor background AI operations, queue controlled tasks, and review worker execution history.</p>
        </div>
        <button onClick={load} className="btn-outline text-sm px-4 py-2">Refresh</button>
      </div>

      {message && <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">{message}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[['Total', counts.total], ['Pending', counts.pending], ['Running', counts.running], ['Completed', counts.completed], ['Failed', counts.failed]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-neutral-400 font-semibold">{label}</div>
            <div className="text-2xl font-bold text-neutral-900 mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="border-b border-neutral-200 flex gap-1 overflow-x-auto">
        {(['overview', 'queue', 'runs', 'templates', 'automation', 'metrics', 'settings', 'health'] as Tab[]).map((key) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === key ? 'border-primary-700 text-primary-900' : 'border-transparent text-neutral-500'}`}>
            {key === 'runs' ? 'Run History' : key}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {AGENTS.map((agent) => {
              const latest = runs.find((run) => run.agent_name === agent.name);
              return (
                <div key={agent.name} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-neutral-900">{agent.name}</h2>
                      <p className="text-xs font-semibold text-primary-700 mt-0.5">{agent.area}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${latest ? statusClass(latest.status) : 'bg-neutral-100 text-neutral-500'}`}>{latest?.status ?? 'idle'}</span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-3 min-h-12">{agent.description}</p>
                  <div className="text-xs text-neutral-400 mt-3">Last run: {prettyDate(latest?.created_at)}</div>
                  {agent.jobType && (
                    <button onClick={() => createJob(agent.jobType!, {})} disabled={!!working} className="btn-primary text-xs px-3 py-2 mt-4 disabled:opacity-50">
                      {working === agent.jobType ? 'Queueing...' : `Run ${agent.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold text-neutral-900 mb-3">Quick Tasks</h2>
            <div className="flex flex-wrap gap-2">
              {QUICK_JOBS.map((job) => (
                <button key={job.jobType} onClick={() => createJob(job.jobType, job.payload)} disabled={!!working} className="btn-outline text-xs px-3 py-2 disabled:opacity-50">
                  {working === job.jobType ? 'Queueing...' : job.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={createCustomJob} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-neutral-900">Manual Agent Task</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-xs font-semibold text-neutral-600">Job Type
                <select value={customJob.jobType} onChange={(e) => setCustomJob((p) => ({ ...p, jobType: e.target.value }))} className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm">
                  {['system.healthCheck','reports.weeklyTenantReport','resources.harvest','catalogue.enrich','repository.extractMetadata','communications.draftNewsletter','circulation.overdueReminders'].map((job) => <option key={job} value={job}>{job}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-neutral-600">Priority
                <input type="number" min={1} max={10} value={customJob.priority} onChange={(e) => setCustomJob((p) => ({ ...p, priority: Number(e.target.value) }))} className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="text-xs font-semibold text-neutral-600 block">Payload JSON
              <textarea value={customJob.payload} onChange={(e) => setCustomJob((p) => ({ ...p, payload: e.target.value }))} rows={5} className="mt-1 w-full font-mono border border-neutral-300 rounded-lg px-3 py-2 text-xs" />
            </label>
            <button className="btn-primary text-sm px-4 py-2" disabled={!!working}>Queue Manual Task</button>
          </form>
        </div>
      )}

      {tab === 'queue' && (
        <DataTable empty="No agent jobs yet.">
          {jobs.map((job) => (
            <tr key={job.id} className="border-t border-neutral-100 align-top">
              <td className="px-3 py-3"><div className="font-semibold text-neutral-800">{job.agent_name}</div><div className="text-xs text-neutral-500">{job.job_type}</div></td>
              <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass(job.status)}`}>{job.status}</span></td>
              <td className="px-3 py-3 text-xs text-neutral-500">{job.attempts}/{job.max_attempts}</td>
              <td className="px-3 py-3 text-xs text-neutral-500">{prettyDate(job.created_at)}<div>Run after: {prettyDate(job.run_after)}</div></td>
              <td className="px-3 py-3 text-xs text-red-600 max-w-xs truncate">{job.error ?? '—'}</td>
              <td className="px-3 py-3">
                {canControlQueue && <div className="flex gap-2">
                  {['failed', 'cancelled'].includes(job.status) && <button onClick={() => act(job.id, 'retry')} disabled={working === `retry-${job.id}`} className="btn-outline text-xs px-2 py-1">Retry</button>}
                  {['pending', 'running'].includes(job.status) && <button onClick={() => act(job.id, 'cancel')} disabled={working === `cancel-${job.id}`} className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50">Cancel</button>}
                </div>}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      {tab === 'runs' && (
        <DataTable empty="No agent runs yet.">
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-neutral-100 align-top">
              <td className="px-3 py-3"><div className="font-semibold text-neutral-800">{run.agent_name}</div><div className="text-xs text-neutral-500">{run.job_type}</div></td>
              <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass(run.status)}`}>{run.status}</span></td>
              <td className="px-3 py-3 text-xs text-neutral-500">{prettyDate(run.started_at)}<div>Finished: {prettyDate(run.finished_at)}</div></td>
              <td className="px-3 py-3 text-xs text-neutral-500 max-w-sm truncate">{String(run.output?.message ?? run.error ?? '—')}</td>
            </tr>
          ))}
        </DataTable>
      )}

      {tab === 'templates' && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex justify-between gap-3"><h2 className="font-semibold text-neutral-900">{template.label}</h2><span className="text-xs text-neutral-400">P{template.priority}</span></div>
                <p className="text-xs text-primary-700 mt-1">{template.agent_name} • {template.job_type}</p>
                <pre className="mt-3 text-xs bg-neutral-50 rounded-lg border border-neutral-200 p-3 max-h-28 overflow-auto">{JSON.stringify(template.payload, null, 2)}</pre>
                <button onClick={() => runTemplate(template)} disabled={!template.enabled || !!working} className="btn-primary text-xs px-3 py-2 mt-3 disabled:opacity-50">Run Template</button>
              </div>
            ))}
          </div>

          {canControlQueue && <form onSubmit={createTemplate} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-neutral-900">Create Job Template</h2>
            <div className="grid md:grid-cols-4 gap-3">
              <input value={newTemplate.label} onChange={(e) => setNewTemplate((p) => ({ ...p, label: e.target.value }))} placeholder="Template label" className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" required />
              <select value={newTemplate.agentName} onChange={(e) => setNewTemplate((p) => ({ ...p, agentName: e.target.value }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm">
                {AGENTS.map((agent) => <option key={agent.name} value={agent.name}>{agent.name}</option>)}
              </select>
              <input value={newTemplate.jobType} onChange={(e) => setNewTemplate((p) => ({ ...p, jobType: e.target.value }))} placeholder="job.type" className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" required />
              <input type="number" min={1} max={10} value={newTemplate.priority} onChange={(e) => setNewTemplate((p) => ({ ...p, priority: Number(e.target.value) }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={newTemplate.payload} onChange={(e) => setNewTemplate((p) => ({ ...p, payload: e.target.value }))} rows={5} className="w-full font-mono border border-neutral-300 rounded-lg px-3 py-2 text-xs" />
            <button className="btn-primary text-sm px-4 py-2" disabled={working === 'template'}>Save Template</button>
          </form>}
        </div>
      )}

      {tab === 'automation' && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex justify-between gap-3"><h2 className="font-semibold text-neutral-900">{schedule.label}</h2><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${schedule.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>{schedule.enabled ? 'enabled' : 'disabled'}</span></div>
                <p className="text-xs text-primary-700 mt-1">{schedule.agent_name} • {schedule.job_type}</p>
                <p className="text-sm text-neutral-500 mt-3">Every {schedule.interval_minutes} minutes</p>
                <p className="text-xs text-neutral-400 mt-1">Next: {prettyDate(schedule.next_run_at)} • Last: {prettyDate(schedule.last_run_at)}</p>
              </div>
            ))}
          </div>
          {canControlQueue && <form onSubmit={createSchedule} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-neutral-900">Create Recurring Schedule</h2>
            <div className="grid md:grid-cols-5 gap-3">
              <input value={newSchedule.label} onChange={(e) => setNewSchedule((p) => ({ ...p, label: e.target.value }))} placeholder="Schedule label" className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" required />
              <select value={newSchedule.agentName} onChange={(e) => setNewSchedule((p) => ({ ...p, agentName: e.target.value }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm">{AGENTS.map((agent) => <option key={agent.name} value={agent.name}>{agent.name}</option>)}</select>
              <input value={newSchedule.jobType} onChange={(e) => setNewSchedule((p) => ({ ...p, jobType: e.target.value }))} placeholder="job.type" className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" required />
              <input type="number" min={5} value={newSchedule.intervalMinutes} onChange={(e) => setNewSchedule((p) => ({ ...p, intervalMinutes: Number(e.target.value) }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" min={1} max={10} value={newSchedule.priority} onChange={(e) => setNewSchedule((p) => ({ ...p, priority: Number(e.target.value) }))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={newSchedule.payload} onChange={(e) => setNewSchedule((p) => ({ ...p, payload: e.target.value }))} rows={4} className="w-full font-mono border border-neutral-300 rounded-lg px-3 py-2 text-xs" />
            <button className="btn-primary text-sm px-4 py-2" disabled={working === 'schedule'}>Save Schedule</button>
          </form>}
        </div>
      )}

      {tab === 'metrics' && (
        <div className="space-y-5">
          {!canControlQueue ? <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">Metrics are visible to librarians and super administrators.</div> : <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[['Jobs 24h', metrics?.jobs24h ?? 0], ['Running', metrics?.running ?? 0], ['Failed Open', metrics?.failedOpen ?? 0], ['AI Calls 24h', metrics?.aiUsage24h?.calls ?? 0]].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-neutral-200 bg-white p-4"><div className="text-xs uppercase tracking-wide text-neutral-400 font-semibold">{label}</div><div className="text-2xl font-bold text-neutral-900 mt-1">{value}</div></div>
              ))}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="font-semibold text-neutral-900 mb-3">AI Usage Last 24 Hours</h2>
              <p className="text-sm text-neutral-600">Input tokens: {metrics?.aiUsage24h?.inputTokens ?? 0} • Output tokens: {metrics?.aiUsage24h?.outputTokens ?? 0} • Estimated cost: {(metrics?.aiUsage24h?.estimatedCost ?? 0).toFixed?.(4) ?? 0}</p>
              <pre className="mt-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-3 overflow-auto">{JSON.stringify(metrics?.aiUsage24h?.byAgent ?? {}, null, 2)}</pre>
            </div>
          </>}
        </div>
      )}

      {tab === 'settings' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {settings.map((setting) => (
            <div key={setting.id} className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-neutral-900">{setting.agent_name}</h2><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${setting.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>{setting.enabled ? 'enabled' : 'disabled'}</span></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-neutral-600">Risk Level
                  <select disabled={!canControlQueue} value={setting.risk_level} onChange={(e) => setSettings((rows) => rows.map((row) => row.id === setting.id ? { ...row, risk_level: e.target.value as AgentSetting['risk_level'] } : row))} className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm disabled:bg-neutral-50">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-neutral-600">Daily Limit
                  <input disabled={!canControlQueue} type="number" min={1} max={1000} value={setting.max_daily_jobs} onChange={(e) => setSettings((rows) => rows.map((row) => row.id === setting.id ? { ...row, max_daily_jobs: Number(e.target.value) } : row))} className="mt-1 w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm disabled:bg-neutral-50" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm"><input disabled={!canControlQueue} type="checkbox" checked={setting.enabled} onChange={(e) => setSettings((rows) => rows.map((row) => row.id === setting.id ? { ...row, enabled: e.target.checked } : row))} /> Enabled</label>
              <label className="flex items-center gap-2 text-sm"><input disabled={!canControlQueue} type="checkbox" checked={setting.requires_approval} onChange={(e) => setSettings((rows) => rows.map((row) => row.id === setting.id ? { ...row, requires_approval: e.target.checked } : row))} /> Requires approval for generated outputs</label>
              {canControlQueue && <button onClick={() => saveSetting(setting)} disabled={working === `setting-${setting.agent_name}`} className="btn-primary text-xs px-3 py-2">Save Settings</button>}
            </div>
          ))}
        </div>
      )}

      {tab === 'health' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold text-neutral-900 mb-2">Worker Health</h2>
          {!canControlQueue ? <p className="text-sm text-neutral-500">Worker health is visible to librarians and super administrators.</p> : (
            <pre className="text-xs bg-neutral-950 text-neutral-50 rounded-lg p-4 overflow-auto max-h-96">{JSON.stringify(health ?? {}, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function DataTable({ children, empty }: { children: ReactNode; empty: string }) {
  const rows = Array.isArray(children) ? children : [children];
  const hasRows = rows.filter(Boolean).length > 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead><tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500"><th className="px-3 py-2">Agent</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Result/Error</th><th className="px-3 py-2">Actions</th></tr></thead>
        <tbody>{hasRows ? children : <tr><td colSpan={6} className="px-3 py-8 text-center text-neutral-400">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}
