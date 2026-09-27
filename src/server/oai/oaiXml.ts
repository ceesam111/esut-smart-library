export const TOKEN_TTL_MS = 30 * 60 * 1000;

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function oaiIdentifier(id: string, authority: string): string {
  return `oai:${authority}:${id}`;
}

export function utcDatestamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

export function dateDatestamp(iso: string | null): string {
  return utcDatestamp(iso).substring(0, 10);
}

export function granularityValid(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v);
}

export function toUtcDate(v: string, endOfDay = false): string {
  const base = v.endsWith('Z') ? v : `${v}T00:00:00Z`;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${base.slice(0, 11)}23:59:59Z`;
  return base;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function buildToken(offset: number, prefix: string, now: number, secret: string): Promise<string> {
  const expires = now + TOKEN_TTL_MS;
  const payload = `${offset}:${prefix}:${expires}`;
  return btoa(JSON.stringify({ offset, prefix, expires, hmac: await signPayload(payload, secret) }));
}

export async function verifyToken(token: string, now: number, secret: string): Promise<{ offset: number; prefix: string } | null> {
  try {
    const decoded = JSON.parse(atob(token));
    if (typeof decoded.offset !== 'number' || typeof decoded.prefix !== 'string' || typeof decoded.expires !== 'number') return null;
    if (decoded.expires < now) return null;
    const expected = await signPayload(`${decoded.offset}:${decoded.prefix}:${decoded.expires}`, secret);
    if (expected !== decoded.hmac) return null;
    return { offset: decoded.offset, prefix: decoded.prefix };
  } catch {
    return null;
  }
}
