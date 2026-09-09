import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { createSignedLibraryDownload } from '@/server/storage/libraryObjects';
import { withHandler } from '@/server/api/withHandler';

const signedDownloadSchema = z.object({ objectId: z.string().uuid() });

export const POST = withHandler({
  bodySchema: signedDownloadSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof signedDownloadSchema>;
    const ctx = await requireUser(request);
    const result = await createSignedLibraryDownload(parsed.objectId, ctx.user.id);
    return { data: result };
  },
});
