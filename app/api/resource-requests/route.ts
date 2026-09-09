import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { withHandler } from '@/server/api/withHandler';
import { ApiError } from '@/server/api/errors';

const requestSchema = z.object({
  itemTitle: z.string().max(300).optional().nullable(),
  requestText: z.string().min(3).max(2000),
  reason: z.string().min(2).max(200),
  course: z.string().max(100).optional().nullable(),
  neededByDate: z.string().max(30).optional().nullable(),
  preferredFormat: z.string().min(2).max(100),
});

export const POST = withHandler({
  bodySchema: requestSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof requestSchema>;
    const ctx = await requireUser(request);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    const { data: patron, error: patronError } = await supabase
      .from('patrons')
      .select('id, full_name, email, faculty_code, faculty_name, department')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (patronError) throw new Error(patronError.message);
    if (!patron) throw new ApiError('BAD_REQUEST', 'No patron account found. Please complete registration first.', 400);

    const { data, error } = await supabase
      .from('resource_requests')
      .insert({
        tenant_id: tenant.tenantId,
        patron_id: patron.id,
        patron_name: patron.full_name,
        patron_email: patron.email,
        patron_faculty: patron.faculty_code || patron.faculty_name,
        patron_department: patron.department,
        item_title: parsed.itemTitle?.trim() || null,
        request_text: parsed.requestText.trim(),
        reason: parsed.reason,
        course: parsed.course?.trim() || null,
        needed_by_date: parsed.neededByDate?.trim() || null,
        preferred_format: parsed.preferredFormat,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { data: { request: data } };
  },
});
