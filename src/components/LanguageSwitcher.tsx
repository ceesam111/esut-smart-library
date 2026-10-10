'use client';

import { LOCALES, localeNames, useI18n, type Locale } from '@/lib/i18n';

export default function LanguageSwitcher({ id, className = '' }: { id: string; className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <select
      id={id}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label={t('a11y.languageSwitcher')}
      className={`rounded-md border border-white/30 bg-transparent px-2 py-1 text-xs font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60 ${className}`}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} className="text-neutral-900">
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}
