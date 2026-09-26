import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
type UnconfirmedRow = { id: string; email: string; created_at: string; provider: string; profile: boolean; roles: number };

/**
 * Lists and removes registrations whose email was never confirmed.
 *
 * These are the accounts that used to be unreachable: no session, no way to
 * sign in, and no profile — they only accumulated in `auth.users`. A
 * super administrator can clear one or all of them from Account Management.
 * Removing a target also removes its patron profile and granted roles, so the
 * same address can be registered cleanly afterwards.
 */

async function listUnconfirmed(supabase: AdminClient): Promise<{ id: string; email: string; created_at: string; provider: string }[]> {
  const out: { id: string; email: string; created_at: string; provider: string }[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    if (!data?.users?.length) break;
    for (const user of data.users) {
      if (user.email_confirmed_at) continue;
      out.push({
        id: user.id,
        email: (user.email || '').toLowerCase(),
        created_at: user.created_at || '',
        provider: user.app_metadata?.provider || 'email',
      });
    }
    if (data.users.length < 100) break;
  }
  return out;
}

async function decorate(supabase: AdminClient, users: { id: string; email: string; created_at: string; provider: string }[]): Promise<UnconfirmedRow[]> {
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const [{ data: patrons }, { data: roleRows }] = await Promise.all([
    supabase.from('patrons').select('user_id').in('user_id', ids),
    supabase.from('user_roles').select('user_id').in('user_id', ids),
  ]);
  const profileIds = new Set((patrons ?? []).map((row) => row.user_id as string));
  const roleCounts = new Map<string, number>();
  for (const row of roleRows ?? []) {
    const key = row.user_id as string;
    roleCounts.set(key, (roleCounts.get(key) ?? 0) + 1);
  }
  return users.map((u) => ({ ...u, profile: profileIds.has(u.id), roles: roleCounts.get(u.id) ?? 0 }));
}

async function purgeOne(supabase: AdminClient, userId: string) {
  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.from('patrons').delete().eq('user_id', userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message || '')) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const accounts = await decorate(supabase, await listUnconfirmed(supabase));
    return NextResponse.json({ accounts, actor: ctx.user.email ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, GLOBAL_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const purgeAll = body.all === true;
    const userId = typeof body.userId === 'string' ? body.userId : '';

    if (!purgeAll && !userId) {
      return NextResponse.json({ error: 'Select a registration to remove.' }, { status: 400 });
    }

    const targets = purgeAll
      ? (await listUnconfirmed(supabase)).map((u) => u.id)
      : [userId];

    const removed: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of targets) {
      try {
        await purgeOne(supabase, id);
        removed.push(id);
      } catch (e) {
        failed.push({ id, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    // Best-effort audit trail for a destructive action.
    const { error: auditError } = await supabase.from('audit_logs').insert({
      user_id: ctx.user.id,
      action: purgeAll ? 'admin.purge_unconfirmed_registrations' : 'admin.purge_unconfirmed_registration',
      entity_type: 'auth',
      table_name: 'users',
      new_values: { removed: removed.length, failed: failed.length },
      detail: `Removed ${removed.length} unconfirmed registration(s)`,
      target_email: null,
    });
    void auditError; // Audit must not block the cleanup.

    return NextResponse.json({ removed: removed.length, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }
}
