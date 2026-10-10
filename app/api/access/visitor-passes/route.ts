import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { issueVisitorPass } from '@/server/slaas/visitorPasses';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const Body = z.object({
  visitorId: z.string().uuid(),
  branchId: z.string().uuid(),
  validForMinutes: z.number().int().min(5).max(24 * 60).default(60),
});

type BodyType = z.infer<typeof Body>;

export const POST = withHandler<BodyType>({
  bodySchema: Body,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const result = await issueVisitorPass({
      visitorId: body.visitorId,
      branchId: body.branchId,
      validForMinutes: body.validForMinutes,
      issuedBy: ctx.user.id,
      actorRole: ctx.primaryRole,
      tenantId: tenant.tenantId,
    });
    return { data: result, status: result.ok ? 201 : 400 };
  },
});
