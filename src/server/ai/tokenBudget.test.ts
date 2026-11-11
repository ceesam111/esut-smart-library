import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAILY_TOKEN_BUDGET,
  evaluateTokenBudget,
  resolveDailyTokenBudget,
  startOfUtcDay,
  sumTokenUsage,
} from './tokenBudget';

describe('resolveDailyTokenBudget', () => {
  it('falls back to the default when the environment variable is absent', () => {
    expect(resolveDailyTokenBudget(undefined)).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(resolveDailyTokenBudget('')).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(resolveDailyTokenBudget('   ')).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
  });

  it('parses positive integers, tolerating whitespace', () => {
    expect(resolveDailyTokenBudget('5000')).toBe(5000);
    expect(resolveDailyTokenBudget(' 2000 ')).toBe(2000);
  });

  it('rejects malformed or non-positive values instead of disabling the cap', () => {
    expect(resolveDailyTokenBudget('not-a-number')).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(resolveDailyTokenBudget('-5')).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(resolveDailyTokenBudget('0')).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(resolveDailyTokenBudget('12.5')).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
  });
});

describe('startOfUtcDay', () => {
  it('returns midnight UTC for the same calendar day', () => {
    expect(startOfUtcDay(new Date('2026-10-22T15:45:10.123Z'))).toBe('2026-10-22T00:00:00.000Z');
  });

  it('handles dates already at midnight', () => {
    expect(startOfUtcDay(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('sumTokenUsage', () => {
  it('sums input and output tokens across rows', () => {
    const total = sumTokenUsage([
      { input_tokens: 100, output_tokens: 50 },
      { input_tokens: 20, output_tokens: 30 },
    ]);
    expect(total).toBe(200);
  });

  it('treats null, missing and non-numeric values as zero', () => {
    const total = sumTokenUsage([
      { input_tokens: null, output_tokens: undefined },
      {},
      { input_tokens: 10, output_tokens: 5 },
    ]);
    expect(total).toBe(15);
  });
});

describe('evaluateTokenBudget', () => {
  it('stays under the cap while usage is below the budget', () => {
    expect(evaluateTokenBudget(999, 1000).exceeded).toBe(false);
  });

  it('triggers exactly at the budget boundary', () => {
    expect(evaluateTokenBudget(1000, 1000).exceeded).toBe(true);
    expect(evaluateTokenBudget(1001, 1000).exceeded).toBe(true);
  });

  it('reports used, budget and exceeded for observability', () => {
    expect(evaluateTokenBudget(250, 500)).toEqual({ used: 250, budget: 500, exceeded: false });
  });
});
