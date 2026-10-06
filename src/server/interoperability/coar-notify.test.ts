import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { createCoarNotify, sendCoarNotify, validateCoarNotify } from '@/server/interoperability/coar-notify';

const TEST_SECRET = 'd'.repeat(64);

describe('coar-notify', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('creates valid COAR Notify notification', () => {
    const notification = createCoarNotify({
      actorId: 'https://example.com/actor',
      objectId: 'https://example.com/object',
      targetId: 'https://example.com/target',
    });
    expect(notification['@context']).toContain('activitystreams');
    expect(notification.type).toContain('coar-notify:EndorsementAction');
    expect(notification.actor.id).toBe('https://example.com/actor');
  });

  it('validates COAR Notify payload', () => {
    const valid = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://example.com/1',
      type: ['coar-notify:EndorsementAction'],
      actor: { id: 'https://example.com/a', type: 'Service' },
      object: { id: 'https://example.com/o', type: 'Document' },
      target: { id: 'https://example.com/t', type: 'Service' },
    };
    expect(validateCoarNotify(valid)).toBe(true);
    expect(validateCoarNotify(null)).toBe(false);
    expect(validateCoarNotify({})).toBe(false);
  });

  it('rejects payloads with an empty or non-string activity type list', () => {
    const base = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://example.com/2',
      actor: { id: 'https://example.com/a', type: 'Service' },
      object: { id: 'https://example.com/o', type: 'Document' },
      target: { id: 'https://example.com/t', type: 'Service' },
    };
    expect(validateCoarNotify({ ...base, type: [] })).toBe(false);
    expect(validateCoarNotify({ ...base, type: 'coar-notify:EndorsementAction' })).toBe(false);
    expect(validateCoarNotify({ ...base, type: [42] })).toBe(false);
  });

  it('rejects payloads whose actor lacks a string id', () => {
    const base = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://example.com/3',
      type: ['coar-notify:EndorsementAction'],
      actor: { type: 'Service' },
      object: { id: 'https://example.com/o', type: 'Document' },
      target: { id: 'https://example.com/t', type: 'Service' },
    };
    expect(validateCoarNotify(base)).toBe(false);
  });

  it('signs outbound notifications with HMAC headers when configured', async () => {
    vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', TEST_SECRET);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const notification = createCoarNotify({
      actorId: 'https://example.com/actor',
      objectId: 'https://example.com/object',
      targetId: 'https://esutlibrary.edu.ng/target',
    });
    const ok = await sendCoarNotify(notification, 'https://esutlibrary.edu.ng/api/coar-notify/inbox');
    expect(ok).toBe(true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    const rawBody = init.body as string;
    const timestamp = init.headers['x-coar-timestamp'];
    const signature = init.headers['x-coar-signature'];
    expect(timestamp).toMatch(/^\d+$/);
    expect(init.headers['x-coar-nonce']).toHaveLength(32);
    const expected = createHmac('sha256', TEST_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
    expect(signature).toBe(expected);
    expect(init.headers['Content-Type']).toBe('application/ld+json');
  });

  it('omits signature headers when the shared secret is not configured', async () => {
    vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', '');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const notification = createCoarNotify({
      actorId: 'https://example.com/actor',
      objectId: 'https://example.com/object',
      targetId: 'https://esutlibrary.edu.ng/target',
    });
    await sendCoarNotify(notification, 'https://esutlibrary.edu.ng/api/coar-notify/inbox');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.headers['x-coar-signature']).toBeUndefined();
    expect(init.headers['x-coar-nonce']).toBeUndefined();
  });

  it('returns false when the inbox request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const notification = createCoarNotify({
      actorId: 'https://example.com/actor',
      objectId: 'https://example.com/object',
      targetId: 'https://esutlibrary.edu.ng/target',
    });
    await expect(sendCoarNotify(notification, 'https://esutlibrary.edu.ng/inbox')).resolves.toBe(false);
  });
});
