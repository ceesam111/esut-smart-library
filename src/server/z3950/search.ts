import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { buildPQF, type IndexKey } from './pqf';
import { checkSSRF } from './ssrf';
import { runYAZSearch, YAZError } from './yazClient';
import { parseMarcRecord, type ParsedMarcRecord } from './marcParse';

export interface Z3950Target {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  enabled: boolean;
  trusted: boolean;
  default_index: string;
  use_attribute_overrides: Record<string, number>;
}

export type DuplicateStatus = 'NO_MATCH' | 'POSSIBLE_MATCH' | 'STRONG_MATCH';

export interface Z3950SearchResult {
  target: { id: string; name: string; host: string; port: number; database: string };
  hitCount: number;
  records: Array<ParsedMarcRecord & { duplicateStatus: DuplicateStatus }>;
  nextPosition: number | null;
  outcome: 'ok' | 'timeout' | 'connection_failed' | 'search_failed' | 'error';
  error?: string;
  durationMs: number;
}

export async function searchZ3950(
  targetId: string,
  query: string,
  index: IndexKey,
): Promise<Z3950SearchResult> {
  const startedAt = Date.now();
  const supabase = getSupabaseAdminClient();

  const { data: target, error: targetError } = await supabase
    .from('z3950_targets')
    .select('*')
    .eq('id', targetId)
    .single();

  if (targetError || !target) {
    return errorResult(targetId, 'error', 'Target not found', startedAt);
  }

  if (!target.enabled) {
    return errorResult(targetId, 'error', 'Target is disabled', startedAt);
  }

  const ssrf = await checkSSRF(target.host, target.port, target.trusted);
  if (!ssrf.allowed) {
    return errorResult(targetId, 'error', ssrf.reason || 'Target blocked', startedAt);
  }

  const pqf = buildPQF(index, query, target.use_attribute_overrides);

  let result;
  try {
    result = await runYAZSearch({
      host: target.host,
      port: target.port,
      database: target.database,
      pqf,
      maxRecords: 20,
      timeoutMs: 30000,
    });
  } catch (err) {
    const outcome = err instanceof YAZError ? err.code.toLowerCase() : 'error';
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResult(targetId, outcome, message, startedAt);
  }

  const records = await Promise.all(result.records.map(async (rec) => {
    const parsed = parseMarcRecord(rec);
    const dupStatus = await checkDuplicate(parsed);
    return { ...parsed, duplicateStatus: dupStatus };
  }));

  return {
    target: { id: target.id, name: target.name, host: target.host, port: target.port, database: target.database },
    hitCount: result.hitCount,
    records,
    nextPosition: result.nextPosition,
    outcome: 'ok',
    durationMs: Date.now() - startedAt,
  };
}

async function checkDuplicate(record: ParsedMarcRecord): Promise<DuplicateStatus> {
  const supabase = getSupabaseAdminClient();

  if (record.isbn) {
    const { data } = await supabase
      .from('catalogue_items')
      .select('id')
      .eq('isbn', record.isbn)
      .limit(1);
    if (data && data.length > 0) return 'STRONG_MATCH';
  }

  const titleNorm = record.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (titleNorm.length > 3) {
    const { data } = await supabase
      .from('catalogue_items')
      .select('id, title')
      .ilike('title', `%${record.title.slice(0, 30)}%`)
      .limit(5);
    if (data && data.length > 0) {
      for (const item of data) {
        const itemNorm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (itemNorm === titleNorm) return 'STRONG_MATCH';
      }
      return 'POSSIBLE_MATCH';
    }
  }

  return 'NO_MATCH';
}

function errorResult(targetId: string, outcome: string, error: string, startedAt: number): Z3950SearchResult {
  return {
    target: { id: targetId, name: '', host: '', port: 0, database: '' },
    hitCount: 0,
    records: [],
    nextPosition: null,
    outcome: outcome as Z3950SearchResult['outcome'],
    error,
    durationMs: Date.now() - startedAt,
  };
}
