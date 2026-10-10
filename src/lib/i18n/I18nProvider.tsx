'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  detectLocale,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  isLocale,
  persistLocale,
  t,
  type DateStyle,
  type Locale,
  type TranslationKey,
  type TranslationVars,
} from './core';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  formatDate: (date: Date | string | number, style?: DateStyle) => string;
  formatDateTime: (date: Date | string | number, style?: DateStyle) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    persistLocale(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => t(locale, key, vars),
      formatDate: (date, style) => formatDate(locale, date, style),
      formatDateTime: (date, style) => formatDateTime(locale, date, style),
      formatNumber: (v, options) => formatNumber(locale, v, options),
      formatCurrency: (amount) => formatCurrency(locale, amount),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
