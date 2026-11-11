import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logging/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { isEmailbumpConfigReady, sendWithEmailbump } from './emailbump.provider';
import { EmailDeliveryError } from '../types';

const config = { apiKey: 'ebk_test', fromEmail: 'noreply@viaemailbump.com', fromName: 'ESUT Library' };
const baseMessage = {
  to: 'reader@esut.edu.ng',
  subject: 'Test subject',
  html: '<p>Hello</p>',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isEmailbumpConfigReady', () => {
  it('requires an api key and from address', () => {
    expect(isEmailbumpConfigReady({ apiKey: 'ebk_test', fromEmail: 'a@b.com' })).toBe(true);
    expect(isEmailbumpConfigReady({ apiKey: '', fromEmail: 'a@b.com' })).toBe(false);
    expect(isEmailbumpConfigReady({ apiKey: 'ebk_test', fromEmail: '' })).toBe(false);
  });
});

describe('sendWithEmailbump', () => {
  it('posts the Resend-style payload and returns the provider id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'eb_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWithEmailbump(baseMessage, config);

    expect(result).toEqual({ success: true, provider: 'emailbump', messageId: 'eb_1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://emailbump.com/api/v1/emails');
    const body = JSON.parse(String(init?.body));
    expect(body.from).toBe('ESUT Library <noreply@viaemailbump.com>');
    expect(body.to).toEqual(['reader@esut.edu.ng']);
    expect(init?.headers?.Authorization).toBe('Bearer ebk_test');
  });

  it('maps 429 to a rate-limited error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"rate"}', { status: 429 })));
    const promise = sendWithEmailbump(baseMessage, config);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.code).toBe('rate_limited');
      expect(error.category).toBe('rate_limit');
    });
  });

  it('maps 401 to an authentication error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"bad key"}', { status: 401 })));
    const promise = sendWithEmailbump(baseMessage, config);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.category).toBe('authentication');
    });
  });

  it('treats connection refusal as a non-ambiguous failure', async () => {
    const failure = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    const promise = sendWithEmailbump(baseMessage, config);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.category).toBe('network');
      expect(error.ambiguous).toBe(false);
    });
  });

  it('treats a timeout as an ambiguous failure', async () => {
    const failure = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    const promise = sendWithEmailbump(baseMessage, config);
    await expect(promise).rejects.toBeInstanceOf(EmailDeliveryError);
    await promise.catch((error: EmailDeliveryError) => {
      expect(error.category).toBe('timeout');
      expect(error.ambiguous).toBe(true);
    });
  });

  it('fails with not_configured when the key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const promise = sendWithEmailbump(baseMessage, { apiKey: '', fromEmail: 'a@b.com' });
    await expect(promise).rejects.toMatchObject({ code: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
