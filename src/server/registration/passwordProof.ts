import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { findUserIdByEmail } from '@/server/auth/userLookup';
import { signRecoveryReceipt } from './recoveryReceipt';
import { completeEmailVerification } from './completeEmailVerification';
import { getRegistrationPolicy } from './policy';

export type PasswordProof =
  | { ok: true; userId: string; receipt: string; confirmed: boolean }
  | { ok: false; error: string };

/**
 * Proves that the caller knows an account's password without changing
 * anything (unless `confirm` is set).
 *
 * GoTrue only reports `email_not_confirmed` **after** the password matched,
 * so that error is the proof. The signed recovery receipt it returns lets
 * `/api/registration/create-profile` continue when the browser has no
 * session — which is the normal state right after `signUp()` and after a
 * rate-limited fallback signup, and the reason registrations used to fail
 * with "Registration session expired" for accounts older than 30 minutes.
 *
 * With `confirm: true` the account is confirmed as well (same transitions as
 * opening the emailed link), so a sign-in attempt is never blocked by
 * "Email not confirmed" when the email service cannot deliver.
 */
export async function provePassword(email: string, password: string, confirm: boolean): Promise<PasswordProof> {
  const supabase = getSupabaseAdminClient();

  const userId = await findUserIdByEmail(supabase, email);
  if (!userId) return { ok: false, error: 'Invalid email or password.' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    return { ok: true, userId, receipt: signRecoveryReceipt(userId), confirmed: true };
  }

  const detail = `${(error as { code?: string })?.code ?? ''} ${error.message ?? ''}`;
  if (/email_not_confirmed|not confirmed|confirm your email/i.test(detail)) {
    if (confirm) {
      try {
        const policy = await getRegistrationPolicy();
        await completeEmailVerification(supabase, userId, policy);
        return { ok: true, userId, receipt: signRecoveryReceipt(userId), confirmed: true };
      } catch {
        return { ok: false, error: 'Your account could not be verified right now. Please try again in a moment.' };
      }
    }
    return { ok: true, userId, receipt: signRecoveryReceipt(userId), confirmed: false };
  }

  if (/invalid login credentials|invalid_credentials|user not found/i.test(detail)) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  return { ok: false, error: 'The authentication service is busy. Please try again in a minute.' };
}
