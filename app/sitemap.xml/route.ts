import { NextResponse } from 'next/server';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = appBaseUrl();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${base}/sitemap-static.xml</loc></sitemap>
  <sitemap><loc>${base}/repository-sitemap.xml</loc></sitemap>
  <sitemap><loc>${base}/catalog-sitemap.xml</loc></sitemap>
  <sitemap><loc>${base}/theses-sitemap.xml</loc></sitemap>
</sitemapindex>`;
  return new NextResponse(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=3600' } });
}
