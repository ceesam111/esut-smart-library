import { createHash, createHmac, timingSafeEqual } from 'crypto';

const COAR_MAX_TIMESTAMP_DRIFT_SEC = 300;
const COAR_RATE_LIMIT_WINDOW_MS = 60_000;
const COAR_RATE_LIMIT_MAX = 30;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const processedNonces = new Set<string>();

function getSharedSecret(): string {
  return process.env.COAR_NOTIFY_SHARED_SECRET || '';
}

export function isCoarConfigured(): boolean {
  return getSharedSecret().length >= 32;
}

export function verifyCoarSignature(payload: string, signature: string, timestamp: string): boolean {
  const secret = getSharedSecret();
  if (secret.length < 32) return false;
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > COAR_MAX_TIMESTAMP_DRIFT_SEC) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

export function checkCoarRateLimit(senderId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(senderId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(senderId, { count: 1, resetAt: now + COAR_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= COAR_RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export function isDuplicateNonce(nonce: string): boolean {
  if (processedNonces.has(nonce)) return true;
  processedNonces.add(nonce);
  if (processedNonces.size > 10_000) {
    const iter = processedNonces.values();
    for (let i = 0; i < 1_000; i++) {
      const v = iter.next();
      if (v.done) break;
      processedNonces.delete(v.value);
    }
  }
  return false;
}

export function validateCoarUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) return false;
    if (hostname.startsWith('169.254.')) return false;
    return true;
  } catch {
    return false;
  }
}

export function sanitizeCoarPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith('@') || key === 'id' || key === 'type' || key === 'name' || key === 'actor' || key === 'object' || key === 'target') {
      if (typeof value === 'string' && validateCoarUrl(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeCoarPayload(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.filter((v) => typeof v === 'string' && validateCoarUrl(v));
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

export function generateCoarNonce(): string {
  return createHash('sha256').update(`${Date.now()}-${crypto.randomUUID()}`).digest('hex').slice(0, 32);
}
