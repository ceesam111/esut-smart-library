import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';
import type { LocalSearchResult } from './types';

function scoreRow(row: Record<string, unknown>, query: string) {
  const q = query.toLowerCase();
  let score = 0;
  if (String(row.title ?? '').toLowerCase() === q) score += 60;
  if (String(row.title ?? '').toLowerCase().includes(q)) score += 30;
  if (String(row.isbn ?? '').replace(/[\s-]/g, '') === q.replace(/[\s-]/g, '')) score += 80;
  if (String(row.doi ?? '').toLowerCase() === q) score += 80;
  if (JSON.stringify(row.authors ?? '').toLowerCase().includes(q)) score += 20;
  if (JSON.stringify(row.subjects ?? '').toLowerCase().includes(q)) score += 10;
  if (String(row.publisher ?? '').toLowerCase().includes(q)) score += 8;
  if (String(row.year ?? '') === q) score += 10;
  return score || 1;
}

export function classifyLocalQuality(results: LocalSearchResult[]) {
  if (results.length === 0) return 'none' as const;
  if (results[0]?.score >= 30 || results.length >= 5) return 'good' as const;
  return 'weak' as const;
}

export async function searchLocalResources(input: { tenantId: string; query: string; limit?: number }) {
  const q = input.query.trim();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('catalogue_items')
    .select('id,title,authors,isbn,doi,publisher,year,subjects,source_url,cover_image')
    .eq('tenant_id', input.tenantId)
    .or(`title.ilike.%${q}%,isbn.ilike.%${q}%,doi.ilike.%${q}%,publisher.ilike.%${q}%`)
    .limit(input.limit ?? 25);
  if (error) {
    if (isMissingSchemaError(error)) return { results: [], quality: 'none' as const, schemaAvailable: false };
    throw new Error(error.message);
  }
  const results = (data ?? []).map((row) => ({ ...row, score: scoreRow(row, q), result_type: 'catalogue' as const })).sort((a, b) => b.score - a.score);
  return { results, quality: classifyLocalQuality(results), schemaAvailable: true };
}
