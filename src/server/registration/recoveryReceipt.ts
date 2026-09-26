import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stateless, signed proof that lets a registration retry resume an account
 * that was created by a rate-limited sign-up. Only the server can mint it,
 * and it is bound to one auth user id and expires after one hour.
 */

const PURPOSE = 'registration:profile-recovery:v1';
const TTL_SECONDS = 60 * 60;

function secret() {
  return process.env.SUPABASE_JWT_SECRET || process.env.REGISTRATION_RECOVERY_SECRET || '';
}

export function signRecoveryReceipt(userId: string): string {
  const key = secret();
  if (!key || !userId) return '';
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${PURPOSE}:${userId}:${issuedAt}`;
  const sig = createHmac('sha256', key).update(payload).digest('base64url');
  return Buffer.from(`${payload}:${sig}`, 'utf8').toString('base64url');
}

export function verifyRecoveryReceipt(receipt: string | null | undefined, userId: string): boolean {
  const key = secret();
  if (!key || !receipt || !userId) return false;
  try {
    const raw = Buffer.from(receipt, 'base64url').toString('utf8');
    const parts = raw.split(':');
    if (parts.length < 4) return false;
    // The purpose itself contains colons ("registration:profile-recovery:v1"),
    // so the fields are read from the end instead of destructuring in order.
    const signature = parts[parts.length - 1];
    const issuedAt = parts[parts.length - 2];
    const uid = parts[parts.length - 3];
    const purpose = parts.slice(0, parts.length - 3).join(':');
    if (purpose !== PURPOSE || uid !== userId || !signature) return false;
    const issued = Number(issuedAt);
    if (!Number.isFinite(issued)) return false;
    const age = Math.floor(Date.now() / 1000) - issued;
    if (age < 0 || age > TTL_SECONDS) return false;
    const expected = createHmac('sha256', key).update(`${PURPOSE}:${uid}:${issuedAt}`).digest('base64url');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
