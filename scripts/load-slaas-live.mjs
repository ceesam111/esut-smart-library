import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const PROJECT_ROOT = 'C:\\Users\\LENOVO\\Desktop\\DWC_Platform_2.5_Idea_Project_Intake_Stitch\\Projects\\ESUT SMART LIBRARY';
const STATE_FILE = `${PROJECT_ROOT}\\scripts\\.load-test-state.json`;

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv(`${PROJECT_ROOT}\\.env.local`);
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const TENANT = '00000000-0000-0000-0000-000000000001';
const OFFICER_EMAIL = 'load-slaas-officer@invalid.invalid';
const PASSWORD = 'E2eSlaas!';
const PATRON_COUNT = 12;
const BRANCH_CODE = 'LOAD-SLAAS-A';

const serviceHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function withRetry(fn, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 300)); }
  }
  throw lastErr;
}
const svc = (path, init = {}) => withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...(init.headers || {}) } }));
const svcJson = async (path, init = {}) => {
  const res = await svc(path, init);
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createUser(email, role) {
  const res0 = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const list = await res0.json();
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
    const body = await res.json();
    uid = body.id ?? body.user?.id;
  }
  if (uid && role) {
    const roleRes = await svc('user_roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, role, tenant_id: TENANT }),
    });
    if (!roleRes.ok) throw new Error(`role insert failed for ${email}: ${roleRes.status}`);
  }
  return uid;
}

async function signIn(email) {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  }));
  const body = await res.json();
  if (!body.access_token) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  return body.access_token;
}

async function api(token, path, init = {}) {
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const elapsed = performance.now() - started;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    let body;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, ms: elapsed, data: body?.data, error: body?.error };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, ms: elapsed, buffer: buf, contentType };
}

async function ensurePatron(patronId, fullName) {
  const existing = await svcJson(`patrons?patron_id=eq.${patronId}&select=id`);
  if (Array.isArray(existing.body) && existing.body.length > 0) return existing.body[0].id;
  const res = await svc('patrons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([{
      patron_id: patronId,
      full_name: fullName,
      email: `${patronId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@invalid.invalid`,
      patron_category: 'undergraduate',
      status: 'active',
      tenant_id: TENANT,
    }]),
  });
  const body = await res.json();
  return Array.isArray(body) ? body[0]?.id : body?.id;
}

const scanBody = (credential, branchId, mode = 'AUTO') => JSON.stringify({ credential, branchId, mode, idempotencyKey: randomUUID() });

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return Math.round(s[idx] * 10) / 10;
};
const stats = (arr) => ({ n: arr.length, p50: pct(arr, 50), p95: pct(arr, 95), p99: pct(arr, 99), max: Math.round(Math.max(...arr) * 10) / 10 });

const phases = [];
function record(phase, latencies, errors, extra = {}) {
  const s = stats(latencies);
  phases.push({ phase, ...s, errors, ...extra });
  console.log(`${phase}: n=${s.n} p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms max=${s.max}ms errors=${errors}`);
}

let officer;
let branchId;
const patronIds = [];
const credentials = [];
let resultsInside = 0;

async function cleanup() {
  if (branchId) {
    const open = await svcJson(`access_visits?branch_id=eq.${branchId}&status=eq.checked_in&select=id`);
    if (Array.isArray(open.body)) {
      for (const v of open.body) {
        await svc(`access_visits?id=eq.${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'checked_out' }) }).catch(() => undefined);
      }
    }
    await svc('analytics_events?entity_type=eq.access_visit', { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_events?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visits?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visitor_passes?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_branch_capacity_history?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_scan_workstations?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_access_identities?patron_id=in.(${patronIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_branches?code=eq.${BRANCH_CODE}`, { method: 'DELETE' }).catch(() => undefined);
  }
  await svc('patrons?patron_id=like.LOAD-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  if (officer) {
    await svc(`audit_logs?actor_user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_roles?user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${officer}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  }
}

async function cleanupStart() {
  const loadPatrons = await svcJson('patrons?select=id&patron_id=like.LOAD-SLAAS-%25');
  const ids = Array.isArray(loadPatrons.body) ? loadPatrons.body.map((p) => p.id) : [];
  const branches = await svcJson('library_branches?select=id&code=like.LOAD-SLAAS-%25');
  const branchIds = Array.isArray(branches.body) ? branches.body.map((b) => b.id) : [];
  if (ids.length > 0) await svc(`library_access_identities?patron_id=in.(${ids.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  await svc('analytics_events?entity_type=eq.access_visit', { method: 'DELETE' }).catch(() => undefined);
  if (branchIds.length > 0) {
    const filter = `branch_id=in.(${branchIds.join(',')})`;
    await svc(`access_events?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visits?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visitor_passes?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_branch_capacity_history?${filter}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_scan_workstations?${filter}`, { method: 'DELETE' }).catch(() => undefined);
  }
  await svc('library_branches?code=like.LOAD-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  await svc('patrons?patron_id=like.LOAD-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
}

async function main() {
  await cleanupStart();
  officer = await createUser(OFFICER_EMAIL, 'super_admin');
  const officerToken = await signIn(OFFICER_EMAIL);
  console.log('officer ready');

  const br = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: BRANCH_CODE, name: 'Load Test Branch', capacity: 100, capacityMode: 'warning', warnThresholdPct: 95, active: true }),
  });
  branchId = br.data?.id;
  if (br.status !== 201 || !branchId) throw new Error(`branch create failed: ${br.status}`);

  for (let i = 0; i < PATRON_COUNT; i++) {
    const patronId = `LOAD-SLAAS-P${String(i + 1).padStart(2, '0')}`;
    const pid = await ensurePatron(patronId, `Load Patron ${i + 1}`);
    patronIds.push(pid);
    const idRes = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: pid }) });
    if (idRes.status !== 201 || !idRes.data?.credential) throw new Error(`identity create failed: ${idRes.status}`);
    credentials.push(idRes.data.credential);
  }
  console.log(`setup done: branch=${branchId} patrons=${patronIds.length}`);

  await svcJson('library_branches?select=id&limit=1');
  const dbLat = [];
  let dbErrors = 0;
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    const r = await svcJson('library_branches?select=id&limit=1');
    dbLat.push(performance.now() - t0);
    if (r.status !== 200) dbErrors++;
  }
  record('Direct DB round-trip baseline (PostgREST x10)', dbLat, dbErrors);

  const invalidLat = [];
  let invalidErrors = 0;
  for (let i = 0; i < 25; i++) {
    const r = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(`forged.${randomUUID()}.${randomUUID()}`, branchId) });
    invalidLat.push(r.ms);
    if (r.data?.errorCode !== 'INVALID_QR') invalidErrors++;
  }
  record('QR validation latency (reject path, sequential x25)', invalidLat, invalidErrors);

  const checkInLat = [];
  let checkInErrors = 0;
  for (const cred of credentials) {
    const r = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(cred, branchId) });
    checkInLat.push(r.ms);
    if (r.data?.event !== 'CHECK_IN') checkInErrors++;
  }
  record('Check-in latency (sequential x12)', checkInLat, checkInErrors);

  await sleep(5700);
  const checkOutLat = [];
  let checkOutErrors = 0;
  for (const cred of credentials) {
    const r = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(cred, branchId) });
    checkOutLat.push(r.ms);
    if (r.data?.event !== 'CHECK_OUT') checkOutErrors++;
  }
  record('Checkout latency (sequential x12)', checkOutLat, checkOutErrors);

  await sleep(5700);
  const burstStarted = performance.now();
  const burstResults = await Promise.all(credentials.map((cred) => api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(cred, branchId) })));
  const burstWall = performance.now() - burstStarted;
  const burstLat = burstResults.map((r) => r.ms);
  const burstFails = burstResults.filter((r) => r.data?.event !== 'CHECK_IN');
  const burstErrors = burstFails.length;
  resultsInside = PATRON_COUNT - burstErrors;
  console.log('burst check-in status codes:', JSON.stringify(burstResults.map((r) => r.status)));
  console.log('burst check-in failures sample:', JSON.stringify(burstFails.slice(0, 6).map((r) => ({ status: r.status, event: r.data?.event ?? null, errorCode: r.data?.errorCode ?? r.error?.code ?? null, message: r.error?.message ?? null }))));
  record('Concurrent check-in burst (12 parallel)', burstLat, burstErrors, { wallMs: Math.round(burstWall) });

  const occLat = [];
  let occErrors = 0;
  for (let i = 0; i < 6; i++) {
    const r = await api(officerToken, `/api/access/occupancy?branchId=${branchId}`);
    occLat.push(r.ms);
    if (r.status !== 200 || r.data?.currentlyInside !== resultsInside) occErrors++;
  }
  record('Occupancy query latency (x6, occupancy=' + resultsInside + ')', occLat, occErrors);

  const from = new Date(Date.now() - 86400000).toISOString();
  const to = new Date(Date.now() + 3600000).toISOString();
  const dashLat = [];
  let dashErrors = 0;
  for (let i = 0; i < 10; i++) {
    const r = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    dashLat.push(r.ms);
    if (r.status !== 200) dashErrors++;
  }
  record('Dashboard analytics query latency (x10)', dashLat, dashErrors);

  const visitsLat = [];
  let visitsErrors = 0;
  for (let i = 0; i < 10; i++) {
    const r = await api(officerToken, `/api/access/visits?branchId=${branchId}`);
    visitsLat.push(r.ms);
    if (r.status !== 200) visitsErrors++;
  }
  record('Attendance history query latency (x10)', visitsLat, visitsErrors);

  const reportLat = [];
  let reportErrors = 0;
  for (let i = 0; i < 3; i++) {
    const r = await api(officerToken, `/api/access/export?format=csv&branchId=${branchId}`);
    reportLat.push(r.ms);
    if (r.status !== 200 || !r.buffer) reportErrors++;
  }
  record('Report generation latency (CSV x3)', reportLat, reportErrors);

  await sleep(5700);
  const outBurstStarted = performance.now();
  const outBurst = await Promise.all(credentials.map((cred) => api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(cred, branchId) })));
  const outBurstWall = performance.now() - outBurstStarted;
  const outLat = outBurst.map((r) => r.ms);
  const outFails = outBurst.filter((r) => r.data?.event !== 'CHECK_OUT');
  const outErrors = outFails.length;
  console.log('burst checkout status codes:', JSON.stringify(outBurst.map((r) => r.status)));
  console.log('burst checkout failures sample:', JSON.stringify(outFails.slice(0, 6).map((r) => ({ status: r.status, event: r.data?.event ?? null, errorCode: r.data?.errorCode ?? r.error?.code ?? null, message: r.error?.message ?? null }))));
  record('Concurrent checkout burst (12 parallel)', outLat, outErrors, { wallMs: Math.round(outBurstWall) });

  const finalOcc = await api(officerToken, `/api/access/occupancy?branchId=${branchId}`);
  const allPassed = phases.every((p) => p.errors === 0) && finalOcc.data?.currentlyInside === 0;

  console.log('');
  console.log('PHASE              n    p50    p95    p99    max   errors');
  for (const p of phases) {
    console.log(`${p.phase.padEnd(38)} ${String(p.n).padStart(3)} ${String(p.p50).padStart(6)} ${String(p.p95).padStart(6)} ${String(p.p99).padStart(6)} ${String(p.max).padStart(6)} ${String(p.errors).padStart(7)}`);
  }
  console.log(`final occupancy inside=${finalOcc.data?.currentlyInside}`);
  writeFileSync(STATE_FILE, JSON.stringify({ phases, finalOccupancy: finalOcc.data?.currentlyInside, allPassed, ranAt: new Date().toISOString() }, null, 2));

  await cleanup();
  console.log(`LOAD TEST ${allPassed ? 'PASSED' : 'FAILED'}`);
  if (!allPassed) process.exit(1);
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try { await cleanup(); } catch (cleanupError) { console.error('cleanup failed', cleanupError); }
  process.exit(1);
});
