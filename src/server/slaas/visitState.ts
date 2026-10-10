export type ScanMode = 'AUTO' | 'CHECK_IN_ONLY' | 'CHECK_OUT_ONLY';

export type VisitState = 'OUTSIDE' | 'INSIDE';

export type ScanOutcome =
  | { action: 'CHECK_IN'; nextState: VisitState }
  | { action: 'CHECK_OUT'; nextState: VisitState }
  | { action: 'DUPLICATE'; reason: 'inside_debounce' | 'outside_debounce' | 'already_checked_in' | 'already_checked_out' }
  | { action: 'DENIED'; reason: 'not_currently_inside' | 'not_outside' | 'invalid_mode' };

export interface ScanDecisionContext {
  currentState: VisitState;
  mode: ScanMode;
  debounceMs: number;
  lastEventAtMs: number | null;
  nowMs: number;
}

export function decideScan(ctx: ScanDecisionContext): ScanOutcome {
  const { currentState, mode, debounceMs, lastEventAtMs, nowMs } = ctx;

  if (lastEventAtMs !== null && nowMs - lastEventAtMs < debounceMs) {
    if (currentState === 'INSIDE') {
      return { action: 'DUPLICATE', reason: 'inside_debounce' };
    }
    return { action: 'DUPLICATE', reason: 'outside_debounce' };
  }

  if (mode === 'CHECK_IN_ONLY') {
    if (currentState === 'INSIDE') {
      return { action: 'DUPLICATE', reason: 'already_checked_in' };
    }
    return { action: 'CHECK_IN', nextState: 'INSIDE' };
  }

  if (mode === 'CHECK_OUT_ONLY') {
    if (currentState === 'OUTSIDE') {
      return { action: 'DENIED', reason: 'not_currently_inside' };
    }
    return { action: 'CHECK_OUT', nextState: 'OUTSIDE' };
  }

  if (currentState === 'OUTSIDE') {
    return { action: 'CHECK_IN', nextState: 'INSIDE' };
  }
  return { action: 'CHECK_OUT', nextState: 'OUTSIDE' };
}
