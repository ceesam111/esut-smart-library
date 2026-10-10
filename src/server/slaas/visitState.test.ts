import { describe, expect, it } from 'vitest';
import { decideScan } from './visitState';

const baseCtx = {
  currentState: 'OUTSIDE' as const,
  mode: 'AUTO' as const,
  debounceMs: 5000,
  lastEventAtMs: null as number | null,
  nowMs: 1_000_000,
};

describe('decideScan', () => {
  it('checks in when outside with no debounce', () => {
    expect(decideScan({ ...baseCtx, currentState: 'OUTSIDE' })).toEqual({
      action: 'CHECK_IN', nextState: 'INSIDE',
    });
  });

  it('checks out when inside with no debounce', () => {
    expect(decideScan({ ...baseCtx, currentState: 'INSIDE' })).toEqual({
      action: 'CHECK_OUT', nextState: 'OUTSIDE',
    });
  });

  it('returns DUPLICATE inside_debounce when inside and scan within debounce window', () => {
    const nowMs = 1_000_000;
    const lastEventAtMs = nowMs - 3000;
    expect(decideScan({ ...baseCtx, currentState: 'INSIDE', lastEventAtMs, nowMs })).toEqual({
      action: 'DUPLICATE', reason: 'inside_debounce',
    });
  });

  it('returns DUPLICATE outside_debounce when outside and scan within debounce window', () => {
    const nowMs = 1_000_000;
    const lastEventAtMs = nowMs - 1000;
    expect(decideScan({ ...baseCtx, currentState: 'OUTSIDE', lastEventAtMs, nowMs })).toEqual({
      action: 'DUPLICATE', reason: 'outside_debounce',
    });
  });

  it('allows check-in after debounce window has elapsed (outside)', () => {
    const nowMs = 1_000_000;
    const lastEventAtMs = nowMs - 6000;
    expect(decideScan({ ...baseCtx, currentState: 'OUTSIDE', lastEventAtMs, nowMs })).toEqual({
      action: 'CHECK_IN', nextState: 'INSIDE',
    });
  });

  it('CHECK_IN_ONLY mode refuses check-out when inside', () => {
    expect(decideScan({ ...baseCtx, mode: 'CHECK_IN_ONLY', currentState: 'INSIDE' })).toEqual({
      action: 'DUPLICATE', reason: 'already_checked_in',
    });
  });

  it('CHECK_IN_ONLY mode checks in when outside', () => {
    expect(decideScan({ ...baseCtx, mode: 'CHECK_IN_ONLY', currentState: 'OUTSIDE' })).toEqual({
      action: 'CHECK_IN', nextState: 'INSIDE',
    });
  });

  it('CHECK_OUT_ONLY mode denies when outside', () => {
    expect(decideScan({ ...baseCtx, mode: 'CHECK_OUT_ONLY', currentState: 'OUTSIDE' })).toEqual({
      action: 'DENIED', reason: 'not_currently_inside',
    });
  });

  it('CHECK_OUT_ONLY mode checks out when inside', () => {
    expect(decideScan({ ...baseCtx, mode: 'CHECK_OUT_ONLY', currentState: 'INSIDE' })).toEqual({
      action: 'CHECK_OUT', nextState: 'OUTSIDE',
    });
  });
});
