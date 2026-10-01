import { randomUUID } from 'crypto';
import { getSupabaseAdminClient } from '../supabase/adminClient';
import { buildAIP, isSafeRelativePath, parseManifest, sha256Bytes, validateAIP, type AIPBundle } from './aipBundle';
import { listObjectsRecursive } from './objectStore';

const AIP_BUCKET = 'aip-exports';
const RESTORE_BUCKET = 'repository';

export const RESTORE_TARGETS = ['isolated', 'test', 'staging'] as const;
export type RestoreTarget = (typeof RESTORE_TARGETS)[number];

export const RESTORE_STATUSES = ['pending', 'running', 'validated', 'complete', 'failed'] as const;
export type RestoreStatus = (typeof RESTORE_STATUSES)[number];

export interface RestoreRunRow {
  id: string;
  aip_path: string;
  repository_item_id: string | null;
  target: RestoreTarget;
  status: RestoreStatus;
  restored_document: Record<string, unknown> | null;
  differences: string[] | null;
  file_count: number | null;
  error: string | null;
  actor_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface RestoreResult {
  ok: boolean;
  runId: string | null;
  status: RestoreStatus;
  newItemId?: string;
  fileCount?: number;
  errors: string[];
  warnings: string[];
  error?: string;
}

export function isRestoreTarget(value: unknown): value is RestoreTarget {
  return typeof value === 'string' && (RESTORE_TARGETS as readonly string[]).includes(value);
}

/**
 * Restores are only ever written to isolated, test or staging destinations.
 * The database has no "production" target, and this guard fails closed on
 * anything that is not explicitly listed.
 */
export function assertRestoreTarget(value: unknown): { ok: true; target: RestoreTarget } | { ok: false; error: string } {
  if (!isRestoreTarget(value)) {
    return { ok: false, error: `Restore target '${String(value)}' is not allowed. Permitted targets: ${RESTORE_TARGETS.join(', ')}.` };
  }
  return { ok: true, target: value };
}

export function findUnsafePaths(paths: string[]): string[] {
  return paths.filter((path) => !isSafeRelativePath(path));
}

export interface RestorePreflight {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Safety checks that must pass before any byte is written back: structural
 * BagIt validity, path traversal, manifest checksum agreement and parseable
 * metadata. Failure is always fail-closed.
 */
export function preflightRestore(bundle: AIPBundle): RestorePreflight {
  const structural = validateAIP(bundle);
  const errors = [...structural.errors];
  const warnings = [...structural.warnings];

  const unsafe = findUnsafePaths([...bundle.files.keys()]);
  for (const path of unsafe) errors.push(`Unsafe path in AIP: ${path}`);

  const manifestRaw = bundle.files.get('manifest-sha256.txt');
  if (manifestRaw) {
    const { entries, errors: parseErrors } = parseManifest(manifestRaw.toString('utf8'));
    errors.push(...parseErrors);
    for (const entry of entries) {
      const bytes = bundle.files.get(entry.path);
      if (!bytes) continue;
      if (sha256Bytes(bytes) !== entry.sha256) {
        errors.push(`Payload checksum mismatch during restore preflight: ${entry.path}`);
      }
    }
  }

  for (const name of ['descriptive', 'administrative', 'rights', 'provenance', 'versions']) {
    const raw = bundle.files.get(`metadata/${name}.json`);
    if (!raw) continue;
    try {
      JSON.parse(raw.toString('utf8'));
    } catch {
      errors.push(`Malformed metadata/${name}.json blocks restore.`);
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings };
}

function readMetadata<T>(bundle: AIPBundle, name: string): T | null {
  const raw = bundle.files.get(`metadata/${name}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString('utf8')) as T;
  } catch {
    return null;
  }
}

type SupabaseLike = ReturnType<typeof getSupabaseAdminClient>;

async function updateRun(db: SupabaseLike, runId: string, patch: Record<string, unknown>): Promise<string | null> {
  const { error } = await db.from('restore_runs').update(patch).eq('id', runId);
  return error ? error.message : null;
}

export async function runRestore(input: {
  aipPath: string;
  target: unknown;
  actorId: string;
  db?: SupabaseLike;
  now?: Date;
}): Promise<RestoreResult> {
  const db = input.db ?? getSupabaseAdminClient();
  const now = input.now ?? new Date();

  const guard = assertRestoreTarget(input.target);
  if (!guard.ok) {
    return { ok: false, runId: null, status: 'failed', errors: [guard.error], warnings: [], error: guard.error };
  }
  const target = guard.target;

  const aipPath = input.aipPath.replace(/^\/+|\/+$/g, '');
  if (!aipPath || !isSafeRelativePath(aipPath)) {
    const error = `Invalid AIP path: ${input.aipPath}`;
    return { ok: false, runId: null, status: 'failed', errors: [error], warnings: [], error };
  }

  const { data: sourceItem } = await db
    .from('repository_items')
    .select('id, title')
    .eq('id', extractItemId(aipPath))
    .maybeSingle();

  const { data: runRow, error: runError } = await db
    .from('restore_runs')
    .insert({
      aip_path: aipPath,
      repository_item_id: sourceItem?.id ?? null,
      target,
      status: 'pending',
      actor_id: input.actorId,
      created_at: now.toISOString(),
    })
    .select('id')
    .single();
  if (runError || !runRow) {
    const error = runError?.message ?? 'Could not create restore run.';
    return { ok: false, runId: null, status: 'failed', errors: [error], warnings: [], error };
  }
  const runId = runRow.id as string;

  await updateRun(db, runId, { status: 'running' });

  if (sourceItem?.id) {
    const { error: startedError } = await db.from('preservation_events').insert({
      repository_item_id: sourceItem.id,
      event_type: 'RESTORE_STARTED',
      details: { runId, aipPath, target },
      actor_id: input.actorId,
    });
    if (startedError) {
      await updateRun(db, runId, { status: 'failed', error: startedError.message, completed_at: now.toISOString() });
      return { ok: false, runId, status: 'failed', errors: [startedError.message], warnings: [], error: startedError.message };
    }
  }

  const listing = await listObjectsRecursive(AIP_BUCKET, aipPath);
  if (listing.status !== 'ok') {
    const error = `Could not list AIP objects: ${listing.error}`;
    await failRun(db, runId, input.actorId, sourceItem?.id ?? null, error, now);
    return { ok: false, runId, status: 'failed', errors: [error], warnings: [], error };
  }

  const bundle: AIPBundle = { bagName: aipPath, files: new Map() };
  const prefix = `${aipPath}/`;
  for (const key of listing.keys) {
    if (!key.startsWith(prefix)) continue;
    const relative = key.slice(prefix.length);
    const { data, error } = await db.storage.from(AIP_BUCKET).download(key);
    if (error || !data) {
      const message = `Could not read ${relative}: ${error?.message ?? 'no data'}`;
      await failRun(db, runId, input.actorId, sourceItem?.id ?? null, message, now);
      return { ok: false, runId, status: 'failed', errors: [message], warnings: [], error: message };
    }
    bundle.files.set(relative, Buffer.from(await data.arrayBuffer()));
  }

  if (bundle.files.size === 0) {
    const error = `AIP ${aipPath} contains no objects.`;
    await failRun(db, runId, input.actorId, sourceItem?.id ?? null, error, now);
    return { ok: false, runId, status: 'failed', errors: [error], warnings: [], error };
  }

  const preflight = preflightRestore(bundle);
  if (!preflight.valid) {
    const error = `Restore preflight failed: ${preflight.errors.join(' | ')}`;
    await failRun(db, runId, input.actorId, sourceItem?.id ?? null, error, now);
    return { ok: false, runId, status: 'failed', errors: preflight.errors, warnings: preflight.warnings, error };
  }

  const validatedError = await updateRun(db, runId, { status: 'validated' });
  if (validatedError) {
    await failRun(db, runId, input.actorId, sourceItem?.id ?? null, validatedError, now);
    return { ok: false, runId, status: 'failed', errors: [validatedError], warnings: preflight.warnings, error: validatedError };
  }

  const descriptive = readMetadata<Record<string, unknown>>(bundle, 'descriptive') ?? {};
  const administrative = readMetadata<Record<string, unknown>>(bundle, 'administrative') ?? {};
  const rights = readMetadata<Record<string, unknown>>(bundle, 'rights') ?? {};

  const originalVisibility = typeof rights.visibility === 'string' ? rights.visibility : 'private';
  const originalStatus = typeof descriptive.status === 'string' ? descriptive.status : 'submitted';
  const differences: string[] = [];
  if (originalVisibility !== 'private') differences.push(`visibility forced to private (source: ${originalVisibility})`);
  if (originalStatus === 'published') differences.push('status forced to review (source: published)');
  differences.push('new identifiers assigned; source records are never modified');

  const { data: newItem, error: itemError } = await db
    .from('repository_items')
    .insert({
      title: typeof descriptive.title === 'string' && descriptive.title ? descriptive.title : `Restored ${aipPath}`,
      authors: Array.isArray(descriptive.authors) ? descriptive.authors : [],
      contributors: Array.isArray(descriptive.contributors) ? descriptive.contributors : [],
      abstract: typeof descriptive.abstract === 'string' ? descriptive.abstract : null,
      keywords: Array.isArray(descriptive.keywords) ? descriptive.keywords : [],
      year: descriptive.year ?? null,
      doi: typeof descriptive.doi === 'string' ? descriptive.doi : null,
      type: typeof descriptive.type === 'string' ? descriptive.type : 'Article',
      item_type: typeof descriptive.item_type === 'string' ? descriptive.item_type : null,
      department: typeof descriptive.department === 'string' ? descriptive.department : null,
      supervisor: typeof descriptive.supervisor === 'string' ? descriptive.supervisor : null,
      visibility: 'private',
      status: originalStatus === 'published' ? 'review' : originalStatus,
      submitter_id: input.actorId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('id')
    .single();
  if (itemError || !newItem) {
    const error = itemError?.message ?? 'Could not create restored item.';
    await failRun(db, runId, input.actorId, sourceItem?.id ?? null, error, now);
    return { ok: false, runId, status: 'failed', errors: [error], warnings: preflight.warnings, error };
  }
  const newItemId = newItem.id as string;

  const adminFiles = Array.isArray(administrative.files)
    ? (administrative.files as Array<Record<string, unknown>>)
    : [];
  const descriptors = new Map(adminFiles.map((entry) => [String(entry.path ?? ''), entry]));

  const manifestRaw = bundle.files.get('manifest-sha256.txt');
  const { entries: manifestEntries } = parseManifest(manifestRaw?.toString('utf8') ?? '');
  let fileCount = 0;
  const newFileIds: string[] = [];

  for (const entry of manifestEntries) {
    const bytes = bundle.files.get(entry.path);
    if (!bytes) continue;
    const descriptor = descriptors.get(entry.path) ?? {};
    const originalName = typeof descriptor.originalFilename === 'string' ? descriptor.originalFilename : entry.path.replace(/^files\//, '');
    const role = typeof descriptor.role === 'string' ? descriptor.role : 'ORIGINAL';
    const key = `restored/${runId}/${entry.path}`;
    const { error: uploadError } = await db.storage.from(RESTORE_BUCKET).upload(key, bytes, {
      contentType: typeof descriptor.mimeType === 'string' ? descriptor.mimeType : 'application/octet-stream',
      upsert: true,
    });
    if (uploadError) {
      const error = `Could not restore payload ${entry.path}: ${uploadError.message}`;
      await failRun(db, runId, input.actorId, newItemId, error, now, differences);
      return { ok: false, runId, status: 'failed', errors: [error], warnings: preflight.warnings, error, newItemId };
    }

    const { data: fileRow, error: fileError } = await db
      .from('repository_files')
      .insert({
        repository_item_id: newItemId,
        storage_provider: 'supabase',
        storage_bucket: RESTORE_BUCKET,
        storage_key: key,
        original_filename: originalName,
        display_filename: originalName,
        mime_type: typeof descriptor.mimeType === 'string' ? descriptor.mimeType : null,
        file_size: bytes.byteLength,
        checksum: entry.sha256,
        checksum_algorithm: 'sha256',
        checksum_calculated_at: now.toISOString(),
        role,
        display_order: fileCount,
        access_level: 'PRIVATE',
        preservation_status: 'active',
        extracted_text_status: 'pending',
        next_verification_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('id')
      .single();
    if (fileError || !fileRow) {
      const error = fileError?.message ?? 'Could not record restored file.';
      await failRun(db, runId, input.actorId, newItemId, error, now, differences);
      return { ok: false, runId, status: 'failed', errors: [error], warnings: preflight.warnings, error, newItemId };
    }
    newFileIds.push(fileRow.id as string);
    fileCount += 1;
  }

  const completedAt = now.toISOString();
  const restoredDocument = {
    newItemId,
    newFileIds,
    sourceItemId: sourceItem?.id ?? null,
    aipPath,
    target,
    provenance: {
      source: 'ESUT Smart Library AIP',
      aipPath,
      restoredAt: completedAt,
      restoredBy: input.actorId,
      isolation: 'restored records are new rows; source records are never overwritten',
    },
  };

  const completeError = await updateRun(db, runId, {
    status: 'complete',
    restored_document: restoredDocument,
    differences,
    file_count: fileCount,
    completed_at: completedAt,
    error: null,
  });
  if (completeError) {
    await failRun(db, runId, input.actorId, newItemId, completeError, now, differences);
    return { ok: false, runId, status: 'failed', errors: [completeError], warnings: preflight.warnings, error: completeError, newItemId };
  }

  if (sourceItem?.id) {
    const { error: restoredEventError } = await db.from('preservation_events').insert({
      repository_item_id: sourceItem.id,
      event_type: 'RESTORED',
      details: { runId, aipPath, target, newItemId, fileCount, differences },
      actor_id: input.actorId,
    });
    if (restoredEventError) {
      // The restore itself succeeded; surface the audit write failure.
      await updateRun(db, runId, { differences: [...differences, `audit event failed: ${restoredEventError.message}`] });
    }
  }

  return { ok: true, runId, status: 'complete', newItemId, fileCount, errors: [], warnings: preflight.warnings };
}

async function failRun(
  db: SupabaseLike,
  runId: string,
  actorId: string,
  itemId: string | null,
  error: string,
  now: Date,
  differences?: string[],
): Promise<void> {
  await updateRun(db, runId, {
    status: 'failed',
    error,
    completed_at: now.toISOString(),
    ...(differences ? { differences } : {}),
  });
  if (itemId) {
    await db.from('preservation_events').insert({
      repository_item_id: itemId,
      event_type: 'RESTORE_FAILED',
      details: { runId, error },
      actor_id: actorId,
    });
  }
}

function extractItemId(aipPath: string): string | null {
  const match = /^item-([0-9a-fA-F-]{36})/.exec(aipPath);
  return match ? match[1] : null;
}

export async function listRestoreRuns(input: { db?: SupabaseLike; limit?: number }): Promise<RestoreRunRow[]> {
  const db = input.db ?? getSupabaseAdminClient();
  const { data, error } = await db
    .from('restore_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RestoreRunRow[];
}

export { buildAIP, randomUUID };
