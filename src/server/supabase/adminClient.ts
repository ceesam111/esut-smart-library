import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Server-side Supabase client that always acts as the service role.
 *
 * Every request (PostgREST and GoTrue auth admin API) is pinned to the
 * service-role key so that a prior `signInWithPassword()` on this client can
 * never replace `Authorization` with a user's access token and downgrade
 * later writes to `authenticated` (RLS failures for the lifetime of the
 * process). Auth endpoints still accept user JWTs where the route itself
 * calls them, but this shared client always presents the service key.
 */
export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server-side Supabase access.');
  }

  if (!cached) {
    const pinnedFetch: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('apikey', serviceRoleKey);
      headers.set('Authorization', `Bearer ${serviceRoleKey}`);
      return fetch(input, { ...init, headers, cache: 'no-store' });
    };

    cached = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: pinnedFetch },
    });
  }

  return cached;
}
