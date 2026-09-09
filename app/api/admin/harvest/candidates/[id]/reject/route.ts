import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { rejectResourceCandidate } from '@/server/resources/candidateService';
import { withHandler } from '@/server/api/withHandler';

const paramsSchema = z.object({ id: z.string().uuid() });
const rejectSchema = z.object({ reason: z.string().max(500).optional() }).default({});

export const POST = withHandler({
  paramsSchema,
  bodySchema: rejectSchema,
  handler: async ({ request, params, body }) => {
    const parsedParams = params as z.infer<typeof paramsSchema>;
    const parsedBody = (body ?? {}) as z.infer<typeof rejectSchema>;
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const candidate = await rejectResourceCandidate({ candidateId: parsedParams.id, actorUserId: ctx.user.id, actorRole: ctx.primaryRole, reason: parsedBody.reason });
    return { data: { candidate } };
  },
});
