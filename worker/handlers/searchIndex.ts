import type { AgentJobHandler } from '../types';
import { getSupabaseAdminClient } from '../../src/server/supabase/adminClient';
import { indexRepositoryItem, reindexAll } from '../../src/server/search/indexModel';
import { requireTenant, safeResult } from './utils';

export const reindexSearch: AgentJobHandler = async (job) => {
  requireTenant(job);
  const payload = job.payload ?? {};
  const scope = typeof payload.scope === 'string' ? payload.scope : 'item';
  const targetId = typeof payload.targetId === 'string' ? payload.targetId : null;

  if (scope === 'all') {
    const result = await reindexAll();
    return safeResult('Repository search index rebuilt.', {
      scope: 'all',
      items: result.items,
      documents: result.documents,
    });
  }

  if (scope === 'file' && targetId) {
    const { indexRepositoryFile } = await import('../../src/server/search/indexModel');
    const result = await indexRepositoryFile(targetId);
    return safeResult('Repository file reindexed.', {
      scope: 'file',
      targetId,
      documents: result.documents,
    });
  }

  if (!targetId) throw new Error('targetId is required for item or file reindex.');

  const result = await indexRepositoryItem(targetId);
  return safeResult('Repository item reindexed.', {
    scope: 'item',
    targetId,
    documents: result.documents,
  });
};

export const produceSearchReindex: AgentJobHandler = async (job) => {
  requireTenant(job);
  const db = getSupabaseAdminClient();

  const { data: pending } = await db
    .from('agent_jobs')
    .select('id')
    .eq('job_type', 'search.reindex')
    .eq('status', 'pending')
    .limit(50);

  const { data: items } = await db
    .from('repository_items')
    .select('id')
    .limit(50);

  let documents = 0;
  for (const item of items ?? []) {
    const result = await indexRepositoryItem(item.id as string);
    documents += result.documents;
  }

  return safeResult('Search reindex sweep completed.', {
    pendingJobs: (pending ?? []).length,
    items: (items ?? []).length,
    documents,
  });
};
