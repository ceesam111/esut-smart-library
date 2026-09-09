import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { createSignedLibraryUpload } from '@/server/storage/libraryObjects';
import { withHandler } from '@/server/api/withHandler';

const signedUploadSchema = z.object({
  area: z.enum(['repository', 'catalogue', 'exports']),
  filename: z.string().min(1).max(240),
  contentType: z.string().max(160).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: z.string().nullable().optional(),
  visibility: z.enum(['private', 'tenant', 'public']).optional(),
  linkedEntityType: z.string().nullable().optional(),
  linkedEntityId: z.string().uuid().nullable().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  recordId: z.string().optional(),
});

export const POST = withHandler({
  bodySchema: signedUploadSchema,
  handler: async ({ request, body }) => {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const result = await createSignedLibraryUpload(body, ctx.user.id);
    return { data: result, status: 201 };
  },
});
