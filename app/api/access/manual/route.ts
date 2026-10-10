import { z } from 'zod';
import { withHandler } from '@/server/api/withHandler';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { captureEvent } from '@/server/analytics/eventCapture';
import { resolveTenant } from '@/server/tenant/resolveTenant';
import { getCurrentOccupancy, getBranchById } from '@/server/slaas/repository';
import { getCurrentAcademicPeriod } from '@/server/slaas/academicPeriod';

const ManualBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('search'),
    query: z.string().min(2).max(200),
  }),
  z.object({
    action: z.literal('check_in'),
    patronId: z.string().uuid(),
    branchId: z.string().uuid(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('check_out'),
    visitId: z.string().uuid(),
    branchId: z.string().uuid(),
    reason: z.string().max(500).optional(),
  }),
]);
type ManualBodyType = z.infer<typeof ManualBody>;

export const POST = withHandler<ManualBodyType>({
  bodySchema: ManualBody,
  async handler({ body, request }) {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const tenant = await resolveTenant(ctx.user.id);
    const supabase = getSupabaseAdminClient();

    if (body.action === 'search') {
      const like = `%${body.query.replace(/[%_]/g, '')}%`;
      const { data, error } = await supabase
        .from('patrons')
        .select('id, full_name, patron_category, department, faculty_code, status, patron_id, matric_number, staff_id')
        .eq('tenant_id', tenant.tenantId)
        .or(`full_name.ilike.${like},patron_id.ilike.${like},matric_number.ilike.${like},staff_id.ilike.${like}`)
        .limit(20);
      if (error) throw new Error(error.message);

      const results = await Promise.all((data ?? []).map(async (p) => {
        const { count } = await supabase
          .from('access_visits')
          .select('id', { count: 'exact', head: true })
          .eq('patron_id', p.id)
          .eq('status', 'checked_in');
        return { ...p, currentlyInside: (count ?? 0) > 0 };
      }));
      return { data: { results } };
    }

    if (body.action === 'check_in') {
      const branch = await getBranchById(body.branchId);
      if (!branch || !branch.active || branch.tenant_id !== tenant.tenantId) {
        return { data: { ok: false, error: 'BRANCH_NOT_FOUND' }, status: 404 };
      }

      const { data: identity } = await supabase
        .from('library_access_identities')
        .select('id')
        .eq('patron_id', body.patronId)
        .eq('tenant_id', tenant.tenantId)
        .eq('status', 'active')
        .maybeSingle();
      if (!identity) return { data: { ok: false, error: 'NO_ACTIVE_IDENTITY' }, status: 409 };

      const { data: patron } = await supabase
        .from('patrons')
        .select('id, status, full_name, patron_category, department, faculty_code')
        .eq('id', body.patronId)
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();
      if (!patron) return { data: { ok: false, error: 'USER_NOT_FOUND' }, status: 404 };
      if (patron.status !== 'active') return { data: { ok: false, error: 'INACTIVE_ACCOUNT' }, status: 403 };

      const period = await getCurrentAcademicPeriod();
      const { data: inserted, error } = await supabase
        .from('access_visits')
        .insert({
          tenant_id: tenant.tenantId,
          access_identity_id: identity.id,
          branch_id: body.branchId,
          patron_id: body.patronId,
          status: 'checked_in',
          entry_method: 'manual',
          academic_session: period.session,
          semester: period.semester,
        })
        .select('id, status, checked_in_at, checked_out_at, duration_minutes')
        .single();
      if (error) {
        if (error.code === '23505') return { data: { ok: false, error: 'ALREADY_INSIDE' }, status: 409 };
        throw new Error(error.message);
      }

      await supabase.from('access_events').insert({
        tenant_id: tenant.tenantId,
        access_identity_id: identity.id,
        visit_id: inserted.id,
        patron_id: body.patronId,
        branch_id: body.branchId,
        event_type: 'MANUAL_CHECK_IN',
        event_source: 'manual',
        metadata: { operator: ctx.user.id, reason: body.reason ?? null },
      });
      await writeAuditLog({
        tenantId: tenant.tenantId,
        actorUserId: ctx.user.id,
        actorRole: ctx.primaryRole,
        action: 'access.manual_check_in',
        entityType: 'access_visits',
        entityId: inserted.id,
        afterData: { patron_id: body.patronId, branch_id: body.branchId },
        metadata: { reason: body.reason ?? null, source: 'manual' },
      });
      await captureEvent({
        event_type: 'library_visit',
        user_id: body.patronId,
        event_category: 'ACCESS',
        entity_type: 'access_visit',
        entity_id: inserted.id,
        metadata: { action: 'manual_check_in', branch_id: body.branchId },
      });
      const occupancy = await getCurrentOccupancy(body.branchId);
      return {
        data: {
          ok: true,
          event: 'CHECK_IN',
          visit: inserted,
          identity: {
            patronId: patron.id,
            fullName: patron.full_name,
            patronCategory: patron.patron_category,
            department: patron.department,
            facultyCode: patron.faculty_code,
          },
          occupancy,
          timestamp: inserted.checked_in_at,
        },
        status: 201,
      };
    }

    const outBranch = await getBranchById(body.branchId);
    if (!outBranch || outBranch.tenant_id !== tenant.tenantId) {
      return { data: { ok: false, error: 'BRANCH_NOT_FOUND' }, status: 404 };
    }

    const { data: visit } = await supabase
      .from('access_visits')
      .select('id, status, checked_in_at, patron_id')
      .eq('id', body.visitId)
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();
    if (!visit) return { data: { ok: false, error: 'VISIT_NOT_FOUND' }, status: 404 };
    if (visit.status !== 'checked_in') return { data: { ok: false, error: 'NOT_CURRENTLY_INSIDE' }, status: 409 };

    const checkedOutAt = new Date().toISOString();
    const duration = Math.max(0, Math.round((Date.now() - new Date(visit.checked_in_at).getTime()) / 60000));
    const { data: updated, error: updateError } = await supabase
      .from('access_visits')
      .update({ status: 'checked_out', checked_out_at: checkedOutAt, exit_method: 'manual', duration_minutes: duration })
      .eq('id', body.visitId)
      .eq('status', 'checked_in')
      .select('id, status, checked_in_at, checked_out_at, duration_minutes')
      .single();
    if (updateError) {
      if (updateError.code === 'PGRST116') return { data: { ok: false, error: 'ALREADY_CHECKED_OUT' }, status: 409 };
      throw new Error(updateError.message);
    }

    const { data: identityRow } = await supabase
      .from('access_visits')
      .select('access_identity_id')
      .eq('id', body.visitId)
      .maybeSingle();

    await supabase.from('access_events').insert({
      tenant_id: tenant.tenantId,
      access_identity_id: identityRow?.access_identity_id ?? null,
      visit_id: updated.id,
      patron_id: visit.patron_id,
      branch_id: body.branchId,
      event_type: 'MANUAL_CHECK_OUT',
      event_source: 'manual',
      metadata: { operator: ctx.user.id, reason: body.reason ?? null, duration_minutes: duration },
    });
    await writeAuditLog({
      tenantId: tenant.tenantId,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'access.manual_check_out',
      entityType: 'access_visits',
      entityId: updated.id,
      beforeData: { status: 'checked_in' },
      afterData: { status: 'checked_out', duration_minutes: duration },
      metadata: { reason: body.reason ?? null, source: 'manual' },
    });

    const occupancy = await getCurrentOccupancy(body.branchId);
    return {
      data: {
        ok: true,
        event: 'CHECK_OUT',
        visit: updated,
        occupancy,
        timestamp: checkedOutAt,
      },
    };
  },
});
