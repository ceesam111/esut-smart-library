import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const PROJECT_ROOT = 'C:\\Users\\LENOVO\\Desktop\\DWC_Platform_2.5_Idea_Project_Intake_Stitch\\Projects\\ESUT SMART LIBRARY';
const STATE_FILE = `${PROJECT_ROOT}\\scripts\\.privacy-state.json`;

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
const TENANT2 = '20000000-0000-4000-8000-000000000002';
const OFFICER_EMAIL = 'priv-slaas-officer@invalid.invalid';
const STUDENT_EMAIL = 'priv-slaas-student@invalid.invalid';
const PATRON_EMAIL = 'priv-slaas-patron@invalid.invalid';
const PASSWORD = 'E2eSlaas!';
const BRANCH_CODE = 'PRIV-SLAAS-A';
const PATRON_CODE = 'PRIV-SLAAS-P1';
const PATRON_NAME = 'PRIV Patron Nora';

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

async function authUserList() {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const body = await res.json();
  return body.users ?? [];
}

async function createUser(email, role) {
  const existing = (await authUserList()).find((u) => u.email === email);
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
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    let body;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, text: JSON.stringify(body ?? null), data: body?.data, error: body?.error };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, text: buf.toString('utf8'), buffer: buf };
}

async function ensurePatron(patronId, userId, fullName) {
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
      user_id: userId,
      tenant_id: TENANT,
    }]),
  });
  const body = await res.json();
  return Array.isArray(body) ? body[0]?.id : body?.id;
}

const scanBody = (credential, branchId) => JSON.stringify({ credential, branchId, mode: 'AUTO', idempotencyKey: randomUUID() });
const isoHoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: String(detail ?? '') });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} - ${detail}`);
}

let officer;
let student;
let patronUser;
let branchId;
let patronRowId;
let credential;
let visitId;

async function wipeFixture() {
  const branches = await svcJson('library_branches?select=id&code=like.PRIV-SLAAS-%25');
  const branchIds = Array.isArray(branches.body) ? branches.body.map((b) => b.id) : [];
  const patrons = await svcJson('patrons?select=id&patron_id=like.PRIV-SLAAS-%25');
  const patronIds = Array.isArray(patrons.body) ? patrons.body.map((p) => p.id) : [];
  let visitIds = [];
  if (branchIds.length > 0) {
    const visits = await svcJson(`access_visits?select=id&branch_id=in.(${branchIds.join(',')})`);
    visitIds = Array.isArray(visits.body) ? visits.body.map((v) => v.id) : [];
  }
  if (visitIds.length > 0) await svc(`analytics_events?entity_id=in.(${visitIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  if (branchIds.length > 0) {
    const f = `branch_id=in.(${branchIds.join(',')})`;
    await svc(`access_events?${f}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visits?${f}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`access_visitor_passes?${f}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`library_branch_capacity_history?${f}`, { method: 'DELETE' }).catch(() => undefined);
  }
  if (patronIds.length > 0) await svc(`library_access_identities?patron_id=in.(${patronIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  await svc('library_branches?code=like.PRIV-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  await svc('patrons?patron_id=like.PRIV-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  const users = await authUserList();
  for (const u of users.filter((x) => x.email && x.email.startsWith('priv-slaas-'))) {
    await svc(`audit_logs?actor_user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_roles?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  }
}

async function main() {
  await wipeFixture();
  officer = await createUser(OFFICER_EMAIL, 'super_admin');
  student = await createUser(STUDENT_EMAIL, 'student');
  patronUser = await createUser(PATRON_EMAIL, 'student');
  const officerToken = await signIn(OFFICER_EMAIL);
  const studentToken = await signIn(STUDENT_EMAIL);
  console.log('users ready');

  const br = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: BRANCH_CODE, name: 'Privacy Probe Branch', capacity: 5, capacityMode: 'warning', warnThresholdPct: 80, active: true }),
  });
  branchId = br.data?.id;
  if (br.status !== 201 || !branchId) throw new Error(`branch create failed: ${br.status}`);

  patronRowId = await ensurePatron(PATRON_CODE, patronUser, PATRON_NAME);
  const idRes = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: patronRowId }) });
  credential = idRes.data?.credential;
  if (idRes.status !== 201 || !credential) throw new Error(`identity create failed: ${idRes.status}`);

  const scanIn = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(credential, branchId) });
  visitId = scanIn.data?.visit?.id;
  await svc(`access_visits?id=eq.${visitId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ checked_in_at: isoHoursAgo(2) }) });
  await sleep(5700);
  const scanOut = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(credential, branchId) });
  check('fixture: visit closed for probes', scanOut.data?.event === 'CHECK_OUT', `event=${scanOut.data?.event}`);

  console.log('--- PRIVACY: error responses must not leak attendance ---');

  const anonScan = await fetch(`${BASE}/api/access/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: scanBody(credential, branchId) });
  const anonScanJson = await anonScan.text();
  check('anonymous scan rejected 401 without data', anonScan.status === 401 && !anonScanJson.includes(visitId) && !anonScanJson.includes('"data"'), `status=${anonScan.status}`);

  const studentVisits = await api(studentToken, '/api/access/visits');
  const studentVisitsLeak = [visitId, PATRON_CODE, PATRON_NAME, `${PATRON_CODE.toLowerCase()}@invalid.invalid`].filter((needle) => studentVisits.text.includes(needle));
  check('student visits probe: 403 and error carries no attendance data', studentVisits.status === 403 && studentVisitsLeak.length === 0, `status=${studentVisits.status} leaks=${studentVisitsLeak.join('|') || 'none'}`);

  const studentCorrection = await api(studentToken, '/api/access/corrections', {
    method: 'POST',
    body: JSON.stringify({ visitId, newStatus: 'checked_out', newCheckedOutAt: new Date().toISOString(), reason: 'privacy probe' }),
  });
  const corrLeak = [PATRON_NAME, `${PATRON_CODE.toLowerCase()}@invalid.invalid`].filter((needle) => studentCorrection.text.includes(needle));
  check('unauthorized correction: 403 and error carries no personal data', studentCorrection.status === 403 && corrLeak.length === 0, `status=${studentCorrection.status} leaks=${corrLeak.join('|') || 'none'}`);

  const foreignOcc = await api(officerToken, `/api/access/occupancy?branchId=${randomUUID()}`);
  check('unknown branch occupancy: 404 with empty error', foreignOcc.status === 404 && !foreignOcc.text.includes(visitId), `status=${foreignOcc.status}`);

  console.log('--- PRIVACY: mass assignment ---');

  const evilBranch = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({
      code: 'PRIV-SLAAS-B',
      name: 'Mass Assignment Probe',
      capacity: 9,
      capacityMode: 'informational',
      warnThresholdPct: 50,
      active: true,
      tenant_id: TENANT2,
      timezone: 'UTC',
      created_at: '2000-01-01T00:00:00Z',
    }),
  });
  const evilBranchRow = await svcJson('library_branches?code=eq.PRIV-SLAAS-B&select=tenant_id,timezone,created_at');
  const eb = Array.isArray(evilBranchRow.body) ? evilBranchRow.body[0] : null;
  check('branch creation ignores attacker tenant/timezone/created_at',
    evilBranch.status === 201 && eb?.tenant_id === TENANT && eb?.timezone === 'Africa/Lagos' && !String(eb?.created_at ?? '').includes('2000-01-01'),
    `status=${evilBranch.status} tenant=${eb?.tenant_id} tz=${eb?.timezone}`);

  const evilVisitor = await api(officerToken, '/api/access/visitors', {
    method: 'POST',
    body: JSON.stringify({ fullName: 'PRIV Visitor Vee', organization: 'Probe Org', purpose: 'probe', created_by: student, tenant_id: TENANT2, id: randomUUID() }),
  });
  const evilVisitorId = evilVisitor.data?.visitorId;
  const evilVisitorRow = await svcJson(`access_visitors?id=eq.${evilVisitorId}&select=created_by,tenant_id`);
  const ev = Array.isArray(evilVisitorRow.body) ? evilVisitorRow.body[0] : null;
  check('visitor creation ignores attacker created_by/tenant/id',
    evilVisitor.status === 201 && ev?.created_by === officer && ev?.tenant_id === TENANT && !!evilVisitorId,
    `status=${evilVisitor.status} createdBy=${ev?.created_by === officer ? 'actor' : ev?.created_by} tenant=${ev?.tenant_id}`);

  console.log('--- PRIVACY: QR token must not echo or log ---');

  const scanOk = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(credential, branchId) });
  const echo = scanOk.text.includes(credential);
  check('scan response does not echo the credential', !echo && !!scanOk.data?.event && !scanOk.data?.errorCode, `event=${scanOk.data?.event} echo=${echo}`);

  const badCred = `probe.${randomUUID()}.${randomUUID()}`;
  const badScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(badCred, branchId) });
  check('invalid scan error does not echo the presented credential', badScan.data?.errorCode === 'INVALID_QR' && !badScan.text.includes(badCred), `err=${badScan.data?.errorCode} echo=${badScan.text.includes(badCred)}`);

  console.log('--- PRIVACY: analytics and export identifier hygiene ---');

  const from = isoHoursAgo(48);
  const to = new Date(Date.now() + 3600000).toISOString();
  const analytics = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const analyticsText = analytics.text;
  const analyticsLeaks = [];
  if (analyticsText.includes('@invalid.invalid')) analyticsLeaks.push('email');
  if (analyticsText.includes(PATRON_NAME)) analyticsLeaks.push('name');
  if (analyticsText.includes(PATRON_CODE)) analyticsLeaks.push('patron_id');
  if (/"patron_id"|"user_id"|"full_name"|"email"/.test(analyticsText)) analyticsLeaks.push('identifier-key');
  check('analytics carries aggregates only (no raw user identifiers)',
    analytics.status === 200 && analyticsLeaks.length === 0, `leaks=${analyticsLeaks.join('|') || 'none'} total=${analytics.data?.totalVisits}`);

  const visitsList = await api(officerToken, `/api/access/visits?branchId=${branchId}`);
  const visitRowText = JSON.stringify(visitsList.data?.rows ?? []);
  const visitLeaks = [];
  if (visitRowText.includes('@invalid.invalid')) visitLeaks.push('email');
  check('attendance rows expose operational ids but no email addresses',
    visitsList.status === 200 && (visitsList.data?.rows ?? []).length >= 1 && visitLeaks.length === 0, `rows=${visitsList.data?.rows?.length} leaks=${visitLeaks.join('|') || 'none'}`);

  const csv = await api(officerToken, `/api/access/export?format=csv&branchId=${branchId}`);
  const csvHeader = (csv.text.split('\n')[0] ?? '').toLowerCase();
  const csvLines = csv.text.trim().split('\n').length;
  const csvLeaks = [];
  if (csvHeader.includes('email') || csvHeader.includes('name') || csvHeader.includes('patron')) csvLeaks.push('identifier-column');
  if (csv.text.includes('@invalid.invalid')) csvLeaks.push('email-value');
  check('export columns exclude direct identifiers and stay capped',
    csv.status === 200 && csvLeaks.length === 0 && csvLines <= 5001, `headerLeak=${csvLeaks.join('|') || 'none'} lines=${csvLines} cap=5000`);

  console.log('--- PRIVACY: rate abuse ---');

  let seqOk = 0;
  let seq5xx = 0;
  let seqOther = 0;
  for (let i = 0; i < 15; i++) {
    const r = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(`abuse.${randomUUID()}`, branchId) });
    if (r.status >= 500) seq5xx++;
    else if (r.data?.errorCode === 'INVALID_QR') seqOk++;
    else seqOther++;
  }
  check('sequential invalid-scan abuse: all rejected, no 5xx', seqOk === 15 && seq5xx === 0, `invalid=${seqOk} 5xx=${seq5xx} other=${seqOther}`);

  const parResults = await Promise.all(Array.from({ length: 10 }, () => api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(`abuse.${randomUUID()}`, branchId) })));
  const par5xx = parResults.filter((r) => r.status >= 500).length;
  const parInvalid = parResults.filter((r) => r.data?.errorCode === 'INVALID_QR').length;
  check('parallel invalid-scan burst: all rejected, no 5xx', parInvalid === 10 && par5xx === 0, `invalid=${parInvalid} 5xx=${par5xx}`);

  const anonBurst = await Promise.all(Array.from({ length: 10 }, () => fetch(`${BASE}/api/access/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: scanBody(randomUUID(), branchId ?? randomUUID()) })));
  const anonStatuses = anonBurst.map((r) => r.status);
  check('anonymous burst: every request 401, no data paths open', anonStatuses.every((s) => s === 401), `statuses=${anonStatuses.join(',')}`);

  const allPassed = checks.every((c) => c.ok);
  console.log('');
  console.log(`${checks.filter((c) => c.ok).length}/${checks.length} privacy checks passed`);
  writeFileSync(STATE_FILE, JSON.stringify({ allPassed, checks, ranAt: new Date().toISOString() }, null, 2));

  await wipeFixture();
  console.log(`PRIVACY RED TEAM ${allPassed ? 'PASSED' : 'FAILED'}`);
  if (!allPassed) process.exit(1);
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try { await wipeFixture(); } catch (cleanupError) { console.error('cleanup failed', cleanupError); }
  process.exit(1);
});
