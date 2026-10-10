// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider, LOCALES, LOCALE_COOKIE, useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Footer from '@/components/layout/Footer';

function Probe() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="probe-text">{t('footer.quickLinks')}</span>
      <span data-testid="probe-locale">{locale}</span>
      <button type="button" onClick={() => setLocale('fr')}>switch-fr</button>
    </div>
  );
}

function clearLocaleState() {
  document.cookie = `${LOCALE_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  localStorage.clear();
}

function readLocaleCookie(): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  return match ? match.slice(LOCALE_COOKIE.length + 1) : null;
}

describe('i18n component integration', () => {
  beforeEach(() => {
    clearLocaleState();
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults to English and sets the html lang attribute', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('probe-locale').textContent).toBe('en');
    expect(screen.getByTestId('probe-text').textContent).toBe('Quick Links');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches to French, updates markup, html lang and persists locale', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText('switch-fr'));
    expect(screen.getByTestId('probe-locale').textContent).toBe('fr');
    expect(screen.getByTestId('probe-text').textContent).toBe('Liens rapides');
    expect(document.documentElement.lang).toBe('fr');
    expect(readLocaleCookie()).toBe('fr');
    expect(localStorage.getItem(LOCALE_COOKIE)).toBe('fr');
  });

  it('restores the persisted locale on a simulated refresh', () => {
    const first = render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText('switch-fr'));
    first.unmount();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('probe-locale').textContent).toBe('fr');
    expect(screen.getByTestId('probe-text').textContent).toBe('Liens rapides');
  });

  it('ignores cookie values outside the locale allowlist', () => {
    document.cookie = `${LOCALE_COOKIE}=de; path=/`;
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('probe-locale').textContent).toBe('en');
  });

  it('exposes an accessible language switcher that changes the locale', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <LanguageSwitcher id="lang-switcher-test" />
        </I18nProvider>
      </MemoryRouter>,
    );
    const select = document.getElementById('lang-switcher-test');
    expect(select).not.toBeNull();
    expect(LOCALES).toEqual(['en', 'fr']);
    const selectEl = select as HTMLSelectElement;
    expect(selectEl.value).toBe('en');
    fireEvent.change(selectEl, { target: { value: 'fr' } });
    expect(selectEl.value).toBe('fr');
    expect(readLocaleCookie()).toBe('fr');
    expect(screen.getByLabelText('Langue')).toBeTruthy();
  });

  it('renders a real page (Footer) with French chrome when locale is persisted', () => {
    document.cookie = `${LOCALE_COOKIE}=fr; path=/`;
    render(
      <MemoryRouter>
        <I18nProvider>
          <Footer />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Liens rapides')).toBeTruthy();
    expect(document.documentElement.lang).toBe('fr');
  });

  it('renders the same real page in English when no locale preference exists', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <Footer />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Quick Links')).toBeTruthy();
  });
});
