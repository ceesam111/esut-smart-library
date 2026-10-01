import { getSupabaseAdminClient } from '../supabase/adminClient';
import { describeStores } from './objectStore';
import { FIXITY_STATES } from './fixity';
import { listIncidents, type IncidentRow } from './incidents';
import { listRestoreRuns, type RestoreRunRow } from './restore';

export interface PreservationOverview {
  generatedAt: string;
  files: {
    total: number;
    due: number;
    byResult: Record<string, number>;
  };
  incidents: {
    open: number;
    acknowledged: number;
    resolved: number;
    recent: IncidentRow[];
  };
  restoreRuns: RestoreRunRow[];
  events: {
    last7Days: number;
    byType: Record<string, number>;
  };
  queue: {
    pendingJobs: number;
    runningJobs: number;
    failedJobs: number;
  };
  schedules: Array<{
    id: string;
    job_type: string;
    label: string;
    enabled: boolean;
    interval_minutes: number;
    next_run_at: string | null;
    last_run_at: string | null;
    payload: Record<string, unknown>;
  }>;
  storage: ReturnType<typeof describeStores>;
}

type SupabaseLike = ReturnType<typeof getSupabaseAdminClient>;

async function countFiles(db: SupabaseLike, now: Date): Promise<{ total: number; due: number; byResult: Record<string, number> }> {
  const byResult: Record<string, number> = {};
  for (const state of FIXITY_STATES) byResult[state] = 0;
  byResult.never = 0;

  const { data, error } = await db
    .from('repository_files')
    .select('last_verification_result, next_verification_at, preservation_status');
  if (error) throw new Error(error.message);

  let total = 0;
  let due = 0;
  for (const row of (data ?? []) as Array<{ last_verification_result: string | null; next_verification_at: string | null; preservation_status: string }>) {
    if (row.preservation_status !== 'active') continue;
    total += 1;
    const key = row.last_verification_result && row.last_verification_result in byResult ? row.last_verification_result : 'never';
    byResult[key] = (byResult[key] ?? 0) + 1;
    if (row.next_verification_at && row.next_verification_at <= now.toISOString()) due += 1;
  }
  return { total, due, byResult };
}

async function countEvents(db: SupabaseLike, since: string): Promise<{ last7Days: number; byType: Record<string, number> }> {
  const { data, error } = await db
    .from('preservation_events')
    .select('event_type, created_at')
    .gte('created_at', since)
    .limit(1000);
  if (error) throw new Error(error.message);
  const byType: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ event_type: string }>) {
    byType[row.event_type] = (byType[row.event_type] ?? 0) + 1;
  }
  return { last7Days: (data ?? []).length, byType };
}

async function queueCounts(db: SupabaseLike): Promise<{ pendingJobs: number; runningJobs: number; failedJobs: number }> {
  const { data, error } = await db
    .from('agent_jobs')
    .select('status')
    .like('job_type', 'preservation.%')
    .in('status', ['pending', 'running', 'failed'])
    .limit(500);
  if (error) throw new Error(error.message);
  const counts = { pendingJobs: 0, runningJobs: 0, failedJobs: 0 };
  for (const row of (data ?? []) as Array<{ status: string }>) {
    if (row.status === 'pending') counts.pendingJobs += 1;
    else if (row.status === 'running') counts.runningJobs += 1;
    else counts.failedJobs += 1;
  }
  return counts;
}

async function loadSchedules(db: SupabaseLike): Promise<PreservationOverview['schedules']> {
  const { data, error } = await db
    .from('agent_schedules')
    .select('id, job_type, label, enabled, interval_minutes, next_run_at, last_run_at, payload')
    .like('job_type', 'preservation.%')
    .order('job_type');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PreservationOverview['schedules'];
}

async function incidentCounts(db: SupabaseLike): Promise<{ open: number; acknowledged: number; resolved: number }> {
  const { data, error } = await db.from('preservation_incidents').select('status').limit(2000);
  if (error) throw new Error(error.message);
  const counts = { open: 0, acknowledged: 0, resolved: 0 };
  for (const row of (data ?? []) as Array<{ status: keyof typeof counts }>) {
    if (row.status in counts) counts[row.status] += 1;
  }
  return counts;
}

export async function getPreservationOverview(): Promise<PreservationOverview> {
  const db = getSupabaseAdminClient();
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [files, counts, recentIncidents, restoreRuns, events, queue, schedules] = await Promise.all([
    countFiles(db, now),
    incidentCounts(db),
    listIncidents({ db, limit: 25 }),
    listRestoreRuns({ db, limit: 25 }),
    countEvents(db, since),
    queueCounts(db),
    loadSchedules(db),
  ]);

  return {
    generatedAt: now.toISOString(),
    files,
    incidents: {
      ...counts,
      recent: recentIncidents.rows,
    },
    restoreRuns,
    events,
    queue,
    schedules,
    storage: describeStores(),
  };
}
