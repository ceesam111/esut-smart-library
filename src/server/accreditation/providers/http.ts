const DEFAULT_TIMEOUT_MS = 8000;

const baseURL = (): string => (process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'esut-smart-library').replace(/\/+$/, '');

const userAgent = (): string =>
  `${baseURL() || 'esut-smart-library'} (open-access accreditation harvest; contact: library@esut.edu.ng)`;

export interface ProviderFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ProviderFetchOutcome {
  status: number | null;
  body: string | null;
  error: string | null;
  rateLimitedUntil: string | null;
}

export const parseRateLimitedUntil = (headers: Headers | null): string | null => {
  if (!headers) return null;
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const asNumber = Number(retryAfter);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      const looksLikeEpochMs = asNumber > 1_000_000_000_000;
      return looksLikeEpochMs
        ? new Date(asNumber).toISOString()
        : new Date(Date.now() + asNumber * 1000).toISOString();
    }
    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) return new Date(asDate).toISOString();
    return new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }
  const via = headers.get('x-rate-limit-reset') ?? headers.get('ratelimit-reset');
  if (via) {
    const asNumber = Number(via);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
      return new Date(ms).toISOString();
    }
  }
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
};

export async function providerFetch(url: string, options?: ProviderFetchOptions): Promise<ProviderFetchOutcome> {
  let controller: AbortController;
  try {
    controller = new AbortController();
  } catch {
    return { status: null, body: null, error: 'abort unavailable', rateLimitedUntil: null };
  }
  let timer: number | NodeJS.Timeout | null = null;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        return;
      }
    }, timeoutMs);
  }
  const outerSignal = options?.signal;
  const onOuterAbort = () => {
    try {
      controller.abort();
    } catch {
      return;
    }
  };
  if (outerSignal) {
    if (outerSignal.aborted) onOuterAbort();
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': userAgent(),
    ...(options?.headers ?? {}),
  };
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    const body = await response.text();
    if (response.status === 429) {
      return { status: 429, body, error: 'rate limited', rateLimitedUntil: parseRateLimitedUntil(response.headers) };
    }
    if (!response.ok) {
      return { status: response.status, body, error: `http ${response.status}`, rateLimitedUntil: null };
    }
    return { status: response.status, body, error: null, rateLimitedUntil: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network error';
    const isAbort = error instanceof Error && (error.name === 'AbortError' || /abort|timed? out/i.test(message));
    return { status: null, body: null, error: isAbort ? `timeout after ${timeoutMs}ms` : 'network error', rateLimitedUntil: null };
  } finally {
    if (timer) clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

export async function providerFetchJson(url: string, options?: ProviderFetchOptions): Promise<ProviderFetchOutcome & { json: unknown }> {
  const outcome = await providerFetch(url, options);
  if (outcome.error !== null) return { ...outcome, json: null };
  try {
    return { ...outcome, json: JSON.parse(outcome.body ?? 'null') };
  } catch {
    return { ...outcome, json: null, error: 'invalid json' };
  }
}

export function harvestErrorOutcome(outcome: ProviderFetchOutcome): { items: never[]; rateLimitedUntil: string | null; error: string } {
  if (outcome.error === 'rate limited' || outcome.status === 429) {
    return { items: [], rateLimitedUntil: outcome.rateLimitedUntil, error: 'rate limited' };
  }
  return { items: [], rateLimitedUntil: null, error: outcome.error ?? 'unknown error' };
}

export function queryUrl(base: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}