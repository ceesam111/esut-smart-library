import { z } from 'zod';
import { programmeBySlug } from '@/data/accreditation/programmes';
import type { SyncResponseData } from '@/lib/accreditationApi';
import { ApiError } from '@/server/api/errors';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { requireRole } from '@/server/auth/requireRole';
import { withHandler } from '@/server/api/withHandler';
import { accreditationProviderById } from '@/server/accreditation/providers';
import { runAccreditationSync } from '@/server/accreditation/sync';

const syncBodySchema = z.object({
  programme: z.string().min(1).optional(),
  providers: z.array(z.string().min(1)).max(20).optional(),
  maxPerProgrammePerProvider: z.number().int().min(1).max(200).optional(),
});

export const POST = withHandler({
  bodySchema: syncBodySchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof syncBodySchema>;
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    if (parsed.programme && !programmeBySlug(parsed.programme)) {
      throw new ApiError('BAD_REQUEST', `Unknown programme: ${parsed.programme}`, 400);
    }
    for (const id of parsed.providers ?? []) {
      if (!accreditationProviderById(id)) {
        throw new ApiError('BAD_REQUEST', `Unknown provider: ${id}`, 400);
      }
    }
    const outcome = await runAccreditationSync({
      programmeSlugs: parsed.programme ? [parsed.programme] : undefined,
      providerIds: parsed.providers,
      maxPerProgrammePerProvider: parsed.maxPerProgrammePerProvider,
    });
    const response: SyncResponseData = {
      runs: outcome.summaries,
      requestsMade: outcome.requestsMade,
      elapsedMs: outcome.elapsedMs,
    };
    return { data: response };
  },
});
