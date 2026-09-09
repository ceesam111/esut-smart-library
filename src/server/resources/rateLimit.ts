const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkExternalDiscoveryRateLimit(key: string, max = 20, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  if (existing.count >= max) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  existing.count += 1;
  return { allowed: true, remaining: max - existing.count };
}

export function __resetDiscoveryRateLimitsForTests() {
  buckets.clear();
}
