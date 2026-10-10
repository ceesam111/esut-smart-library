import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const RegisterBody = z.object({
  fullName: z.string().min(2).max(200),
  organization: z.string().max(200).optional(),
  purpose: z.string().max(300).optional(),
  hostDepartment: z.string().max(200).optional(),
  contactEmail: z.string().email().max(320).optional().or(z.literal('')),
  contactPhone: z.string().max(32).optional(),
});
type RegisterBodyType = z.infer<typeof RegisterBody>;

export const GET = withHandler({
  async handler({ request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const [{ data: visitors }, { data: passes }] = await Promise.all([
      supabase.from('access_visitors').select('id, full_name, organization, purpose, host_department, created_at').eq('tenant_id', tenant.tenantId).order('created_at', { ascending: false }).limit(100),
      supabase
        .from('access_visitor_passes')
        .select('id, visitor_id, branch_id, valid_from, valid_until, status, issued_by, created_at, access_visitors(full_name), library_branches(name)')
        .eq('tenant_id', tenant.tenantId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    return { data: { visitors: visitors ?? [], passes: passes ?? [] } };
  },
});

export const POST = withHandler<RegisterBodyType>({
  bodySchema: RegisterBody,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('access_visitors')
      .insert({
        tenant_id: tenant.tenantId,
        full_name: body.fullName,
        organization: body.organization || null,
        purpose: body.purpose || null,
        host_department: body.hostDepartment || null,
        contact_email: body.contactEmail || null,
        contact_phone: body.contactPhone || null,
        created_by: ctx.user.id,
      })
      .select('id, full_name')
      .single();
    if (error) throw new Error(error.message);

    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'visitor.registered',
      entityType: 'access_visitors',
      entityId: data.id,
      afterData: { full_name: body.fullName, organization: body.organization ?? null },
      metadata: { source: 'api' },
    });

    return { data: { ok: true, visitorId: data.id, fullName: data.full_name }, status: 201 };
  },
});
