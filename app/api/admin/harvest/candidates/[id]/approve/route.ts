import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { promoteCandidateToCatalogue } from '@/server/resources/candidateService';
import { withHandler } from '@/server/api/withHandler';

const paramsSchema = z.object({ id: z.string().uuid() });

export const POST = withHandler({
  paramsSchema,
  handler: async ({ request, params }) => {
    const parsed = params as z.infer<typeof paramsSchema>;
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const result = await promoteCandidateToCatalogue({ candidateId: parsed.id, actorUserId: ctx.user.id, actorRole: ctx.primaryRole });
    return { data: result };
  },
});
