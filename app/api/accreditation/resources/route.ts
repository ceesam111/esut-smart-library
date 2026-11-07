import { z } from 'zod';
import { ACCREDITATION_YEAR_TO, programmeBySlug } from '@/data/accreditation/programmes';
import type { PortalResourceItem, ResourcesResponseData } from '@/lib/accreditationApi';
import { resourceTypeLabel } from '@/lib/accreditationLabels';
import { ApiError } from '@/server/api/errors';
import { withHandler } from '@/server/api/withHandler';
import { searchLiveOpenAccess } from '@/server/accreditation/liveOaSearch';
import { loadLocalRecords } from '@/server/accreditation/localRecords';
import { applyPortalFilters } from '@/server/accreditation/portalFilters';
import { providerSummary } from '@/server/accreditation/providers';
import type { ScholarlyResourceRow } from '@/server/accreditation/types';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { fetchAllPaged } from '@/server/supabase/pagedQuery';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

const EXTERNAL_ROW_CAP = 2000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SEARCH_YEAR_MIN = 1900;
const DEFAULT_SEARCH_WINDOW_YEARS = 5;
const WIDEN_STEP_YEARS = 5;
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
  auto_extend: z.string().optional(),
});

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.floor(value), min), max);

const EXTERNAL_COLUMNS =
  'id,source_provider,resource_type,title,creators,publisher,publication_year,doi,subject_headings,abstract_text,landing_page_url,full_text_url,access_state,open_access,verification_status,verification_checked_at,relevance_score,matched_terms';

const toExternalItem = (
  row: ScholarlyResourceRow,
  providerLabels: Map<string, string>,
): PortalResourceItem => ({
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
});

const dedupeByKey = <T extends { key: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    deduped.push(item);
  }
  return deduped;
};

export const GET = withHandler({
  querySchema: resourcesQuerySchema,
  handler: async ({ query }) => {
    const parsed = query as z.infer<typeof resourcesQuerySchema>;
    const programme = parsed.programme ? programmeBySlug(parsed.programme) : undefined;
    if (parsed.programme && !programme) {
      throw new ApiError('BAD_REQUEST', `Unknown programme: ${parsed.programme}`, 400);
    }
    const currentYear = new Date().getFullYear();
    const anchorYearTo = Math.max(ACCREDITATION_YEAR_TO, currentYear);
    const yearTo = clampInt(parsed.year_to ?? anchorYearTo, SEARCH_YEAR_MIN, 2100);
    const yearFrom = clampInt(
      parsed.year_from ?? yearTo - (DEFAULT_SEARCH_WINDOW_YEARS - 1),
      SEARCH_YEAR_MIN,
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
    const needle = parsed.q?.trim() || null;
    const autoExtend = parsed.auto_extend === 'true' && needle !== null;
    const rowCap = needle ? undefined : EXTERNAL_ROW_CAP + 1;

    const supabase = getSupabaseAdminClient();
    const fetchExternalRows = async (
      fromYear: number,
      toYear: number,
    ): Promise<{ rows: ScholarlyResourceRow[]; capped: boolean }> => {
      const { rows, error } = await fetchAllPaged<ScholarlyResourceRow>(
        (from, to) => {
          let statement = supabase
            .from('scholarly_resources')
            .select(EXTERNAL_COLUMNS)
            .eq('is_active', true)
            .gte('publication_year', fromYear)
            .lte('publication_year', toYear)
            .order('id', { ascending: true })
            .range(from, to);
          if (programme) statement = statement.contains('programmes', [programme.slug]);
          if (fullTextOnly) statement = statement.not('full_text_url', 'is', null);
          return statement;
        },
        rowCap === undefined ? {} : { maxRows: rowCap },
      );
      if (error && !isMissingSchemaError(error)) throw new Error(error.message);
      const capped = rowCap !== undefined && rows.length > EXTERNAL_ROW_CAP;
      return { rows: capped ? rows.slice(0, EXTERNAL_ROW_CAP) : rows, capped };
    };

    const phaseOne = await fetchExternalRows(yearFrom, yearTo);
    const externalRows = phaseOne.rows;
    const externalCapped = phaseOne.capped;

    const providerLabels = new Map(providerSummary().map((entry) => [entry.id, entry.displayName]));
    const externalItems: PortalResourceItem[] = externalRows.map((row) =>
      toExternalItem(row, providerLabels),
    );

    const local = await loadLocalRecords(programme?.slug);
    let liveItems: PortalResourceItem[] = [];
    if (needle) {
      liveItems = await searchLiveOpenAccess({ needle, yearFrom, yearTo });
    }

    let effectiveFrom = yearFrom;
    const inRequestedWindow = (year: number | null): boolean =>
      year !== null && year >= yearFrom && year <= yearTo;
    const phaseOneMatches =
      externalRows.filter((row) => inRequestedWindow(row.publication_year)).length +
      local.items.filter((item) => inRequestedWindow(item.year)).length +
      liveItems.length;

    if (needle && autoExtend && phaseOneMatches === 0 && yearFrom > SEARCH_YEAR_MIN) {
      const [olderPhase, widerLive] = await Promise.all([
        fetchExternalRows(SEARCH_YEAR_MIN, yearFrom - 1),
        searchLiveOpenAccess({ needle, yearFrom: SEARCH_YEAR_MIN, yearTo }),
      ]);
      const olderItems = olderPhase.rows.map((row) => toExternalItem(row, providerLabels));
      const olderPool = [...olderItems, ...widerLive, ...local.items];
      const olderHitYears = olderPool
        .map((item) => item.year)
        .filter((year): year is number => year !== null && year < yearFrom);
      if (olderHitYears.length > 0) {
        const oldestYear = Math.min(...olderHitYears);
        const widenSteps = Math.ceil((yearFrom - oldestYear) / WIDEN_STEP_YEARS);
        effectiveFrom = Math.max(yearFrom - widenSteps * WIDEN_STEP_YEARS, SEARCH_YEAR_MIN);
        externalItems.push(...olderItems);
        liveItems = [...liveItems, ...widerLive];
      }
    }

    const base = dedupeByKey([...externalItems, ...liveItems, ...local.items]).filter(
      (item) => item.year !== null && item.year >= effectiveFrom && item.year <= yearTo,
    );
    const fullTexted = fullTextOnly
      ? base.filter((item) => item.fullTextUrl !== null)
      : base;
    const { results, matchedTotal, typeCounts, providerCounts } = applyPortalFilters({
      base: fullTexted,
      needle,
      types: requestedTypes,
      source,
      localTypes: LOCAL_TYPES,
    });
    const liveTotal = results.filter((item) => item.key.startsWith('live:')).length;

    const sorted = [...results];
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
      matchedTotal,
      externalTotal: sorted.filter((item) => item.recordSource === 'external').length,
      localTotal: sorted.filter((item) => item.recordSource !== 'external').length,
      page,
      pageSize,
      capped: externalCapped,
      effectiveYearFrom: effectiveFrom,
      effectiveYearTo: yearTo,
      expanded: effectiveFrom < yearFrom,
      liveTotal,
      items: sorted.slice(start, start + pageSize),
      providerFacets: providerCounts
        .map((entry) => ({ provider: entry.provider, label: entry.label, count: entry.count }))
        .sort((left, right) => right.count - left.count || left.provider.localeCompare(right.provider)),
      typeFacets: typeCounts
        .map((entry) => ({ type: entry.type, label: resourceTypeLabel(entry.type), count: entry.count }))
        .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
    };
    return { data: response };
  },
});
