import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

const SIP2_MAX_FAILED_ATTEMPTS = 5;
const SIP2_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const SIP2_RATE_LIMIT_WINDOW_MS = 60_000;
const SIP2_RATE_LIMIT_MAX = 10;
const BCRYPT_ROUNDS = 12;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface Sip2Terminal {
  id: string;
  name: string;
  institution_id: string;
  login_username: string;
  password_hash: string;
  credential_scheme: string;
  is_active: boolean;
  allowed_operations: string[];
  permitted_ip_cidr: string | null;
  failed_attempts: number;
  locked_until: string | null;
}

export interface Sip2AuthResult {
  success: boolean;
  terminalId?: string;
  allowedOperations?: string[];
  reason?: string;
}

function isIpAllowed(clientIp: string | null, permittedCidr: string | null): boolean {
  if (!permittedCidr) return true;
  if (!clientIp) return false;
  const [prefix, bitsStr] = permittedCidr.split('/');
  if (!prefix || !bitsStr) return true;
  const bits = Number(bitsStr);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return true;
  const prefixParts = prefix.split('.').map(Number);
  const ipParts = clientIp.split('.').map(Number);
  if (prefixParts.length !== 4 || ipParts.length !== 4) return true;
  for (let i = 0; i < 4; i++) {
    if (Number.isNaN(prefixParts[i]) || Number.isNaN(ipParts[i])) return true;
  }
  const prefixBuf = Buffer.from(prefixParts);
  const ipBuf = Buffer.from(ipParts);
  const fullBits = bits;
  for (let i = 0; i < 4; i++) {
    const maskBits = Math.max(0, Math.min(8, fullBits - i * 8));
    if (maskBits === 0) break;
    const mask = maskBits === 8 ? 0xFF : (0xFF << (8 - maskBits)) & 0xFF;
    if ((prefixBuf[i] & mask) !== (ipBuf[i] & mask)) return false;
  }
  return true;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + SIP2_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= SIP2_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function verifyPassword(password: string, hash: string, scheme: string): Promise<boolean> {
  if (scheme === 'bcrypt') {
    return bcrypt.compare(password, hash);
  }
  if (scheme === 'sha256-legacy') {
    const { createHash } = await import('crypto');
    const computed = createHash('sha256').update(`sip2:${password}`).digest('hex');
    const a = Buffer.from(computed);
    const b = Buffer.from(hash);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  return false;
}

export async function authenticateSip2Terminal(
  username: string,
  password: string,
  institutionId: string,
  clientIp: string | null,
): Promise<Sip2AuthResult> {
  if (!username || !password) {
    return { success: false, reason: 'Invalid credentials' };
  }

  if (!checkRateLimit(`${institutionId}:${username}`)) {
    return { success: false, reason: 'Too many attempts' };
  }

  const supabase = getSupabaseAdminClient();
  const { data: terminal, error } = await supabase
    .from('sip2_terminals')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('login_username', username)
    .maybeSingle();

  if (error || !terminal) {
    await logSip2Event(null, 'login_failed', false, { reason: 'unknown_terminal', username }, clientIp);
    return { success: false, reason: 'Invalid credentials' };
  }

  if (!terminal.is_active) {
    await logSip2Event(terminal.id, 'login_failed', false, { reason: 'disabled' }, clientIp);
    return { success: false, reason: 'Invalid credentials' };
  }

  if (terminal.locked_until && new Date(terminal.locked_until) > new Date()) {
    await logSip2Event(terminal.id, 'login_failed', false, { reason: 'locked' }, clientIp);
    return { success: false, reason: 'Invalid credentials' };
  }

  if (!isIpAllowed(clientIp, terminal.permitted_ip_cidr)) {
    await logSip2Event(terminal.id, 'login_failed', false, { reason: 'ip_not_allowed' }, clientIp);
    return { success: false, reason: 'Invalid credentials' };
  }

  const scheme = terminal.credential_scheme || 'sha256-legacy';
  const valid = await verifyPassword(password, terminal.password_hash, scheme);

  if (!valid) {
    const newFailed = terminal.failed_attempts + 1;
    const lockedUntil = newFailed >= SIP2_MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + SIP2_LOCKOUT_DURATION_MS).toISOString()
      : null;
    await supabase
      .from('sip2_terminals')
      .update({ failed_attempts: newFailed, locked_until: lockedUntil, updated_at: new Date().toISOString() })
      .eq('id', terminal.id);
    await logSip2Event(terminal.id, 'login_failed', false, { reason: 'bad_password', failed_attempts: newFailed }, clientIp);
    return { success: false, reason: 'Invalid credentials' };
  }

  if (scheme === 'sha256-legacy') {
    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await supabase
      .from('sip2_terminals')
      .update({ password_hash: newHash, credential_scheme: 'bcrypt', updated_at: new Date().toISOString() })
      .eq('id', terminal.id);
    await logSip2Event(terminal.id, 'credential_migrated', true, { from: 'sha256-legacy', to: 'bcrypt' }, clientIp);
  }

  await supabase
    .from('sip2_terminals')
    .update({
      failed_attempts: 0,
      locked_until: null,
      last_successful_auth: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', terminal.id);

  await logSip2Event(terminal.id, 'login_success', true, null, clientIp);

  return {
    success: true,
    terminalId: terminal.id,
    allowedOperations: terminal.allowed_operations,
  };
}

export async function logSip2Event(
  terminalId: string | null,
  event: string,
  success: boolean,
  details: Record<string, unknown> | null,
  ipAddress: string | null,
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('sip2_audit_log').insert({
      terminal_id: terminalId,
      event,
      success,
      details: details || undefined,
      ip_address: ipAddress,
    });
  } catch {
    // audit logging must never break auth flow
  }
}

export async function hashSip2Password(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function isOperationAllowed(allowedOperations: string[] | undefined, operation: string): boolean {
  if (!allowedOperations || allowedOperations.length === 0) return false;
  return allowedOperations.includes(operation) || allowedOperations.includes('*');
}
