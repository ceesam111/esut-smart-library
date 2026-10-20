import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const nowIso = new Date().toISOString();
  const { data } = await getSupabaseAdminClient()
    .from('repository_items')
    .select('id,updated_at')
    .eq('status', 'published')
    .eq('visibility', 'global')
    .or(`embargo_until.is.null,embargo_until.lte.${nowIso}`)
    .order('updated_at', { ascending: false })
    .limit(50000);
  const base = appBaseUrl();
  const urls = (data ?? []).map((item) => `<url><loc>${base}/repository/${encodeURIComponent(item.id)}</loc><lastmod>${item.updated_at ?? nowIso}</lastmod></url>`).join('');
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=3600' } });
}
