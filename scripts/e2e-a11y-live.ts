import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadDotEnv } from './demo-seed-lib';
import { chromium } from 'playwright';

loadDotEnv();

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3111';
const AXE_SRC = readFileSync(resolve(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8');

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

type AxeViolation = { id: string; impact: string | null; help: string; nodes: unknown[] };

async function runAxe(page: import('playwright').Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: AXE_SRC });
  const results = await page.evaluate(async (): Promise<AxeViolation[]> => {
    const axeRef = (window as unknown as { axe: { run: (ctx: unknown, opts: { resultTypes: string[] }) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const ctx = document.querySelector('#main-content') ?? document.body;
    const r = await axeRef.run(ctx, { resultTypes: ['violations'] });
    return r.violations;
  });
  return results.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

async function auditDomSemantics(page: import('playwright').Page): Promise<{ imgsMissingAlt: number; inputsMissingLabel: number }> {
  return page.evaluate(() => {
    const ctx = document.querySelector('#main-content') ?? document.body;
    const imgsMissingAlt = Array.from(ctx.querySelectorAll('img')).filter(
      (img) => !img.hasAttribute('alt') && img.getAttribute('aria-hidden') !== 'true',
    ).length;
    const inputsMissingLabel = Array.from(ctx.querySelectorAll('input, select, textarea')).filter((el) => {
      const id = el.getAttribute('id');
      const hasLabelFor = !!id && !!document.querySelector(`label[for="${CSS.escape(id)}"]`);
      const wrappedByLabel = !!el.closest('label');
      const hasAria = !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby');
      return !hasLabelFor && !wrappedByLabel && !hasAria;
    }).length;
    return { imgsMissingAlt, inputsMissingLabel };
  });
}

function formatViolations(vs: AxeViolation[]): string {
  return vs.map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help} [${v.nodes.length} nodes]`).join('; ');
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText('Quick Links', { exact: true }).first().waitFor({ state: 'visible', timeout: 90000 });

    const skip = page.locator('a[href="#main-content"]').first();
    check('skip link present on Home', await skip.count() > 0);

    await page.keyboard.press('Tab');
    const focusedIsSkip = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLAnchorElement && el.getAttribute('href') === '#main-content';
    });
    check('first Tab focuses skip link', focusedIsSkip);

    if (focusedIsSkip) {
      const skipVisibleOnFocus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' || style.clip !== 'auto' || el.offsetWidth > 0;
      });
      check('skip link becomes visible on focus', skipVisibleOnFocus);
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content');
    check('activating skip link moves focus to #main-content', mainFocused);

    const homeTitle = await page.title();
    check('Home has a document title', homeTitle.length > 0, homeTitle);

    const homeSemantics = await auditDomSemantics(page);
    check(
      'Home: every img has alt (or aria-hidden) and every form control is labelled',
      homeSemantics.imgsMissingAlt === 0 && homeSemantics.inputsMissingLabel === 0,
      `imgsMissingAlt=${homeSemantics.imgsMissingAlt} inputsMissingLabel=${homeSemantics.inputsMissingLabel}`,
    );

    const homeViolations = await runAxe(page);
    check('Home: no serious/critical axe violations', homeViolations.length === 0, formatViolations(homeViolations) || 'clean');

    await page.evaluate(() => {
      const link = document.querySelector('a[href="/catalogue"]');
      if (!(link instanceof HTMLAnchorElement)) throw new Error('catalogue link missing');
      link.click();
    });
    await page.waitForURL('**/catalogue', { timeout: 30000 });
    await page.waitForTimeout(1500);

    const catTitle = await page.title();
    check('Catalogue document title updates', catTitle.length > 0 && catTitle !== homeTitle, catTitle);

    const catSemantics = await auditDomSemantics(page);
    check(
      'Catalogue: every img has alt (or aria-hidden) and every form control is labelled',
      catSemantics.imgsMissingAlt === 0 && catSemantics.inputsMissingLabel === 0,
      `imgsMissingAlt=${catSemantics.imgsMissingAlt} inputsMissingLabel=${catSemantics.inputsMissingLabel}`,
    );

    const catViolations = await runAxe(page);
    check('Catalogue: no serious/critical axe violations', catViolations.length === 0, formatViolations(catViolations) || 'clean');

    await page.evaluate(() => {
      const link = document.querySelector('a[href="/repository"]');
      if (!(link instanceof HTMLAnchorElement)) throw new Error('repository link missing');
      link.click();
    });
    await page.waitForURL('**/repository', { timeout: 30000 });
    await page.waitForTimeout(1500);

    const repoSemantics = await auditDomSemantics(page);
    check(
      'Repository: every img has alt (or aria-hidden) and every form control is labelled',
      repoSemantics.imgsMissingAlt === 0 && repoSemantics.inputsMissingLabel === 0,
      `imgsMissingAlt=${repoSemantics.imgsMissingAlt} inputsMissingLabel=${repoSemantics.inputsMissingLabel}`,
    );

    const repoViolations = await runAxe(page);
    check('Repository: no serious/critical axe violations', repoViolations.length === 0, formatViolations(repoViolations) || 'clean');

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    const loginInputs = await page.locator('input').count();
    check('Login page renders form inputs', loginInputs > 0, `${loginInputs} inputs`);

    const loginA11y = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const unlabelled: string[] = [];
      for (const input of inputs) {
        const id = input.getAttribute('id');
        const aria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
        const labelled = (id && document.querySelector(`label[for="${id}"]`)) || aria || input.getAttribute('placeholder');
        if (!labelled) unlabelled.push(input.outerHTML.slice(0, 80));
      }
      return unlabelled;
    });
    check('Login inputs all have an accessible name source', loginA11y.length === 0, loginA11y.join(' | ') || 'all labelled');

    const loginSemantics = await auditDomSemantics(page);
    check(
      'Login: every img has alt (or aria-hidden) and every form control is labelled',
      loginSemantics.imgsMissingAlt === 0 && loginSemantics.inputsMissingLabel === 0,
      `imgsMissingAlt=${loginSemantics.imgsMissingAlt} inputsMissingLabel=${loginSemantics.inputsMissingLabel}`,
    );

    const loginViolations = await runAxe(page);
    check('Login: no serious/critical axe violations', loginViolations.length === 0, formatViolations(loginViolations) || 'clean');

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('Quick Links', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 });

    const langSwitcher = page.locator('select[id^="lang-switcher"]').first();
    check('language switcher present', (await langSwitcher.count()) > 0);
    const langLabel = await langSwitcher.getAttribute('aria-label');
    check('language switcher has aria-label', !!langLabel, langLabel ?? 'missing');

    const navFocusables = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      );
      return els.filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).length;
    });
    check('Home exposes keyboard-focusable controls', navFocusables > 0, `${navFocusables} focusable`);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const secondFocus = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : 'none';
    });
    check('keyboard Tab sequence moves through interactive elements', secondFocus !== 'body', `focus=${secondFocus}`);
  } catch (err) {
    check('e2e run completed without errors', false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nA11Y E2E: ${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
