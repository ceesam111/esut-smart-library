import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { withHandler } from '@/server/api/withHandler';

const objectsQuerySchema = z.object({ linkedEntityType: z.string().max(80).optional() });

export const GET = withHandler({
  querySchema: objectsQuerySchema,
  handler: async ({ request, query }) => {
    const parsed = query as z.infer<typeof objectsQuerySchema>;
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    let dbQuery = supabase.from('library_objects').select('*').eq('tenant_id', tenant.tenantId).order('created_at', { ascending: false }).limit(100);
    if (parsed.linkedEntityType) dbQuery = dbQuery.eq('linked_entity_type', parsed.linkedEntityType);
    const { data, error } = await dbQuery;
    if (error) throw new Error(error.message);
    return { data: { objects: data ?? [] } };
  },
});
