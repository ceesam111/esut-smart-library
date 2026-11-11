import { describe, it, expect } from 'vitest';
import { isRetentionDue, RETENTION_FLAG_CAP_PER_POLICY, RETENTION_CANDIDATE_LIMIT } from './retention';

const policy = { older_than_years: 7, statuses: ['published'] as string[] };

describe('isRetentionDue', () => {
  const now = new Date('2026-10-22T00:00:00Z');

  it('flags a published item older than the policy age', () => {
    expect(isRetentionDue({ createdAt: '2019-01-15T00:00:00Z', status: 'published', policy, now })).toBe(true);
  });

  it('does not flag a published item inside the policy age', () => {
    expect(isRetentionDue({ createdAt: '2025-06-01T00:00:00Z', status: 'published', policy, now })).toBe(false);
  });

  it('never flags statuses outside the policy list', () => {
    expect(isRetentionDue({ createdAt: '2015-01-01T00:00:00Z', status: 'draft', policy, now })).toBe(false);
    expect(isRetentionDue({ createdAt: '2015-01-01T00:00:00Z', status: 'embargoed', policy, now })).toBe(false);
  });

  it('rejects unparseable timestamps instead of guessing', () => {
    expect(isRetentionDue({ createdAt: 'not-a-date', status: 'published', policy, now })).toBe(false);
  });

  it('uses UTC year arithmetic so boundary dates are deterministic', () => {
    expect(isRetentionDue({ createdAt: '2019-12-31T23:59:59Z', status: 'published', policy, now })).toBe(true);
    expect(isRetentionDue({ createdAt: '2020-01-01T00:00:00Z', status: 'published', policy, now })).toBe(false);
  });
});

describe('retention review bounds', () => {
  it('keeps each run bounded so event volume cannot explode', () => {
    expect(RETENTION_FLAG_CAP_PER_POLICY).toBeGreaterThan(0);
    expect(RETENTION_FLAG_CAP_PER_POLICY).toBeLessThanOrEqual(RETENTION_CANDIDATE_LIMIT);
  });
});
