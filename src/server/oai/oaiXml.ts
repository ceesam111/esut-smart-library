export const TOKEN_TTL_MS = Number(process.env.OAI_TOKEN_TTL_MS ?? 30 * 60 * 1000);
export const PAGE_SIZE = Math.min(500, Math.max(1, Number(process.env.OAI_PAGE_SIZE ?? 100)));

export interface OaiConfig {
  repoName: string;
  baseUrl: string;
  adminEmail: string;
  authority: string;
  protocolVersion: string;
  deletedRecord: string;
  granularity: string;
  earliestDatestamp: string | null;
}

export function resolveAuthority(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return 'localhost';
  }
}

export function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function oaiIdentifier(id: string, authority: string): string {
  return `oai:${authority}:${id}`;
}

export function localIdentifier(identifier: string): string {
  const parts = String(identifier).split(':');
  return parts[parts.length - 1] ?? identifier;
}

export function utcDatestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function dateDatestamp(iso: string | null | undefined): string {
  const full = utcDatestamp(iso);
  return full ? full.slice(0, 10) : '';
}

export function granularityValid(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value);
}

export function toUtcDate(value: string, endOfDay = false): string {
  const base = value.endsWith('Z') ? value : `${value}T00:00:00Z`;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${base.slice(0, 11)}23:59:59Z`;
  return base;
}

export interface TokenPayload {
  offset: number;
  prefix: string;
  from: string | null;
  until: string | null;
  set: string | null;
  expires: number;
  hmac: string;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function buildToken(
  context: { offset: number; prefix: string; from?: string | null; until?: string | null; set?: string | null },
  now: number,
  secret: string,
): Promise<string> {
  const expires = now + TOKEN_TTL_MS;
  const payload: Omit<TokenPayload, 'hmac'> = {
    offset: context.offset,
    prefix: context.prefix,
    from: context.from ?? null,
    until: context.until ?? null,
    set: context.set ?? null,
    expires,
  };
  const canonical = `${payload.offset}:${payload.prefix}:${payload.from ?? ''}:${payload.until ?? ''}:${payload.set ?? ''}:${payload.expires}`;
  const hmac = await signPayload(canonical, secret);
  return btoa(JSON.stringify({ ...payload, hmac }));
}

export async function verifyToken(
  token: string,
  now: number,
  secret: string,
): Promise<{ offset: number; prefix: string; from: string | null; until: string | null; set: string | null } | null> {
  try {
    const decoded = JSON.parse(atob(token)) as Partial<TokenPayload>;
    if (typeof decoded.offset !== 'number' || typeof decoded.prefix !== 'string' || typeof decoded.expires !== 'number') return null;
    if (decoded.expires < now) return null;
    const canonical = `${decoded.offset}:${decoded.prefix}:${decoded.from ?? ''}:${decoded.until ?? ''}:${decoded.set ?? ''}:${decoded.expires}`;
    const expected = await signPayload(canonical, secret);
    if (expected !== decoded.hmac) return null;
    return {
      offset: decoded.offset,
      prefix: decoded.prefix,
      from: decoded.from ?? null,
      until: decoded.until ?? null,
      set: decoded.set ?? null,
    };
  } catch {
    return null;
  }
}

export function isPublicItem(item: { status?: string; visibility?: string; embargo_until?: string | null }): boolean {
  if (item.status !== 'published') return false;
  if (item.visibility !== 'global') return false;
  if (item.embargo_until && new Date(item.embargo_until).getTime() > Date.now()) return false;
  return true;
}
