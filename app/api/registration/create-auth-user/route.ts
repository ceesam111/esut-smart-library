import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { signRecoveryReceipt } from '@/server/registration/recoveryReceipt';

export const dynamic = 'force-dynamic';

/**
 * Fallback auth-user creation for rate-limited signups.
 *
 * `auth.signUp()` sends a provider confirmation email, which can be rejected
 * with "Email rate limit exceeded" — sometimes after the auth user was already
 * created, leaving a half-finished registration behind. This endpoint closes
 * that gap without sending any provider email:
 *
 *  1. user missing  -> create it with the service-role client (no email)
 *  2. user exists, confirmed  -> report `exists` (a real duplicate account)
 *  3. user exists, unconfirmed, password matches -> return the id plus a
 *     signed recovery receipt so profile creation can resume
 *
 * Verification stays in our own hands: `/api/registration/send-verification`
 * issues our token email (best-effort) and `/api/registration/verify`
 * confirms the account.
 *
 * No new capability is gained — the same account a visitor could create with
 * the public sign-up endpoint is handled here.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
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

function isDuplicateEmailError(message: string) {
  return /already been registered|already registered|already exists/i.test(message);
}

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

/** Prefers the indexed RPC, falls back to a paginated scan if it is missing. */
async function findUserIdByEmail(supabase: AdminClient, email: string): Promise<string | null> {
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

export async function POST(request: NextRequest) {
  if (!allow(`create-auth:${clientKey(request)}`)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName },
    });

    if (!error) {
      return NextResponse.json({ ok: true, userId: data.user?.id ?? null });
    }

    if (!isDuplicateEmailError(error.message || '')) {
      return NextResponse.json({ error: error.message || 'Account could not be created.' }, { status: 400 });
    }

    // Duplicate: find the existing auth user and decide whether this is a
    // genuine duplicate or a half-finished sign-up we can resume.
    const existingId = await findUserIdByEmail(supabase, email);
    if (!existingId) {
      return NextResponse.json({ ok: true, exists: true });
    }

    const { data: existingUser } = await supabase.auth.admin.getUserById(existingId);
    if (!existingUser?.user) {
      return NextResponse.json({ ok: true, exists: true });
    }
    if (existingUser.user.email_confirmed_at) {
      return NextResponse.json({ ok: true, exists: true });
    }

    // Unconfirmed account with no verified owner yet: only resume it when the
    // caller can prove they know its password (GoTrue reports
    // `email_not_confirmed` only after the password matched).
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    const signInDetail = `${(signInError as { code?: string })?.code ?? ''} ${signInError?.message ?? ''}`;
    const passwordMatches = /email_not_confirmed|not confirmed/i.test(signInDetail);
    if (!passwordMatches) {
      return NextResponse.json({ ok: true, exists: true });
    }

    return NextResponse.json({ ok: true, userId: existingId, recovery: true, receipt: signRecoveryReceipt(existingId) });
  } catch {
    return NextResponse.json({ error: 'Unexpected error while creating the account.' }, { status: 500 });
  }
}
