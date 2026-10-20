import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { computeVisibilityDiagnostics } from '@/server/visibility/visibilityDiagnostics';

export const visibilityDiagnosticsWorker: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const diagnostics = await computeVisibilityDiagnostics(supabase, { deep: false });
  return safeResult('Visibility and indexing diagnostics computed.', {
    diagnostics,
    coverage_pct: diagnostics.repository.sitemap_coverage_pct,
    indexable_items: diagnostics.repository.public_indexable_items,
    duplicate_title_groups: diagnostics.duplicate_titles.length,
  });
};
