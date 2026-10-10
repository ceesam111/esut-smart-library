import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES, LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { resolveTenant } from '@/server/tenant/resolveTenant';

const BranchBody = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  location: z.string().max(300).optional(),
  capacity: z.number().int().min(0).max(100000),
  capacityMode: z.enum(['informational', 'warning', 'enforced']).default('informational'),
  warnThresholdPct: z.number().int().min(0).max(100).default(80),
  active: z.boolean().default(true),
  reason: z.string().max(500).optional(),
});
type BranchBodyType = z.infer<typeof BranchBody>;

export const GET = withHandler({
  async handler({ request }) {
    const ctx = await requireRole(request, [...LIBRARY_ADMIN_ROLES]);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('library_branches')
      .select('id, code, name, location, timezone, capacity, capacity_mode, warn_threshold_pct, active, created_at, updated_at')
      .eq('tenant_id', tenant.tenantId)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return { data: data ?? [] };
  },
});

export const POST = withHandler<BranchBodyType>({
  bodySchema: BranchBody,
  async handler({ body, request }) {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    const payload = {
      code: body.code,
      name: body.name,
      location: body.location ?? null,
      capacity: body.capacity,
      capacity_mode: body.capacityMode,
      warn_threshold_pct: body.warnThresholdPct,
      active: body.active,
    };

    let branchId: string;
    let before: Record<string, unknown> | null = null;

    if (body.id) {
      const { data: existing } = await supabase
        .from('library_branches')
        .select('id, code, name, location, capacity, capacity_mode, warn_threshold_pct, active')
        .eq('id', body.id)
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();
      if (!existing) return { data: { ok: false, error: 'BRANCH_NOT_FOUND' }, status: 404 };
      before = existing as Record<string, unknown>;

      const { data: updated, error } = await supabase
        .from('library_branches')
        .update(payload)
        .eq('id', body.id)
        .eq('tenant_id', tenant.tenantId)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      branchId = updated.id;
    } else {
      const { data: created, error } = await supabase
        .from('library_branches')
        .insert({ ...payload, tenant_id: tenant.tenantId })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') return { data: { ok: false, error: 'DUPLICATE_CODE' }, status: 409 };
        throw new Error(error.message);
      }
      branchId = created.id;
    }

    await supabase.from('library_branch_capacity_history').insert({
      tenant_id: tenant.tenantId,
      branch_id: branchId,
      capacity: body.capacity,
      capacity_mode: body.capacityMode,
      effective_from: new Date().toISOString(),
      changed_by: ctx.user.id,
      reason: body.reason ?? null,
    });

    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: body.id ? 'access.branch_updated' : 'access.branch_created',
      entityType: 'library_branches',
      entityId: branchId,
      beforeData: before,
      afterData: payload,
      metadata: { reason: body.reason ?? null },
    });

    return { data: { ok: true, id: branchId }, status: body.id ? 200 : 201 };
  },
});
