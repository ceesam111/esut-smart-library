import { createHash } from 'crypto';
import { getSupabaseAdminClient } from '../supabase/adminClient';
import { DEFAULT_TENANT_ID } from '../tenant/resolveTenant';
import { readStoredObject, type StorageProvider, type StoredObjectRef } from './objectStore';

export const FIXITY_STATES = ['PENDING', 'VALID', 'MISMATCH', 'MISSING', 'ERROR'] as const;
export type FixityState = (typeof FIXITY_STATES)[number];

export const DEFAULT_CADENCE_DAYS = 7;
export const MAX_BATCH_SIZE = 500;
export const DEFAULT_BATCH_SIZE = 50;

export interface DueFile {
  id: string;
  repository_item_id: string;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_key: string;
  checksum: string | null;
  checksum_algorithm: string;
  last_verification_result: string | null;
}

export interface FixityRead {
  status: 'ok' | 'missing' | 'error' | 'inactive';
  bytes?: Buffer;
  error?: string;
  provider?: StorageProvider;
}

export interface FixityDecision {
  state: FixityState;
  observed: string | null;
  recordCalculatedChecksum: boolean;
  event: 'FIXITY_VERIFIED' | 'FIXITY_FAILED' | 'CHECKSUM_CALCULATED';
  eventDetails: Record<string, unknown>;
  incident: null | {
    type: 'MISMATCH' | 'MISSING';
    expected: string | null;
    observed: string | null;
    details: Record<string, unknown>;
  };
  note: string;
}

/**
 * Pure fixity state machine. The expected checksum is never mutated:
 * it is only ever compared against the bytes observed in storage.
 */
export function classifyFixity(input: { read: FixityRead; expected: string | null; algorithm: string }): FixityDecision {
  const { read, expected, algorithm } = input;

  if (read.status === 'inactive') {
    return {
      state: 'ERROR',
      observed: null,
      recordCalculatedChecksum: false,
      event: 'FIXITY_FAILED',
      eventDetails: { result: 'ERROR', reason: 'storage_provider_inactive', provider: read.provider ?? null, detail: read.error ?? null },
      incident: null,
      note: 'Storage provider inactive; verification could not run. This is not evidence of corruption.',
    };
  }

  if (read.status === 'error') {
    return {
      state: 'ERROR',
      observed: null,
      recordCalculatedChecksum: false,
      event: 'FIXITY_FAILED',
      eventDetails: { result: 'ERROR', reason: 'read_failed', detail: read.error ?? null },
      incident: null,
      note: 'Object could not be read; verification could not run. This is not evidence of corruption.',
    };
  }

  if (read.status === 'missing') {
    return {
      state: 'MISSING',
      observed: null,
      recordCalculatedChecksum: false,
      event: 'FIXITY_FAILED',
      eventDetails: { result: 'MISSING', reason: 'object_not_found' },
      incident: {
        type: 'MISSING',
        expected,
        observed: null,
        details: { reason: 'object_not_found', algorithm },
      },
      note: 'Stored object is no longer present.',
    };
  }

  const bytes = read.bytes ?? Buffer.alloc(0);
  const observed = createHash('sha256').update(bytes).digest('hex');

  if ((algorithm || 'sha256').toLowerCase() !== 'sha256') {
    return {
      state: 'ERROR',
      observed,
      recordCalculatedChecksum: false,
      event: 'FIXITY_FAILED',
      eventDetails: { result: 'ERROR', reason: 'unsupported_algorithm', algorithm },
      incident: null,
      note: `Checksum algorithm ${algorithm} is not supported; only sha256 is verified.`,
    };
  }

  if (!expected) {
    return {
      state: 'VALID',
      observed,
      recordCalculatedChecksum: true,
      event: 'CHECKSUM_CALCULATED',
      eventDetails: { result: 'VALID', reason: 'expected_checksum_absent', algorithm: 'sha256', calculated: observed },
      incident: null,
      note: 'No expected checksum existed, so one was calculated from the current bytes and recorded.',
    };
  }

  if (observed.toLowerCase() === expected.toLowerCase()) {
    return {
      state: 'VALID',
      observed,
      recordCalculatedChecksum: false,
      event: 'FIXITY_VERIFIED',
      eventDetails: { result: 'VALID', algorithm: 'sha256' },
      incident: null,
      note: 'Observed checksum matches the expected checksum.',
    };
  }

  return {
    state: 'MISMATCH',
    observed,
    recordCalculatedChecksum: false,
    event: 'FIXITY_FAILED',
    eventDetails: { result: 'MISMATCH', algorithm: 'sha256', expected, observed },
    incident: {
      type: 'MISMATCH',
      expected,
      observed,
      details: { algorithm: 'sha256', reason: 'checksum_mismatch' },
    },
    note: 'Observed checksum does not match the expected checksum.',
  };
}

export function resolveCadenceDays(value: unknown, envValue?: string | null): number {
  const candidates = [value, envValue ?? process.env.PRESERVATION_CADENCE_DAYS, DEFAULT_CADENCE_DAYS];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 3650) return Math.floor(parsed);
  }
  return DEFAULT_CADENCE_DAYS;
}

export function resolveBatchSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.floor(parsed));
}

export function nextDueAt(cadenceDays: number, now = new Date()): string {
  return new Date(now.getTime() + cadenceDays * 86_400_000).toISOString();
}

type SupabaseLike = ReturnType<typeof getSupabaseAdminClient>;

export async function selectDueFiles(db: SupabaseLike, limit: number, now = new Date()): Promise<DueFile[]> {
  const { data, error } = await db
    .from('repository_files')
    .select(
      'id, repository_item_id, storage_provider, storage_bucket, storage_key, checksum, checksum_algorithm, last_verification_result, next_verification_at, preservation_status',
    )
    .eq('preservation_status', 'active')
    .lte('next_verification_at', now.toISOString())
    .order('next_verification_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DueFile[];
}

export async function findOpenVerifyJob(db: SupabaseLike): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from('agent_jobs')
    .select('id, status')
    .eq('job_type', 'preservation.verifyFixity')
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null) ?? null;
}

export async function recordPreservationEvent(
  db: SupabaseLike,
  input: {
    repositoryFileId?: string | null;
    repositoryItemId?: string | null;
    eventType: string;
    details: Record<string, unknown>;
    actorId?: string | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    event_type: input.eventType,
    details: input.details,
  };
  if (input.repositoryFileId) payload.repository_file_id = input.repositoryFileId;
  if (input.repositoryItemId) payload.repository_item_id = input.repositoryItemId;
  if (input.actorId) payload.actor_id = input.actorId;
  const { error } = await db.from('preservation_events').insert(payload);
  if (error) throw new Error(error.message);
}

export interface ProducerResult {
  ok: boolean;
  candidates: number;
  queued: boolean;
  jobId: string | null;
  deduped: boolean;
  reason?: string;
  error?: string;
}

/**
 * B2: selects due files and enqueues at most one verification job, so the
 * queue never accumulates duplicate pending fixity work.
 */
export async function produceFixityJobs(input: {
  db?: SupabaseLike;
  payload?: Record<string, unknown>;
  now?: Date;
}): Promise<ProducerResult> {
  const db = input.db ?? getSupabaseAdminClient();
  const now = input.now ?? new Date();
  const batchSize = resolveBatchSize(input.payload?.batchSize);
  const cadenceDays = resolveCadenceDays(input.payload?.cadenceDays);

  let due: DueFile[];
  try {
    due = await selectDueFiles(db, batchSize, now);
  } catch (error) {
    return { ok: false, candidates: 0, queued: false, jobId: null, deduped: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (due.length === 0) {
    return { ok: true, candidates: 0, queued: false, jobId: null, deduped: false, reason: 'no_files_due' };
  }

  let open;
  try {
    open = await findOpenVerifyJob(db);
  } catch (error) {
    return { ok: false, candidates: due.length, queued: false, jobId: null, deduped: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (open) {
    return { ok: true, candidates: due.length, queued: false, jobId: open.id, deduped: true, reason: 'verification_already_queued' };
  }

  const { data, error } = await db
    .from('agent_jobs')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      job_type: 'preservation.verifyFixity',
      agent_name: 'preservation.fixityWorker',
      payload: {
        batchSize,
        cadenceDays,
        candidateIds: due.map((file) => file.id),
        scheduledBy: input.payload?.scheduledBy ?? 'fixityProducer',
        scheduleLabel: input.payload?.scheduleLabel ?? null,
        scheduledAt: now.toISOString(),
      },
      priority: 5,
      run_after: now.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, candidates: due.length, queued: false, jobId: null, deduped: false, error: error.message };
  }

  return { ok: true, candidates: due.length, queued: true, jobId: data.id as string, deduped: false };
}

export interface VerificationSummary {
  ok: boolean;
  scanned: number;
  valid: number;
  mismatch: number;
  missing: number;
  errored: number;
  incidentsOpened: number;
  scheduledFailures: number;
  results: Array<{ fileId: string; state: FixityState; note: string }>;
  error?: string;
}

async function openIncidentIfAbsent(
  db: SupabaseLike,
  input: { fileId: string; type: 'MISMATCH' | 'MISSING'; expected: string | null; observed: string | null; details: Record<string, unknown> },
): Promise<boolean> {
  const { data: existing } = await db
    .from('preservation_incidents')
    .select('id, status')
    .eq('repository_file_id', input.fileId)
    .eq('incident_type', input.type)
    .neq('status', 'resolved')
    .limit(1)
    .maybeSingle();
  if (existing) return false;

  const { error } = await db.from('preservation_incidents').insert({
    repository_file_id: input.fileId,
    incident_type: input.type,
    expected_checksum: input.expected,
    observed_checksum: input.observed,
    details: input.details,
    status: 'open',
  });
  if (error) throw new Error(error.message);
  return true;
}

/**
 * B3: verifies due files, records state, opens incidents and always pushes
 * `next_verification_at` forward so a file cannot be picked up twice inside
 * the same cadence window.
 */
export async function verifyDueFiles(input: {
  db?: SupabaseLike;
  payload?: Record<string, unknown>;
  now?: Date;
  store?: (ref: StoredObjectRef) => Promise<FixityRead>;
}): Promise<VerificationSummary> {
  const db = input.db ?? getSupabaseAdminClient();
  const now = input.now ?? new Date();
  const cadenceDays = resolveCadenceDays(input.payload?.cadenceDays);
  const batchSize = resolveBatchSize(input.payload?.batchSize);
  const readObject = input.store ?? (async (ref: StoredObjectRef) => {
    const result = await readStoredObject(ref);
    return { status: result.status, bytes: result.bytes, error: result.error, provider: result.provider };
  });

  const summary: VerificationSummary = {
    ok: true, scanned: 0, valid: 0, mismatch: 0, missing: 0, errored: 0, incidentsOpened: 0, scheduledFailures: 0, results: [],
  };

  let due: DueFile[];
  try {
    due = await selectDueFiles(db, batchSize, now);
  } catch (error) {
    return { ...summary, ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (due.length === 0) return summary;

  for (const file of due) {
    const dueAt = nextDueAt(cadenceDays, now);
    try {
      // Claim the file for the whole cadence window before hashing so a
      // concurrent run cannot schedule the same bytes twice.
      const { error: claimError } = await db
        .from('repository_files')
        .update({ last_verification_result: 'PENDING', next_verification_at: dueAt, updated_at: now.toISOString() })
        .eq('id', file.id);
      if (claimError) throw new Error(claimError.message);

      const read = await readObject({
        provider: (file.storage_provider as StorageProvider) || 'supabase',
        bucket: file.storage_bucket,
        key: file.storage_key,
      });

      const decision = classifyFixity({ read, expected: file.checksum, algorithm: file.checksum_algorithm });

      const patch: Record<string, unknown> = {
        last_verification_result: decision.state,
        last_verified_at: now.toISOString(),
        next_verification_at: dueAt,
        updated_at: now.toISOString(),
        observed_checksum: decision.observed,
      };
      if (decision.recordCalculatedChecksum) {
        patch.checksum = decision.observed;
        patch.checksum_calculated_at = now.toISOString();
      }
      const { error: updateError } = await db.from('repository_files').update(patch).eq('id', file.id);
      if (updateError) throw new Error(updateError.message);

      await recordPreservationEvent(db, {
        repositoryFileId: file.id,
        repositoryItemId: file.repository_item_id,
        eventType: decision.event,
        details: { ...decision.eventDetails, note: decision.note, cadenceDays },
      });

      if (decision.incident) {
        const opened = await openIncidentIfAbsent(db, {
          fileId: file.id,
          type: decision.incident.type,
          expected: decision.incident.expected,
          observed: decision.incident.observed,
          details: decision.incident.details,
        });
        if (opened) {
          summary.incidentsOpened += 1;
          await recordPreservationEvent(db, {
            repositoryFileId: file.id,
            repositoryItemId: file.repository_item_id,
            eventType: 'INCIDENT_OPENED',
            details: { incidentType: decision.incident.type, state: decision.state },
          });
        }
      }

      if (decision.state === 'VALID') summary.valid += 1;
      else if (decision.state === 'MISMATCH') summary.mismatch += 1;
      else if (decision.state === 'MISSING') summary.missing += 1;
      else summary.errored += 1;

      summary.scanned += 1;
      summary.results.push({ fileId: file.id, state: decision.state, note: decision.note });
    } catch (err) {
      summary.scanned += 1;
      summary.errored += 1;
      summary.scheduledFailures += 1;
      const message = err instanceof Error ? err.message : String(err);
      summary.results.push({ fileId: file.id, state: 'ERROR', note: message });
      try {
        await db
          .from('repository_files')
          .update({ last_verification_result: 'ERROR', last_verified_at: now.toISOString(), next_verification_at: dueAt, updated_at: now.toISOString() })
          .eq('id', file.id);
        await recordPreservationEvent(db, {
          repositoryFileId: file.id,
          repositoryItemId: file.repository_item_id,
          eventType: 'FIXITY_FAILED',
          details: { result: 'ERROR', reason: 'scheduling_failure', detail: message },
        });
      } catch {
        // The job error already carries the failure; do not mask it.
      }
    }
  }

  return summary;
}

export async function markFileDue(fileId: string, db?: SupabaseLike, now = new Date()): Promise<void> {
  const client = db ?? getSupabaseAdminClient();
  const { error } = await client
    .from('repository_files')
    .update({ next_verification_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', fileId);
  if (error) throw new Error(error.message);
}

export async function ensureVerifyJobQueued(input: {
  db?: SupabaseLike;
  payload?: Record<string, unknown>;
  now?: Date;
}): Promise<ProducerResult> {
  const db = input.db ?? getSupabaseAdminClient();
  const now = input.now ?? new Date();
  const open = await findOpenVerifyJob(db);
  if (open) return { ok: true, candidates: 0, queued: false, jobId: open.id, deduped: true, reason: 'verification_already_queued' };

  const { data, error } = await db
    .from('agent_jobs')
    .insert({
      tenant_id: DEFAULT_TENANT_ID,
      job_type: 'preservation.verifyFixity',
      agent_name: 'preservation.fixityWorker',
      payload: { ...(input.payload ?? {}), scheduledBy: input.payload?.scheduledBy ?? 'manual_recheck', scheduledAt: now.toISOString() },
      priority: 4,
      run_after: now.toISOString(),
    })
    .select('id')
    .single();
  if (error) return { ok: false, candidates: 0, queued: false, jobId: null, deduped: false, error: error.message };
  return { ok: true, candidates: 0, queued: true, jobId: data.id as string, deduped: false };
}
