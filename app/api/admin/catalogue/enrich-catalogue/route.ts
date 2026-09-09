import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { enrichCatalogueRow } from '@/server/catalogue/enrichCatalogue';
import { normalizeCatalogueRow } from '@/server/catalogue/importValidation';
import { withHandler } from '@/server/api/withHandler';

const enrichSchema = z.object({ row: z.record(z.unknown()).optional() }).passthrough();

export const POST = withHandler({
  bodySchema: enrichSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof enrichSchema>;
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const row = normalizeCatalogueRow(parsed.row ?? parsed);
    const result = await enrichCatalogueRow(row);
    return { data: result };
  },
});
