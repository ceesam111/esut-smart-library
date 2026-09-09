import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { searchLocalResources } from '@/server/resources/localSearch';
import { runExternalResourceDiscovery } from '@/server/resources/discovery';
import { checkExternalDiscoveryRateLimit } from '@/server/resources/rateLimit';
import { withHandler } from '@/server/api/withHandler';
import { ApiError } from '@/server/api/errors';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

function groupCandidates(candidates: any[] = []) {
  return {
    openAccessArticles: candidates.filter((item) => item.item_type === 'article' && item.rights_status === 'open'),
    ebooks: candidates.filter((item) => /book|ebook/i.test(String(item.item_type ?? ''))),
    journals: candidates.filter((item) => /journal|doaj|crossref|openalex/i.test(`${item.item_type ?? ''} ${item.source_name ?? ''}`)),
    biomedical: candidates.filter((item) => /pubmed|pmc|biomedical/i.test(`${item.source_name ?? ''} ${item.subjects?.join?.(' ') ?? ''}`)),
    publicDomain: candidates.filter((item) => item.rights_status === 'public_domain'),
    legalPdfAvailable: candidates.filter((item) => ['open', 'public_domain'].includes(item.rights_status) && item.download_url),
  };
}

function decorateCandidate(candidate: any) {
  const legalDownload = ['open', 'public_domain'].includes(candidate.rights_status) && !!candidate.download_url;
  const approved = candidate.status === 'approved' || candidate.status === 'auto_added' || Boolean(candidate.promoted_catalogue_item_id);
  return {
    ...candidate,
    actions: {
      readOnline: candidate.source_url ?? candidate.download_url ?? null,
      download: legalDownload ? candidate.download_url : null,
      requestLibrarianReview: !approved,
      staffReviewUrl: approved ? null : `/admin/harvest?candidate=${candidate.id}`,
      canDownloadLegally: legalDownload,
      approved,
    },
  };
}

function candidateToCatalogueRow(candidate: any, tenantId: string) {
  const title = String(candidate.title ?? '').trim();
  if (!title) return null;
  const authors = Array.isArray(candidate.authors) ? candidate.authors : String(candidate.authors ?? '').split(/[;,]/).map((a) => a.trim()).filter(Boolean);
  const subjects = Array.isArray(candidate.subjects) ? candidate.subjects : String(candidate.subjects ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const yearMatch = String(candidate.year ?? candidate.published_year ?? candidate.publication_date ?? '').match(/(?:18|19|20)\d{2}/);
  return {
    tenant_id: tenantId,
    title,
    authors,
    publisher: candidate.publisher ?? candidate.source_name ?? null,
    year: yearMatch ? Number(yearMatch[0]) : null,
    format: candidate.item_type ?? 'article',
    subjects,
    abstract: candidate.abstract ?? candidate.description ?? null,
    source_url: candidate.source_url ?? candidate.download_url ?? null,
    download_url: candidate.download_url ?? null,
    isbn: candidate.isbn ?? null,
    issn: candidate.issn ?? null,
    is_harvested: true,
    visibility: 'global',
    status: 'active',
    total_copies: 1,
    available_copies: 1,
  };
}

async function cacheApprovedHoldings(candidates: any[], tenantId: string) {
  const rows = candidates
    .filter((candidate) => candidate.status === 'approved' || candidate.status === 'auto_added' || candidate.promoted_catalogue_item_id)
    .map((candidate) => candidateToCatalogueRow(candidate, tenantId))
    .filter((row): row is NonNullable<ReturnType<typeof candidateToCatalogueRow>> => Boolean(row));
  if (!rows.length) return 0;
  const client = getSupabaseAdminClient();
  const inserted = await client.from('catalogue_items').upsert(rows, { onConflict: 'tenant_id,title,source_url', ignoreDuplicates: true });
  if (inserted.error && !isMissingSchemaError(inserted.error)) throw new ApiError('INTERNAL_ERROR', inserted.error.message, 500);
  return inserted.error ? 0 : rows.length;
}

async function optionalUser(request: NextRequest) {
  try {
    return await requireUser(request);
  } catch {
    return null;
  }
}

const searchQuerySchema = z.object({ q: z.string().min(1), expand: z.string().optional() });

export const GET = withHandler({
  querySchema: searchQuerySchema,
  handler: async ({ request, query }) => {
    const searchQuery = query as z.infer<typeof searchQuerySchema>;
    const queryText = searchQuery.q.trim();
    const expand = searchQuery.expand !== 'false';
    if (!queryText) throw new ApiError('BAD_REQUEST', 'Search query is required.', 400);

    const ctx = await optionalUser(request);
    const tenant = await resolveTenant(ctx?.user.id);
    const local = await searchLocalResources({ tenantId: tenant.tenantId, query: queryText });

    if (!expand) {
      const logInsert = await getSupabaseAdminClient().from('resource_discovery_logs').insert({
        tenant_id: tenant.tenantId,
        user_id: ctx?.user.id ?? null,
        search_query: queryText,
        local_result_count: local.results.length,
        local_result_quality: local.quality,
        external_lookup_triggered: false,
      });
      if (logInsert.error && !isMissingSchemaError(logInsert.error)) throw new ApiError('INTERNAL_ERROR', logInsert.error.message, 500);
      return { data: { query: queryText, localResults: local.results, localQuality: local.quality, externalLookupOffered: true, externalLookupTriggered: false, schemaAvailable: local.schemaAvailable !== false } };
    }

    const rate = checkExternalDiscoveryRateLimit(`${tenant.tenantId}:${ctx?.user.id ?? request.headers.get('x-forwarded-for') ?? 'anon'}`);
    if (!rate.allowed) throw new ApiError('RATE_LIMITED', 'Too many external lookups. Try again later.', 429, { retryAfterSeconds: rate.retryAfterSeconds });

    const discovery = await runExternalResourceDiscovery({
      tenantId: tenant.tenantId,
      userId: ctx?.user.id ?? null,
      query: queryText,
      triggerType: local.quality === 'none' ? 'search_miss' : 'search_weak_results',
      localResultCount: local.results.length,
      localResultQuality: local.quality,
      limitPerSource: 4,
    });

    const rawCandidates = discovery.candidates as any[];
    const cachedHoldingCount = await cacheApprovedHoldings(rawCandidates, tenant.tenantId);
    const externalCandidates = rawCandidates.map(decorateCandidate);

    return { data: {
      query: queryText,
      localResults: local.results,
      localQuality: local.quality,
      externalLookupOffered: false,
      externalLookupTriggered: true,
      externalCandidates,
      grouped: groupCandidates(externalCandidates),
      sourcesQueried: discovery.sourcesQueried,
      duplicateCount: discovery.duplicateCount,
      autoApprovedCount: discovery.autoApprovedCount ?? 0,
      cachedHoldingCount,
      queuedJobs: discovery.queuedJobs,
      errors: discovery.errors,
      schemaAvailable: local.schemaAvailable !== false && discovery.schemaAvailable !== false,
    } };
  },
});
