import { getSupabaseAdminClient } from '../supabase/adminClient';
import { listObjectsByPrefix } from '../storage/b2Client';

export interface BackupCheckResult {
  bucket: string;
  prefix: string;
  status: 'ok' | 'empty' | 'error';
  objectCount: number;
  totalBytes: number;
  latestObjectAt: string | null;
  error?: string;
}

export interface BackupCheckSummary {
  ok: boolean;
  results: BackupCheckResult[];
  recorded: number;
  error?: string;
}

export function summarizeBackupObjects(objects: Array<{ size?: number; lastModified?: Date | string | null }>): {
  objectCount: number;
  totalBytes: number;
  latestObjectAt: string | null;
} {
  let totalBytes = 0;
  let latest: Date | null = null;
  for (const object of objects) {
    totalBytes += typeof object.size === 'number' ? object.size : 0;
    const modified = object.lastModified ? new Date(object.lastModified) : null;
    if (modified && !Number.isNaN(modified.getTime()) && (!latest || modified > latest)) latest = modified;
  }
  return { objectCount: objects.length, totalBytes, latestObjectAt: latest ? latest.toISOString() : null };
}

export function classifyBackupStatus(input: { objectCount: number; error?: string }): 'ok' | 'empty' | 'error' {
  if (input.error) return 'error';
  return input.objectCount > 0 ? 'ok' : 'empty';
}

export async function checkBackupBuckets(options: { payload?: Record<string, unknown> } = {}): Promise<BackupCheckSummary> {
  const payload = options.payload ?? {};
  const prefix = typeof payload.prefix === 'string' ? payload.prefix : '';
  const supabase = getSupabaseAdminClient();
  const results: BackupCheckResult[] = [];
  let recorded = 0;

  let objects: Array<{ key?: string; size?: number; lastModified?: Date | string | null }> = [];
  let failure: string | undefined;
  try {
    objects = await listObjectsByPrefix({ bucketKind: 'backups', prefix, maxKeys: 1000 });
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Unknown storage error.';
  }

  const summary = summarizeBackupObjects(objects);
  const status = classifyBackupStatus({ objectCount: summary.objectCount, error: failure });
  const result: BackupCheckResult = {
    bucket: 'backups',
    prefix,
    status,
    objectCount: summary.objectCount,
    totalBytes: summary.totalBytes,
    latestObjectAt: summary.latestObjectAt,
    ...(failure ? { error: failure } : {}),
  };
  results.push(result);

  const { error: insertError } = await supabase.from('preservation_backups').insert({
    bucket: result.bucket,
    key_prefix: result.prefix,
    status: result.status,
    object_count: result.objectCount,
    total_bytes: result.totalBytes,
    latest_object_at: result.latestObjectAt,
    error: result.error ?? null,
  });
  if (insertError) return { ok: false, results, recorded, error: insertError.message };
  recorded += 1;

  const eventType = result.status === 'empty' ? 'BACKUP_EMPTY' : 'BACKUP_CHECKED';
  const { error: eventError } = await supabase.from('preservation_events').insert({
    event_type: eventType,
    details: {
      bucket: result.bucket,
      prefix: result.prefix,
      status: result.status,
      objectCount: result.objectCount,
      totalBytes: result.totalBytes,
      latestObjectAt: result.latestObjectAt,
      ...(result.error ? { error: result.error } : {}),
    },
  });
  if (eventError) return { ok: false, results, recorded, error: eventError.message };

  return { ok: true, results, recorded };
}
