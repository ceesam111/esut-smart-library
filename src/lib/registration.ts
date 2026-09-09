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
}

/**
 * Creates the auth user and inserts a pending patron profile. No effective
 * role is granted until an authorised librarian approves the registration.
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
  await verifyTurnstileClient(opts.turnstileToken ?? null, 'registration');
  const policy = await fetch('/api/registration/policy')
    .then((res) => res.ok ? res.json() : null)
    .then((json) => parseRegistrationPolicy(json?.policy))
    .catch(() => DEFAULT_REGISTRATION_POLICY);
  const privileged = isPrivilegedSelfRegistrationRole(opts.role);
  const requiresEmailVerification = policyRequiresEmailVerification(policy);
  const requiresBranchApproval = policyRequiresBranchApproval(policy) || privileged;

  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: { data: { full_name: opts.fullName } },
  });

  if (authErr || !authData.user) {
    return { ok: false, error: authErr?.message ?? 'Registration failed. Please try again.' };
  }

  const patronId = `${institutionConfig.institutionCode}-TMP-${Math.floor(100000 + Math.random() * 900000)}`;
  const now = new Date().toISOString();
  const directAccess = !requiresEmailVerification && !requiresBranchApproval;

  const { error: dbErr } = await supabase.from('patrons').insert({
    user_id: authData.user.id,
    patron_id: patronId,
    full_name: opts.fullName,
    email: opts.email,
    patron_category: opts.patronCategory,
    account_role: opts.role,
    status: directAccess ? 'active' : 'pending',
    approved_at: directAccess ? now : null,
    email_verified_at: requiresEmailVerification ? null : now,
    main_library_access_at: directAccess ? now : null,
    branch_approved_at: directAccess ? now : null,
    registration_policy: policy,
    membership_expires_at: null,
    ...opts.profile,
  });

  if (dbErr) {
    return { ok: false, error: 'Account created but profile setup failed: ' + dbErr.message };
  }

  let verificationEmailSent = false;
  if (requiresEmailVerification) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/registration/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ userId: authData.user.id, email: opts.email }),
    }).catch(() => null);
    verificationEmailSent = !!res?.ok;
  } else {
    sendWelcomeEmail({
      email: opts.email,
      full_name: opts.fullName,
      patron_id: patronId,
      faculty_name: (opts.profile.faculty_name as string) || undefined,
    });
  }

  return { ok: true, policy, requiresEmailVerification, requiresBranchApproval, directAccess, verificationEmailSent };
}
