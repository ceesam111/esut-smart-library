import type { NextRequest } from 'next/server';
import { requireUser, type ServerUserContext } from './requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { hasAnyRole, isPrivilegedRole } from './permissions';

export interface RoleContext extends ServerUserContext {
  roles: string[];
  primaryRole: string | null;
}

export async function getUserRoles(userId: string) {
  const supabase = getSupabaseAdminClient();
  const [{ data: roleRows, error: roleError }, { data: patron, error: patronError }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('patrons').select('account_role,status,main_library_access_at').eq('user_id', userId).maybeSingle(),
  ]);

  if (roleError) throw new Error(roleError.message);
  if (patronError) throw new Error(patronError.message);

  const roles = new Set<string>();
  const patronHasAccess = !patron || patron.status === 'active' || !!patron.main_library_access_at;
  if (patronHasAccess) {
    (roleRows ?? []).forEach((row: { role: string }) => roles.add(row.role));
    if (patron?.account_role && !isPrivilegedRole(patron.account_role)) roles.add(patron.account_role);
  }
  if (roles.size === 0) roles.add('guest');

  return [...roles];
}

export async function requireRole(request: Request | NextRequest, allowedRoles: string[]): Promise<RoleContext> {
  const ctx = await requireUser(request);
  const roles = await getUserRoles(ctx.user.id);
  if (!hasAnyRole(roles, allowedRoles)) throw new Error('Forbidden.');
  return { ...ctx, roles, primaryRole: roles[0] ?? null };
}
