import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSlaasAnalytics } from '@/server/slaas/analytics';

const Query = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  branchId: z.string().uuid().optional(),
});
type QueryType = z.infer<typeof Query>;

export const GET = withHandler<unknown, QueryType>({
  querySchema: Query,
  async handler({ query, request }) {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const analytics = await getSlaasAnalytics({
      from: query.from,
      to: query.to,
      branchId: query.branchId,
    });
    return { data: analytics };
  },
});
