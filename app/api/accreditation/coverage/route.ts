import { z } from 'zod';
import { ACCREDITATION_YEAR_FROM, ACCREDITATION_YEAR_TO, programmeBySlug } from '@/data/accreditation/programmes';
import type { CoverageResponseData } from '@/lib/accreditationApi';
import { ApiError } from '@/server/api/errors';
import { withHandler } from '@/server/api/withHandler';
import { computeProgrammeCoverage, COVERAGE_THRESHOLDS, type CoverageInputRecord } from '@/server/accreditation/coverage';
import { loadLocalRecords } from '@/server/accreditation/localRecords';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { fetchAllPaged } from '@/server/supabase/pagedQuery';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

const EXTERNAL_ROW_CAP = 2000;

const coverageQuerySchema = z.object({
  programme: z.string().min(1),
});

interface ExternalCoverageRow {
  resource_type: string;
  publication_year: number | null;
  verification_status: string;
  full_text_url: string | null;
  title: string;
  abstract_text: string | null;
  subject_headings: string[];
}

export const GET = withHandler({
  querySchema: coverageQuerySchema,
  handler: async ({ query }) => {
    const parsed = query as z.infer<typeof coverageQuerySchema>;
    const programme = programmeBySlug(parsed.programme);
    if (!programme) throw new ApiError('BAD_REQUEST', `Unknown programme: ${parsed.programme}`, 400);

    const supabase = getSupabaseAdminClient();
    const { rows, error } = await fetchAllPaged<ExternalCoverageRow>(
      (from, to) =>
        supabase
          .from('scholarly_resources')
          .select('resource_type,publication_year,verification_status,full_text_url,title,abstract_text,subject_headings')
          .eq('is_active', true)
          .contains('programmes', [programme.slug])
          .gte('publication_year', ACCREDITATION_YEAR_FROM)
          .lte('publication_year', ACCREDITATION_YEAR_TO)
          .order('id', { ascending: true })
          .range(from, to),
      { maxRows: EXTERNAL_ROW_CAP },
    );
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);

    const externalRecords: CoverageInputRecord[] = rows.map((row) => ({
      resourceType: row.resource_type,
      year: row.publication_year,
      verified: row.verification_status === 'verified',
      hasFullText: row.full_text_url !== null,
      title: row.title,
      abstract: row.abstract_text,
      subjects: row.subject_headings,
    }));

    const local = await loadLocalRecords(programme.slug);
    const localRecords: CoverageInputRecord[] = local.items
      .filter(
        (item) =>
          item.year !== null && item.year >= ACCREDITATION_YEAR_FROM && item.year <= ACCREDITATION_YEAR_TO,
      )
      .map((item) => ({
      resourceType: item.resourceType,
      year: item.year,
      verified: false,
      hasFullText: item.fullTextUrl !== null,
      title: item.title,
      abstract: item.abstract,
      subjects: item.subjects,
    }));

    const coverage = computeProgrammeCoverage(programme, [...externalRecords, ...localRecords]);
    const response: CoverageResponseData = {
      slug: programme.slug,
      name: programme.name,
      totals: coverage.totals,
      byType: coverage.byType,
      topics: coverage.topics,
      warnings: coverage.warnings,
      thresholds: {
        programmeMinimum: COVERAGE_THRESHOLDS.programmeMinimum,
        topicMinimum: COVERAGE_THRESHOLDS.topicMinimum,
      },
    };
    return { data: response };
  },
});
