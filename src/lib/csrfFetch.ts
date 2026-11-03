const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const COOKIE_NAME = 'csrf-token';
const HEADER_NAME = 'x-csrf-token';

let installed = false;

function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return null;
  const value = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
  return value || null;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  return method.toUpperCase();
}

function sameOriginTarget(raw: string): URL | null {
  const base = typeof location === 'undefined' ? undefined : location.href;
  try {
    const target = new URL(raw, base);
    if (typeof location !== 'undefined' && target.origin !== location.origin) return null;
    return target;
  } catch {
    return null;
  }
}

export function installCsrfFetch(): void {
  if (installed) return;
  installed = true;
  const original = globalThis.fetch;
  if (typeof original !== 'function') return;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = requestMethod(input, init);
    if (!UNSAFE_METHODS.has(method)) return original(input, init);
    const target = sameOriginTarget(requestUrl(input));
    if (!target || !target.pathname.startsWith('/api/')) return original(input, init);
    const token = csrfToken();
    if (!token) return original(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (headers.has(HEADER_NAME)) return original(input, init);
    headers.set(HEADER_NAME, token);
    return original(input, { ...init, headers });
  };
}
