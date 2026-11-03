import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const ORIGIN = 'https://virtuallibrary.esut.edu.ng';

type FetchCall = [RequestInfo | URL, RequestInit | undefined];

describe('installCsrfFetch', () => {
  let stub: Mock;
  let mod: typeof import('./csrfFetch');

  beforeEach(async () => {
    vi.resetModules();
    stub = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', stub);
    vi.stubGlobal('location', { href: `${ORIGIN}/search/global`, origin: ORIGIN });
    vi.stubGlobal('document', { cookie: '' });
    mod = await import('./csrfFetch');
    mod.installCsrfFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function call(index = 0): FetchCall {
    return stub.mock.calls[index] as unknown as FetchCall;
  }

  it('adds the csrf header to same-origin unsafe api requests', async () => {
    document.cookie = 'locale=en; csrf-token=token-123';
    await globalThis.fetch('/api/events/track', { method: 'POST', keepalive: true });
    const [input, init] = call();
    expect(input).toBe('/api/events/track');
    expect(new Headers(init?.headers).get('x-csrf-token')).toBe('token-123');
    expect(init?.keepalive).toBe(true);
  });

  it('leaves safe methods untouched', async () => {
    document.cookie = 'csrf-token=token-123';
    await globalThis.fetch('/api/health');
    expect(stub.mock.calls[0]).toEqual(['/api/health', undefined]);
  });

  it('leaves cross-origin requests untouched', async () => {
    document.cookie = 'csrf-token=token-123';
    await globalThis.fetch('https://example.com/api/hooks', { method: 'POST' });
    const [, init] = call();
    expect(new Headers(init?.headers).has('x-csrf-token')).toBe(false);
  });

  it('leaves same-origin non-api requests untouched', async () => {
    document.cookie = 'csrf-token=token-123';
    await globalThis.fetch('/webhook', { method: 'POST' });
    const [, init] = call();
    expect(new Headers(init?.headers).has('x-csrf-token')).toBe(false);
  });

  it('passes through unchanged when the token cookie is absent', async () => {
    const init = { method: 'POST' };
    await globalThis.fetch('/api/events/track', init);
    expect(call()[1]).toBe(init);
  });

  it('keeps a client-provided header as-is', async () => {
    document.cookie = 'csrf-token=token-123';
    await globalThis.fetch('/api/events/track', {
      method: 'POST',
      headers: { 'x-csrf-token': 'preset' },
    });
    const [, init] = call();
    expect(new Headers(init?.headers).get('x-csrf-token')).toBe('preset');
  });

  it('merges the header when a Request instance is passed', async () => {
    document.cookie = 'csrf-token=token-123';
    await globalThis.fetch(new Request(`${ORIGIN}/api/events/track`, { method: 'POST' }));
    const [, init] = call();
    expect(new Headers(init?.headers).get('x-csrf-token')).toBe('token-123');
  });

  it('installs only once', () => {
    const wrapped = globalThis.fetch;
    mod.installCsrfFetch();
    expect(globalThis.fetch).toBe(wrapped);
  });
});
