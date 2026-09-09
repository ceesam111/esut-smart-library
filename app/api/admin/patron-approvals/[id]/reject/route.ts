import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES, GLOBAL_ADMIN_ROLES, hasAnyRole } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { writeAuditLog } from '@/server/audit/writeAuditLog';

async function canRejectPatron(actorUserId: string, actorRoles: string[], patron: { preferred_branch: string | null; faculty_name: string | null }) {
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
    if (!(await canRejectPatron(ctx.user.id, ctx.roles, before))) throw new Error('Forbidden.');

    const body = await request.json().catch(() => ({}));
    const { data: patron, error } = await supabase
      .from('patrons')
      .update({ status: 'suspended' })
      .eq('id', params.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    await writeAuditLog({
      tenantId: patron.tenant_id,
      actorUserId: ctx.user.id,
      actorRole: ctx.primaryRole,
      action: 'patron_registration_rejected',
      entityType: 'patrons',
      entityId: patron.id,
      beforeData: before,
      afterData: patron,
      metadata: { decisionNote: body.decisionNote ?? null },
    });

    return NextResponse.json({ patron });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 400 });
  }
}
