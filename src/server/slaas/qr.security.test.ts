import { createHmac } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateDynamicCredential,
  generateStaticCredential,
  signVisitorPass,
  verifyCredential,
  verifyVisitorPass,
} from './qr';

const TEST_SECRET = 'slaas-redteam-test-secret-value';

beforeAll(() => {
  process.env.SLAAS_QR_SECRET = TEST_SECRET;
});

function signWith(body: unknown, secret: string): string {
  const bodyB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret).update(bodyB64).digest('base64url');
  return `${bodyB64}.${sig}`;
}

function decodeBody(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
}

describe('SLAAS QR red-team attacks', () => {
  it('static credential is deterministic per identity and distinct across identities', () => {
    const a1 = generateStaticCredential('11111111-1111-4111-8111-111111111111');
    const a2 = generateStaticCredential('11111111-1111-4111-8111-111111111111');
    const b = generateStaticCredential('22222222-2222-4222-8222-222222222222');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
  });

  it('rejects a token signed with a different secret', () => {
    const claims = decodeBody(generateStaticCredential('11111111-1111-4111-8111-111111111111'));
    const result = verifyCredential(signWith(claims, 'attacker-guess'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });

  it('rejects a correctly signed token with a swapped audience', () => {
    const claims = decodeBody(generateStaticCredential('11111111-1111-4111-8111-111111111111'));
    const result = verifyCredential(signWith({ ...claims, aud: 'other-gate' }, TEST_SECRET));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_audience');
  });

  it('rejects a correctly signed token with a wrong token version', () => {
    const claims = decodeBody(generateStaticCredential('11111111-1111-4111-8111-111111111111'));
    const result = verifyCredential(signWith({ ...claims, v: 99 }, TEST_SECRET));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_version');
  });

  it('rejects a correctly signed expired token even with a fresh jti', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = verifyCredential(
      signWith(
        { v: 1, sub: '11111111-1111-4111-8111-111111111111', iss: 'esut-library', aud: 'esut-access-gate', iat: now - 600, exp: now - 1, jti: 'fresh-nonce' },
        TEST_SECRET,
      ),
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('accepts exactly at exp and rejects one second after', () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { v: 1, sub: '11111111-1111-4111-8111-111111111111', iss: 'esut-library', aud: 'esut-access-gate', iat: now, exp: now, jti: 'boundary' };
    expect(verifyCredential(signWith(claims, TEST_SECRET), now).ok).toBe(true);
    expect(verifyCredential(signWith(claims, TEST_SECRET), now + 1).ok).toBe(false);
  });

  it('rejects a subject swap made to a stored token without the secret', () => {
    const victim = generateStaticCredential('33333333-3333-4333-8333-333333333333');
    const claims = decodeBody(victim);
    const forgedBody = Buffer.from(JSON.stringify({ ...claims, sub: '44444444-4444-4444-8444-444444444444' })).toString('base64url');
    const originalBody = victim.split('.')[0];
    const tamperedOriginal = victim.replace(originalBody, forgedBody);
    const forged = `${forgedBody}.${victim.split('.')[1]}`;
    expect(verifyCredential(forged).ok).toBe(false);
    expect(verifyCredential(tamperedOriginal).ok).toBe(false);
  });

  it('rejects malformed and edge-case inputs without throwing', () => {
    const cases = ['', '.', 'a.', '.b', 'not-a-token', 'a.b.c', 'ab .cd', '..'];
    for (const token of cases) {
      expect(verifyCredential(token).ok).toBe(false);
      expect(verifyVisitorPass(token).ok).toBe(false);
    }
    expect(verifyCredential(undefined as unknown as string).ok).toBe(false);
    expect(verifyVisitorPass(null as unknown as string).ok).toBe(false);
    expect(verifyCredential(12345 as unknown as string).ok).toBe(false);
  });

  it('rejects a non-JSON body signed with the correct secret', () => {
    const body = Buffer.from('not-json').toString('base64url');
    const sig = createHmac('sha256', TEST_SECRET).update(body).digest('base64url');
    expect(verifyCredential(`${body}.${sig}`).ok).toBe(false);
    expect(verifyVisitorPass(`${body}.${sig}`).ok).toBe(false);
  });

  it('does not accept stripped or padded signatures', () => {
    const token = generateStaticCredential('11111111-1111-4111-8111-111111111111');
    const body = token.split('.')[0];
    expect(verifyCredential(`${body}.`).ok).toBe(false);
    expect(verifyCredential(body).ok).toBe(false);
    expect(verifyCredential(`${body}.${'A'.repeat(40)}`).ok).toBe(false);
  });

  it('keeps visitor passes and patron credentials mutually exclusive', () => {
    const visitorToken = signVisitorPass('55555555-5555-4555-8555-555555555555', new Date(Date.now() - 1000), new Date(Date.now() + 60000));
    const asPatron = verifyCredential(visitorToken);
    expect(asPatron.ok).toBe(false);
    if (!asPatron.ok) expect(asPatron.reason).toBe('wrong_audience');

    const patronToken = generateStaticCredential('66666666-6666-4666-8666-666666666666');
    const asVisitor = verifyVisitorPass(patronToken);
    expect(asVisitor.ok).toBe(false);
    if (!asVisitor.ok) expect(asVisitor.reason).toBe('not_visitor');
  });

  it('rejects a visitor pass signed with a different secret', () => {
    const now = Date.now();
    const valid = signVisitorPass('55555555-5555-4555-8555-555555555555', new Date(now - 1000), new Date(now + 60000));
    const body = valid.split('.')[0];
    const forged = `${body}.${createHmac('sha256', 'attacker-key').update(body).digest('base64url')}`;
    const result = verifyVisitorPass(forged);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('bad_signature');
  });

  it('rejects an expired visitor pass', () => {
    const token = signVisitorPass('55555555-5555-4555-8555-555555555555', new Date(Date.now() - 120000), new Date(Date.now() - 60000));
    const result = verifyVisitorPass(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects a visitor pass whose kind or version was rewritten', () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { v: 1, kind: 'visitor', sub: '55555555-5555-4555-8555-555555555555', iat: now, exp: now + 60, jti: 'x' };
    const wrongKind = verifyVisitorPass(signWith({ ...claims, kind: 'patron' }, TEST_SECRET));
    expect(wrongKind.ok).toBe(false);
    if (!wrongKind.ok) expect(wrongKind.reason).toBe('not_visitor');
    const wrongVersion = verifyVisitorPass(signWith({ ...claims, v: 2 }, TEST_SECRET));
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.reason).toBe('not_visitor');
  });

  it('visitor pass payload carries only the visitor id and no profile data', () => {
    const token = signVisitorPass('55555555-5555-4555-8555-555555555555', new Date(), new Date(Date.now() + 60000));
    const claims = decodeBody(token);
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'jti', 'kind', 'sub', 'v']);
    expect(JSON.stringify(claims)).not.toMatch(/@|phone|matric|email/i);
  });

  it('a dynamically generated credential honors its ttl', () => {
    const short = generateDynamicCredential('11111111-1111-4111-8111-111111111111', -1);
    expect(verifyCredential(short).ok).toBe(false);
    const valid = generateDynamicCredential('11111111-1111-4111-8111-111111111111', 120);
    expect(verifyCredential(valid).ok).toBe(true);
  });
});
