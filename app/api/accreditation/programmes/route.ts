import {
  ACCREDITATION_YEAR_FROM,
  ACCREDITATION_YEAR_TO,
  accreditationProgrammes,
} from '@/data/accreditation/programmes';
import { accreditationDatabases } from '@/data/accreditation/databases';
import type { ProgrammeWithStats } from '@/lib/accreditationApi';
import { withHandler } from '@/server/api/withHandler';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { fetchAllPaged } from '@/server/supabase/pagedQuery';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

const STATS_ROW_CAP = 20000;

interface StatsRow {
  programmes: string[];
  publication_year: number | null;
  resource_type: string;
  open_access: boolean;
  verification_status: string;
  full_text_url: string | null;
  last_synced_at: string | null;
}

export const GET = withHandler({
  handler: async () => {
    const supabase = getSupabaseAdminClient();
    const { rows, error } = await fetchAllPaged<StatsRow>(
      (from, to) =>
        supabase
          .from('scholarly_resources')
          .select(
            'programmes,publication_year,resource_type,open_access,verification_status,full_text_url,last_synced_at',
          )
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(from, to),
      { maxRows: STATS_ROW_CAP },
    );
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    const programmes: ProgrammeWithStats[] = accreditationProgrammes.map((programme) => {
      const matching = rows.filter((row) => row.programmes.includes(programme.slug));
      const ebooks = matching.filter((row) => row.resource_type === 'ebook').length;
      const ejournals = matching.filter((row) => row.resource_type === 'ejournal').length;
      const articles = matching.filter((row) => row.resource_type === 'research_article').length;
      const openAccessJournals = matching.filter(
        (row) => row.resource_type === 'ejournal' && row.open_access,
      ).length;
      const verifiedFullText = matching.filter(
        (row) => row.verification_status === 'verified' && row.full_text_url !== null,
      ).length;
      const lastSyncedAt = matching
        .map((row) => row.last_synced_at)
        .filter((value): value is string => value !== null)
        .sort()
        .pop() ?? null;
      return {
        ...programme,
        stats: {
          indexed: matching.length,
          recent2023: matching.filter(
            (row) => (row.publication_year ?? 0) >= ACCREDITATION_YEAR_FROM,
          ).length,
          ebooks,
          ejournals,
          articles,
          openAccessJournals,
          verifiedFullText,
          lastSyncedAt,
        },
      };
    });
    return {
      data: {
        programmes,
        databases: accreditationDatabases,
        yearFrom: ACCREDITATION_YEAR_FROM,
        yearTo: ACCREDITATION_YEAR_TO,
      },
    };
  },
});
