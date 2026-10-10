import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const TOKEN_VERSION = 1;
const NONCE_BYTES = 24;
const DEFAULT_TTL_SECONDS = 120;

export type QrClaims = {
  /** v: token version */
  v: number;
  /** sub: access identity id */
  sub: string;
  /** iss: issuer */
  iss: string;
  /** aud: audience */
  aud: string;
  /** iat: issued-at (unix seconds) */
  iat: number;
  /** exp: expiry (unix seconds) */
  exp: number;
  /** jti: unique token id (nonce) */
  jti: string;
};

function getSecret(): string {
  const secret = process.env.SLAAS_QR_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SLAAS_QR_SECRET is required in production.');
    }
    return 'dev-only-slaas-qr-secret-do-not-use-in-prod';
  }
  return secret;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const STATIC_IAT = 0;
const STATIC_EXP = 4102444800;

export function generateStaticCredential(accessIdentityId: string): string {
  const payload: QrClaims = {
    v: TOKEN_VERSION,
    sub: accessIdentityId,
    iss: 'esut-library',
    aud: 'esut-access-gate',
    iat: STATIC_IAT,
    exp: STATIC_EXP,
    jti: `static-${createHmac('sha256', getSecret()).update(`static:${accessIdentityId}`).digest('hex').slice(0, 32)}`,
  };
  return signClaims(payload);
}
export function generateDynamicCredential(
  accessIdentityId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const nonce = randomBytes(NONCE_BYTES).toString('base64url');
  const iat = nowSeconds();
  const payload: QrClaims = {
    v: TOKEN_VERSION,
    sub: accessIdentityId,
    iss: 'esut-library',
    aud: 'esut-access-gate',
    iat,
    exp: iat + ttlSeconds,
    jti: nonce,
  };
  return signClaims(payload);
}

function signClaims(claims: QrClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; claims: QrClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_version' | 'wrong_audience' };

export function verifyCredential(token: string, now = nowSeconds()): VerifyResult {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' };
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'malformed' };

  const expectedSig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let claims: QrClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (claims.v !== TOKEN_VERSION) return { ok: false, reason: 'wrong_version' };
  if (claims.aud !== 'esut-access-gate') return { ok: false, reason: 'wrong_audience' };
  if (typeof claims.exp !== 'number' || claims.exp < now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claims };
}

export function hashForStorage(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface VisitorPassClaims {
  v: number;
  kind: 'visitor';
  sub: string;
  iat: number;
  exp: number;
  jti: string;
}

export function signVisitorPass(
  visitorId: string,
  validFrom: Date,
  validUntil: Date,
): string {
  const iat = Math.floor(validFrom.getTime() / 1000);
  const exp = Math.floor(validUntil.getTime() / 1000);
  const nonce = randomBytes(NONCE_BYTES).toString('base64url');
  const claims: VisitorPassClaims = { v: TOKEN_VERSION, kind: 'visitor', sub: visitorId, iat, exp, jti: nonce };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export type VisitorPassVerifyResult =
  | { ok: true; claims: VisitorPassClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'not_visitor' };

export function verifyVisitorPass(token: string, now = nowSeconds()): VisitorPassVerifyResult {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'malformed' };
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'malformed' };
  const expectedSig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'bad_signature' };
  }
  let claims: VisitorPassClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.kind !== 'visitor') return { ok: false, reason: 'not_visitor' };
  if (claims.v !== TOKEN_VERSION) return { ok: false, reason: 'not_visitor' };
  if (typeof claims.exp !== 'number' || claims.exp < now) return { ok: false, reason: 'expired' };
  return { ok: true, claims };
}
