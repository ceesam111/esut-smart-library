import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { withHandler } from '@/server/api/withHandler';
import { ApiError } from '@/server/api/errors';

const externalRequestSchema = z.object({ candidateId: z.string().uuid(), reason: z.string().max(500).optional() });

export const POST = withHandler({
  bodySchema: externalRequestSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof externalRequestSchema>;
    const ctx = await requireUser(request);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data: patron, error: patronError } = await supabase.from('patrons').select('*').eq('user_id', ctx.user.id).maybeSingle();
    if (patronError) throw new Error(patronError.message);
    if (!patron) throw new ApiError('BAD_REQUEST', 'No patron account found.', 400);
    const { data: candidate, error: candidateError } = await supabase.from('resource_candidates').select('*').eq('tenant_id', tenant.tenantId).eq('id', parsed.candidateId).single();
    if (candidateError) throw new Error(candidateError.message);
    const { data, error } = await supabase.from('resource_requests').insert({
      tenant_id: tenant.tenantId,
      patron_id: patron.id,
      patron_name: patron.full_name,
      patron_email: patron.email,
      patron_faculty: patron.faculty_name,
      patron_department: patron.department,
      resource_candidate_id: candidate.id,
      item_title: candidate.title,
      request_text: `Please review and add this externally discovered resource: ${candidate.title ?? candidate.source_url ?? candidate.source_record_id}`,
      reason: parsed.reason || 'External open-access discovery request',
      preferred_format: candidate.download_url ? 'Digital' : 'Either',
    }).select('*').single();
    if (error) throw new Error(error.message);
    await supabase.from('resource_candidates').update({ requested_count: (candidate.requested_count ?? 0) + 1 }).eq('id', candidate.id);
    return { data: { request: data } };
  },
});
