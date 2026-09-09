import { describe, expect, it, vi } from 'vitest';
import { nextRetryAt, shouldRetry } from './retry';

describe('worker retry policy', () => {
  it('retries while attempts are below max attempts', () => {
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(3, 3)).toBe(false);
  });

  it('uses exponential retry delay', () => {
    vi.setSystemTime(new Date('2026-06-26T00:00:00Z'));
    expect(nextRetryAt(1)).toBe('2026-06-26T00:00:30.000Z');
    expect(nextRetryAt(3)).toBe('2026-06-26T00:02:00.000Z');
    vi.useRealTimers();
  });
});
