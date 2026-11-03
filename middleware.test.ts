import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

const PAGE = 'https://virtuallibrary.esut.edu.ng';

function trackRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest(`${PAGE}/api/events/track`, { method: 'POST', headers });
}

async function payload(response: Response) {
  return (await response.json()) as {
    success?: boolean;
    error?: { code?: string; message?: string };
  };
}

describe('middleware csrf gate', () => {
  it('passes cookieless unsafe requests and issues a csrf token', async () => {
    const response = await middleware(trackRequest({}));
    expect(response.status).toBe(200);
    expect(response.cookies.get('csrf-token')?.value).toBeTruthy();
  });

  it('blocks cookie-bearing unsafe requests without the token cookie', async () => {
    const response = await middleware(trackRequest({ cookie: '__cf_bm=abc' }));
    expect(response.status).toBe(403);
    expect((await payload(response)).error?.message).toBe('CSRF check failed.');
    expect(response.cookies.get('csrf-token')?.value).toBeTruthy();
  });

  it('passes when the echoed header matches the token cookie', async () => {
    const response = await middleware(
      trackRequest({ cookie: 'other=1; csrf-token=abc123', 'x-csrf-token': 'abc123' }),
    );
    expect(response.status).toBe(200);
  });

  it('rejects a mismatched echoed header', async () => {
    const response = await middleware(
      trackRequest({ cookie: 'other=1; csrf-token=abc123', 'x-csrf-token': 'wrong' }),
    );
    expect(response.status).toBe(403);
    expect((await payload(response)).error?.message).toBe('CSRF check failed.');
  });

  it('rejects cookie-bearing requests that omit the echoed header', async () => {
    const response = await middleware(trackRequest({ cookie: 'other=1; csrf-token=abc123' }));
    expect(response.status).toBe(403);
    expect((await payload(response)).error?.message).toBe('CSRF check failed.');
  });

  it('leaves safe methods and non-api paths alone', async () => {
    const getResponse = await middleware(
      new NextRequest(`${PAGE}/api/health`, { headers: { cookie: 'other=1' } }),
    );
    expect(getResponse.status).toBe(200);
    const pageResponse = await middleware(
      new NextRequest(`${PAGE}/catalogue`, { headers: { cookie: 'other=1' } }),
    );
    expect(pageResponse.status).toBe(200);
  });

  it('keeps security headers on csrf rejections', async () => {
    const response = await middleware(trackRequest({ cookie: 'other=1' }));
    expect(response.status).toBe(403);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});
