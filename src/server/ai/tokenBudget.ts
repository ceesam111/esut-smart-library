export const DEFAULT_DAILY_TOKEN_BUDGET = 300000;

export interface TokenBudgetState {
  used: number;
  budget: number;
  exceeded: boolean;
}

export function resolveDailyTokenBudget(raw: string | undefined): number {
  if (!raw) return DEFAULT_DAILY_TOKEN_BUDGET;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return DEFAULT_DAILY_TOKEN_BUDGET;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_TOKEN_BUDGET;
}

export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function sumTokenUsage(rows: Array<{ input_tokens?: number | null; output_tokens?: number | null }>): number {
  let total = 0;
  for (const row of rows) {
    total += typeof row.input_tokens === 'number' ? row.input_tokens : 0;
    total += typeof row.output_tokens === 'number' ? row.output_tokens : 0;
  }
  return total;
}

export function evaluateTokenBudget(used: number, budget: number): TokenBudgetState {
  return { used, budget, exceeded: used >= budget };
}
