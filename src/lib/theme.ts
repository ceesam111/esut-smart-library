import { institutionConfig } from '@config/institution.config';

export function applyTheme(): void {
  const root = document.documentElement;

  // Apply CSS variables from config
  root.style.setProperty('--color-primary', institutionConfig.primaryColour);
  root.style.setProperty('--color-secondary', institutionConfig.secondaryColour);
  root.style.setProperty('--color-gold', '#D4A017');

  // Update favicon
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = institutionConfig.favicon;

  // Update theme-color meta tag for mobile browsers
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = institutionConfig.primaryColour;

  // Update document title
  document.title = `${institutionConfig.shortName} Library`;
}
