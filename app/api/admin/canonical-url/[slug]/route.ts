import { NextResponse } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const SITE_TITLE = 'ESUT Smart Library';
const SITE_DESCRIPTION =
  'The official digital library platform of Enugu State University of Science and Technology — powering research, catalogues, repositories, AI-librarian services, and academic resources.';
const NOINDEX_PREFIXES = ['/admin', '/dashboard', '/supervisor', '/reset-password', '/thesis/submit', '/thesis/status'];

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

function stripPort(value: string): string {
  return value.toLowerCase().replace(/:\d+$/, '');
}

function isCanonicalHost(request: Request): boolean {
  const raw =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.trim() ||
    null;
  if (!raw) return false;
  return stripPort(raw) === stripPort(new URL(appBaseUrl()).host);
}

export async function GET(request: Request, { params }: Props) {
  try {
    if (process.env.NODE_ENV === 'production' && !isCanonicalHost(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden host' }, { status: 403 });
    }
    await requireRole(request, GLOBAL_ADMIN_ROLES);
    const { slug } = await params;
    const path = `/${safeSegment(slug)}`;
    const base = appBaseUrl();
    const envBase = (process.env.APP_BASE_URL ?? '').replace(/\/+$/, '') || null;
    const indexable = !NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? null;
    return NextResponse.json({
      success: true,
      data: {
        base,
        canonical: `${base}${path}`,
        robots: {
          title: SITE_TITLE,
          description: SITE_DESCRIPTION,
          indexable,
        },
        source: envBase ? 'env:APP_BASE_URL' : 'static:fallback',
        request: { forwardedHost, host: request.headers.get('host') },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 403 },
    );
  }
}
