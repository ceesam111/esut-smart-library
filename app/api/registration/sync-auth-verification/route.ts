import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getRegistrationPolicy } from '@/server/registration/policy';
import { isPrivilegedSelfRegistrationRole, policyRequiresBranchApproval } from '@/lib/registrationPolicy';

export const dynamic = 'force-dynamic';

async function grantPatronRole(supabase: ReturnType<typeof getSupabaseAdminClient>, patron: any) {
  const role = patron.account_role as string | null;
  if (!role || isPrivilegedSelfRegistrationRole(role)) return;

  const { error } = await supabase.from('user_roles').insert({
    user_id: patron.user_id,
    role,
    branch_code: patron.preferred_branch,
    faculty_code: null,
    tenant_id: patron.tenant_id,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireUser(request);
    const supabase = getSupabaseAdminClient();

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(ctx.user.id);
    if (authError || !authUser.user) throw new Error(authError?.message ?? 'Auth user not found.');

    if (!authUser.user.email_confirmed_at) {
      return NextResponse.json({ synced: false, reason: 'auth_email_not_confirmed' });
    }

    const { data: patron, error: patronError } = await supabase
      .from('patrons')
      .select('*')
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (patronError) throw new Error(patronError.message);
    if (!patron) return NextResponse.json({ synced: false, reason: 'no_patron_profile' });
    if (patron.email_verified_at && patron.main_library_access_at) {
      return NextResponse.json({ synced: false, alreadyVerified: true });
    }

    const policy = await getRegistrationPolicy();
    const now = new Date().toISOString();
    const privileged = isPrivilegedSelfRegistrationRole(patron.account_role);
    const update = policyRequiresBranchApproval(policy) || privileged
      ? { email_verified_at: patron.email_verified_at ?? now, main_library_access_at: privileged ? patron.main_library_access_at : (patron.main_library_access_at ?? now) }
      : { email_verified_at: patron.email_verified_at ?? now, main_library_access_at: patron.main_library_access_at ?? now, status: 'active', approved_at: patron.approved_at ?? now };

    const { data: updated, error: updateError } = await supabase
      .from('patrons')
      .update(update)
      .eq('id', patron.id)
      .select('*')
      .single();
    if (updateError) throw new Error(updateError.message);

    if (!policyRequiresBranchApproval(policy) && !privileged) await grantPatronRole(supabase, updated);

    return NextResponse.json({ synced: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
