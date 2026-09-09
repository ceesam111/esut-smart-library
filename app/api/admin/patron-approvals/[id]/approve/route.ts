import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES, GLOBAL_ADMIN_ROLES, hasAnyRole } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';
import { getRegistrationPolicy } from '@/server/registration/policy';
import { policyRequiresEmailVerification } from '@/lib/registrationPolicy';

async function canApprovePatron(actorUserId: string, actorRoles: string[], patron: { preferred_branch: string | null; faculty_name: string | null }) {
  if (hasAnyRole(actorRoles, GLOBAL_ADMIN_ROLES)) return true;
  if (!actorRoles.includes('faculty_librarian')) return false;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('branch_code,faculty_code')
    .eq('user_id', actorUserId)
    .eq('role', 'faculty_librarian');
  if (error) throw new Error(error.message);

  return (data ?? []).some((row: { branch_code: string | null; faculty_code: string | null }) => {
    const branchMatches = !!row.branch_code && row.branch_code === patron.preferred_branch;
    const facultyMatches = !!row.faculty_code && row.faculty_code === patron.faculty_name;
    return branchMatches || facultyMatches;
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireRole(request, LIBRARY_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const { data: before, error: beforeError } = await supabase.from('patrons').select('*').eq('id', params.id).single();
    if (beforeError) throw new Error(beforeError.message);
    if (!(await canApprovePatron(ctx.user.id, ctx.roles, before))) throw new Error('Forbidden.');
    const policy = await getRegistrationPolicy();
    if (policyRequiresEmailVerification(policy) && !before.email_verified_at) {
      throw new Error('This registration must verify email before branch approval.');
    }

    const { data: patron, error } = await supabase
      .from('patrons')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: ctx.user.id,
        branch_approved_at: new Date().toISOString(),
        branch_approved_by: ctx.user.id,
        main_library_access_at: before.main_library_access_at ?? new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    const reqRole = patron.account_role as string | null;
    if (reqRole) {
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: patron.user_id,
        role: reqRole,
        branch_code: patron.preferred_branch,
        faculty_code: null,
        tenant_id: patron.tenant_id,
      });
      if (roleError && !/duplicate|unique/i.test(roleError.message)) throw new Error(roleError.message);
    }

    await writeAuditLog({
      tenantId: patron.tenant_id,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'patron_registration_approved',
      entityType: 'patrons',
      entityId: patron.id,
      beforeData: before,
      afterData: patron,
    });

    return NextResponse.json({ patron });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
