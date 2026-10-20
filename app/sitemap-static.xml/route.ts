import { NextResponse } from 'next/server';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

interface StaticUrl {
  path: string;
  changefreq: string;
  priority: string;
}

const STATIC_URLS: StaticUrl[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/catalogue', changefreq: 'daily', priority: '0.9' },
  { path: '/categories', changefreq: 'weekly', priority: '0.7' },
  { path: '/repository', changefreq: 'daily', priority: '0.9' },
  { path: '/search/global', changefreq: 'weekly', priority: '0.8' },
  { path: '/databases', changefreq: 'weekly', priority: '0.8' },
  { path: '/ai-librarian', changefreq: 'monthly', priority: '0.7' },
  { path: '/thesis', changefreq: 'weekly', priority: '0.7' },
  { path: '/theses', changefreq: 'weekly', priority: '0.8' },
  { path: '/events', changefreq: 'daily', priority: '0.8' },
  { path: '/blog', changefreq: 'daily', priority: '0.8' },
  { path: '/newsletter', changefreq: 'monthly', priority: '0.5' },
  { path: '/lecturers', changefreq: 'weekly', priority: '0.7' },
  { path: '/webometrics', changefreq: 'weekly', priority: '0.6' },
  { path: '/library/babs-fafunwa', changefreq: 'monthly', priority: '0.7' },
  { path: '/library/hon-idia-babalola', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/ondo-city-public', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/special-library', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/faculty-science', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/faculty-education', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/faculty-management-social', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/faculty-vocational-technical', changefreq: 'monthly', priority: '0.6' },
  { path: '/library/faculty-arts', changefreq: 'monthly', priority: '0.6' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/team', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/faq', changefreq: 'monthly', priority: '0.7' },
  { path: '/tutorial', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.4' },
  { path: '/terms', changefreq: 'yearly', priority: '0.4' },
  { path: '/accessibility', changefreq: 'yearly', priority: '0.4' },
];

export async function GET() {
  const base = appBaseUrl();
  const lastmod = new Date().toISOString();
  const urls = STATIC_URLS.map(
    (entry) => `  <url><loc>${base}${entry.path}</loc><lastmod>${lastmod}</lastmod><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new NextResponse(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=3600' } });
}
