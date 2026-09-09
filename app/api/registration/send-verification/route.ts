import { randomBytes, createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getBearerToken, requireUser } from '@/server/auth/requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { getRegistrationPolicy } from '@/server/registration/policy';
import { policyRequiresEmailVerification } from '@/lib/registrationPolicy';
import { sendRegistrationVerificationEmailServer } from '@/server/email/resend';

export const dynamic = 'force-dynamic';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getPublicOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '');

  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (forwardedHost && !/^(0\.0\.0\.0|localhost|127\.0\.0\.1)(:|$)/.test(forwardedHost)) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`;
  }

  return 'https://esutlibrary.edu.ng';
}

export async function POST(request: NextRequest) {
  try {
    const policy = await getRegistrationPolicy();
    if (!policyRequiresEmailVerification(policy)) return NextResponse.json({ sent: false, policy });

    let userId: string | undefined;
    let email: string | undefined;

    if (getBearerToken(request)) {
      const ctx = await requireUser(request);
      userId = ctx.user.id;
      email = ctx.user.email;
    } else {
      const body = await request.json().catch(() => ({}));
      userId = typeof body.userId === 'string' ? body.userId : undefined;
      email = typeof body.email === 'string' ? body.email.toLowerCase() : undefined;
    }

    if (!userId || !email) throw new Error('Authentication or registration context required.');

    const supabase = getSupabaseAdminClient();
    const { data: patron, error } = await supabase
      .from('patrons')
      .select('id,user_id,email,full_name,email_verified_at')
      .eq('user_id', userId)
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!patron) throw new Error('No registration profile found.');
    if (patron.email_verified_at) return NextResponse.json({ sent: false, verified: true, policy });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await supabase.from('registration_verification_tokens').insert({
      user_id: userId,
      patron_id: patron.id,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    });
    if (tokenError) throw new Error(tokenError.message);

    const origin = getPublicOrigin(request);
    await sendRegistrationVerificationEmailServer({
      email: patron.email,
      full_name: patron.full_name,
      verificationLink: `${origin}/api/registration/verify?token=${encodeURIComponent(token)}`,
      expiresAt,
    });

    return NextResponse.json({ sent: true, expiresAt, policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
