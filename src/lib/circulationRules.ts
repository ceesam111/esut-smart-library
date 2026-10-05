import { differenceInDays } from 'date-fns';
import { institutionConfig } from '@config/institution.config';

export interface LoanRule {
  maxItems: number;
  durationDays: number;
  renewals: number;
}

const DEFAULT_RULE: LoanRule = { maxItems: 4, durationDays: 14, renewals: 2 };

export const OFFLINE_CACHE_MAX_AGE_HOURS = 48;

export function loanRuleFor(category: string | null | undefined): LoanRule {
  const rules = institutionConfig.loanRules as Record<string, LoanRule>;
  if (category && rules[category]) return rules[category];
  return DEFAULT_RULE;
}

export function maxItemsFor(category: string | null | undefined): number {
  return loanRuleFor(category).maxItems;
}

export function durationDaysFor(category: string | null | undefined): number {
  return loanRuleFor(category).durationDays;
}

export function renewalsFor(category: string | null | undefined): number {
  return loanRuleFor(category).renewals;
}

export function computeDueDate(from: Date | string | number, category: string | null | undefined): string {
  const base = from instanceof Date ? from : new Date(from);
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + durationDaysFor(category));
  return d.toISOString().split('T')[0];
}

export function isExamPeriodAt(at: Date = new Date()): boolean {
  const c = institutionConfig;
  const ranges = [
    { start: c.examOneDates.start, end: c.examOneDates.end },
    { start: c.examTwoDates.start, end: c.examTwoDates.end },
  ];
  return ranges.some(({ start, end }) => at >= new Date(start) && at <= new Date(end));
}

export interface FineCalc {
  amount: number;
  daysOverdue: number;
  suspended: boolean;
}

export function calculateFine(dueDate: string | Date, at: Date = new Date()): FineCalc {
  const suspended = isExamPeriodAt(at);
  const days = differenceInDays(at, new Date(dueDate));
  if (suspended || days <= 0) return { amount: 0, daysOverdue: Math.max(0, days), suspended };
  const rate = institutionConfig.fineRatePerDay ?? 50;
  return { amount: days * rate, daysOverdue: days, suspended };
}

export interface RulesSnapshot {
  loanRules: Record<string, LoanRule>;
  fineRatePerDay: number;
  examOneDates: { start: string; end: string };
  examTwoDates: { start: string; end: string };
  libraryName: string;
}

export function institutionRulesSnapshot(): RulesSnapshot {
  return {
    loanRules: institutionConfig.loanRules as Record<string, LoanRule>,
    fineRatePerDay: institutionConfig.fineRatePerDay,
    examOneDates: institutionConfig.examOneDates,
    examTwoDates: institutionConfig.examTwoDates,
    libraryName: institutionConfig.libraryName,
  };
}

/**
 * Stable fingerprint of the circulation rule set. Offline clients send this
 * with every queued transaction; a mismatch on the server raises a
 * RULE_CHANGED conflict instead of applying a stale due-date calculation.
 */
export function rulesFingerprint(): string {
  const payload = JSON.stringify({
    loanRules: institutionConfig.loanRules,
    fineRatePerDay: institutionConfig.fineRatePerDay,
    examOneDates: institutionConfig.examOneDates,
    examTwoDates: institutionConfig.examTwoDates,
  });
  let h1 = 0x811c9dc5;
  let h2 = 0x9dc5811c;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
