import { NextResponse, type NextRequest } from 'next/server';
import { verifyTurnstileToken } from '@/server/security/turnstile';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const remoteIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const result = await verifyTurnstileToken(body.token, remoteIp, typeof body.action === 'string' ? body.action : null);
  if (!result.success) return NextResponse.json({ ok: false, error: result.error || 'Security challenge failed.' }, { status: 400 });
  return NextResponse.json({ ok: true, skipped: result.skipped ?? false });
}
