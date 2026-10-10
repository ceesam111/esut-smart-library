import { loadDotEnv } from './demo-seed-lib';
import { chromium } from 'playwright';

loadDotEnv();

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3111';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const TENANT = '00000000-0000-0000-0000-000000000001';
const OFFICER_EMAIL = 'mobile-slaas-officer@invalid.invalid';
const PATRON_EMAIL = 'mobile-slaas-patron@invalid.invalid';
const PASSWORD = 'E2eSlaas!';
const BRANCH_CODE = 'MOBILE-SLAAS-A';
const PATRON_ID = 'MOBILE-SLAAS-P1';

const serviceHeaders: Record<string, string> = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastErr;
}

async function svc(path: string, init: RequestInit = {}): Promise<Response> {
  return withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...((init.headers as Record<string, string>) ?? {}) } }));
}

async function svcJson(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await svc(path, init);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function createUser(email: string, role: string | null): Promise<string> {
  const res0 = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const list = (await res0.json()) as { users?: Array<{ id: string; email: string }> };
  const existing = (list.users ?? []).find((u) => u.email === email);
  let uid = existing?.id;
  if (existing) {
    await svc(`user_roles?user_id=eq.${existing.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?actor_user_id=eq.${existing.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?user_id=eq.${existing.id}`, { method: 'DELETE' }).catch(() => undefined);
    const delRes = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => null);
    if (delRes?.ok || delRes?.status === 404) uid = undefined;
  }
  if (!uid) {
    const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    }));
    const body = (await res.json()) as { id?: string; user?: { id?: string } };
    uid = body.id ?? body.user?.id;
  }
  if (!uid) throw new Error(`user create failed for ${email}`);
  if (role) {
    const roleRes = await svc('user_roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, role, tenant_id: TENANT }),
    });
    if (!roleRes.ok) throw new Error(`role insert failed for ${email}: ${roleRes.status}`);
  }
  return uid;
}

async function signIn(email: string): Promise<string> {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  return body.access_token;
}

async function api(token: string, path: string, init: RequestInit = {}): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((init.headers as Record<string, string>) ?? {}) },
  });
  let body: { data?: Record<string, unknown> } | null;
  try {
    body = (await res.json()) as { data?: Record<string, unknown> };
  } catch {
    body = null;
  }
  return { status: res.status, data: body?.data ?? null };
}

async function uiLogin(page: import('playwright').Page, email: string): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function checkScreen(page: import('playwright').Page, width: number, name: string, url: string, selector: string): Promise<void> {
  await page.setViewportSize({ width, height: 852 });
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible', timeout: 60000 });
  const scrollWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  check(`${name} @${width}px has no horizontal page overflow`, scrollWidth <= width + 2, `scrollWidth=${scrollWidth}`);
  check(`${name} @${width}px key content visible`, await target.isVisible());
}

let officer: string | null = null;
let patronUser: string | null = null;
let branchId: string | null = null;
let patronRowId: string | null = null;

async function cleanup(): Promise<void> {
  const patrons = await svcJson('patrons?select=id&patron_id=like.MOBILE-SLAAS-%25');
  const patronIds = Array.isArray(patrons.body) ? (patrons.body as Array<{ id: string }>).map((p) => p.id) : [];
  if (patronIds.length > 0) {
    await svc(`library_access_identities?patron_id=in.(${patronIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  }
  const branches = await svcJson('library_branches?select=id&code=like.MOBILE-SLAAS-%25');
  const branchIds = Array.isArray(branches.body) ? (branches.body as Array<{ id: string }>).map((b) => b.id) : [];
  if (branchIds.length > 0) {
    const filter = `branch_id=in.(${branchIds.join(',')})`;
    await svc(`access_events?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visits?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visitor_passes?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_branch_capacity_history?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_scan_workstations?${filter}`, { method: 'DELETE' }).catch(() => undefined);
  }
  await svc('library_branches?code=like.MOBILE-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  await svc('patrons?patron_id=like.MOBILE-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  for (const uid of [officer, patronUser]) {
    if (!uid) continue;
    await svc(`audit_logs?actor_user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_roles?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  }
}

async function main() {
  await cleanup();
  officer = await createUser(OFFICER_EMAIL, 'super_admin');
  patronUser = await createUser(PATRON_EMAIL, 'student');
  check('mobile test users created', !!officer && !!patronUser);

  const officerToken = await signIn(OFFICER_EMAIL);

  const patronInsert = await svc('patrons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([{
      patron_id: PATRON_ID,
      full_name: 'Mobile Patron',
      email: 'mobile-slaas-patron-row@invalid.invalid',
      patron_category: 'undergraduate',
      status: 'active',
      user_id: patronUser,
      tenant_id: TENANT,
    }]),
  });
  const patronBody = (await patronInsert.json()) as Array<{ id: string }>;
  patronRowId = (Array.isArray(patronBody) ? patronBody[0]?.id : undefined) ?? null;
  check('patron institutional record created', !!patronRowId);

  const br = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: BRANCH_CODE, name: 'Mobile Test Branch', capacity: 20, capacityMode: 'warning', warnThresholdPct: 80, active: true }),
  });
  branchId = (br.data?.id as string | undefined) ?? null;
  check('mobile test branch created', br.status === 201 && !!branchId, `status=${br.status}`);

  const identity = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: patronRowId }) });
  check('patron access identity issued for QR', identity.status === 201 && typeof identity.data?.credential === 'string', `status=${identity.status}`);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const officerCtx = await browser.newContext();
    const officerPage = await officerCtx.newPage();
    await uiLogin(officerPage, OFFICER_EMAIL);
    check('officer signs in through UI', !officerPage.url().includes('/login'), officerPage.url());

    const officerScreens = [
      { name: 'officer dashboard + occupancy', url: '/admin/access', selector: '[data-testid="branch-card"]' },
      { name: 'scanner', url: '/admin/access/scanner', selector: 'h1:has-text("Scan station")' },
      { name: 'visitor entry', url: '/admin/access/visitors', selector: 'h1:has-text("Visitors")' },
    ];
    for (const screen of officerScreens) {
      for (const width of [360, 390, 414, 768]) {
        await checkScreen(officerPage, width, screen.name, screen.url, screen.selector);
      }
    }
    await officerCtx.close();

    const patronCtx = await browser.newContext();
    const patronPage = await patronCtx.newPage();
    await uiLogin(patronPage, PATRON_EMAIL);
    check('patron signs in through UI', !patronPage.url().includes('/login'), patronPage.url());
    for (const width of [360, 390, 414, 768]) {
      await checkScreen(patronPage, width, 'digital QR + personal visit history', '/dashboard/access', '[data-testid="my-access-qr"]');
    }
    await patronCtx.close();
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nMOBILE UX E2E: ${checks.length - failed.length}/${checks.length} checks passed`);
  await cleanup();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try {
    await cleanup();
  } catch (cleanupError) {
    console.error('cleanup failed', cleanupError);
  }
  process.exit(1);
});
