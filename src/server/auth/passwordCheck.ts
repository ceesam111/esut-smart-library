import { createClient } from '@supabase/supabase-js';

export type PasswordCheck = { ok: true; detail: '' } | { ok: false; detail: string };

/**
 * Checks an email/password pair on a throwaway client.
 *
 * `signInWithPassword()` stores a session on the client it is called on, and
 * supabase-js then sends that user's access token as `Authorization` for every
 * later request made with it. Running it on the shared admin client would
 * silently downgrade all server-side writes to `authenticated`, so every insert
 * started failing row-level security until the process restarted ("Your profile
 * could not be saved due to a permissions issue"). Password checks therefore
 * never touch the shared client.
 */
export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, detail: 'auth_config_missing' };

  const probe = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    return { ok: false, detail: `${code} ${error.message ?? ''}`.trim() };
  }

  await probe.auth.signOut().catch(() => undefined);
  return { ok: true, detail: '' };
}
