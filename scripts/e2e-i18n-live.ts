import { loadDotEnv } from './demo-seed-lib';
import { chromium } from 'playwright';

loadDotEnv();

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3111';

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function htmlLang(page: import('playwright').Page): Promise<string> {
  return page.evaluate(() => document.documentElement.lang);
}

async function localeCookie(context: import('playwright').BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  const row = cookies.find((c) => c.name === 'esut_locale');
  return row ? row.value : null;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const switcher = page.locator('select[id^="lang-switcher"]').first();
    await switcher.waitFor({ state: 'visible', timeout: 60000 });
    await page.getByText('Quick Links', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 });

    check('initial load renders English chrome', true, `lang=${await htmlLang(page)}`);
    check('initial locale is English', (await htmlLang(page)) === 'en');
    check('language switcher present', true, (await switcher.getAttribute('id')) ?? 'missing');

    await switcher.selectOption('fr');
    await page.getByText('Liens rapides', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });

    check('switching to French updates html lang', (await htmlLang(page)) === 'fr');
    check('switching to French re-renders chrome', true, 'footer heading now "Liens rapides"');
    check('French locale persisted to cookie', (await localeCookie(context)) === 'fr', String(await localeCookie(context)));
    const stored = await page.evaluate(() => localStorage.getItem('esut_locale'));
    check('French locale mirrored to localStorage', stored === 'fr', String(stored));

    await page.evaluate(() => {
      const link = document.querySelector('a[href="/catalogue"]');
      if (link instanceof HTMLAnchorElement) {
        link.click();
      } else {
        throw new Error('catalogue link not found');
      }
    });
    await page.waitForURL('**/catalogue', { timeout: 30000 });
    await page.getByText('Liens rapides', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 });

    check('locale retained across client-side navigation', (await htmlLang(page)) === 'fr', page.url());
    check('French chrome survives SPA route change', true, 'footer still translated on /catalogue');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText('Liens rapides', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 });

    check('locale retained after full page refresh', (await htmlLang(page)) === 'fr');
    check('cookie survives refresh', (await localeCookie(context)) === 'fr');

    const switcher2 = page.locator('select[id^="lang-switcher"]').first();
    await switcher2.waitFor({ state: 'visible', timeout: 60000 });
    await switcher2.selectOption('en');
    await page.getByText('Quick Links', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });

    check('switching back to English restores html lang', (await htmlLang(page)) === 'en');
    check('English locale persisted to cookie', (await localeCookie(context)) === 'en', String(await localeCookie(context)));
  } catch (err) {
    check('e2e run completed without errors', false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nI18N E2E: ${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
