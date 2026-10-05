import { randomInt } from 'node:crypto';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { hashSip2Password } from '@/server/sip2/auth';
import { SIP2_INSTITUTION_ID } from '@/server/sip2/messages';

export const SIP2_OPERATIONS = ['checkout', 'checkin', 'patron_info', 'item_info'] as const;
export type Sip2Operation = (typeof SIP2_OPERATIONS)[number];

export interface Sip2TerminalSummary {
  id: string;
  name: string;
  institution_id: string;
  login_username: string;
  is_active: boolean;
  allowed_operations: string[];
  permitted_ip_cidr: string | null;
  credential_scheme: string;
  failed_attempts: number;
  locked_until: string | null;
  last_successful_auth: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sip2AuditEntry {
  id: string;
  terminal_id: string | null;
  event: string;
  success: boolean;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const COLUMNS =
  'id, name, institution_id, login_username, is_active, allowed_operations, permitted_ip_cidr, credential_scheme, failed_attempts, locked_until, last_successful_auth, created_at, updated_at';

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%+=';

function generateTerminalPassword(): string {
  let out = '';
  for (let i = 0; i < 20; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

function normalizeOperations(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Invalid operations.');
  const allowed = new Set<string>([...SIP2_OPERATIONS, '*']);
  const ops = [...new Set(value.filter((v): v is string => typeof v === 'string'))];
  if (ops.length === 0 || ops.some((op) => !allowed.has(op))) throw new Error('Invalid operations.');
  return ops;
}

function normalizeCidr(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(value.trim())) {
    throw new Error('Invalid CIDR.');
  }
  const [prefix, bits] = value.trim().split('/');
  const parts = prefix.split('.').map(Number);
  if (parts.some((p) => p > 255) || Number(bits) > 32) throw new Error('Invalid CIDR.');
  return value.trim();
}

function isUniqueViolation(error: { code?: string | null } | null): boolean {
  return !!error && error.code === '23505';
}

export async function listSip2Terminals(): Promise<Sip2TerminalSummary[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sip2_terminals')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load SIP2 terminals: ${error.message}`);
  return (data ?? []) as Sip2TerminalSummary[];
}

export async function listSip2Audit(limit = 50): Promise<Sip2AuditEntry[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sip2_audit_log')
    .select('id, terminal_id, event, success, details, ip_address, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new Error(`Failed to load SIP2 audit log: ${error.message}`);
  return (data ?? []) as Sip2AuditEntry[];
}

export async function createSip2Terminal(input: {
  name: unknown;
  loginUsername: unknown;
  allowedOperations: unknown;
  permittedIpCidr: unknown;
}): Promise<{ terminal: Sip2TerminalSummary; plainPassword: string }> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const loginUsername = typeof input.loginUsername === 'string' ? input.loginUsername.trim() : '';
  if (!name) throw new Error('Invalid name.');
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(loginUsername)) throw new Error('Invalid username.');
  const allowedOperations = normalizeOperations(input.allowedOperations);
  const permittedIpCidr = normalizeCidr(input.permittedIpCidr);

  const plainPassword = generateTerminalPassword();
  const passwordHash = await hashSip2Password(plainPassword);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sip2_terminals')
    .insert({
      name,
      institution_id: SIP2_INSTITUTION_ID,
      login_username: loginUsername,
      password_hash: passwordHash,
      credential_scheme: 'bcrypt',
      is_active: true,
      allowed_operations: allowedOperations,
      permitted_ip_cidr: permittedIpCidr,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    if (isUniqueViolation(error)) throw new Error('Invalid: username already exists for this institution.');
    throw new Error(`Failed to create SIP2 terminal: ${error.message}`);
  }
  return { terminal: data as Sip2TerminalSummary, plainPassword };
}

export async function updateSip2Terminal(
  id: string,
  patch: { name?: unknown; isActive?: unknown; allowedOperations?: unknown; permittedIpCidr?: unknown },
): Promise<void> {
  if (!id) throw new Error('Invalid id.');
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = typeof patch.name === 'string' ? patch.name.trim() : '';
    if (!name) throw new Error('Invalid name.');
    update.name = name;
  }
  if (patch.isActive !== undefined) {
    if (typeof patch.isActive !== 'boolean') throw new Error('Invalid active flag.');
    update.is_active = patch.isActive;
    if (!patch.isActive) {
      update.failed_attempts = 0;
      update.locked_until = null;
    }
  }
  if (patch.allowedOperations !== undefined) update.allowed_operations = normalizeOperations(patch.allowedOperations);
  if (patch.permittedIpCidr !== undefined) update.permitted_ip_cidr = normalizeCidr(patch.permittedIpCidr);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('sip2_terminals').update(update).eq('id', id);
  if (error) throw new Error(`Failed to update SIP2 terminal: ${error.message}`);
}

export async function resetSip2TerminalSecret(id: string): Promise<{ plainPassword: string }> {
  if (!id) throw new Error('Invalid id.');
  const plainPassword = generateTerminalPassword();
  const passwordHash = await hashSip2Password(plainPassword);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('sip2_terminals')
    .update({
      password_hash: passwordHash,
      credential_scheme: 'bcrypt',
      failed_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`Failed to reset SIP2 terminal secret: ${error.message}`);
  return { plainPassword };
}

export async function deleteSip2Terminal(id: string): Promise<void> {
  if (!id) throw new Error('Invalid id.');
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('sip2_terminals').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete SIP2 terminal: ${error.message}`);
}
