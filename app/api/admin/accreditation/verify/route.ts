import { z } from 'zod';
import type { VerifyResponseData } from '@/lib/accreditationApi';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { requireRole } from '@/server/auth/requireRole';
import { withHandler } from '@/server/api/withHandler';
import { runLinkVerification } from '@/server/accreditation/verification';

const verifyBodySchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});

export const POST = withHandler({
  bodySchema: verifyBodySchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof verifyBodySchema>;
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const summary = await runLinkVerification({ limit: parsed.limit });
    const response: VerifyResponseData = {
      checked: summary.checked,
      verified: summary.verified,
      failed: summary.failed,
      unverifiable: summary.unverifiable,
    };
    return { data: response };
  },
});
