import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyCoarSignature,
  checkCoarRateLimit,
  checkCoarSourceRateLimit,
  signCoarPayload,
  isDuplicateNonce,
  validateCoarUrl,
  isCoarConfigured,
  generateCoarNonce,
} from '@/server/interoperability/coar-security';
import { createHmac } from 'crypto';

const TEST_SECRET = 'a'.repeat(64);

function sign(payload: string, timestamp: string): string {
  return createHmac('sha256', TEST_SECRET).update(`${timestamp}.${payload}`).digest('hex');
}

describe('coar-security', () => {
  beforeEach(() => {
    vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', TEST_SECRET);
  });

  describe('isCoarConfigured', () => {
    it('returns true when secret is set', () => {
      expect(isCoarConfigured()).toBe(true);
    });

    it('returns false when secret is too short', () => {
      vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', 'short');
      expect(isCoarConfigured()).toBe(false);
    });
  });

  describe('verifyCoarSignature', () => {
    it('accepts valid signature', () => {
      const payload = '{"test":true}';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const sig = sign(payload, timestamp);
      expect(verifyCoarSignature(payload, sig, timestamp)).toBe(true);
    });

    it('rejects invalid signature', () => {
      const payload = '{"test":true}';
      const timestamp = String(Math.floor(Date.now() / 1000));
      expect(verifyCoarSignature(payload, 'invalidsig', timestamp)).toBe(false);
    });

    it('rejects expired timestamp', () => {
      const payload = '{"test":true}';
      const timestamp = String(Math.floor(Date.now() / 1000) - 600);
      const sig = sign(payload, timestamp);
      expect(verifyCoarSignature(payload, sig, timestamp)).toBe(false);
    });

    it('rejects future timestamp', () => {
      const payload = '{"test":true}';
      const timestamp = String(Math.floor(Date.now() / 1000) + 600);
      const sig = sign(payload, timestamp);
      expect(verifyCoarSignature(payload, sig, timestamp)).toBe(false);
    });

    it('rejects missing signature', () => {
      const payload = '{"test":true}';
      const timestamp = String(Math.floor(Date.now() / 1000));
      expect(verifyCoarSignature(payload, '', timestamp)).toBe(false);
    });

    it('rejects missing timestamp', () => {
      const payload = '{"test":true}';
      const sig = sign(payload, String(Math.floor(Date.now() / 1000)));
      expect(verifyCoarSignature(payload, sig, '')).toBe(false);
    });
  });

  describe('checkCoarRateLimit', () => {
    it('allows requests under limit', () => {
      const sender = 'https://example.com/sender-1';
      expect(checkCoarRateLimit(sender)).toBe(true);
    });

    it('blocks requests over limit', () => {
      const sender = 'https://example.com/sender-2';
      for (let i = 0; i < 30; i++) checkCoarRateLimit(sender);
      expect(checkCoarRateLimit(sender)).toBe(false);
    });

    it('tracks senders independently', () => {
      const senderA = 'https://example.com/sender-a';
      const senderB = 'https://example.com/sender-b';
      for (let i = 0; i < 30; i++) checkCoarRateLimit(senderA);
      expect(checkCoarRateLimit(senderA)).toBe(false);
      expect(checkCoarRateLimit(senderB)).toBe(true);
    });
  });

  describe('isDuplicateNonce', () => {
    it('detects duplicate nonce', async () => {
      const nonce = generateCoarNonce();
      expect(await isDuplicateNonce(nonce)).toBe(false);
      expect(await isDuplicateNonce(nonce)).toBe(true);
    });

    it('allows unique nonces', async () => {
      expect(await isDuplicateNonce(generateCoarNonce())).toBe(false);
      expect(await isDuplicateNonce(generateCoarNonce())).toBe(false);
    });
  });

  describe('validateCoarUrl', () => {
    it('accepts valid https URLs', () => {
      expect(validateCoarUrl('https://example.com/path')).toBe(true);
    });

    it('accepts valid http URLs', () => {
      expect(validateCoarUrl('http://example.com/path')).toBe(true);
    });

    it('rejects non-string values', () => {
      expect(validateCoarUrl(123)).toBe(false);
      expect(validateCoarUrl(null)).toBe(false);
      expect(validateCoarUrl(undefined)).toBe(false);
      expect(validateCoarUrl({})).toBe(false);
    });

    it('rejects localhost', () => {
      expect(validateCoarUrl('http://localhost/path')).toBe(false);
      expect(validateCoarUrl('http://127.0.0.1/path')).toBe(false);
      expect(validateCoarUrl('http://[::1]/path')).toBe(false);
    });

    it('rejects private IPs', () => {
      expect(validateCoarUrl('http://10.0.0.1/path')).toBe(false);
      expect(validateCoarUrl('http://192.168.1.1/path')).toBe(false);
      expect(validateCoarUrl('http://172.16.0.1/path')).toBe(false);
    });

    it('rejects link-local addresses', () => {
      expect(validateCoarUrl('http://169.254.1.1/path')).toBe(false);
    });

    it('rejects non-http protocols', () => {
      expect(validateCoarUrl('ftp://example.com')).toBe(false);
      expect(validateCoarUrl('file:///etc/passwd')).toBe(false);
      expect(validateCoarUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(validateCoarUrl('not-a-url')).toBe(false);
      expect(validateCoarUrl('')).toBe(false);
    });

    it('rejects overly long URLs', () => {
      expect(validateCoarUrl(`https://example.com/${'a'.repeat(3000)}`)).toBe(false);
    });
  });

  describe('generateCoarNonce', () => {
    it('generates unique nonces', () => {
      const a = generateCoarNonce();
      const b = generateCoarNonce();
      expect(a).not.toBe(b);
      expect(a.length).toBe(32);
    });
  });

  describe('signCoarPayload', () => {
    it('produces a signature accepted by verifyCoarSignature', () => {
      const payload = '{"@context":"https://www.w3.org/ns/activitystreams"}';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const sig = signCoarPayload(payload, timestamp);
      expect(verifyCoarSignature(payload, sig, timestamp)).toBe(true);
    });

    it('does not accept a signature over a different raw body', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const sig = signCoarPayload('{"a":1}', timestamp);
      expect(verifyCoarSignature('{"a":2}', sig, timestamp)).toBe(false);
    });

    it('throws when the secret is not configured', () => {
      vi.stubEnv('COAR_NOTIFY_SHARED_SECRET', 'short');
      expect(() => signCoarPayload('{}', '1')).toThrow(/not configured/);
    });
  });

  describe('checkCoarSourceRateLimit', () => {
    it('allows requests under limit', () => {
      expect(checkCoarSourceRateLimit('src-allow-1')).toBe(true);
    });

    it('blocks requests over the source limit', () => {
      for (let i = 0; i < 60; i++) checkCoarSourceRateLimit('src-block-1');
      expect(checkCoarSourceRateLimit('src-block-1')).toBe(false);
    });

    it('tracks sources independently', () => {
      for (let i = 0; i < 60; i++) checkCoarSourceRateLimit('src-a-1');
      expect(checkCoarSourceRateLimit('src-a-1')).toBe(false);
      expect(checkCoarSourceRateLimit('src-b-1')).toBe(true);
    });
  });
});
