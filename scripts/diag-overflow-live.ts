import { loadDotEnv } from './demo-seed-lib';
import { chromium } from 'playwright';

loadDotEnv();

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3111';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const TENANT = '00000000-0000-0000-0000-000000000001';
const OFFICER_EMAIL = 'diag-slaas-officer@invalid.invalid';
const PASSWORD = 'E2eSlaas!';
const BRANCH_CODE = 'DIAG-SLAAS-A';

const serviceHeaders: Record<string, string> = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

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
    await svc('user_roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, role, tenant_id: TENANT }),
    });
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
  if (!body.access_token) throw new Error(`sign-in failed: ${res.status}`);
  return body.access_token;
}

async function main() {
  const officer = await createUser(OFFICER_EMAIL, 'super_admin');
  const token = await signIn(OFFICER_EMAIL);
  const branchRes = await fetch(`${BASE}/api/access/branches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: BRANCH_CODE, name: 'Diag Branch With A Long Name For Overflow', capacity: 20 }),
  });
  const branchBody = (await branchRes.json()) as { data?: { id?: string } };
  const branchId = branchBody.data?.id ?? '';
  console.log('branch:', branchRes.status, branchId);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.fill('#email', OFFICER_EMAIL);
    await page.fill('#password', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.goto(`${BASE}/admin/access`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.locator('[data-testid="branch-card"]').first().waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(3000);
    const report = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out: string[] = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0) {
          const cls = (el.getAttribute('class') ?? '').slice(0, 90);
          out.push(`${el.tagName.toLowerCase()} class="${cls}" right=${Math.round(r.right)} w=${Math.round(r.width)}`);
        }
      });
      return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: out.slice(0, 25) };
    });
    console.log(JSON.stringify(report, null, 2));
    await ctx.close();
  } finally {
    await browser.close();
  }

  await svc(`access_events?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visits?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_branches?code=eq.${BRANCH_CODE}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`audit_logs?actor_user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`audit_logs?user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`user_roles?user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
  await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${officer}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  console.log('cleanup done');
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
