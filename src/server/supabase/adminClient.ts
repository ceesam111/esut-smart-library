import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Server-side Supabase client that always acts as the service role.
 *
 * PostgREST headers are pinned to the service key because `supabase.auth`
 * session changes would otherwise replace `Authorization` with a user's access
 * token and turn every later write into an RLS failure for the lifetime of the
 * process. Auth endpoints are left untouched so user JWTs still work there.
 */
export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server-side Supabase access.');
  }

  if (!cached) {
    const restBase = `${url.replace(/\/$/, '')}/rest`;
    const pinnedFetch: typeof fetch = (input, init) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (target.startsWith(`${restBase}/`) && target !== `${restBase}/`) {
        const headers = new Headers(init?.headers);
        headers.set('apikey', serviceRoleKey);
        headers.set('Authorization', `Bearer ${serviceRoleKey}`);
        return fetch(input, { ...init, headers, cache: 'no-store' });
      }
      return fetch(input, { ...init, cache: 'no-store' });
    };

    cached = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: pinnedFetch },
    });
  }

  return cached;
}
