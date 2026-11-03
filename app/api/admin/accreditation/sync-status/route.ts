import type { SyncStatusResponseData } from '@/lib/accreditationApi';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { requireRole } from '@/server/auth/requireRole';
import { withHandler } from '@/server/api/withHandler';
import { providerSummary } from '@/server/accreditation/providers';
import type { SyncStateRow } from '@/server/accreditation/types';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { isMissingSchemaError } from '@/server/supabase/schemaErrors';

export const GET = withHandler({
  handler: async ({ request }) => {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('resource_sync_state')
      .select('*')
      .order('provider')
      .order('programme_slug');
    if (error && !isMissingSchemaError(error)) throw new Error(error.message);
    const response: SyncStatusResponseData = {
      providers: providerSummary(),
      state: (data ?? []) as SyncStateRow[],
    };
    return { data: response };
  },
});
