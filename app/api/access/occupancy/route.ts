import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getCurrentOccupancy, getBranchById } from '@/server/slaas/repository';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const Query = z.object({ branchId: z.string().uuid() });
type QueryType = z.infer<typeof Query>;

export const GET = withHandler<unknown, QueryType>({
  querySchema: Query,
  async handler({ query, request }) {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const branch = await getBranchById(query.branchId);
    if (!branch || branch.tenant_id !== tenant.tenantId) {
      return { data: { ok: false, error: 'BRANCH_NOT_FOUND' }, status: 404 };
    }
    const occupancy = await getCurrentOccupancy(query.branchId);
    return { data: occupancy };
  },
});
