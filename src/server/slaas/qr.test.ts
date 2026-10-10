import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateDynamicCredential, generateStaticCredential, hashForStorage,
  verifyCredential,
} from './qr';

beforeAll(() => {
  process.env.SLAAS_QR_SECRET = 'test-secret-for-unit-tests';
});

describe('SLAAS QR credential', () => {
  it('verifies a static credential and extracts claims', () => {
    const identityId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = generateStaticCredential(identityId);
    const result = verifyCredential(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe(identityId);
      expect(result.claims.aud).toBe('esut-access-gate');
      expect(result.claims.v).toBe(1);
      expect(result.claims.jti).toBeTruthy();
    }
  });

  it('rejects a forged (tampered-body) token', () => {
    const token = generateStaticCredential('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    const [body, sig] = token.split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    claims.sub = '11111111-1111-1111-1111-111111111111';
    const forgedBody = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const result = verifyCredential(`${forgedBody}.${sig}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });

  it('rejects a random/guessed token', () => {
    const result = verifyCredential('not-a-real-token.sig');
    expect(result.ok).toBe(false);
  });

  it('rejects an expired dynamic credential', () => {
    const token = generateDynamicCredential('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', -10);
    const result = verifyCredential(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('accepts a valid dynamic credential', () => {
    const token = generateDynamicCredential('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 120);
    const result = verifyCredential(token);
    expect(result.ok).toBe(true);
  });

  it('hashForStorage is deterministic and does not contain PII', () => {
    const token = generateStaticCredential('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    const h1 = hashForStorage(token);
    const h2 = hashForStorage(token);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).not.toContain('aaaaaaaa');
  });

  it('does not embed full name, matric, email, phone, or department in the token payload', () => {
    const identityId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const token = generateStaticCredential(identityId);
    const [body] = token.split('.');
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    expect(decoded).not.toMatch(/name|email|phone|matric|department/i);
  });
});
