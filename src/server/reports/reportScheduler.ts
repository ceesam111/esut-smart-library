import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { sendEmail } from '@/server/email/emailService';
import {
  EXPORT_MAX_ROWS,
  MAX_PAGE_SIZE,
  reportToCsv,
  runReport,
  type ReportColumn,
  type ReportFilter,
  type ReportQuery,
  type ReportRow,
} from './reportBuilder';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type ScheduleDelivery = 'in_app' | 'email';

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string;
  day?: number | null;
  delivery: ScheduleDelivery;
}

export const SCHEDULED_REPORT_JOB = 'reports.scheduledRun';
export const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
const ARTIFACT_MAX_CHARS = 2_000_000;

interface ScheduleRow {
  schedule_frequency?: string | null;
  schedule_time?: string | null;
  schedule_day?: number | null;
  schedule_delivery?: string | null;
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function normalizeSchedule(input: ScheduleRow | Record<string, unknown>): ScheduleConfig {
  const frequency = input.schedule_frequency as ScheduleFrequency | null | undefined;
  if (frequency !== 'daily' && frequency !== 'weekly' && frequency !== 'monthly') {
    throw new Error('Invalid schedule frequency: expected daily, weekly, or monthly');
  }
  const time = String(input.schedule_time ?? '08:00');
  if (!TIME_PATTERN.test(time)) {
    throw new Error('Invalid schedule time: expected HH:MM');
  }
  const rawDay = input.schedule_day ?? null;
  let day: number | null = rawDay === null || rawDay === undefined ? null : Number(rawDay);
  if (day !== null && !Number.isInteger(day)) throw new Error('Invalid schedule day');
  if (frequency === 'weekly') {
    if (day === null || day < 0 || day > 6) throw new Error('Weekly schedule requires day 0-6 (0=Sunday)');
  } else if (frequency === 'monthly') {
    if (day === null || day < 1 || day > 31) throw new Error('Monthly schedule requires day 1-31');
  } else {
    day = null;
  }
  const delivery = (input.schedule_delivery ?? 'in_app') as ScheduleDelivery;
  if (delivery !== 'in_app' && delivery !== 'email') {
    throw new Error('Invalid schedule delivery: expected in_app or email');
  }
  return { frequency, time, day, delivery };
}

function timeParts(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h, minutes: m };
}

/** Next occurrence strictly after `from`, in UTC. */
export function computeNextRunAt(schedule: ScheduleConfig, from: Date = new Date()): Date {
  const { hours, minutes } = timeParts(schedule.time);
  const atTime = (base: Date): Date => {
    const d = new Date(base);
    d.setUTCHours(hours, minutes, 0, 0);
    return d;
  };

  if (schedule.frequency === 'daily') {
    let candidate = atTime(new Date(from));
    if (candidate.getTime() <= from.getTime()) {
      candidate = atTime(new Date(from.getTime() + 86_400_000));
    }
    return candidate;
  }

  if (schedule.frequency === 'weekly') {
    const targetDay = schedule.day ?? 0;
    for (let i = 0; i <= 7; i++) {
      const day = new Date(from.getTime() + i * 86_400_000);
      if (day.getUTCDay() !== targetDay) continue;
      const candidate = atTime(day);
      if (candidate.getTime() > from.getTime()) return candidate;
    }
    return atTime(new Date(from.getTime() + 7 * 86_400_000));
  }

  // monthly
  const targetDay = schedule.day ?? 1;
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  for (let i = 0; i < 14; i++) {
    const month = new Date(start.getTime());
    month.setUTCMonth(month.getUTCMonth() + i);
    const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    const candidate = atTime(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(targetDay, lastDay))));
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return atTime(new Date(from.getTime() + 28 * 86_400_000));
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Duplicate-run protection key: one successful run per period per report. */
export function computePeriodKey(schedule: ScheduleConfig, at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, '0');
  const d = String(at.getUTCDate()).padStart(2, '0');
  if (schedule.frequency === 'daily') return `d:${y}-${m}-${d}`;
  if (schedule.frequency === 'weekly') return `w:${isoWeekKey(at)}`;
  return `m:${y}-${m}`;
}

interface SavedReportScheduleRow {
  id: string;
  name: string;
  dataset: string;
  owner_id: string;
  filters?: unknown;
  columns?: unknown;
  sorting?: unknown;
  schedule_enabled?: boolean;
}

type SupabaseLike = ReturnType<typeof getSupabaseAdminClient>;

function isMissingTable(message: string): boolean {
  return /Could not find the table|schema cache|does not exist|PGRST20|42P01/i.test(message);
}

async function advanceNextRun(supabase: SupabaseLike, reportId: string, schedule: ScheduleConfig, from: Date) {
  await supabase
    .from('saved_reports')
    .update({ schedule_next_run_at: computeNextRunAt(schedule, from).toISOString() })
    .eq('id', reportId);
}

/**
 * Queue due scheduled reports on the shared agent_jobs queue.
 * Duplicate protection: report_run_history(report_id, schedule_period_key) is unique.
 */
export async function enqueueDueScheduledReports(
  supabase: SupabaseLike,
): Promise<{ queued: number; skipped: number }> {
  const now = new Date();
  const { data, error } = await supabase
    .from('saved_reports')
    .select('*')
    .eq('schedule_enabled', true)
    .not('schedule_frequency', 'is', null)
    .lte('schedule_next_run_at', now.toISOString())
    .limit(20);

  if (error) {
    if (isMissingTable(error.message)) return { queued: 0, skipped: 0 };
    throw new Error(error.message);
  }

  let queued = 0;
  let skipped = 0;

  for (const report of (data ?? []) as SavedReportScheduleRow[]) {
    let schedule: ScheduleConfig;
    try {
      schedule = normalizeSchedule(report as ScheduleRow);
    } catch {
      skipped += 1;
      continue;
    }

    const periodKey = computePeriodKey(schedule, now);

    const { data: run, error: runErr } = await supabase
      .from('report_run_history')
      .insert({
        report_id: report.id,
        report_type: report.dataset,
        status: 'pending',
        schedule_period_key: periodKey,
        filters: (report.filters ?? []) as unknown as Record<string, unknown>,
        columns: (report.columns ?? []) as unknown as Record<string, unknown>,
        output_format: 'csv',
        started_at: now.toISOString(),
      })
      .select('id')
      .single();

    if (runErr || !run) {
      if (runErr && /duplicate|23505/i.test(runErr.message)) {
        skipped += 1;
        await advanceNextRun(supabase, report.id, schedule, now);
        continue;
      }
      skipped += 1;
      continue;
    }

    const { error: jobErr } = await supabase.from('agent_jobs').insert({
      tenant_id: DEFAULT_TENANT,
      job_type: SCHEDULED_REPORT_JOB,
      agent_name: 'ReportScheduler',
      payload: { reportId: report.id, runId: run.id, periodKey },
      priority: 5,
      run_after: now.toISOString(),
    });

    if (jobErr) {
      await supabase.from('report_run_history').delete().eq('id', run.id);
      skipped += 1;
      continue;
    }

    queued += 1;
    await advanceNextRun(supabase, report.id, schedule, now);
  }

  return { queued, skipped };
}

/** Updates (or clears) a saved report's schedule, enforcing owner_id. Returns null when not found. */
export async function updateReportSchedule(
  reportId: string,
  userId: string,
  input: { enabled: boolean; frequency?: string | null; time?: string | null; day?: number | null; delivery?: string | null } | null,
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    schedule_enabled: false,
    schedule_frequency: null,
    schedule_time: '08:00',
    schedule_day: null,
    schedule_delivery: 'in_app',
    schedule_next_run_at: null,
  };

  if (input && input.enabled) {
    const schedule = normalizeSchedule({
      schedule_frequency: input.frequency ?? 'daily',
      schedule_time: input.time ?? '08:00',
      schedule_day: input.day ?? null,
      schedule_delivery: input.delivery ?? 'in_app',
    });
    Object.assign(patch, {
      schedule_enabled: true,
      schedule_frequency: schedule.frequency,
      schedule_time: schedule.time,
      schedule_day: schedule.day,
      schedule_delivery: schedule.delivery,
      schedule_next_run_at: computeNextRunAt(schedule).toISOString(),
    });
  }

  const { data, error } = await supabase
    .from('saved_reports')
    .update(patch)
    .eq('id', reportId)
    .eq('owner_id', userId)
    .select('id, schedule_enabled, schedule_frequency, schedule_time, schedule_day, schedule_delivery, schedule_next_run_at, schedule_last_run_at, schedule_last_status')
    .maybeSingle();

  if (error) throw new Error(`Failed to update schedule: ${error.message}`);
  return data ?? null;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'report';
}

async function markRun(
  supabase: SupabaseLike,
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase.from('report_run_history').update(patch).eq('id', runId);
}

/**
 * Executes one scheduled report run: builds rows (paged up to EXPORT_MAX_ROWS),
 * stores a CSV artifact on the run row, updates schedule status, and delivers
 * an in-app notification (always) plus best-effort email when configured.
 */
export async function executeScheduledReport(payload: {
  reportId?: string;
  runId?: string;
}): Promise<{ ok: boolean; detail: string; rowCount?: number }> {
  const supabase = getSupabaseAdminClient();
  const runId = payload.runId;
  if (!runId) throw new Error('runId required for scheduled report run');

  const { data: run } = await supabase.from('report_run_history').select('*').eq('id', runId).maybeSingle();
  if (!run) throw new Error('Report run not found');
  if (run.status === 'completed' || run.status === 'suppressed') {
    return { ok: true, detail: `Run already ${run.status}` };
  }

  const reportId = run.report_id ?? payload.reportId;
  const { data: report } = await supabase.from('saved_reports').select('*').eq('id', reportId).maybeSingle();
  if (!report) {
    await markRun(supabase, runId, { status: 'failed', error_message: 'Saved report no longer exists', completed_at: new Date().toISOString() });
    return { ok: false, detail: 'Saved report no longer exists' };
  }

  await markRun(supabase, runId, { status: 'running' });

  try {
    const query: ReportQuery = {
      dataset: report.dataset as ReportQuery['dataset'],
      filters: (report.filters ?? []) as ReportFilter[],
      columns: (report.columns ?? []) as ReportColumn[],
      sorting: (report.sorting ?? []) as ReportQuery['sorting'],
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    };

    const rows: ReportRow[] = [];
    let columns: string[] = [];
    let page = 1;
    while (rows.length < EXPORT_MAX_ROWS) {
      const result = await runReport({ ...query, page });
      columns = result.columns;
      rows.push(...result.data);
      if (result.data.length === 0 || page >= result.totalPages) break;
      page += 1;
    }
    const data = rows.slice(0, EXPORT_MAX_ROWS);

    let csv = reportToCsv(data, columns);
    if (csv.length > ARTIFACT_MAX_CHARS) {
      csv = `${csv.slice(0, ARTIFACT_MAX_CHARS)}\n...[truncated]`;
    }

    const periodKey = run.schedule_period_key ?? 'run';
    const artifactName = `${slugify(report.name)}_${periodKey}.csv`;
    const now = new Date().toISOString();

    await markRun(supabase, runId, {
      status: 'completed',
      row_count: data.length,
      output_format: 'csv',
      artifact_content: csv,
      artifact_name: artifactName,
      completed_at: now,
      error_message: null,
    });
    await supabase
      .from('saved_reports')
      .update({ schedule_last_run_at: now, schedule_last_status: 'completed', last_run_at: now })
      .eq('id', report.id);

    const deliveryParts: string[] = [];
    let inAppOk = false;
    if (report.owner_id) {
      try {
        const { error: notifyErr } = await supabase.from('user_notifications').insert({
          user_id: report.owner_id,
          title: `Scheduled report: ${report.name}`,
          body: `${data.length} rows generated for period ${periodKey}.`,
          url: '/admin/reports',
          type: 'report',
          is_read: false,
          created_at: new Date().toISOString(),
        });
        if (notifyErr) throw new Error(notifyErr.message);
        inAppOk = true;
        deliveryParts.push('in-app delivered');
      } catch (err) {
        deliveryParts.push(`in-app failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      deliveryParts.push('in-app skipped: no owner');
    }

    let deliveryChannel = 'in-app';
    if (report.schedule_delivery === 'email') {
      deliveryChannel = 'in-app+email';
      try {
        const profile = report.owner_id
          ? await (async () => {
              const { data } = await supabase
                .from('patrons')
                .select('email, full_name')
                .eq('user_id', report.owner_id)
                .maybeSingle();
              return data;
            })()
          : null;
        if (!profile?.email) {
          deliveryParts.push('email skipped: no patron email');
        } else {
          await sendEmail({
            to: profile.email,
            subject: `Scheduled report: ${report.name}`,
            html: `<p>Your scheduled report <strong>${report.name}</strong> is ready.</p><p>Period: ${periodKey} — ${data.length} rows.</p><p>Open the Reports dashboard to download the CSV artifact.</p>`,
            text: `Your scheduled report "${report.name}" is ready. Period: ${periodKey} — ${data.length} rows.`,
            toName: profile.full_name ?? undefined,
          });
          deliveryParts.push('email sent');
        }
      } catch (err) {
        deliveryParts.push(`email failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const deliveryStatus = inAppOk ? 'delivered' : 'failed';
    await markRun(supabase, runId, {
      delivery_status: deliveryStatus,
      delivery_channel: deliveryChannel,
      delivery_detail: deliveryParts.join('; '),
    });

    return { ok: true, detail: `Generated ${data.length} rows`, rowCount: data.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRun(supabase, runId, {
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    });
    await supabase
      .from('saved_reports')
      .update({ schedule_last_status: 'failed' })
      .eq('id', report.id);
    return { ok: false, detail: message };
  }
}
