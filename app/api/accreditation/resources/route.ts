import { z } from 'zod';
import {
  ACCREDITATION_YEAR_FROM,
  ACCREDITATION_YEAR_TO,
  programmeBySlug,
} from '@/data/accreditation/programmes';
import type { PortalResourceItem, ResourcesResponseData } from '@/lib/accreditationApi';
import { resourceTypeLabel } from '@/lib/accreditationLabels';
import { ApiError } from '@/server/api/errors';
import { withHandler } from '@/server/api/withHandler';
import { loadLocalRecords } from '@/server/accreditation/localRecords';
import { providerSummary } from '@/server/accreditation/providers';
import type { ScholarlyResourceRow } from '@/server/accreditation/types';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { fetchAllPaged } from '@/server/supabase/pagedQuery';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

const EXTERNAL_ROW_CAP = 2000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const LOCAL_TYPES = ['print_holding'];
const KNOWN_TYPES = new Set([
  'ebook',
  'ejournal',
  'research_article',
  'report',
  'dataset',
  'thesis',
  'standard',
  'course_material',
  'print_holding',
]);

const resourcesQuerySchema = z.object({
  programme: z.string().min(1).optional(),
  q: z.string().max(200).optional(),
  year_from: z.coerce.number().int().optional(),
  year_to: z.coerce.number().int().optional(),
  type: z.string().optional(),
  fulltext_only: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  sort: z.enum(['relevance', 'year_desc']).optional(),
});

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.floor(value), min), max);

const EXTERNAL_COLUMNS =
  'id,source_provider,resource_type,title,creators,publisher,publication_year,doi,subject_headings,abstract_text,landing_page_url,full_text_url,access_state,open_access,verification_status,verification_checked_at,relevance_score,matched_terms';

const matchesQuery = (item: PortalResourceItem, needle: string): boolean => {
  const lower = needle.toLowerCase();
  return (
    item.title.toLowerCase().includes(lower) ||
    item.creators.some((creator) => creator.toLowerCase().includes(lower)) ||
    (item.abstract?.toLowerCase().includes(lower) ?? false) ||
    item.subjects.some((subject) => subject.toLowerCase().includes(lower))
  );
};

export const GET = withHandler({
  querySchema: resourcesQuerySchema,
  handler: async ({ query }) => {
    const parsed = query as z.infer<typeof resourcesQuerySchema>;
    const programme = parsed.programme ? programmeBySlug(parsed.programme) : undefined;
    if (parsed.programme && !programme) {
      throw new ApiError('BAD_REQUEST', `Unknown programme: ${parsed.programme}`, 400);
    }
    const yearTo = clampInt(parsed.year_to ?? ACCREDITATION_YEAR_TO, ACCREDITATION_YEAR_FROM, 2100);
    const yearFrom = clampInt(
      parsed.year_from ?? ACCREDITATION_YEAR_FROM,
      ACCREDITATION_YEAR_FROM,
      yearTo,
    );
    const requestedTypes = (parsed.type ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const type of requestedTypes) {
      if (!KNOWN_TYPES.has(type)) {
        throw new ApiError('BAD_REQUEST', `Unknown resource type: ${type}`, 400);
      }
    }
    const source = parsed.source?.trim() || null;
    const fullTextOnly = parsed.fulltext_only === 'true';
    const page = parsed.page ?? 1;
    const pageSize = clampInt(parsed.page_size ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

    const supabase = getSupabaseAdminClient();
    const { rows: fetchedRows, error } = await fetchAllPaged<ScholarlyResourceRow>(
      (from, to) => {
        let statement = supabase
          .from('scholarly_resources')
          .select(EXTERNAL_COLUMNS)
          .eq('is_active', true)
          .gte('publication_year', yearFrom)
          .lte('publication_year', yearTo)
          .order('id', { ascending: true })
          .range(from, to);
        if (programme) statement = statement.contains('programmes', [programme.slug]);
        if (fullTextOnly) statement = statement.not('full_text_url', 'is', null);
        return statement;
      },
      { maxRows: EXTERNAL_ROW_CAP + 1 },
    );
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    const externalCapped = fetchedRows.length > EXTERNAL_ROW_CAP;
    const externalRows = externalCapped ? fetchedRows.slice(0, EXTERNAL_ROW_CAP) : fetchedRows;

    const providerLabels = new Map(providerSummary().map((entry) => [entry.id, entry.displayName]));
    const externalItems: PortalResourceItem[] = externalRows.map((row) => ({
      key: `external:${row.id}`,
      recordSource: 'external',
      sourceProvider: row.source_provider,
      sourceLabel: providerLabels.get(row.source_provider) ?? row.source_provider,
      resourceType: row.resource_type,
      title: row.title,
      creators: row.creators,
      year: row.publication_year,
      publisher: row.publisher,
      doi: row.doi,
      abstract: row.abstract_text,
      subjects: row.subject_headings,
      landingUrl: row.landing_page_url,
      fullTextUrl: row.full_text_url,
      accessState: row.access_state,
      openAccess: row.open_access,
      verification: { status: row.verification_status, checkedAt: row.verification_checked_at },
      availability: null,
      relevanceScore: row.relevance_score,
      matchedTerms: row.matched_terms,
    }));

    const local = await loadLocalRecords(programme?.slug);
    const base = [...externalItems, ...local.items].filter(
      (item) => item.year !== null && item.year >= yearFrom && item.year <= yearTo,
    );
    const needle = parsed.q?.trim();
    const searched = needle ? base.filter((item) => matchesQuery(item, needle)) : base;
    const fullTexted = fullTextOnly
      ? searched.filter((item) => item.fullTextUrl !== null)
      : searched;
    const typeFiltered =
      requestedTypes.length > 0
        ? fullTexted.filter((item) => requestedTypes.includes(item.resourceType))
        : fullTexted;
    const sourceFiltered = source
      ? typeFiltered.filter((item) =>
          LOCAL_TYPES.includes(source)
            ? item.recordSource === source
            : item.sourceProvider === source,
        )
      : typeFiltered;

    const providerCounts = new Map<string, { label: string; count: number }>();
    for (const item of typeFiltered) {
      const providerKey = item.sourceProvider ?? item.recordSource;
      const existing = providerCounts.get(providerKey);
      providerCounts.set(providerKey, {
        label: item.sourceLabel,
        count: (existing?.count ?? 0) + 1,
      });
    }
    const typeCounts = new Map<string, number>();
    for (const item of fullTexted) {
      typeCounts.set(item.resourceType, (typeCounts.get(item.resourceType) ?? 0) + 1);
    }

    const sorted = [...sourceFiltered];
    if (parsed.sort === 'year_desc') {
      sorted.sort((left, right) => (right.year ?? 0) - (left.year ?? 0));
    } else {
      sorted.sort(
        (left, right) =>
          (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0) ||
          (right.year ?? 0) - (left.year ?? 0),
      );
    }

    const start = (page - 1) * pageSize;
    const response: ResourcesResponseData = {
      total: sorted.length,
      externalTotal: sorted.filter((item) => item.recordSource === 'external').length,
      localTotal: sorted.filter((item) => item.recordSource !== 'external').length,
      page,
      pageSize,
      capped: externalCapped,
      items: sorted.slice(start, start + pageSize),
      providerFacets: [...providerCounts.entries()]
        .map(([provider, entry]) => ({ provider, label: entry.label, count: entry.count }))
        .sort((left, right) => right.count - left.count || left.provider.localeCompare(right.provider)),
      typeFacets: [...typeCounts.entries()]
        .map(([type, count]) => ({ type, label: resourceTypeLabel(type), count }))
        .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
    };
    return { data: response };
  },
});
