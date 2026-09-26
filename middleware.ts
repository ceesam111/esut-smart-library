import arcjet, { detectBot, shield } from '@arcjet/next';
import { NextResponse, type NextRequest } from 'next/server';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const sensitivePrefixes = ['/api/auth', '/api/generate-questions', '/api/admin/catalogue/enrich-catalogue', '/api/admin/harvest', '/api/resource-requests/external'];
const sensitiveExact = new Set(['/api/search/resources']);
const csrfExemptPrefixes = ['/api/ai/', '/api/security/turnstile/', '/api/registration/'];
const devBuckets = new Map<string, { count: number; resetAt: number }>();

const ajKey = process.env.ARCJET_KEY || process.env.ARC_JET || '';
const aj = ajKey
  ? arcjet({
      key: ajKey,
      rules: [
        shield({ mode: 'LIVE' }),
        detectBot({ mode: 'LIVE', allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:MONITOR'] }),
      ],
    })
  : null;

function requestId(request: NextRequest) {
  return request.headers.get('x-request-id') || crypto.randomUUID();
}

function allowedOrigins() {
  return new Set([
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean),
  ].filter(Boolean) as string[]);
}

function isAllowedOrigin(request: NextRequest, origin: string | null) {
  if (!origin) return true;
  if (origin === request.nextUrl.origin) return true;
  const allowed = allowedOrigins();
  if (allowed.size === 0 && process.env.NODE_ENV !== 'production') return true;
  return allowed.has(origin);
}

function isSensitive(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (sensitivePrefixes.some((prefix) => path.startsWith(prefix))) return true;
  if (sensitiveExact.has(path) && request.nextUrl.searchParams.get('expand') === 'true') return true;
  return false;
}

function shouldUseArcjet(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (sensitiveExact.has(path)) return false;
  return sensitivePrefixes.some((prefix) => path.startsWith(prefix));
}

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || 'unknown';
}

function devRateLimit(request: NextRequest) {
  if (!isSensitive(request)) return null;
  const key = `${clientKey(request)}:${request.nextUrl.pathname}`;
  const max = Number(process.env.RATE_LIMIT_SENSITIVE_MAX || 60);
  const windowMs = Number(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MS || 60_000);
  const now = Date.now();
  const bucket = devBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    devBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > max) return Math.ceil((bucket.resetAt - now) / 1000);
  return null;
}

function applySecurityHeaders(response: NextResponse, id: string) {
  response.headers.set('x-request-id', id);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=(), payment=()');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; child-src https://challenges.cloudflare.com; worker-src 'self' blob:; media-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload');
  return response;
}

function corsResponse(request: NextRequest, id: string) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(request, origin)) {
    return applySecurityHeaders(NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Origin not allowed.', requestId: id } }, { status: 403 }), id);
  }
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (origin) response.headers.set('access-control-allow-origin', origin);
    response.headers.set('vary', 'Origin');
    response.headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.headers.set('access-control-allow-headers', 'authorization,content-type,x-csrf-token,x-request-id,x-requested-with');
    response.headers.set('access-control-max-age', '600');
    return applySecurityHeaders(response, id);
  }
  return null;
}

function csrfFailure(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith('/api/')) return false;
  if (csrfExemptPrefixes.some((prefix) => path.startsWith(prefix))) return false;
  if (!unsafeMethods.has(request.method)) return false;
  if (request.headers.get('authorization')?.toLowerCase().startsWith('bearer ')) return false;
  const hasCookieAuth = Boolean(request.headers.get('cookie'));
  if (!hasCookieAuth) return false;
  const token = request.cookies.get('csrf-token')?.value;
  const header = request.headers.get('x-csrf-token');
  return !token || !header || token !== header;
}

export async function middleware(request: NextRequest) {
  const id = requestId(request);
  const cors = request.nextUrl.pathname.startsWith('/api/') ? corsResponse(request, id) : null;
  if (cors) return cors;

  if (request.nextUrl.pathname.startsWith('/api/') && !isAllowedOrigin(request, request.headers.get('origin'))) {
    return applySecurityHeaders(NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Origin not allowed.', requestId: id } }, { status: 403 }), id);
  }

  if (csrfFailure(request)) {
    return applySecurityHeaders(NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'CSRF check failed.', requestId: id } }, { status: 403 }), id);
  }

  const retryAfter = devRateLimit(request);
  if (retryAfter) {
    const response = NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.', requestId: id } }, { status: 429 });
    response.headers.set('retry-after', String(retryAfter));
    return applySecurityHeaders(response, id);
  }

  if (aj && shouldUseArcjet(request)) {
    const decision = await aj.protect(request);
    if (decision.isDenied()) {
      const status = decision.reason.isRateLimit() ? 429 : 403;
      return applySecurityHeaders(NextResponse.json({ success: false, error: { code: status === 429 ? 'RATE_LIMITED' : 'FORBIDDEN', message: status === 429 ? 'Too many requests.' : 'Request blocked.', requestId: id } }, { status }), id);
    }
  }

  const response = NextResponse.next({ request: { headers: request.headers } });
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin && isAllowedOrigin(request, origin)) {
      response.headers.set('access-control-allow-origin', origin);
      response.headers.set('vary', 'Origin');
    }
  }
  return applySecurityHeaders(response, id);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)'],
};
