import { randomBytes, createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getBearerToken, requireUser } from '@/server/auth/requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getRegistrationPolicy } from '@/server/registration/policy';
import {
  isPrivilegedSelfRegistrationRole,
  policyRequiresBranchApproval,
  policyRequiresEmailVerification,
  type RegistrationAccessPolicy,
} from '@/lib/registrationPolicy';
import { sendRegistrationVerificationEmailServer } from '@/server/email/resend';

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

async function grantPatronRole(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  patron: { user_id: string; account_role: string | null; preferred_branch: string | null; tenant_id: string | null },
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

/**
 * Email delivery failed (rate limit, provider down, key missing). Product
 * rule: registration must still succeed and the user must be able to sign in,
 * so verification is completed server-side instead of waiting for a link that
 * cannot arrive. The same status transitions as clicking the emailed link are
 * applied — approval rules for privileged/branch accounts are unchanged.
 */
async function autoVerifyRegistration(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  patron: {
    id: string;
    account_role: string | null;
    email_verified_at: string | null;
    main_library_access_at: string | null;
    approved_at: string | null;
    preferred_branch: string | null;
    tenant_id: string | null;
  },
  policy: RegistrationAccessPolicy,
) {
  const { error: confirmErr } = await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
  if (confirmErr) throw new Error(confirmErr.message);

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
}

export async function POST(request: NextRequest) {
  try {
    const policy = await getRegistrationPolicy();
    if (!policyRequiresEmailVerification(policy)) return NextResponse.json({ sent: false, policy });

    let userId: string | undefined;
    let email: string | undefined;

    if (getBearerToken(request)) {
      const ctx = await requireUser(request);
      userId = ctx.user.id;
      email = ctx.user.email;
    } else {
      const body = await request.json().catch(() => ({}));
      userId = typeof body.userId === 'string' ? body.userId : undefined;
      email = typeof body.email === 'string' ? body.email.toLowerCase() : undefined;
    }

    if (!userId || !email) throw new Error('Authentication or registration context required.');

    const supabase = getSupabaseAdminClient();
    const { data: patron, error } = await supabase
      .from('patrons')
      .select('id,user_id,email,full_name,email_verified_at,account_role,main_library_access_at,approved_at,preferred_branch,tenant_id')
      .eq('user_id', userId)
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!patron) throw new Error('No registration profile found.');
    if (patron.email_verified_at) return NextResponse.json({ sent: false, verified: true, policy });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await supabase.from('registration_verification_tokens').insert({
      user_id: userId,
      patron_id: patron.id,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    });
    if (tokenError) throw new Error(tokenError.message);

    const origin = getPublicOrigin(request);
    try {
      await sendRegistrationVerificationEmailServer({
        email: patron.email,
        full_name: patron.full_name,
        verificationLink: `${origin}/api/registration/verify?token=${encodeURIComponent(token)}`,
        expiresAt,
      });
      return NextResponse.json({ sent: true, expiresAt, policy });
    } catch (emailError) {
      // The verification token was created successfully. Email delivery is
      // best-effort: provider rate limits must NOT block registration.
      const code = (emailError as { code?: string })?.code;
      const reason = code === 'rate_limited' ? 'rate_limited'
        : code === 'not_configured' ? 'not_configured'
        : 'send_failed';

      // Email cannot be delivered right now, so verification is completed
      // immediately and the user can sign in without a link.
      try {
        await autoVerifyRegistration(supabase, userId, patron, policy);
        return NextResponse.json(
          { sent: false, autoVerified: true, reason, policy },
          { status: 202 },
        );
      } catch {
        return NextResponse.json(
          { sent: false, reason, expiresAt, policy, retryable: true },
          { status: 202 },
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
