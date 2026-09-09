import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await getSupabaseAdminClient().from('catalogue_items').select('id,updated_at').order('updated_at', { ascending: false }).limit(50000);
  const urls = (data ?? []).map((item) => `<url><loc>https://esutlibrary.edu.ng/catalog/${item.id}</loc><lastmod>${item.updated_at ?? new Date().toISOString()}</lastmod></url>`).join('');
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'content-type': 'application/xml' } });
}
