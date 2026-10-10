import { readFileSync } from 'fs';
import { resolve } from 'path';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3111';
const AXE_SRC = readFileSync(resolve(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8');

type Node = { html: string; target: string[] };
type Violation = { id: string; impact: string | null; help: string; nodes: Node[] };

async function scan(page: import('playwright').Page, path: string, rules: string[]) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);
  await page.addScriptTag({ content: AXE_SRC });
  const violations = await page.evaluate(async (ruleList: string[]): Promise<Violation[]> => {
    const axeRef = (window as unknown as {
      axe: { run: (ctx: unknown, opts: { runOnly: { type: string; values: string[] } }) => Promise<{ violations: Violation[] }> };
    }).axe;
    const ctx = document.querySelector('#main-content') ?? document.body;
    const res = await axeRef.run(ctx, { runOnly: { type: 'rule', values: ruleList } });
    return res.violations;
  }, rules);
  console.log(`\n=== ${path} ===`);
  if (violations.length === 0) console.log('clean');
  for (const v of violations) {
    console.log(`${v.id} (${v.impact ?? 'unknown'}): ${v.help}`);
    for (const n of v.nodes.slice(0, 12)) {
      console.log(`  [${n.target.join(' ')}] ${n.html.slice(0, 180)}`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  try {
    await scan(page, '/', ['color-contrast', 'link-name', 'link-in-text-block']);
    await scan(page, '/catalogue', ['color-contrast', 'link-name', 'select-name', 'label-content-name-mismatch']);
    await scan(page, '/repository', ['color-contrast', 'link-name', 'select-name', 'label-content-name-mismatch']);
    await scan(page, '/login', ['color-contrast', 'link-name']);
  } finally {
    await browser.close();
  }
}

void main();
