import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface OaiRequestRecord {
  verb: string;
  metadataPrefix?: string | null;
  set?: string | null;
  resumptionToken?: boolean;
  errorCode?: string | null;
  recordCount: number;
  durationMs: number;
}

export interface OaiMetrics {
  total: number;
  byVerb: Record<string, number>;
  byPrefix: Record<string, number>;
  errors: Record<string, number>;
  resumptionTokens: number;
  averageDurationMs: number;
}

const inFlight: OaiRequestRecord[] = [];

export function recordOaiRequest(record: OaiRequestRecord): void {
  inFlight.push(record);
  if (inFlight.length > 500) inFlight.splice(0, inFlight.length - 500);

  void persist(record).catch(() => undefined);
}

async function persist(record: OaiRequestRecord): Promise<void> {
  const db = getSupabaseAdminClient();
  const { error } = await db.from('oai_request_log').insert({
    verb: record.verb,
    metadata_prefix: record.metadataPrefix ?? null,
    set_filter: record.set ?? null,
    resumption_token: record.resumptionToken ?? false,
    error_code: record.errorCode ?? null,
    record_count: record.recordCount,
    duration_ms: record.durationMs,
  });
  if (error) throw new Error(error.message);
}

export function snapshotMetrics(): OaiMetrics {
  const byVerb: Record<string, number> = {};
  const byPrefix: Record<string, number> = {};
  const errors: Record<string, number> = {};
  let resumptionTokens = 0;
  let totalDuration = 0;

  for (const record of inFlight) {
    byVerb[record.verb] = (byVerb[record.verb] ?? 0) + 1;
    const prefix = record.metadataPrefix ?? 'none';
    byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;
    if (record.errorCode) errors[record.errorCode] = (errors[record.errorCode] ?? 0) + 1;
    if (record.resumptionToken) resumptionTokens += 1;
    totalDuration += record.durationMs;
  }

  return {
    total: inFlight.length,
    byVerb,
    byPrefix,
    errors,
    resumptionTokens,
    averageDurationMs: inFlight.length > 0 ? Math.round(totalDuration / inFlight.length) : 0,
  };
}

export async function persistedMetrics(sinceMinutes = 60): Promise<{
  total: number;
  byVerb: Record<string, number>;
  errors: Record<string, number>;
  resumptionTokens: number;
  averageDurationMs: number;
}> {
  const db = getSupabaseAdminClient();
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const { data, error } = await db
    .from('oai_request_log')
    .select('verb, metadata_prefix, error_code, resumption_token, duration_ms')
    .gte('created_at', since)
    .limit(10000);

  if (error) throw new Error(error.message);

  const byVerb: Record<string, number> = {};
  const errors: Record<string, number> = {};
  let resumptionTokens = 0;
  let totalDuration = 0;

  for (const row of data ?? []) {
    byVerb[row.verb] = (byVerb[row.verb] ?? 0) + 1;
    if (row.error_code) errors[row.error_code] = (errors[row.error_code] ?? 0) + 1;
    if (row.resumption_token) resumptionTokens += 1;
    totalDuration += row.duration_ms ?? 0;
  }

  const total = (data ?? []).length;
  return {
    total,
    byVerb,
    errors,
    resumptionTokens,
    averageDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
  };
}
