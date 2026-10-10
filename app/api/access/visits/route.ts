import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const Query = z.object({
  branchId: z.string().uuid().optional(),
  status: z.enum(['checked_in', 'checked_out', 'auto_closed', 'all']).default('all'),
  from: z.string().optional(),
  to: z.string().optional(),
  academicSession: z.string().max(64).optional(),
  semester: z.string().max(32).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
type QueryType = z.infer<typeof Query>;

export const GET = withHandler<unknown, QueryType>({
  querySchema: Query,
  async handler({ query, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    let q = supabase
      .from('access_visits')
      .select('id, patron_id, visitor_id, branch_id, status, entry_method, exit_method, checked_in_at, checked_out_at, duration_minutes, correction_reason, corrected_at, academic_session, semester, is_observed, library_branches(name, code), patrons(full_name, patron_category, department)', { count: 'exact' })
      .eq('tenant_id', tenant.tenantId);

    if (query.branchId) q = q.eq('branch_id', query.branchId);
    if (query.status !== 'all') q = q.eq('status', query.status);
    if (query.from) q = q.gte('checked_in_at', query.from);
    if (query.to) q = q.lte('checked_in_at', query.to);
    if (query.academicSession) q = q.eq('academic_session', query.academicSession);
    if (query.semester) q = q.eq('semester', query.semester);

    const offset = (query.page - 1) * query.pageSize;
    q = q.order('checked_in_at', { ascending: false }).range(offset, offset + query.pageSize - 1);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    return {
      data: {
        rows: data ?? [],
        total: count ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      },
    };
  },
});
