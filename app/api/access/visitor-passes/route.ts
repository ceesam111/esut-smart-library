import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { issueVisitorPass } from '@/server/slaas/visitorPasses';
import { resolveTenant, DEFAULT_TENANT_ID } from '@/server/tenant/resolveTenant';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';

const Body = z.object({
  visitorId: z.string().uuid(),
  branchId: z.string().uuid(),
  validForMinutes: z.number().int().min(5).max(24 * 60).default(60),
});

type BodyType = z.infer<typeof Body>;

const RevokeBody = z.object({
  passId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

type RevokeBodyType = z.infer<typeof RevokeBody>;

export const POST = withHandler<BodyType>({
  bodySchema: Body,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const result = await issueVisitorPass({
      visitorId: body.visitorId,
      branchId: body.branchId,
      validForMinutes: body.validForMinutes,
      issuedBy: ctx.user.id,
      actorRole: ctx.primaryRole,
      tenantId: tenant.tenantId,
    });
    return { data: result, status: result.ok ? 201 : 400 };
  },
});

export const PATCH = withHandler<RevokeBodyType>({
  bodySchema: RevokeBody,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    const { data: existing } = await supabase
      .from('access_visitor_passes')
      .select('id, status, visitor_id, branch_id')
      .eq('id', body.passId)
      .maybeSingle();
    if (!existing) return { data: { ok: false, error: 'PASS_NOT_FOUND' }, status: 404 };
    if (existing.status === 'revoked') return { data: { ok: true, alreadyRevoked: true, passId: existing.id } };

    const { error } = await supabase
      .from('access_visitor_passes')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', body.passId);
    if (error) throw new Error(error.message);

    await supabase.from('access_events').insert({
      tenant_id: tenant.tenantId || DEFAULT_TENANT_ID,
      visitor_id: existing.visitor_id,
      branch_id: existing.branch_id,
      event_type: 'VISITOR_PASS_REVOKED',
      event_source: 'manual',
      metadata: { pass_id: existing.id, operator: ctx.user.id, reason: body.reason ?? null },
    });

    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'visitor.pass_revoked',
      entityType: 'access_visitor_passes',
      entityId: existing.id,
      beforeData: { status: existing.status },
      afterData: { status: 'revoked' },
      metadata: { reason: body.reason ?? null },
    });

    return { data: { ok: true, passId: existing.id }, status: 200 };
  },
});
