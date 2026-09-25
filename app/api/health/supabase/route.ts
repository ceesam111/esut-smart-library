import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ ok: false, supabase: 'not_configured' }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/catalogue_items?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    return NextResponse.json({
      ok: response.ok,
      supabase: response.ok ? 'reachable' : 'unhealthy',
      status: response.status,
      timestamp: new Date().toISOString(),
    }, { status: response.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, supabase: 'unreachable' }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
