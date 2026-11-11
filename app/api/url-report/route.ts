import { NextResponse } from 'next/server';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

const SITE_TITLE = 'ESUT Smart Library';
const SITE_DESCRIPTION =
  'The official digital library platform of Enugu State University of Science and Technology — powering research, catalogues, repositories, AI-librarian services, and academic resources.';
const NOINDEX_PREFIXES = ['/admin', '/dashboard', '/supervisor', '/reset-password', '/thesis/submit', '/thesis/status'];

function sanitizeControl(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x20 && code !== 0x7f) out += char;
  }
  return out;
}

function safePath(value: string | null): string {
  if (!value) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (!decoded.startsWith('/') || decoded.includes('..')) return '/';
  return sanitizeControl(decoded).slice(0, 512) || '/';
}

export async function GET(request: Request) {
  const envBase = (process.env.APP_BASE_URL ?? '').replace(/\/+$/, '') || null;
  const path = safePath(new URL(request.url).searchParams.get('path'));
  const base = appBaseUrl();
  const indexable = !NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return NextResponse.json({
    success: true,
    data: {
      base,
      canonical: `${base}${path}`,
      hreflang: [],
      i18n: { languages: ['en', 'fr'], strategy: 'cookie' },
      robots: {
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        indexable,
        sitemap: `${base}/sitemap.xml`,
        disallow: NOINDEX_PREFIXES,
      },
      source: envBase ? 'env:APP_BASE_URL' : 'static:fallback',
    },
  });
}
