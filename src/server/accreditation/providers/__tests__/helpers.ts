import { expect, vi } from 'vitest';

const REAL_FETCH = globalThis.fetch;

export interface MockFetch {
  call: (url: string, options?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean; headers: Record<string, string>; body: string }>;
}

export function mockFetch(handler: (url: string, options?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean; headers: Record<string, string>; body: string }>): void {
  const mockFn = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.href : url instanceof Request ? url.url : String(url);
    const headers: Record<string, string> = {};
    const initHeaders = (init?.headers as Record<string, string> | undefined) ?? {};
    for (const [key, value] of Object.entries(initHeaders)) headers[key] = value;
    const result = await handler(urlStr, {
      headers,
      signal: (init?.signal as AbortSignal | undefined) ?? undefined,
    });
    return new Response(result.body, {
      status: result.status,
      statusText: String(result.status),
      headers: result.headers,
    });
  });
  globalThis.fetch = mockFn as typeof fetch;
}

export function useRealFetch(): void {
  globalThis.fetch = REAL_FETCH;
}

export function expectFetchCalled(mockFn: ReturnType<typeof vi.fn>, urlContains: string): void {
  const calls = mockFn.mock.calls as Array<Array<{ toString?: () => string } | string>>;
  const matched = calls.some((call) => {
    const urlArg = call[0];
    const urlStr = typeof urlArg === 'string' ? urlArg : urlArg?.toString?.() ?? '';
    return urlStr.includes(urlContains);
  });
  expect(matched, `Expected fetch to be called with URL containing "${urlContains}"`).toBe(true);
}