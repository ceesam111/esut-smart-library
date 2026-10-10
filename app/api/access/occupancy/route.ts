import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getCurrentOccupancy } from '@/server/slaas/repository';

const Query = z.object({ branchId: z.string().uuid() });
type QueryType = z.infer<typeof Query>;

export const GET = withHandler<unknown, QueryType>({
  querySchema: Query,
  async handler({ query, request }) {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const occupancy = await getCurrentOccupancy(query.branchId);
    return { data: occupancy };
  },
});
