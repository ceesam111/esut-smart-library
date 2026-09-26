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

export interface RegisterResult {
  ok: boolean;
  error?: string;
  policy?: RegistrationAccessPolicy;
  requiresEmailVerification?: boolean;
  requiresBranchApproval?: boolean;
  directAccess?: boolean;
  verificationEmailSent?: boolean;
  /**
   * The email service could not deliver the link, so the server completed
   * verification anyway — the user can sign in immediately.
   */
  autoVerified?: boolean;
  /** Friendly, non-blocking reason the verification email was not sent. */
  emailNotice?: string;
}

/**
 * Detects provider-side email rate limiting ("Email rate limit exceeded",
 * 429s, SMTP throttling). These must never fail a registration.
 */
export function isEmailRateLimitError(error: unknown): boolean {
  const e = error as { message?: string; code?: string; status?: number } | null;
  const message = String(e?.message ?? '').toLowerCase();
  const code = String(e?.code ?? '').toLowerCase();
  if (e?.status === 429) return true;
  if (code.includes('rate_limit') || code.includes('rate limit') || code.includes('too_many')) return true;
  return /rate.?limit|too many requests|throttl|try again later|quota exceeded|exceeded a rate limit/i.test(message);
}

type AuthUserFallback =
  | { ok: true; userId: string; receipt?: string }
  | { ok: false; exists?: boolean; error?: string };

/**
 * Last-resort account creation when `auth.signUp()` is rejected by the
 * provider's email rate limit. Creates the auth user server-side with no
 * provider email; verification is issued by our own token email instead.
 * If a half-finished sign-up already exists for this address and the password
 * matches, the server resumes it and returns a signed recovery receipt.
 */
async function createAuthUserWithoutProviderEmail(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthUserFallback> {
  const attempt = async (): Promise<AuthUserFallback> => {
    try {
      const res = await fetch('/api/registration/create-auth-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });
      const json = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (res.ok && json.ok && typeof json.userId === 'string' && json.userId) {
        return {
          ok: true,
          userId: json.userId,
          receipt: typeof json.receipt === 'string' && json.receipt ? json.receipt : undefined,
        };
      }
      if (res.ok && json.ok && json.exists) return { ok: false, exists: true };
      return {
        ok: false,
        error: typeof json.error === 'string' && json.error ? json.error : undefined,
      };
    } catch {
      return { ok: false, error: 'Could not reach the registration service.' };
    }
  };

  const first = await attempt();
  if (first.ok || first.exists) return first;
  if (isEmailRateLimitError({ message: first.error })) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return attempt();
  }
  return first;
}

/**
 * Creates the auth user, then creates the patron profile through a
 * server-side endpoint (service role). The client-side insert path is
 * unusable because email confirmation means signUp() returns no session,
 * so any direct `patrons` insert would run as `anon` and be rejected by RLS.
 *
 * Email delivery failures (including provider rate limits) never fail the
 * registration itself — they are reported through `emailNotice`, and a
 * rate-limited `signUp()` falls back to server-side account creation.
 */
export async function registerAccount(opts: {
  role: AppRole;
  email: string;
  password: string;
  fullName: string;
  patronCategory: string;
  profile: Record<string, unknown>;
}): Promise<RegisterResult> {
  try {
    return await runRegistration(opts);
  } catch (error) {
    if (isEmailRateLimitError(error)) {
      return {
        ok: false,
        error: 'The email service is temporarily busy. Please wait about a minute and submit the form again.',
      };
    }
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
  let recoveryReceipt: string | undefined;

  if (authErr || !userId) {
    const message = (authErr?.message || '').toLowerCase();
    const alreadyRegistered =
      message.includes('already registered') ||
      message.includes('already been registered') ||
      authErr?.status === 422;
    let needsSignInRecovery = false;

    if (alreadyRegistered) {
      needsSignInRecovery = true;
    } else if (isEmailRateLimitError(authErr)) {
      // The provider's own confirmation email can be rate-limited. That must
      // never block registration: fall back to creating the account without
      // a provider email and let our own verification email handle delivery.
      const fallback = await createAuthUserWithoutProviderEmail(opts.email, opts.password, opts.fullName);
      if (fallback.ok) {
        userId = fallback.userId;
        recoveryReceipt = fallback.receipt;
      } else if (fallback.exists || (fallback.error && /already/i.test(fallback.error))) {
        needsSignInRecovery = true;
      } else {
        return {
          ok: false,
          error: fallback.error || 'We could not finish creating your account. Please try again in a moment.',
        };
      }
    } else {
      return { ok: false, error: authErr?.message ?? 'Registration failed. Please try again.' };
    }

    if (needsSignInRecovery) {
      // The account already exists — recover it so a partial earlier attempt
      // (signup succeeded, profile failed) can still complete.
      const signIn = await supabase.auth.signInWithPassword({ email: opts.email, password: opts.password });
      if (signIn.error || !signIn.data.user) {
        const signInMessage = signIn.error?.message ?? '';
        const notConfirmed = /not confirmed|confirm your email/i.test(signInMessage);
        return {
          ok: false,
          error: notConfirmed
            ? 'An account with this email already exists but has not been verified yet. Enter the password you used when you first registered, or contact the library desk to reset it.'
            : 'An account with this email already exists. Please sign in, or use a different email address.',
        };
      }
      userId = signIn.data.user.id;
    }
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
      ...(recoveryReceipt ? { recoveryReceipt } : {}),
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
  let autoVerified = false;
  let emailNotice: string | undefined;

  if (requiresEmailVerification) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const sendOnce = () =>
      fetch('/api/registration/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, email: opts.email }),
      }).catch(() => null);

    let res = await sendOnce();
    if (!res) res = await sendOnce();

    if (res?.ok) {
      const json = await res.json().catch(() => ({}));
      verificationEmailSent = !!json.sent;
      if (json.autoVerified) {
        // Email could not be delivered, so the server completed verification.
        autoVerified = true;
        verificationEmailSent = false;
        emailNotice =
          'The email service is unavailable right now, so we skipped email verification and activated your account. You can sign in immediately.';
      } else if (!json.sent && json.verified) {
        verificationEmailSent = true;
      } else if (!json.sent && json.reason === 'rate_limited') {
        emailNotice = 'The email service is temporarily rate-limited. Your account was created — please request the verification link again in a few minutes from the sign-in page.';
      } else if (!json.sent) {
        emailNotice = 'Your account was created, but the verification email could not be sent right now. You can request it again shortly from the sign-in page.';
      }
    } else {
      emailNotice =
        'Your account was created, but we could not reach the email service. Try signing in now; if you are still asked to verify, request a new link from the sign-in page.';
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
    autoVerified,
    emailNotice,
  };
}
