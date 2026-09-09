import { NextResponse } from 'next/server';
import { getTurnstileSiteKey } from '@/server/security/turnstile';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ siteKey: getTurnstileSiteKey() || null });
}
