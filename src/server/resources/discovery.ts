import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';
import { enrichWithUnpaywall, getEnabledAdapters } from './adapters';
import { autoPromoteTrustedCandidate, isTrustedAutoApprovable, stageResourceCandidate } from './candidateService';
import { canDownloadLegalFile } from './rights';
import { createDownloadToB2Job, type ResourceJob } from './jobs';
import { getTenantSourceControls } from './sourceControls';

function queryTerms(query: string) {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !['the', 'and', 'for', 'with', 'book', 'books'].includes(term));
}

function isExactIdentifierQuery(query: string) {
  return /(?:doi:|10\.\d{4,9}\/|(?:97[89]\d{10}|\d{9}[\dXx])$)/i.test(query.trim());
}

function relevantCandidates<T extends { title?: string | null; authors?: string[] | null; subjects?: string[] | null; source_record_id?: string | null }>(query: string, candidates: T[]) {
  if (isExactIdentifierQuery(query)) return candidates;
  const terms = queryTerms(query);
  if (!terms.length) return candidates;
  return candidates.filter((candidate) => {
    const haystack = `${candidate.title ?? ''} ${(candidate.authors ?? []).join(' ')} ${(candidate.subjects ?? []).join(' ')} ${candidate.source_record_id ?? ''}`.toLowerCase();
    const hits = terms.filter((term) => haystack.includes(term)).length;
    return hits >= Math.max(1, Math.ceil(terms.length / 2));
  });
}

export async function runExternalResourceDiscovery(input: {
  tenantId: string;
  query: string;
  userId?: string | null;
  triggerType: 'search_miss' | 'search_weak_results' | 'manual_admin' | 'scheduled';
  localResultCount?: number;
  localResultQuality?: 'good' | 'weak' | 'none';
  sourceTypes?: string[];
  limitPerSource?: number;
}) {
  const supabase = getSupabaseAdminClient();
  const runInsert = await supabase.from('resource_harvest_runs').insert({
    tenant_id: input.tenantId,
    job_name: input.triggerType.startsWith('search') ? 'resources.searchExternal' : 'resources.harvest',
    trigger_type: input.triggerType,
    search_query: input.query,
    status: 'running',
  }).select('*').single();
  if (runInsert.error) {
    if (isMissingSchemaError(runInsert.error)) return runExternalResourceSearchOnly(input);
    throw new Error(runInsert.error.message);
  }
  const run = runInsert.data;

  const { controls } = await getTenantSourceControls(input.tenantId);
  const selectedSourceTypes = input.sourceTypes?.length ? input.sourceTypes : controls.filter((control) => control.enabled && !control.missingApiKey).map((control) => control.sourceType);
  const controlsByType = new Map(controls.map((control) => [control.sourceType, control]));
  const adapters = getEnabledAdapters(selectedSourceTypes).sort((a, b) => (controlsByType.get(b.sourceType)?.priority ?? 0) - (controlsByType.get(a.sourceType)?.priority ?? 0));
  const sourcesQueried: string[] = [];
  const errors: string[] = [];
  const staged: unknown[] = [];
  const jobs: ResourceJob[] = [];
  let duplicateCount = 0;
  let externalCount = 0;
  let autoApprovedCount = 0;

  const searchPromises = adapters.map(async (adapter) => {
    sourcesQueried.push(adapter.name);
    const control = controlsByType.get(adapter.sourceType);
    const limit = input.limitPerSource ?? control?.limitPerRun ?? 5;
    try {
      const candidates = relevantCandidates(input.query, await adapter.search(input.query, {
        limit,
        apiKey: process.env.CORE_API_KEY,
        apiKeys: { CORE_API_KEY: process.env.CORE_API_KEY, NCBI_API_KEY: process.env.NCBI_API_KEY, NCBI_EMAIL: process.env.NCBI_EMAIL, UNPAYWALL_EMAIL: process.env.UNPAYWALL_EMAIL },
      }));
      return { adapter, control, candidates };
    } catch (error) {
      errors.push(`${adapter.name}: ${error instanceof Error ? error.message : 'failed'}`);
      return { adapter, control, candidates: [] };
    }
  });

  const searchResults = await Promise.all(searchPromises);

  for (const { adapter, control, candidates } of searchResults) {
    if (!candidates || candidates.length === 0) continue;
    externalCount += candidates.length;
    for (const rawCandidate of candidates) {
      try {
        const candidate = await enrichWithUnpaywall(rawCandidate);
        const result = await stageResourceCandidate({ tenantId: input.tenantId, candidate, harvestRunId: run.id, discoverySource: input.triggerType.startsWith('search') ? 'search_discovery' : 'harvest', searchQuery: input.query });
        if (result.duplicate) duplicateCount += 1;
        
        let visibleCandidate = result.candidate;
        if (!result.duplicate && isTrustedAutoApprovable(result.candidate)) {
          try {
            const promoted = await autoPromoteTrustedCandidate({ candidateId: result.candidate.id });
            visibleCandidate = promoted.candidate;
            autoApprovedCount += 1;
          } catch (error) {
            errors.push(`Auto-approving ${adapter.name} item: ${error instanceof Error ? error.message : 'failed'}`);
          }
        }

        // Even if it's a duplicate, we return it to the user so they see the discovery result
        // UNLESS it's already a live catalogue item (because local search will handle live items).
        if (!result.duplicate || result.duplicate.kind !== 'catalogue_items') {
          staged.push(visibleCandidate);
        }

        if (!result.duplicate && control?.downloadPolicy === 'download_legal_files' && canDownloadLegalFile(candidate) && candidate.download_url) {
          jobs.push(createDownloadToB2Job({ tenantId: input.tenantId, candidateId: result.candidate.id, downloadUrl: candidate.download_url }));
        }
      } catch (err) {
        errors.push(`Staging ${adapter.name} item: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
  }

  await supabase.from('resource_harvest_runs').update({
    status: errors.length && staged.length === 0 ? 'failed' : errors.length ? 'partial' : 'completed',
    finished_at: new Date().toISOString(),
    total_found: externalCount,
    staged_count: staged.length,
    auto_added_count: autoApprovedCount,
    skipped_duplicates: duplicateCount,
    error_count: errors.length,
    error: errors.join('\n') || null,
    metadata: { sources_queried: sourcesQueried, queued_jobs: jobs, source_controls: controls.filter((control) => selectedSourceTypes.includes(control.sourceType)) },
  }).eq('id', run.id);

  const logInsert = await supabase.from('resource_discovery_logs').insert({
    tenant_id: input.tenantId,
    user_id: input.userId ?? null,
    search_query: input.query,
    local_result_count: input.localResultCount ?? 0,
    local_result_quality: input.localResultQuality ?? null,
    external_lookup_triggered: true,
    sources_queried: sourcesQueried,
    external_result_count: externalCount,
    staged_count: staged.length,
    duplicate_count: duplicateCount,
    auto_added_count: autoApprovedCount,
    error: errors.join('\n') || null,
  }).select('*').single();

  return { runId: run.id, candidates: staged, sourcesQueried, externalResultCount: externalCount, duplicateCount, autoApprovedCount, errors, queuedJobs: jobs, discoveryLog: logInsert.data, schemaAvailable: true };
}

export async function runExternalResourceSearchOnly(input: {
  query: string;
  tenantId?: string;
  sourceTypes?: string[];
  limitPerSource?: number;
}) {
  const controlsResult = input.tenantId ? await getTenantSourceControls(input.tenantId) : null;
  const controls = controlsResult?.controls ?? [];
  const controlsByType = new Map(controls.map((control) => [control.sourceType, control]));
  const selectedSourceTypes = input.sourceTypes?.length ? input.sourceTypes : controls.length ? controls.filter((control) => control.enabled && !control.missingApiKey).map((control) => control.sourceType) : undefined;
  const adapters = getEnabledAdapters(selectedSourceTypes).sort((a, b) => (controlsByType.get(b.sourceType)?.priority ?? 0) - (controlsByType.get(a.sourceType)?.priority ?? 0));
  const sourcesQueried: string[] = [];
  const errors: string[] = [];
  const candidates: unknown[] = [];

  const searchPromises = adapters.map(async (adapter) => {
    sourcesQueried.push(adapter.name);
    const control = controlsByType.get(adapter.sourceType);
    const limit = input.limitPerSource ?? control?.limitPerRun ?? 5;
    try {
      const results = relevantCandidates(input.query, await adapter.search(input.query, {
        limit,
        apiKey: process.env.CORE_API_KEY,
        apiKeys: { CORE_API_KEY: process.env.CORE_API_KEY, NCBI_API_KEY: process.env.NCBI_API_KEY, NCBI_EMAIL: process.env.NCBI_EMAIL, UNPAYWALL_EMAIL: process.env.UNPAYWALL_EMAIL },
      }));
      return { adapter, results };
    } catch (error) {
      errors.push(`${adapter.name}: ${error instanceof Error ? error.message : 'failed'}`);
      return { adapter, results: [] };
    }
  });

  const searchResults = await Promise.all(searchPromises);

  for (const { adapter, results } of searchResults) {
    if (!results || results.length === 0) continue;
    try {
      const enriched = await Promise.all(results.map((candidate) => enrichWithUnpaywall(candidate)));
      candidates.push(...enriched.map((candidate, index) => ({
        ...candidate,
        id: `${adapter.sourceType}:${candidate.source_record_id ?? index}`,
        status: 'external_only',
      })));
    } catch (error) {
      errors.push(`Enriching ${adapter.name} item: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  return {
    runId: null,
    candidates,
    sourcesQueried,
    externalResultCount: candidates.length,
    duplicateCount: 0,
    autoApprovedCount: 0,
    errors,
    queuedJobs: [],
    discoveryLog: null,
    schemaAvailable: false,
  };
}
