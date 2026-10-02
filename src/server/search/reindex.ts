import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { indexRepositoryFile, indexRepositoryItem, reindexAll, removeItemDocuments } from './indexModel';

export type ReindexScope = 'item' | 'file' | 'all';

export interface ReindexResult {
  scope: ReindexScope;
  enqueued: number;
  indexed: number;
  documents: number;
  errors: string[];
}

export async function reindexRepository(scope: ReindexScope, targetId?: string): Promise<ReindexResult> {
  const result: ReindexResult = { scope, enqueued: 0, indexed: 0, documents: 0, errors: [] };

  if (scope === 'item' && targetId) {
    try {
      const indexed = await indexRepositoryItem(targetId);
      result.indexed = 1;
      result.documents = indexed.documents;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
    return result;
  }

  if (scope === 'file' && targetId) {
    try {
      const indexed = await indexRepositoryFile(targetId);
      result.indexed = 1;
      result.documents = indexed.documents;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
    return result;
  }

  try {
    const all = await reindexAll();
    result.indexed = all.items;
    result.documents = all.documents;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
  return result;
}

export async function enqueueReindex(scope: ReindexScope, targetId?: string): Promise<number> {
  const db = getSupabaseAdminClient();

  if (scope === 'item' && targetId) {
    const { error } = await db.rpc('enqueue_search_reindex', { p_item_id: targetId });
    if (error) throw new Error(`Failed to enqueue reindex: ${error.message}`);
    return 1;
  }

  if (scope === 'file' && targetId) {
    const { data: file } = await db
      .from('repository_files')
      .select('repository_item_id')
      .eq('id', targetId)
      .maybeSingle();
    if (!file) return 0;
    const { error } = await db.rpc('enqueue_search_reindex', { p_item_id: file.repository_item_id });
    if (error) throw new Error(`Failed to enqueue reindex: ${error.message}`);
    return 1;
  }

  const { data: items } = await db.from('repository_items').select('id').limit(10000);
  let enqueued = 0;
  for (const item of items ?? []) {
    const { error } = await db.rpc('enqueue_search_reindex', { p_item_id: item.id as string });
    if (!error) enqueued += 1;
  }
  return enqueued;
}

export async function reindexBacklog(): Promise<{ pending: number; documents: number }> {
  const db = getSupabaseAdminClient();
  const { count } = await db
    .from('agent_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('job_type', 'search.reindex')
    .eq('status', 'pending');

  const { data: items } = await db
    .from('repository_items')
    .select('id')
    .limit(10000);

  let documents = 0;
  for (const item of items ?? []) {
    const result = await indexRepositoryItem(item.id as string);
    documents += result.documents;
  }

  return { pending: count ?? 0, documents };
}

export { removeItemDocuments };
