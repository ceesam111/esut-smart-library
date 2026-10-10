import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { processScan } from '@/server/slaas/repository';

const ScanBody = z.object({
  credential: z.string().min(1),
  branchId: z.string().uuid(),
  mode: z.enum(['AUTO', 'CHECK_IN_ONLY', 'CHECK_OUT_ONLY']).default('AUTO'),
  idempotencyKey: z.string().min(1).max(128),
  workstationId: z.string().max(128).optional(),
});

type ScanBodyType = z.infer<typeof ScanBody>;

export const POST = withHandler<ScanBodyType>({
  bodySchema: ScanBody,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const result = await processScan({
      token: body.credential,
      branchId: body.branchId,
      mode: body.mode,
      idempotencyKey: body.idempotencyKey,
      operatorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      workstationId: body.workstationId ?? null,
    });
    return { data: result, status: result.ok ? 200 : 200 };
  },
});
