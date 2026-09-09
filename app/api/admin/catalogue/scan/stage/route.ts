import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { stageScannedCatalogueRow } from '@/server/catalogue/stageScan';
import { withHandler } from '@/server/api/withHandler';

const scanStageSchema = z.object({ source: z.enum(['manual', 'scan']).optional(), row: z.record(z.unknown()).optional() }).passthrough();

export const POST = withHandler({
  bodySchema: scanStageSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof scanStageSchema>;
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const source = parsed.source === 'manual' ? 'manual' : 'scan';
    const result = await stageScannedCatalogueRow({ uploadedBy: ctx.user.id, source, row: parsed.row ?? {} });
    return { data: result, status: 201 };
  },
});
