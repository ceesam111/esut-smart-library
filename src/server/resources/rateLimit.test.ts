import { describe, expect, it } from 'vitest';
import { __resetDiscoveryRateLimitsForTests, checkExternalDiscoveryRateLimit } from './rateLimit';

describe('external discovery rate limit', () => {
  it('blocks excessive lookups', () => {
    __resetDiscoveryRateLimitsForTests();
    expect(checkExternalDiscoveryRateLimit('tenant:user', 2).allowed).toBe(true);
    expect(checkExternalDiscoveryRateLimit('tenant:user', 2).allowed).toBe(true);
    expect(checkExternalDiscoveryRateLimit('tenant:user', 2).allowed).toBe(false);
  });
});
