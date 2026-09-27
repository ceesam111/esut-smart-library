import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n';

describe('i18n', () => {
  it('translates English strings', () => {
    expect(t('en', 'nav.home')).toBe('Home');
    expect(t('en', 'search.button')).toBe('Search');
  });

  it('translates French strings', () => {
    expect(t('fr', 'nav.home')).toBe('Accueil');
    expect(t('fr', 'search.button')).toBe('Rechercher');
  });

  it('falls back to English for missing keys', () => {
    expect(t('fr', 'nonexistent.key')).toBe('nonexistent.key');
  });
});
