import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { correctVisit } from '@/server/slaas/corrections';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const Body = z.object({
  visitId: z.string().uuid(),
  newStatus: z.enum(['checked_out', 'auto_closed', 'checked_in']),
  newCheckedOutAt: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().min(3).max(500),
});

type BodyType = z.infer<typeof Body>;

export const POST = withHandler<BodyType>({
  bodySchema: Body,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const result = await correctVisit({
      visitId: body.visitId,
      newStatus: body.newStatus,
      newCheckedOutAt: body.newCheckedOutAt,
      reason: body.reason,
      correctedBy: ctx.user.id,
      actorRole: ctx.primaryRole,
      tenantId: tenant.tenantId,
    });
    return { data: result, status: result.ok ? 200 : 400 };
  },
});
