import { supabase } from '@/lib/supabase';
import { institutionConfig } from '@config/institution.config';
import { sendWelcomeEmail } from '@/lib/email';
import type { AppRole } from '@/config/roles.config';
import {
  DEFAULT_REGISTRATION_POLICY,
  isPrivilegedSelfRegistrationRole,
  parseRegistrationPolicy,
  policyRequiresBranchApproval,
  policyRequiresEmailVerification,
  type RegistrationAccessPolicy,
} from '@/lib/registrationPolicy';
import { verifyTurnstileClient } from '@/lib/turnstileClient';

export interface RegisterResult {
  ok: boolean;
  error?: string;
  policy?: RegistrationAccessPolicy;
  requiresEmailVerification?: boolean;
  requiresBranchApproval?: boolean;
  directAccess?: boolean;
  verificationEmailSent?: boolean;
  /** Friendly, non-blocking reason the verification email was not sent. */
  emailNotice?: string;
}

/**
 * Creates the auth user, then creates the patron profile through a
 * server-side endpoint (service role). The client-side insert path is
 * unusable because email confirmation means signUp() returns no session,
 * so any direct `patrons` insert would run as `anon` and be rejected by RLS.
 *
 * Email delivery failures (including provider rate limits) never fail the
 * registration itself — they are reported through `emailNotice`.
 */
export async function registerAccount(opts: {
  role: AppRole;
  email: string;
  password: string;
  fullName: string;
  patronCategory: string;
  profile: Record<string, unknown>;
  turnstileToken?: string | null;
}): Promise<RegisterResult> {
  try {
    await verifyTurnstileClient(opts.turnstileToken ?? null, 'registration');
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Please complete the security verification before submitting.',
    };
  }

  try {
    return await runRegistration(opts);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message
        ? error.message
        : 'Registration failed due to an unexpected error. Please try again.',
    };
  }
}

async function runRegistration(opts: {
  role: AppRole;
  email: string;
  password: string;
  fullName: string;
  patronCategory: string;
  profile: Record<string, unknown>;
  turnstileToken?: string | null;
}): Promise<RegisterResult> {
  const policy = await fetch('/api/registration/policy')
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => parseRegistrationPolicy(json?.policy))
    .catch(() => DEFAULT_REGISTRATION_POLICY);
  const privileged = isPrivilegedSelfRegistrationRole(opts.role);
  const requiresEmailVerification = policyRequiresEmailVerification(policy);
  const requiresBranchApproval = policyRequiresBranchApproval(policy) || privileged;
  const now = new Date().toISOString();
  const directAccess = !requiresEmailVerification && !requiresBranchApproval;

  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: { data: { full_name: opts.fullName } },
  });

  let userId = authData?.user?.id ?? null;

  if (authErr || !userId) {
    const message = (authErr?.message || '').toLowerCase();
    const alreadyRegistered =
      message.includes('already registered') ||
      message.includes('already been registered') ||
      authErr?.status === 422;

    if (!alreadyRegistered) {
      return { ok: false, error: authErr?.message ?? 'Registration failed. Please try again.' };
    }

    // The account already exists — still ensure the patron profile exists so a
    // partial earlier attempt (signup succeeded, profile failed) can recover.
    const signIn = await supabase.auth.signInWithPassword({ email: opts.email, password: opts.password });
    if (signIn.error || !signIn.data.user) {
      return {
        ok: false,
        error: 'An account with this email already exists. Please sign in, or use a different email address.',
      };
    }
    userId = signIn.data.user.id;
  }

  const profilePayload = { ...opts.profile, full_name: opts.fullName };

  const profileRes = await fetch('/api/registration/create-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      email: opts.email,
      fullName: opts.fullName,
      role: opts.role,
      patronCategory: opts.patronCategory,
      status: directAccess ? 'active' : 'pending',
      approvedAt: directAccess ? now : null,
      emailVerifiedAt: requiresEmailVerification ? null : now,
      mainLibraryAccessAt: directAccess ? now : null,
      branchApprovedAt: directAccess ? now : null,
      registrationPolicy: policy,
      profile: profilePayload,
    }),
  }).catch(() => null);

  if (!profileRes) {
    return { ok: false, error: 'Could not reach the registration service. Please check your connection and try again.' };
  }

  const profileJson = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok || profileJson.ok === false) {
    return { ok: false, error: profileJson.error || 'Your library profile could not be created. Please try again.' };
  }

  // Email delivery is best-effort: registration succeeds regardless.
  let verificationEmailSent = false;
  let emailNotice: string | undefined;

  if (requiresEmailVerification) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/registration/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ userId, email: opts.email }),
    }).catch(() => null);

    if (res?.ok) {
      const json = await res.json().catch(() => ({}));
      verificationEmailSent = !!json.sent;
      if (!json.sent && json.reason === 'rate_limited') {
        emailNotice = 'The email service is temporarily rate-limited. Your account was created — please request the verification link again in a few minutes from the sign-in page.';
      } else if (!json.sent && json.reason === 'send_failed') {
        emailNotice = 'Your account was created, but the verification email could not be sent right now. You can request it again shortly from the sign-in page.';
      } else if (!json.sent && json.verified) {
        verificationEmailSent = true;
      }
    } else {
      const json = await res?.json().catch(() => ({}));
      if (json?.reason === 'rate_limited') {
        emailNotice = 'The email service is temporarily rate-limited. Your account was created — please request the verification link again in a few minutes from the sign-in page.';
      } else {
        emailNotice = 'Your account was created, but the verification email could not be sent right now. You can request it again shortly from the sign-in page.';
      }
    }
  } else {
    sendWelcomeEmail({
      email: opts.email,
      full_name: opts.fullName,
      patron_id: String(profileJson.patronId || institutionConfig.institutionCode || ''),
      faculty_name: (opts.profile.faculty_name as string) || undefined,
    }).catch(() => undefined);
  }

  return {
    ok: true,
    policy,
    requiresEmailVerification,
    requiresBranchApproval,
    directAccess,
    verificationEmailSent,
    emailNotice,
  };
}
