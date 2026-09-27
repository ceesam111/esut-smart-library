const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }
  b.count += 1;
  if (b.count > max) return { limited: true, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { limited: false };
}

export function rateLimitKey(ips: string[], pathname: string): string {
  return `${ips[0] ?? 'unknown'}:${pathname}`;
}
