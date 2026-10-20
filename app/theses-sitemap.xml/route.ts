import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await getSupabaseAdminClient()
    .from('theses')
    .select('id,updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(50000);
  const base = appBaseUrl();
  const nowIso = new Date().toISOString();
  const urls = (data ?? []).map(
    (item) => `<url><loc>${base}/theses/${encodeURIComponent(item.id)}</loc><lastmod>${item.updated_at ?? nowIso}</lastmod></url>`,
  ).join('');
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600, s-maxage=3600' } },
  );
}
