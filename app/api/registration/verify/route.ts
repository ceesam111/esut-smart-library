import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getRegistrationPolicy } from '@/server/registration/policy';
import { isPrivilegedSelfRegistrationRole, policyRequiresBranchApproval } from '@/lib/registrationPolicy';

export const dynamic = 'force-dynamic';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getPublicOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '');

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (forwardedHost && !/^(0\.0\.0\.0|localhost|127\.0\.0\.1)(:|$)/.test(forwardedHost)) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`;
  }

  return 'https://esutlibrary.edu.ng';
}

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const redirect = (status: 'verified' | 'invalid' | 'expired') => NextResponse.redirect(new URL(`/login?registration=${status}`, getPublicOrigin(request)));
  if (!token) return redirect('invalid');

  try {
    const supabase = getSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from('registration_verification_tokens')
      .select('id,user_id,patron_id,expires_at,used_at')
      .eq('token_hash', hashToken(token))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.used_at) return redirect('invalid');
    if (new Date(row.expires_at).getTime() < Date.now()) return redirect('expired');

    const { data: patron, error: patronError } = await supabase.from('patrons').select('*').eq('id', row.patron_id).single();
    if (patronError) throw new Error(patronError.message);

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(row.user_id, { email_confirm: true });
    if (authUpdateError) throw new Error(authUpdateError.message);

    const policy = await getRegistrationPolicy();
    const now = new Date().toISOString();
    const privileged = isPrivilegedSelfRegistrationRole(patron.account_role);
    const update = policyRequiresBranchApproval(policy) || privileged
      ? { email_verified_at: now, main_library_access_at: privileged ? null : now }
      : { email_verified_at: now, main_library_access_at: now, status: 'active', approved_at: now };

    const { data: updated, error: updateError } = await supabase.from('patrons').update(update).eq('id', patron.id).select('*').single();
    if (updateError) throw new Error(updateError.message);
    await supabase.from('registration_verification_tokens').update({ used_at: now }).eq('id', row.id);
    if (!policyRequiresBranchApproval(policy) && !privileged) await grantPatronRole(supabase, updated);

    return redirect('verified');
  } catch {
    return redirect('invalid');
  }
}
