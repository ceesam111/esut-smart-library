import { accreditationProgrammes, ACCREDITATION_YEAR_FROM } from '@/data/accreditation/programmes';
import type {
  EvidenceByProgramme,
  EvidenceResponseData,
  EvidenceSampleRecord,
  EvidenceStatus,
} from '@/lib/accreditationApi';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { requireRole } from '@/server/auth/requireRole';
import { withHandler } from '@/server/api/withHandler';
import {
  computeProgrammeCoverage,
  COVERAGE_THRESHOLDS,
  type CoverageInputRecord,
} from '@/server/accreditation/coverage';
import { loadLocalRecords } from '@/server/accreditation/localRecords';
import { providerSummary } from '@/server/accreditation/providers';
import type { SyncStateRow } from '@/server/accreditation/types';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { fetchAllPaged } from '@/server/supabase/pagedQuery';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

const EVIDENCE_ROW_CAP = 20000;
const SAMPLE_RECORD_COUNT = 10;

const EVIDENCE_COLUMNS =
  'id,source_provider,resource_type,publication_year,verification_status,verification_checked_at,full_text_url,doi,dedupe_key,programmes,title,creators,abstract_text,subject_headings,landing_page_url,open_access,is_active';

interface EvidenceRow {
  id: string;
  source_provider: string;
  resource_type: string;
  publication_year: number | null;
  verification_status: string;
  verification_checked_at: string | null;
  full_text_url: string | null;
  doi: string | null;
  dedupe_key: string;
  programmes: string[];
  title: string;
  creators: string[];
  abstract_text: string | null;
  subject_headings: string[];
  landing_page_url: string;
  open_access: boolean;
  is_active: boolean;
}

export const GET = withHandler({
  handler: async ({ request }) => {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const [rowsResult, { data: syncRows, error: syncError }] = await Promise.all([
      fetchAllPaged<EvidenceRow>(
        (from, to) =>
          supabase
            .from('scholarly_resources')
            .select(EVIDENCE_COLUMNS)
            .order('id', { ascending: true })
            .range(from, to),
        { maxRows: EVIDENCE_ROW_CAP },
      ),
      supabase.from('resource_sync_state').select('*'),
    ]);
    const { rows: allRows, error } = rowsResult;
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    if (syncError && !isMissingSchemaError(syncError)) throw new Error(syncError.message);

    const activeRows = allRows.filter((row) => row.is_active);
    const recent = (row: EvidenceRow): boolean => (row.publication_year ?? 0) >= ACCREDITATION_YEAR_FROM;
    const providerSummaries = providerSummary();
    const providerLabels = new Map(providerSummaries.map((entry) => [entry.id, entry.displayName]));

    const local = await loadLocalRecords();
    const catalogueMatches = local.items.filter((item) => item.recordSource === 'catalogue').length;
    const repositoryMatches = local.items.filter((item) => item.recordSource === 'repository').length;

    const byProgramme: EvidenceByProgramme[] = accreditationProgrammes.map((programme) => {
      const programmeRows = activeRows.filter((row) => row.programmes.includes(programme.slug));
      const records: CoverageInputRecord[] = programmeRows.map((row) => ({
        resourceType: row.resource_type,
        year: row.publication_year,
        verified: row.verification_status === 'verified',
        hasFullText: row.full_text_url !== null,
        title: row.title,
        abstract: row.abstract_text,
        subjects: row.subject_headings,
      }));
      const coverage = computeProgrammeCoverage(programme, records);
      const byType: Record<string, number> = {};
      const byTypeVerified: Record<string, number> = {};
      for (const row of programmeRows) {
        byType[row.resource_type] = (byType[row.resource_type] ?? 0) + 1;
        if (row.verification_status === 'verified' && row.full_text_url !== null) {
          byTypeVerified[row.resource_type] = (byTypeVerified[row.resource_type] ?? 0) + 1;
        }
      }
      const openAccessJournals = programmeRows.filter(
        (row) => row.resource_type === 'ejournal' && row.open_access,
      ).length;
      const failedLinks = programmeRows.filter(
        (row) => row.verification_status === 'failed',
      ).length;
      const weakTopics = coverage.topics.filter((topic) => topic.weak).map((topic) => topic.topic);
      const warning = coverage.warnings.find((entry) => entry.level !== 'ok')?.message ?? null;
      const evidenceStatus: EvidenceStatus =
        coverage.totals.indexed === 0
          ? 'not_available'
          : coverage.totals.verified === 0
            ? 'pending_review'
            : failedLinks === 0 && weakTopics.length === 0
              ? 'verified'
              : 'partially_verified';
      return {
        slug: programme.slug,
        name: programme.name,
        visitStart: programme.accreditationVisit.start,
        visitEnd: programme.accreditationVisit.end,
        total: coverage.totals.indexed,
        recent2023: coverage.totals.recent2023,
        verified: coverage.totals.verified,
        fullText: coverage.totals.fullText,
        byType,
        byTypeVerified,
        openAccessJournals,
        failedLinks,
        evidenceStatus,
        weakTopics,
        warning,
      };
    });

    const providerCounts = new Map<string, { count: number; recent: number }>();
    for (const row of activeRows) {
      const entry = providerCounts.get(row.source_provider) ?? { count: 0, recent: 0 };
      entry.count += 1;
      if (recent(row)) entry.recent += 1;
      providerCounts.set(row.source_provider, entry);
    }

    const verificationCounts = { verified: 0, unverified: 0, failed: 0, stale: 0 };
    for (const row of activeRows) {
      if (row.verification_status === 'verified') verificationCounts.verified += 1;
      else if (row.verification_status === 'failed') verificationCounts.failed += 1;
      else if (row.verification_status === 'stale') verificationCounts.stale += 1;
      else verificationCounts.unverified += 1;
    }

    const sampleRecords: EvidenceSampleRecord[] = [...activeRows]
      .sort(
        (left, right) =>
          (right.publication_year ?? 0) - (left.publication_year ?? 0) ||
          left.title.localeCompare(right.title),
      )
      .slice(0, SAMPLE_RECORD_COUNT)
      .map((row) => ({
        title: row.title,
        creators: row.creators,
        year: row.publication_year,
        sourceLabel: providerLabels.get(row.source_provider) ?? row.source_provider,
        doi: row.doi,
        landingUrl: row.landing_page_url,
        verificationStatus: row.verification_status as EvidenceSampleRecord['verificationStatus'],
        verificationCheckedAt: row.verification_checked_at,
      }));

    const response: EvidenceResponseData = {
      generatedAt: new Date().toISOString(),
      totals: {
        indexed: allRows.length,
        active: activeRows.length,
        uniqueWorks: new Set(activeRows.map((row) => row.dedupe_key)).size,
        recent2023: activeRows.filter(recent).length,
        withFullText: activeRows.filter((row) => row.full_text_url !== null).length,
        withDoi: activeRows.filter((row) => row.doi !== null).length,
        verified: verificationCounts.verified,
        unverified: verificationCounts.unverified,
        failed: verificationCounts.failed,
        stale: verificationCounts.stale,
        catalogueMatches,
        repositoryMatches,
        providersEnabled: providerSummaries.filter((entry) => entry.enabled).length,
        providersWithData: providerCounts.size,
      },
      byProgramme,
      byProvider: [...providerCounts.entries()]
        .map(([provider, entry]) => ({
          provider,
          label: providerLabels.get(provider) ?? provider,
          count: entry.count,
          recent2023: entry.recent,
        }))
        .sort((left, right) => right.count - left.count || left.provider.localeCompare(right.provider)),
      sampleRecords,
      syncState: (syncRows ?? []) as SyncStateRow[],
      thresholds: {
        programmeMinimum: COVERAGE_THRESHOLDS.programmeMinimum,
        topicMinimum: COVERAGE_THRESHOLDS.topicMinimum,
      },
    };
    return { data: response };
  },
});
