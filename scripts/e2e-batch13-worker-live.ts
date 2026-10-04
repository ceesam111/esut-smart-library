import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const STATE_FILE = join(tmpdir(), 'e2e-batch13-worker-state.json');
const TENANT = '00000000-0000-0000-0000-000000000001';

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(fileURLToPath(new URL('../.env.local', import.meta.url)));
for (const [k, v] of Object.entries(env)) {
  if (k === 'NEXT_PUBLIC_SUPABASE_URL' || !process.env[k]) process.env[k] = v;
}
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;

const results: Array<{ name: string; ok: boolean }> = [];
const write = (line: string) => process.stdout.write(`${line}\n`);
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok });
  write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastError;
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const serviceHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const svc = (path: string, init: RequestInit = {}) =>
  withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...((init.headers as Record<string, string>) ?? {}) } }));

const { loadWorkerConfig } = await import('../worker/config');
const { createWorkerSupabase } = await import('../worker/supabase');
const { WorkerRunner } = await import('../worker/runner');
const { enqueueDueScheduledReports, executeScheduledReport } = await import('../src/server/reports/reportScheduler');
const { scheduledReportWorker } = await import('../worker/handlers/scheduledReports');

// Claim all E2E jobs on the first local poll: the production esut-worker container
// (pre-batch13 image) polls the same agent_jobs table and would otherwise race us.
process.env.WORKER_CONCURRENCY = process.env.WORKER_CONCURRENCY || '8';
const config = loadWorkerConfig();
const supabase = createWorkerSupabase(config);
const controller = new AbortController();
const runner = new WorkerRunner(supabase, config, controller.signal);

const startedAt = new Date(Date.now() - 60_000).toISOString();

const PATRON_EMAIL = 'e2e-worker-patron@invalid.invalid';
const PATRON_NAME = 'E2E Worker Patron';

let fixtureUserId: string | null = null;
let overdueLoanId: string | null = null;
let dueSoonLoanId: string | null = null;
let savedReportId: string | null = null;
const jobIds: string[] = [];

async function findUserByEmail(email: string) {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const body = await res.json();
  return (body.users ?? []).find((u: { email?: string }) => u.email === email) ?? null;
}

async function createFixtureUser(email: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await svc(`user_roles?user_id=eq.${existing.id}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, { method: 'DELETE', headers: serviceHeaders }));
  }
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'E2eBatch13!', email_confirm: true }),
  }));
  const body = await res.json();
  return (body.id ?? body.user?.id ?? null) as string | null;
}

async function preClean() {
  await svc(`notice_delivery_log?entity_type=eq.loan`, { method: 'DELETE' }).catch(() => undefined);
  await svc('agent_jobs?agent_name=eq.E2ENoticeTest', { method: 'DELETE' }).catch(() => undefined);
  await svc('agent_jobs?agent_name=eq.E2EReportTest', { method: 'DELETE' }).catch(() => undefined);
  await svc(`saved_reports?name=like.${encodeURIComponent('E2E Worker%')}`, { method: 'DELETE' }).catch(() => undefined);
}

// ── Fixtures ─────────────────────────────────────────────────────────────
await preClean();

fixtureUserId = await createFixtureUser('e2e-worker@invalid.invalid');
check('created fixture user', !!fixtureUserId, fixtureUserId ?? 'failed');

const catalogue = await svc('catalogue_items?select=id&limit=1').then((r) => r.json());
const catalogueItemId = Array.isArray(catalogue) && catalogue[0]?.id ? catalogue[0].id : null;
check('found catalogue item for loan fixture', !!catalogueItemId, catalogueItemId ?? 'none');

const patronInsert = await svc('patrons', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    patron_id: randomUUID(),
    full_name: PATRON_NAME,
    email: PATRON_EMAIL,
    user_id: fixtureUserId,
    patron_category: 'Student',
  }),
});
const patronRows = await patronInsert.json().catch(() => []);
const patronId: string | null = Array.isArray(patronRows) && patronRows[0]?.id ? patronRows[0].id : null;
check('created fixture patron (reserved .invalid email)', patronInsert.status === 201 && !!patronId, `status=${patronInsert.status} id=${patronId ?? JSON.stringify(patronRows).slice(0, 200)}`);

if (patronId && catalogueItemId) {
  const overdueDue = new Date(Date.now() - 4 * 86_400_000).toISOString().split('T')[0];
  const dueSoonDue = new Date(Date.now() + 1 * 86_400_000).toISOString().split('T')[0];
  const overdueInsert = await svc('loans', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ patron_id: patronId, catalogue_item_id: catalogueItemId, due_date: overdueDue, checkout_date: new Date(Date.now() - 10 * 86_400_000).toISOString().split('T')[0] }),
  });
  const overdueRows = await overdueInsert.json().catch(() => []);
  overdueLoanId = Array.isArray(overdueRows) && overdueRows[0]?.id ? overdueRows[0].id : null;
  const dueSoonInsert = await svc('loans', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ patron_id: patronId, catalogue_item_id: catalogueItemId, due_date: dueSoonDue, checkout_date: new Date().toISOString().split('T')[0] }),
  });
  const dueSoonRows = await dueSoonInsert.json().catch(() => []);
  dueSoonLoanId = Array.isArray(dueSoonRows) && dueSoonRows[0]?.id ? dueSoonRows[0].id : null;
  check('created overdue + due-soon loans', !!overdueLoanId && !!dueSoonLoanId, `overdue=${overdueLoanId} dueSoon=${dueSoonLoanId}`);
} else {
  check('created overdue + due-soon loans', false, 'missing patron or catalogue item');
}

// ── Enqueue notice jobs ──────────────────────────────────────────────────
if (overdueLoanId) {
  const r = await svc('agent_jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ tenant_id: TENANT, job_type: 'notices.overdue', agent_name: 'E2ENoticeTest', payload: { e2e: true }, priority: 5, run_after: new Date().toISOString() }),
  });
  const rows = await r.json().catch(() => []);
  if (Array.isArray(rows) && rows[0]?.id) jobIds.push(rows[0].id);
}
if (dueSoonLoanId) {
  const r = await svc('agent_jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ tenant_id: TENANT, job_type: 'notices.dueSoon', agent_name: 'E2ENoticeTest', payload: { e2e: true }, priority: 5, run_after: new Date().toISOString() }),
  });
  const rows = await r.json().catch(() => []);
  if (Array.isArray(rows) && rows[0]?.id) jobIds.push(rows[0].id);
}
check('enqueued notice jobs', jobIds.length === 2, `jobs=${jobIds.join(',')}`);

// ── Scheduled report fixture + enqueue/dedup ─────────────────────────────
if (fixtureUserId) {
  const reportInsert = await svc('saved_reports', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      name: 'E2E Worker Report',
      description: 'batch13 worker e2e',
      report_type: 'catalogue',
      dataset: 'catalogue',
      filters: [], columns: [], grouping: [], sorting: [],
      owner_id: fixtureUserId,
      visibility: 'private',
      schedule_enabled: true,
      schedule_frequency: 'daily',
      schedule_time: '08:00',
      schedule_day: null,
      schedule_delivery: 'in_app',
      schedule_next_run_at: new Date(Date.now() - 60_000).toISOString(),
    }),
  });
  const reportRows = await reportInsert.json().catch(() => []);
  savedReportId = Array.isArray(reportRows) && reportRows[0]?.id ? reportRows[0].id : null;
  check('created due scheduled report', reportInsert.status === 201 && !!savedReportId, `id=${savedReportId ?? JSON.stringify(reportRows).slice(0, 200)}`);
} else {
  check('created due scheduled report', false, 'no fixture user');
}

if (savedReportId) {
  const enqueue1 = await enqueueDueScheduledReports(supabase);
  check('first enqueue queues due report', enqueue1.queued === 1 && enqueue1.skipped === 0, JSON.stringify(enqueue1));

  // Force due again within the same period → period-key dedup must skip.
  await svc(`saved_reports?id=eq.${savedReportId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ schedule_next_run_at: new Date(Date.now() - 60_000).toISOString() }),
  });
  const enqueue2 = await enqueueDueScheduledReports(supabase);
  check('second enqueue in same period is deduplicated', enqueue2.queued === 0 && enqueue2.skipped === 1, JSON.stringify(enqueue2));

  const pendingReportJobs = await svc('agent_jobs?job_type=eq.reports.scheduledRun&status=eq.pending&select=id').then((r) => r.json()).catch(() => []);
  check('exactly one scheduled report job queued', Array.isArray(pendingReportJobs) && pendingReportJobs.length === 1, `count=${pendingReportJobs?.length}`);
  if (Array.isArray(pendingReportJobs) && pendingReportJobs[0]?.id) jobIds.push(pendingReportJobs[0].id);
}

// Missing-runId job → handler must throw → retry scheduled with error recorded.
if (savedReportId) {
  const r = await svc('agent_jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ tenant_id: TENANT, job_type: 'reports.scheduledRun', agent_name: 'E2EReportTest', payload: { reportId: savedReportId }, priority: 5, run_after: new Date().toISOString() }),
  });
  const rows = await r.json().catch(() => []);
  if (Array.isArray(rows) && rows[0]?.id) jobIds.push(rows[0].id);
  check('enqueued missing-runId job', jobIds.length === 4, `total=${jobIds.length}`);
}

// ── Run the worker runner until our jobs settle ──────────────────────────
const deadline = Date.now() + 90_000;
let polled = 0;
while (Date.now() < deadline && polled < 60) {
  polled += 1;
  await runner.pollOnce();
  const open = await svc(`agent_jobs?id=in.(${jobIds.join(',')})&status=in.(pending,running)&select=id`).then((r) => r.json()).catch(() => []);
  if (!Array.isArray(open) || open.length === 0) break;
  await new Promise((r) => setTimeout(r, 1000));
}
controller.abort();

const jobsAfter = await svc(`agent_jobs?id=in.(${jobIds.join(',')})&select=id,job_type,agent_name,status,error,attempts,result`).then((r) => r.json()).catch(() => []);
const overdueJob = (Array.isArray(jobsAfter) ? jobsAfter : []).find((j: Record<string, unknown>) => j.job_type === 'notices.overdue');
const dueSoonJob = (Array.isArray(jobsAfter) ? jobsAfter : []).find((j: Record<string, unknown>) => j.job_type === 'notices.dueSoon');
const reportJobs = (Array.isArray(jobsAfter) ? jobsAfter : []).filter((j: Record<string, unknown>) => j.job_type === 'reports.scheduledRun');
const scheduledJob = reportJobs.find((j: Record<string, unknown>) => j.agent_name === 'ReportScheduler');
const missingRunJob = reportJobs.find((j: Record<string, unknown>) => j.agent_name === 'E2EReportTest');

check('overdue notice job completed', overdueJob?.status === 'completed', `status=${overdueJob?.status} error=${overdueJob?.error ?? '—'} result=${JSON.stringify(overdueJob?.result ?? {}).slice(0, 160)}`);
check('due-soon notice job completed', dueSoonJob?.status === 'completed', `status=${dueSoonJob?.status} error=${dueSoonJob?.error ?? '—'} result=${JSON.stringify(dueSoonJob?.result ?? {}).slice(0, 160)}`);
check('scheduled report job completed', scheduledJob?.status === 'completed', `status=${scheduledJob?.status} error=${scheduledJob?.error ?? '—'} result=${JSON.stringify(scheduledJob?.result ?? {}).slice(0, 160)}`);
// The production esut-worker container (pre-batch13 image) also polls this table and
// may win the claim, so assert the exact handler error in-process and only require
// that the enqueued job never reaches completed.
let handlerRunIdError = '';
try {
  await scheduledReportWorker({ tenant_id: TENANT, payload: { reportId: savedReportId } } as never, {} as never);
} catch (err) {
  handlerRunIdError = err instanceof Error ? err.message : String(err);
}
check('missing-runId handler throws exact error', handlerRunIdError === 'runId is required for reports.scheduledRun.', handlerRunIdError || 'did not throw');
check('missing-runId job never completed', !!missingRunJob && missingRunJob.status !== 'completed' && String(missingRunJob.error ?? '').length > 0, `status=${missingRunJob?.status} error=${String(missingRunJob?.error ?? '').slice(0, 120)}`);

// ── Delivery / artifact assertions ───────────────────────────────────────
if (overdueLoanId) {
  const keys = [`overdue:${overdueLoanId}:d1:in-app`, `overdue:${overdueLoanId}:d1:email`];
  const rows = await svc(`notice_delivery_log?idempotency_key=in.(${keys.join(',')})&select=idempotency_key,status,error_category`).then((r) => r.json()).catch(() => []);
  const inApp = (Array.isArray(rows) ? rows : []).find((r: { idempotency_key: string }) => r.idempotency_key.endsWith(':in-app'));
  const email = (Array.isArray(rows) ? rows : []).find((r: { idempotency_key: string }) => r.idempotency_key.endsWith(':email'));
  check('overdue in-app delivery SENT', inApp?.status === 'SENT', JSON.stringify(inApp ?? null));
  check('overdue email delivery attempted/recorded', !!email && ['SENT', 'FAILED', 'SUPPRESSED'].includes(email.status), JSON.stringify(email ?? null));
} else {
  check('overdue in-app delivery SENT', false, 'no loan fixture');
}

if (dueSoonLoanId) {
  // Bucket is the raw due_date value from the DB row (may include a time component),
  // so match by prefix rather than reconstructing the key.
  const rows = await svc(`notice_delivery_log?entity_type=eq.loan&entity_id=eq.${dueSoonLoanId}&idempotency_key=like.${encodeURIComponent('due_soon:%')}&select=idempotency_key,status`).then((r) => r.json()).catch(() => []);
  const inApp = (Array.isArray(rows) ? rows : []).find((r: { idempotency_key: string }) => r.idempotency_key.endsWith(':in-app'));
  check('due-soon in-app delivery SENT', inApp?.status === 'SENT', JSON.stringify(inApp ?? rows ?? null));
} else {
  check('due-soon in-app delivery SENT', false, 'no loan fixture');
}

const notifRows = fixtureUserId
  ? await svc(`user_notifications?user_id=eq.${fixtureUserId}&select=id,title,type`).then((r) => r.json()).catch(() => [])
  : [];
const titles = (Array.isArray(notifRows) ? notifRows : []).map((n: { title?: string }) => String(n.title ?? ''));
check('fixture user received overdue + due-soon + report notifications', titles.some((t: string) => t.toLowerCase().includes('overdue')) && titles.some((t: string) => t.toLowerCase().includes('due')) && titles.some((t: string) => t.toLowerCase().includes('scheduled report')), `titles=${JSON.stringify(titles)}`);

if (savedReportId) {
  const runRows = await svc(`report_run_history?report_id=eq.${savedReportId}&select=id,status,row_count,artifact_content,artifact_name,schedule_period_key,delivery_status,delivery_detail,error_message`).then((r) => r.json()).catch(() => []);
  const run = Array.isArray(runRows) ? runRows[0] : null;
  check('scheduled run completed with CSV artifact', !!run && run.status === 'completed' && typeof run.artifact_content === 'string' && run.artifact_content.length > 0 && !!run.artifact_name && !!run.schedule_period_key, JSON.stringify({ status: run?.status, rows: run?.row_count, name: run?.artifact_name, period: run?.schedule_period_key, err: run?.error_message }));
  check('scheduled run delivery recorded', !!run && run.delivery_status === 'delivered' && String(run.delivery_detail ?? '').includes('in-app delivered'), `status=${run?.delivery_status} detail=${run?.delivery_detail}`);

  const reportRow = await svc(`saved_reports?id=eq.${savedReportId}&select=schedule_next_run_at,schedule_last_run_at,schedule_last_status`).then((r) => r.json()).catch(() => []);
  const rep = Array.isArray(reportRow) ? reportRow[0] : null;
  const nextRun = rep?.schedule_next_run_at ? new Date(rep.schedule_next_run_at).getTime() : 0;
  check('schedule advanced + last run status stored', nextRun > Date.now() && rep?.schedule_last_status === 'completed' && !!rep?.schedule_last_run_at, JSON.stringify(rep));

  // Idempotent re-run of the same runId must be a no-op.
  const rerun = await executeScheduledReport({ reportId: savedReportId, runId: run?.id });
  check('executeScheduledReport idempotent on completed run', rerun.ok === true && rerun.detail.includes('already completed'), rerun.detail);
} else {
  check('scheduled run completed with CSV artifact', false, 'no saved report');
}

// ── Cleanup ──────────────────────────────────────────────────────────────
if (savedReportId) {
  await svc(`report_run_history?report_id=eq.${savedReportId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`saved_reports?id=eq.${savedReportId}`, { method: 'DELETE' }).catch(() => undefined);
}
await svc('agent_jobs?agent_name=in.(E2ENoticeTest,E2EReportTest)', { method: 'DELETE' }).catch(() => undefined);
await svc(`agent_runs?job_type=in.(notices.overdue,notices.dueSoon,reports.scheduledRun)&created_by=is.null&started_at=gte.${startedAt}`, { method: 'DELETE' }).catch(() => undefined);
await svc(`audit_logs?entity_type=eq.agent_job&entity_id=in.(${jobIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
await svc('notice_delivery_log?entity_type=eq.loan', { method: 'DELETE' }).catch(() => undefined);
if (fixtureUserId) {
  await svc(`user_notifications?user_id=eq.${fixtureUserId}`, { method: 'DELETE' }).catch(() => undefined);
}
if (overdueLoanId) await svc(`loans?id=eq.${overdueLoanId}`, { method: 'DELETE' }).catch(() => undefined);
if (dueSoonLoanId) await svc(`loans?id=eq.${dueSoonLoanId}`, { method: 'DELETE' }).catch(() => undefined);
if (patronId) await svc(`patrons?id=eq.${patronId}`, { method: 'DELETE' }).catch(() => undefined);
if (fixtureUserId) {
  await svc(`user_roles?user_id=eq.${fixtureUserId}`, { method: 'DELETE' }).catch(() => undefined);
  await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${fixtureUserId}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
}

const loansLeft = await svc(`loans?patron_id=eq.${patronId ?? 'none'}&select=id`).then((r) => r.json()).catch(() => []);
const reportsLeft = await svc(`saved_reports?name=like.${encodeURIComponent('E2E Worker%')}&select=id`).then((r) => r.json()).catch(() => []);
check('cleanup removed fixtures', (Array.isArray(loansLeft) ? loansLeft.length : 1) === 0 && (Array.isArray(reportsLeft) ? reportsLeft.length : 1) === 0, `loans=${Array.isArray(loansLeft) ? loansLeft.length : '?'} reports=${Array.isArray(reportsLeft) ? reportsLeft.length : '?'}`);

writeFileSync(STATE_FILE, JSON.stringify({ fixtureUserId, patronId, overdueLoanId, dueSoonLoanId, savedReportId, jobIds }, null, 2));

const failed = results.filter((r) => !r.ok).length;
write(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
