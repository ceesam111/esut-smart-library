import type { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import {
  isPrivilegedSelfRegistrationRole,
  policyRequiresBranchApproval,
  type RegistrationAccessPolicy,
} from '@/lib/registrationPolicy';

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

export async function grantPatronRole(
  supabase: AdminClient,
  patron: { user_id: string | null; account_role: string | null; preferred_branch: string | null; tenant_id: string | null },
) {
  const role = patron.account_role;
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

export type CompletionResult = 'confirmed_no_profile' | 'completed';

/**
 * Applies the same state transitions as clicking the emailed verification
 * link, for the cases where that link can never arrive (email service down,
 * provider rate limit, mail key missing). Used by
 * `/api/registration/send-verification` and `/api/registration/prove-password`.
 *
 * The auth user is always confirmed; the patron profile, when it exists, is
 * moved to `email_verified_at` and — only when the registration policy does
 * not require approval — to `status='active'` with the patron role granted.
 * Approval rules for privileged/branch accounts are unchanged.
 */
export async function completeEmailVerification(
  supabase: AdminClient,
  userId: string,
  policy: RegistrationAccessPolicy,
): Promise<CompletionResult> {
  const { error: confirmErr } = await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
  if (confirmErr && !/already|confirmed/i.test(confirmErr.message || '')) throw new Error(confirmErr.message);

  const { data: patron, error } = await supabase
    .from('patrons')
    .select('id,user_id,email_verified_at,account_role,main_library_access_at,approved_at,preferred_branch,tenant_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!patron) return 'confirmed_no_profile';

  const privileged = isPrivilegedSelfRegistrationRole(patron.account_role);
  const needsApproval = policyRequiresBranchApproval(policy) || privileged;
  const now = new Date().toISOString();
  const update = needsApproval
    ? {
        email_verified_at: patron.email_verified_at ?? now,
        main_library_access_at: privileged ? patron.main_library_access_at : (patron.main_library_access_at ?? now),
      }
    : {
        email_verified_at: patron.email_verified_at ?? now,
        main_library_access_at: patron.main_library_access_at ?? now,
        status: 'active',
        approved_at: patron.approved_at ?? now,
      };

  const { data: updated, error: updateErr } = await supabase
    .from('patrons')
    .update(update)
    .eq('id', patron.id)
    .select('id, user_id, account_role, preferred_branch, tenant_id')
    .single();
  if (updateErr) throw new Error(updateErr.message);

  if (!needsApproval) await grantPatronRole(supabase, updated);
  return 'completed';
}
