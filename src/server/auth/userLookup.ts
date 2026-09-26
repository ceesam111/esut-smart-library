import type { getSupabaseAdminClient } from '@/server/supabase/adminClient';

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

/**
 * Resolves an auth user id from an email address.
 * Prefers the indexed RPC, falls back to a paginated scan if it is missing.
 */
export async function findUserIdByEmail(supabase: AdminClient, email: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('auth_user_id_by_email', { p_email: email });
    if (!error && typeof data === 'string' && data) return data;
  } catch {
    // RPC not applied yet — fall through to the scan.
  }
  for (let page = 1; page <= 10; page += 1) {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !list?.users?.length) return null;
    const match = list.users.find((u) => (u.email || '').toLowerCase() === email);
    if (match) return match.id;
    if (list.users.length < 100) return null;
  }
  return null;
}
