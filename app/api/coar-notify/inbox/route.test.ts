import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac, randomUUID } from 'crypto';

const state = vi.hoisted(() => ({
  noncesInserted: [] as string[],
  notificationIds: [] as string[],
  storeError: false,
}));

const TEST_SECRET = 'c'.repeat(64);

vi.mock('@/server/supabase/adminClient', () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === 'coar_nonces') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: async () => ({
                data: state.noncesInserted.includes(value) ? { nonce: value } : null,
                error: null,
              }),
            }),
          }),
          insert: async (row: { nonce: string }) => {
            state.noncesInserted.push(row.nonce);
            return { error: null };
          },
        };
      }
      if (table === 'coar_notifications') {
        return {
          select: () => ({
            eq: (_col: string, value: string) => ({
              maybeSingle: async () => ({
                data: state.notificationIds.includes(value) ? { id: 'existing-row' } : null,
                error: null,
              }),
            }),
          }),
          insert: async (row: { notification_id: string }) => {
            if (state.storeError) return { error: { message: 'boom' } };
            state.notificationIds.push(row.notification_id);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST, GET } from './route';

function validPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `https://example.com/notify/${randomUUID()}`,
    type: ['coar-notify:EndorsementAction'],
    actor: { id: 'https://repo.example.com/actor', type: 'Service' },
    object: { id: 'https://repo.example.com/object/1', type: 'https://purl.org/coar/resource_type/c_6501' },
    target: { id: 'https://esutlibrary.edu.ng/inbox', type: 'Service' },
    ...over,
  };
}

function hmac(rawBody: string, timestamp: string): string {
  return createHmac('sha256', TEST_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
}

function post(rawBody: string, headers: Record<string, string> = {}, ip = '203.0.113.10'): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/coar-notify/inbox', {
      method: 'POST',
      body: rawBody,
      headers: { 'content-type': 'application/ld+json', 'x-forwarded-for': ip, ...headers },
    }) as never,
  );
}

interface SignedOptions {
  nonce?: string;
  ts?: number | string;
  sig?: string;
  ip?: string;
  rawOverride?: string;
}

function signedPost(payload: unknown, opts: SignedOptions = {}): Promise<Response> {
  const rawBody = opts.rawOverride ?? JSON.stringify(payload);
  const timestamp = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const nonce = opts.nonce ?? `nonce-${randomUUID()}`;
  const signature = opts.sig ?? hmac(rawBody, timestamp);
  return post(rawBody, { 'x-coar-signature': signature, 'x-coar-timestamp': timestamp, 'x-coar-nonce': nonce }, opts.ip);
}

describe('POST /api/coar-notify/inbox', () => {
  beforeEach(() => {
    vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', TEST_SECRET);
    vi.stubEnv('COAR_NOTIFY_TARGET_HOST', 'esutlibrary.edu.ng');
    state.noncesInserted.length = 0;
    state.notificationIds.length = 0;
    state.storeError = false;
  });

  it('accepts a correctly signed notification and stores it', async () => {
    const payload = validPayload();
    const res = await signedPost(payload);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(state.notificationIds).toContain(payload.id);
  });

  it('rejects a request without authentication headers', async () => {
    const res = await post(JSON.stringify(validPayload()), { 'x-coar-signature': '', 'x-coar-timestamp': '', 'x-coar-nonce': '' }, '198.51.100.1');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed signature and never claims the nonce', async () => {
    const before = state.noncesInserted.length;
    const res = await signedPost(validPayload(), { sig: 'deadbeef', ip: '198.51.100.2' });
    expect(res.status).toBe(401);
    expect(state.noncesInserted.length).toBe(before);
  });

  it('rejects a timestamp outside the allowed drift window', async () => {
    const res = await signedPost(validPayload(), { ts: Math.floor(Date.now() / 1000) - 600, ip: '198.51.100.3' });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed JSON body even when the signature is valid', async () => {
    const res = await signedPost(null, { rawOverride: '{"broken":', ip: '198.51.100.4' });
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported content type', async () => {
    const res = await post(JSON.stringify(validPayload()), {
      'content-type': 'text/plain',
      'x-coar-signature': 'x',
      'x-coar-timestamp': String(Math.floor(Date.now() / 1000)),
      'x-coar-nonce': `nonce-${randomUUID()}`,
    }, '198.51.100.5');
    expect(res.status).toBe(415);
  });

  it('rejects a payload with an unsupported activity structure', async () => {
    const res = await signedPost(validPayload({ type: [] }), { ip: '198.51.100.6' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid sender (localhost actor)', async () => {
    const res = await signedPost(validPayload({ actor: { id: 'http://localhost/actor', type: 'Service' } }), { ip: '198.51.100.7' });
    expect(res.status).toBe(400);
  });

  it('rejects a target that does not match the configured host', async () => {
    const res = await signedPost(validPayload({ target: { id: 'https://other.example.com/inbox', type: 'Service' } }), { ip: '198.51.100.8' });
    expect(res.status).toBe(400);
  });

  it('rejects a replayed nonce', async () => {
    const nonce = `replay-${randomUUID()}`;
    const first = await signedPost(validPayload(), { nonce, ip: '198.51.100.9' });
    expect(first.status).toBe(201);
    const second = await signedPost(validPayload(), { nonce, ip: '198.51.100.9' });
    expect(second.status).toBe(409);
  });

  it('returns duplicate:true for a previously stored activity id with a fresh nonce', async () => {
    const payload = validPayload();
    const first = await signedPost(payload, { ip: '198.51.100.11' });
    expect(first.status).toBe(201);
    const second = await signedPost(payload, { ip: '198.51.100.11' });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.duplicate).toBe(true);
  });

  it('returns 503 when the shared secret is not configured', async () => {
    vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', 'short');
    const res = await signedPost(validPayload(), { ip: '198.51.100.12' });
    expect(res.status).toBe(503);
  });

  it('returns 500 without leaking internal error details when storage fails', async () => {
    state.storeError = true;
    const res = await signedPost(validPayload(), { ip: '198.51.100.13' });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('boom');
  });

  it('rate limits a single source after repeated attempts', async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) {
      const res = await post(JSON.stringify(validPayload()), {
        'x-coar-signature': 'bad',
        'x-coar-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-coar-nonce': `rl-${randomUUID()}`,
      }, '192.0.2.77');
      last = res.status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  it('rate limits a single actor across distinct sources', async () => {
    let sawRateLimit = false;
    for (let i = 0; i < 31; i++) {
      const res = await signedPost(
        validPayload({ actor: { id: 'https://flood.example.com/actor', type: 'Service' } }),
        { ip: `192.0.2.${100 + i}` },
      );
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
      expect(res.status).toBe(201);
    }
    expect(sawRateLimit).toBe(true);
  });

  it('serves the inbox description on GET', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('OrderedCollection');
  });
});
