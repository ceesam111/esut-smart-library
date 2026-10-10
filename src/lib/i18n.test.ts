import { describe, it, expect } from 'vitest';
import {
  t,
  isLocale,
  detectLocale,
  formatDate,
  formatDateTime,
  formatNumber,
  formatCurrency,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALES,
  type Locale,
} from '@/lib/i18n';

describe('i18n core', () => {
  it('exposes the allowlisted locales with en as default and fallback', () => {
    expect(LOCALES).toEqual(['en', 'fr']);
    expect(DEFAULT_LOCALE).toBe('en');
    expect(FALLBACK_LOCALE).toBe('en');
  });

  it('translates English strings', () => {
    expect(t('en', 'nav.home')).toBe('Home');
    expect(t('en', 'search.search')).toBe('Search');
  });

  it('translates French strings', () => {
    expect(t('fr', 'nav.home')).toBe('Accueil');
    expect(t('fr', 'search.search')).toBe('Rechercher');
  });

  it('falls back to English for missing keys', () => {
    expect(t('fr' as Locale, 'nav.home')).toBe('Accueil');
    const missing = t('en', 'nav.home');
    expect(missing).toBe('Home');
  });

  it('returns the raw key when no translation exists', () => {
    const key = 'no.such.key' as never;
    expect(t('fr', key)).toBe('no.such.key');
    expect(t('en', key)).toBe('no.such.key');
  });

  it('interpolates variables safely', () => {
    expect(t('en', 'footer.copyright', { year: 2026 })).toBe(
      '© 2026 ESUT Library. Enugu State University of Science and Technology. All rights reserved.',
    );
    expect(t('en', 'catalogue.itemsFound', { count: 3 })).toBe('3 items found');
    expect(t('en', 'catalogue.itemsFound', { count: 1 })).toBe('1 item found');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(t('en', 'footer.copyright', {})).toContain('{year}');
  });

  it('pluralizes with Intl.PluralRules (en: 0/1 one, 2+ other)', () => {
    expect(t('en', 'catalogue.itemsFound', { count: 0 })).toBe('0 items found');
    expect(t('en', 'catalogue.itemsFound', { count: 1 })).toBe('1 item found');
    expect(t('en', 'catalogue.itemsFound', { count: 2 })).toBe('2 items found');
  });

  it('pluralizes with Intl.PluralRules (fr: 0 and 1 are one)', () => {
    expect(t('fr', 'catalogue.itemsFound', { count: 0 })).toBe('0 document trouvé');
    expect(t('fr', 'catalogue.itemsFound', { count: 1 })).toBe('1 document trouvé');
    expect(t('fr', 'catalogue.itemsFound', { count: 2 })).toBe('2 documents trouvés');
  });

  it('validates locales against the allowlist', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale('en; DROP TABLE')).toBe(false);
    expect(isLocale('../../etc/passwd')).toBe(false);
  });

  it('detects the default locale when no preference is stored', () => {
    expect(detectLocale()).toBe('en');
  });

  it('formats dates per locale', () => {
    const date = new Date(2026, 9, 7);
    expect(formatDate('en', date)).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/);
    expect(formatDate('fr', date)).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/);
    expect(formatDate('en', date, 'long')).toContain('2026');
    expect(formatDate('en', 'not-a-date')).toBe('');
  });

  it('formats date-time per locale', () => {
    const date = new Date(2026, 9, 7, 14, 30);
    expect(formatDateTime('en', date)).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}/);
    expect(formatDateTime('fr', date)).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats numbers per locale', () => {
    expect(formatNumber('en', 1500)).toBe('1,500');
    expect(formatNumber('fr', 1500)).toMatch(/1[\s\u202F]500/);
  });

  it('formats currency as Nigerian Naira', () => {
    const en = formatCurrency('en', 1500);
    expect(en).toContain('1,500');
    expect(en).toMatch(/NGN|₦/);
    const fr = formatCurrency('fr', 1500);
    expect(fr).toMatch(/1[\s\u202F]500/);
    expect(fr).toMatch(/NGN|₦/);
  });
});
