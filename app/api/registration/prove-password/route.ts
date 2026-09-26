import { NextResponse, type NextRequest } from 'next/server';
import { provePassword } from '@/server/registration/passwordProof';

export const dynamic = 'force-dynamic';

/**
 * Password proof for registration and sign-in recovery.
 *
 * Body: { email, password, confirm? }
 *  - always returns a signed recovery receipt when the password matched, so
 *    `/api/registration/create-profile` can finish a registration whose
 *    browser has no session;
 *  - with `confirm: true` it also completes email verification (used by the
 *    sign-in page so "Email not confirmed" never locks a user out when the
 *    email service cannot deliver).
 *
 * No state changes and no proof are issued unless the password matched.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; resetAt: number }>();

function allow(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 500) {
      for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const confirm = body.confirm === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
    }

    const ip = clientKey(request);
    if (!allow(`prove:${ip}:${email}`) || !allow(`prove-ip:${ip}`)) {
      return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
    }

    const proof = await provePassword(email, password, confirm);
    if (!proof.ok) {
      return NextResponse.json({ ok: false, error: proof.error }, { status: 401 });
    }
    return NextResponse.json({ ok: true, receipt: proof.receipt, confirmed: proof.confirmed, userId: proof.userId });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not verify your password right now. Please try again.' }, { status: 500 });
  }
}
