import { en } from './dictionaries/en';
import { fr } from './dictionaries/fr';

export { I18nProvider, useI18n } from './I18nProvider';
export type { I18nContextValue } from './I18nProvider';

export type Locale = 'en' | 'fr';

export const LOCALES = ['en', 'fr'] as const;
export const DEFAULT_LOCALE: Locale = 'en';
export const FALLBACK_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'esut_locale';
export const LOCALE_STORAGE_KEY = 'esut_locale';
export const APP_TIMEZONE = 'Africa/Lagos';
export const CURRENCY_CODE = 'NGN';

const translations: Record<Locale, unknown> = { en, fr };

type StringLeaves<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${StringLeaves<T[K]>}`
      : never;
}[keyof T & string];

type PluralLeaves<T> = {
  [K in keyof T & string]: T[K] extends { one: string; other: string }
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${PluralLeaves<T[K]>}`
      : never;
}[keyof T & string];

export type TranslationKey = StringLeaves<typeof en> | PluralLeaves<typeof en>;

export type TranslationVars = Record<string, string | number>;

export type DateStyle = 'short' | 'long';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function lookup(locale: Locale, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = translations[locale];
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function pluralRule(locale: Locale, count: number): string {
  const rule = new Intl.PluralRules(locale).select(count);
  return rule === 'one' ? 'one' : 'other';
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

function warnMissingKey(locale: Locale, key: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[i18n] Missing translation: ${locale}:${key}`);
  }
}

export function t(locale: Locale, key: TranslationKey, vars?: TranslationVars): string {
  const active: Locale = isLocale(locale) ? locale : FALLBACK_LOCALE;
  let value = lookup(active, key);
  if (typeof value !== 'string' && vars && typeof vars.count === 'number') {
    value = lookup(active, `${key}.${pluralRule(active, vars.count)}`);
  }
  if (typeof value !== 'string') {
    const fallbackValue = lookup(FALLBACK_LOCALE, key);
    if (typeof fallbackValue === 'string') value = fallbackValue;
  }
  if (typeof value !== 'string') {
    warnMissingKey(active, key);
    return key;
  }
  return interpolate(value, vars);
}

export function readLocaleCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function readStoredLocale(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // storage unavailable (private mode) — cookie still persists the selection
  }
}

export function detectLocale(): Locale {
  const fromCookie = readLocaleCookie();
  if (isLocale(fromCookie)) return fromCookie;
  const stored = readStoredLocale();
  if (isLocale(stored)) return stored;
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browser = navigator.language.toLowerCase();
    const match = LOCALES.find((l) => browser === l || browser.startsWith(`${l}-`));
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

function resolveLocale(locale: Locale): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

function toDate(date: Date | string | number): Date | null {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(locale: Locale, date: Date | string | number, style: DateStyle = 'short'): string {
  const d = toDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(resolveLocale(locale), { dateStyle: style, timeZone: APP_TIMEZONE }).format(d);
}

export function formatDateTime(locale: Locale, date: Date | string | number, style: DateStyle = 'short'): string {
  const d = toDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(resolveLocale(locale), { dateStyle: style, timeStyle: 'short', timeZone: APP_TIMEZONE }).format(d);
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(resolveLocale(locale), options).format(value);
}

export function formatCurrency(locale: Locale, amount: number): string {
  return new Intl.NumberFormat(resolveLocale(locale), { style: 'currency', currency: CURRENCY_CODE }).format(amount);
}

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
};
