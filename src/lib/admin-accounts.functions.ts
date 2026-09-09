import { supabase } from '@/lib/supabase';

export type AssignableRole =
  | 'super_admin'
  | 'librarian'
  | 'faculty_librarian'
  | 'student'
  | 'researcher_lecturer'
  | 'admin_staff'
  | 'guest';

export interface AccountRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  status: string | null;
  library_number: string | null;
  roles: string[];
  superAdminLevel: 'ceo' | 'aceo' | null;
  banned: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface AuditRow {
  id: string;
  actor_email: string | null;
  target_email: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You must be signed in.');
  return data.user.id;
}

async function assertSuperAdmin() {
  const userId = await currentUserId();
  const { data, error } = await supabase.rpc('is_super_admin', { _user_id: userId });
  if (error || !data) throw new Error('Forbidden: super administrators only');
  return userId;
}

interface ActorContext {
  userId: string;
  roles: string[];
  superAdminLevel: 'ceo' | 'aceo' | null;
}

async function currentActor(): Promise<ActorContext> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('user_roles')
    .select('role,super_admin_level')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row: { role: string }) => row.role);
  const superRole = (data ?? []).find((row: { role: string; super_admin_level: 'ceo' | 'aceo' | null }) => row.role === 'super_admin');
  return {
    userId,
    roles,
    superAdminLevel: superRole ? superRole.super_admin_level ?? 'ceo' : null,
  };
}

async function assertAccountManager() {
  const actor = await currentActor();
  if (!actor.roles.includes('super_admin') && !actor.roles.includes('librarian')) {
    throw new Error('Forbidden: account managers only');
  }
  return actor;
}

async function targetRoles(userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role,super_admin_level')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row: { role: string }) => row.role);
  const superRole = (data ?? []).find((row: { role: string; super_admin_level: 'ceo' | 'aceo' | null }) => row.role === 'super_admin');
  return { roles, superAdminLevel: superRole ? superRole.super_admin_level ?? 'ceo' : null };
}

async function assertCanManageTarget(actor: ActorContext, targetUserId: string, roleChange?: AssignableRole) {
  const target = await targetRoles(targetUserId);
  const targetIsSuper = target.roles.includes('super_admin');
  if (actor.roles.includes('librarian') && !actor.roles.includes('super_admin')) {
    if (targetIsSuper || roleChange === 'super_admin') throw new Error('Forbidden: librarians cannot manage super administrators');
    return;
  }
  if (!actor.roles.includes('super_admin')) throw new Error('Forbidden: account managers only');
  if (actor.superAdminLevel === 'aceo' && (target.superAdminLevel === 'ceo' || roleChange === 'super_admin')) {
    throw new Error('Forbidden: ACEO cannot manage CEO or create super administrators');
  }
}

async function audit(action: string, targetUserId?: string | null, targetEmail?: string | null, detail?: string) {
  const actorId = await currentUserId();
  await supabase.from('role_audit_log').insert({
    actor_id: actorId,
    target_user_id: targetUserId ?? null,
    target_email: targetEmail ?? null,
    action,
    detail: detail ?? null,
  });
}

export async function listAccounts(): Promise<AccountRow[]> {
  await assertAccountManager();

  const [{ data: patrons, error: patronsError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from('patrons').select('user_id, email, full_name, status, library_number, created_at'),
    supabase.from('user_roles').select('user_id, role, super_admin_level'),
  ]);

  if (patronsError) throw new Error(patronsError.message);
  if (rolesError) throw new Error(rolesError.message);

  const rolesByUser = new Map<string, string[]>();
  const superLevelByUser = new Map<string, 'ceo' | 'aceo' | null>();
  (roles ?? []).forEach((row: { user_id: string; role: string; super_admin_level: 'ceo' | 'aceo' | null }) => {
    rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
    if (row.role === 'super_admin') superLevelByUser.set(row.user_id, row.super_admin_level ?? 'ceo');
  });

  return (patrons ?? [])
    .filter((row: { user_id: string | null }) => !!row.user_id)
    .map((row: { user_id: string; email: string | null; full_name: string | null; status: string | null; library_number: string | null; created_at: string }) => ({
      user_id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      status: row.status,
      library_number: row.library_number,
      roles: rolesByUser.get(row.user_id) ?? [],
      superAdminLevel: superLevelByUser.get(row.user_id) ?? null,
      banned: row.status === 'suspended',
      last_sign_in_at: null,
      created_at: row.created_at,
    }))
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
}

export async function listAudit(): Promise<AuditRow[]> {
  await assertSuperAdmin();
  const { data, error } = await supabase
    .from('role_audit_log')
    .select('id, actor_email, target_email, action, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditRow[];
}

export async function assignRole({ data }: { data: { userId: string; role: AssignableRole; email?: string | null } }) {
  const actor = await assertAccountManager();
  await assertCanManageTarget(actor, data.userId, data.role);
  const { error } = await supabase.from('user_roles').insert({
    user_id: data.userId,
    role: data.role,
    super_admin_level: data.role === 'super_admin' ? 'aceo' : null,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  await audit('role_granted', data.userId, data.email, data.role);
  return { ok: true };
}

export async function revokeRole({ data }: { data: { userId: string; role: AssignableRole; email?: string | null } }) {
  const actor = await assertAccountManager();
  await assertCanManageTarget(actor, data.userId, data.role);
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', data.userId)
    .eq('role', data.role);
  if (error) throw new Error(error.message);
  await audit('role_revoked', data.userId, data.email, data.role);
  return { ok: true };
}

export async function setAccess({ data }: { data: { userId: string; email?: string | null; banned?: boolean; revoke?: boolean } }) {
  const actor = await assertAccountManager();
  await assertCanManageTarget(actor, data.userId);
  const banned = data.banned ?? data.revoke ?? false;
  const { error } = await supabase
    .from('patrons')
    .update({ status: banned ? 'suspended' : 'active' })
    .eq('user_id', data.userId);
  if (error) throw new Error(error.message);
  await audit(banned ? 'access_suspended' : 'access_restored', data.userId, data.email);
  return { ok: true };
}

export async function inviteUser(_input?: { data: { email: string; role?: AssignableRole; redirectTo: string } }) {
  throw new Error('Invitations require a Next API route backed by SUPABASE_SERVICE_ROLE_KEY.');
}

export async function adminResetPassword(_input?: { data: { email: string; redirectTo: string } }) {
  throw new Error('Password reset requires a Next API route backed by SUPABASE_SERVICE_ROLE_KEY.');
}
