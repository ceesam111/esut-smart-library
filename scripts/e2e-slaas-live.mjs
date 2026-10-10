import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHmac, randomUUID } from 'crypto';

const STATE_FILE = join(tmpdir(), 'e2e-slaas-state.json');

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(fileURLToPath(new URL('../.env.local', import.meta.url)));
const SUPABASE_URL = env.SUPABASE_URL;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'http://localhost:3000';
const TENANT = '00000000-0000-0000-0000-000000000001';
const TENANT2 = '20000000-0000-4000-8000-000000000002';
const OFFICER_EMAIL = 'e2e-slaas-officer@invalid.invalid';
const STUDENT_EMAIL = 'e2e-slaas-student@invalid.invalid';
const PATRON_EMAIL = 'e2e-slaas-patron@invalid.invalid';
const TENANT2_EMAIL = 'e2e-slaas-t2@invalid.invalid';
const PASSWORD = 'E2eSlaas!';
const SECRET = env.SLAAS_QR_SECRET || 'dev-only-slaas-qr-secret-do-not-use-in-prod';
const SESSION = 'E2E SLAAS/2026';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(fn, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastError;
}

const serviceHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const svc = (path, init = {}) => withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...(init.headers || {}) } }));
const svcJson = async (path, init = {}) => {
  const res = await svc(path, init);
  let body;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
};

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
    const tenant = email === TENANT2_EMAIL ? TENANT2 : TENANT;
    const roleRes = await svc('user_roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, role, tenant_id: tenant }),
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
  const res = await withRetry(() => fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  }));
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    let body;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body, data: body?.data, error: body?.error };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buffer: buf, contentType };
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}
function hmacSign(bodyObj, secret = SECRET) {
  const body = b64url(JSON.stringify(bodyObj));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function signedDynamicCredential(sub, expOffsetSeconds) {
  const now = Math.floor(Date.now() / 1000);
  return hmacSign({ v: 1, sub, iss: 'esut-library', aud: 'esut-access-gate', iat: now, exp: now + expOffsetSeconds, jti: randomUUID() });
}
function signedVisitorPass(sub, expMs) {
  const now = Math.floor(Date.now() / 1000);
  return hmacSign({ v: 1, kind: 'visitor', sub, iat: now - 3600, exp: Math.floor(expMs / 1000), jti: randomUUID() });
}
function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}
function dayOnly(daysOffset) {
  return new Date(Date.now() + daysOffset * 86400000).toISOString().slice(0, 10);
}
const scanBody = (credential, branchId, mode = 'AUTO') => JSON.stringify({ credential, branchId, mode, idempotencyKey: randomUUID() });

async function ensurePatron(patronId, userId, fullName) {
  const existing = await svcJson(`patrons?patron_id=eq.${patronId}&select=id`);
  if (Array.isArray(existing.body) && existing.body.length > 0) {
    const id = existing.body[0].id;
    await svc(`patrons?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, status: 'active', tenant_id: TENANT }) }).catch(() => undefined);
    return id;
  }
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
  return body?.[0]?.id ?? null;
}

const visitIds = [];
let calendarId = null;
let officer, student, patronUser, tenant2User;
let officerToken, studentToken, patronToken, tenant2Token;
let branchA, branchB, branchMA;
let patronAId, patronBId, racePatronId, crossPatronId;
let patronAIdentityId, patronACredential, patronBCredential, raceCredential, crossCredential;
let visit1Id;

async function cleanupStart() {
  await svc(`analytics_events?entity_type=eq.access_visit`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_events?branch_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visits?branch_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitor_passes?branch_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitors?full_name=like.E2E%20Visitor%25`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_access_identities?patron_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_branches?code=like.E2E-SLAAS-%25`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`patrons?patron_id=like.E2E-SLAAS-%25`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`academic_calendar?session=eq.${encodeURIComponent(SESSION)}`, { method: 'DELETE' }).catch(() => undefined);
}

async function cleanupEnd() {
  if (visitIds.length > 0) {
    await svc(`analytics_events?entity_id=in.(${visitIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  }
  await svc(`access_events?branch_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visits?branch_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitor_passes?branch_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitors?full_name=like.E2E%20Visitor%25`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_access_identities?patron_id=not.is.null`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_branches?code=like.E2E-SLAAS-%25`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`patrons?patron_id=like.E2E-SLAAS-%25`, { method: 'DELETE' }).catch(() => undefined);
  if (calendarId) await svc(`academic_calendar?id=eq.${calendarId}`, { method: 'DELETE' }).catch(() => undefined);
  for (const uid of [officer, student, patronUser, tenant2User]) {
    if (!uid) continue;
    await svc(`audit_logs?actor_user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_roles?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  }
}

function probeBody(method, path) {
  if (path.startsWith('/api/access/scan')) return JSON.stringify({ credential: 'probe', branchId: branchA ?? randomUUID(), idempotencyKey: 'probe-key' });
  if (path.startsWith('/api/access/corrections')) return JSON.stringify({ visitId: randomUUID(), newStatus: 'checked_out', newCheckedOutAt: new Date().toISOString(), reason: 'probe reason' });
  if (path.startsWith('/api/access/identities')) return JSON.stringify(method === 'POST' ? { patronId: randomUUID() } : { identityId: randomUUID() });
  if (path.startsWith('/api/access/visitor-passes')) return JSON.stringify(method === 'POST' ? { visitorId: randomUUID(), branchId: branchA ?? randomUUID(), validForMinutes: 30 } : { passId: randomUUID() });
  if (path.startsWith('/api/access/visitors')) return JSON.stringify({ fullName: 'Probe Visitor' });
  if (path.startsWith('/api/access/branches')) return JSON.stringify({ code: 'PROBE', name: 'Probe', capacity: 1 });
  if (path.startsWith('/api/access/manual')) return JSON.stringify({ action: 'search', query: 'probe' });
  return JSON.stringify({});
}

async function main() {
  await cleanupStart();

  officer = await createUser(OFFICER_EMAIL, 'super_admin');
  student = await createUser(STUDENT_EMAIL, 'student');
  patronUser = await createUser(PATRON_EMAIL, null);
  tenant2User = await createUser(TENANT2_EMAIL, 'librarian');
  check('created E2E users (officer, student, patron, tenant2)', !!officer && !!student && !!patronUser && !!tenant2User);

  officerToken = await signIn(OFFICER_EMAIL);
  studentToken = await signIn(STUDENT_EMAIL);
  patronToken = await signIn(PATRON_EMAIL);
  tenant2Token = await signIn(TENANT2_EMAIL);
  check('all four sessions sign in', !!officerToken && !!studentToken && !!patronToken && !!tenant2Token);

  const calRes = await svc('academic_calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([{
      session: SESSION,
      semester_one_start: dayOnly(-40),
      semester_one_end: dayOnly(40),
      public_holidays: [],
      created_by: officer,
    }]),
  });
  const calBody = await calRes.json();
  calendarId = Array.isArray(calBody) ? calBody[0]?.id : calBody?.id;
  check('academic period exists (calendar row created)', !!calendarId, `id=${calendarId}`);

  patronAId = await ensurePatron('E2E-SLAAS-A', patronUser, 'E2E Patron Aisha');
  patronBId = await ensurePatron('E2E-SLAAS-B', null, 'E2E Patron Bola');
  racePatronId = await ensurePatron('E2E-SLAAS-R', null, 'E2E Patron Race');
  crossPatronId = await ensurePatron('E2E-SLAAS-X', null, 'E2E Patron Cross');
  check('institutional users exist (4 patrons)', !!patronAId && !!patronBId && !!racePatronId && !!crossPatronId);

  const brA = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: 'E2E-SLAAS-A', name: 'E2E Branch Alpha', capacity: 5, capacityMode: 'warning', warnThresholdPct: 80, active: true, tenant_id: TENANT2 }),
  });
  branchA = brA.data?.id;
  check('administrator configures branch A (tenant_id injection stripped)', brA.status === 201 && !!branchA, `status=${brA.status}`);

  const brB = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: 'E2E-SLAAS-B', name: 'E2E Branch Beta', capacity: 3, capacityMode: 'warning', warnThresholdPct: 80, active: true }),
  });
  branchB = brB.data?.id;
  check('branch B created', brB.status === 201 && !!branchB, `status=${brB.status}`);

  const brMA = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: 'E2E-SLAAS-MA', name: 'E2E MassAssign', capacity: 1, tenant_id: TENANT2 }),
  });
  branchMA = brMA.data?.id;
  const t2Branches = await api(tenant2Token, '/api/access/branches');
  const maVisibleToT2 = Array.isArray(t2Branches.data) && t2Branches.data.some((b) => b.code === 'E2E-SLAAS-MA');
  check('mass assignment rejected (tenant2 does not see injected branch)', brMA.status === 201 && !maVisibleToT2, `status=${brMA.status} visible=${maVisibleToT2}`);
  const officerBranches = await api(officerToken, '/api/access/branches');
  const officerSeesAll = Array.isArray(officerBranches.data) && ['E2E-SLAAS-A', 'E2E-SLAAS-B', 'E2E-SLAAS-MA'].every((c) => officerBranches.data.some((b) => b.code === c));
  check('branch configuration lists all three branches', officerSeesAll);
  const maOcc = await api(officerToken, `/api/access/occupancy?branchId=${branchMA}`);
  check('mass-assigned branch usable by officer tenant', maOcc.status === 200 && maOcc.data?.capacity === 1, `status=${maOcc.status} capacity=${maOcc.data?.capacity}`);

  console.log('--- E2E JOURNEY 1: normal visit lifecycle ---');

  const me1 = await api(patronToken, '/api/access/me');
  check('personal identity endpoint registers institutional user', me1.data?.registered === true, `registered=${me1.data?.registered}`);

  const idA = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: patronAId }) });
  patronAIdentityId = idA.data?.identityId;
  patronACredential = idA.data?.credential;
  check('secure access identity issued with QR credential', idA.status === 201 && !!patronAIdentityId && !!patronACredential, `status=${idA.status}`);

  const me2 = await api(patronToken, '/api/access/me');
  const meCredential = me2.data?.identity?.credential;
  check('QR credential displayed on personal dashboard', typeof meCredential === 'string' && meCredential.includes('.'), `len=${meCredential ? meCredential.length : 0}`);

  const occ0 = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  check('capacity configured (occupancy reports capacity 5)', occ0.data?.capacity === 5, `capacity=${occ0.data?.capacity}`);

  const scanIn = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronACredential, branchA) });
  const inData = scanIn.data;
  check('officer scans user in (CHECK_IN)', inData?.event === 'CHECK_IN' && inData?.ok === true, `event=${inData?.event} err=${inData?.errorCode}`);
  visit1Id = inData?.visit?.id;
  if (visit1Id) visitIds.push(visit1Id);

  check('identity confirmation displays name', inData?.identity?.fullName === 'E2E Patron Aisha', `name=${inData?.identity?.fullName}`);
  check('occupancy increased to 1', inData?.occupancy?.currentlyInside === 1, `inside=${inData?.occupancy?.currentlyInside}`);

  const dupScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronACredential, branchA) });
  check('immediate duplicate rejected as duplicate not checkout', dupScan.data?.event === 'DUPLICATE' && dupScan.data?.errorCode === 'DUPLICATE' && dupScan.data?.visit?.status === 'checked_in', `event=${dupScan.data?.event} status=${dupScan.data?.visit?.status}`);

  await svc(`access_visits?id=eq.${visit1Id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ checked_in_at: isoDaysAgo(0.0833) }) });
  await sleep(5700);

  const scanOut = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronACredential, branchA) });
  check('valid checkout occurs', scanOut.data?.event === 'CHECK_OUT' && scanOut.data?.ok === true, `event=${scanOut.data?.event} err=${scanOut.data?.errorCode}`);
  const duration = scanOut.data?.visit?.duration_minutes;
  check('duration calculated (~120 minutes)', typeof duration === 'number' && duration >= 115 && duration <= 125, `duration=${duration}`);
  check('occupancy decreased to 0', scanOut.data?.occupancy?.currentlyInside === 0, `inside=${scanOut.data?.occupancy?.currentlyInside}`);

  const visitsList = await api(officerToken, `/api/access/visits?branchId=${branchA}`);
  const v1row = Array.isArray(visitsList.data?.rows) ? visitsList.data.rows.find((r) => r.id === visit1Id) : null;
  check('attendance history contains visit', !!v1row, `rows=${visitsList.data?.rows?.length}`);
  check('academic structure stamped on visit', v1row?.academic_session === SESSION && v1row?.semester === '1', `session=${v1row?.academic_session} semester=${v1row?.semester}`);

  const sessFiltered = await api(officerToken, `/api/access/visits?academicSession=${encodeURIComponent(SESSION)}`);
  const wrongSess = await api(officerToken, '/api/access/visits?academicSession=NO-SUCH-SESSION');
  check('academic filters work', (sessFiltered.data?.rows ?? []).some((r) => r.id === visit1Id) && (wrongSess.data?.rows?.length ?? -1) === 0, `right=${sessFiltered.data?.rows?.length} wrong=${wrongSess.data?.rows?.length}`);

  const branchFiltered = await api(officerToken, `/api/access/visits?branchId=${branchB}`);
  const periodFiltered = await api(officerToken, `/api/access/visits?from=${encodeURIComponent(isoDaysAgo(30))}&to=${encodeURIComponent(isoDaysAgo(29))}`);
  check('branch and period filters work', !(branchFiltered.data?.rows ?? []).some((r) => r.id === visit1Id) && !(periodFiltered.data?.rows ?? []).some((r) => r.id === visit1Id), `branchRows=${branchFiltered.data?.rows?.length} periodRows=${periodFiltered.data?.rows?.length}`);

  const meVisits = await api(patronToken, '/api/access/me');
  check('personal dashboard reflects visit', (meVisits.data?.stats?.totalVisits ?? 0) >= 1 && (meVisits.data?.visits ?? []).some((r) => r.id === visit1Id), `total=${meVisits.data?.stats?.totalVisits}`);

  const from = isoDaysAgo(1);
  const to = new Date(Date.now() + 3600000).toISOString();
  const analytics = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  check('analytics reflects visit from actual data', (analytics.data?.totalVisits ?? 0) >= 1 && (analytics.data?.byBranch ?? []).some((b) => b.branchId === branchA), `total=${analytics.data?.totalVisits}`);

  const csvExport = await api(officerToken, `/api/access/export?format=csv&branchId=${branchA}`);
  const csvText = csvExport.buffer ? csvExport.buffer.toString('utf8') : '';
  check('report (CSV) reflects visit', csvExport.status === 200 && csvText.includes(visit1Id), `status=${csvExport.status}`);
  const xlsxExport = await api(officerToken, `/api/access/export?format=xlsx&branchId=${branchA}`);
  const isXlsx = xlsxExport.status === 200 && !!xlsxExport.buffer && xlsxExport.buffer.length > 100 && xlsxExport.buffer[0] === 0x50 && xlsxExport.buffer[1] === 0x4b;
  check('real XLSX where exposed (PK zip signature)', isXlsx, `status=${xlsxExport.status} bytes=${xlsxExport.buffer ? xlsxExport.buffer.length : 0}`);
  const exportAudit = await svcJson(`audit_logs?action=eq.access.export&limit=1`);
  check('export is audited', Array.isArray(exportAudit.body) && exportAudit.body.length > 0, `rows=${Array.isArray(exportAudit.body) ? exportAudit.body.length : '?'}`);

  const unauthModify = await api(studentToken, '/api/access/corrections', {
    method: 'POST',
    body: JSON.stringify({ visitId: visit1Id, newStatus: 'checked_out', newCheckedOutAt: new Date().toISOString(), reason: 'E2E unauthorized attempt' }),
  });
  check('unauthorized user cannot modify visit (403)', unauthModify.status === 403, `status=${unauthModify.status}`);

  console.log('--- E2E JOURNEY 2: visitor temp pass ---');

  const visitorReg = await api(officerToken, '/api/access/visitors', {
    method: 'POST',
    body: JSON.stringify({ fullName: 'E2E Visitor One', organization: 'E2E Org', purpose: 'E2E research visit' }),
  });
  const visitorId = visitorReg.data?.visitorId;
  check('visitor registered', visitorReg.status === 201 && !!visitorId, `status=${visitorReg.status}`);

  const pass1 = await api(officerToken, '/api/access/visitor-passes', {
    method: 'POST',
    body: JSON.stringify({ visitorId, branchId: branchA, validForMinutes: 60 }),
  });
  const pass1Cred = pass1.data?.credential;
  check('temporary pass issued with credential', pass1.status === 201 && !!pass1Cred, `status=${pass1.status}`);

  const vOcc0 = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  const vIn = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass1Cred, branchA) });
  check('visitor check-in works', vIn.data?.event === 'CHECK_IN' && vIn.data?.visitor?.fullName === 'E2E Visitor One' && vIn.data?.identity === null, `event=${vIn.data?.event} visitor=${vIn.data?.visitor?.fullName}`);
  if (vIn.data?.visit?.id) visitIds.push(vIn.data.visit.id);
  check('occupancy increased for visitor', vIn.data?.occupancy?.currentlyInside === (vOcc0.data?.currentlyInside ?? 0) + 1, `before=${vOcc0.data?.currentlyInside} after=${vIn.data?.occupancy?.currentlyInside}`);

  const vDup = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass1Cred, branchA) });
  check('visitor duplicate scan rejected', vDup.data?.event === 'DUPLICATE', `event=${vDup.data?.event}`);

  await sleep(5700);
  const vOut = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass1Cred, branchA) });
  check('visitor checkout works', vOut.data?.event === 'CHECK_OUT', `event=${vOut.data?.event} err=${vOut.data?.errorCode}`);
  check('occupancy decreased after visitor exit', vOut.data?.occupancy?.currentlyInside === 0, `inside=${vOut.data?.occupancy?.currentlyInside}`);

  const vAnalytics = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  check('visitor analytics reflects visitor visits', (vAnalytics.data?.visitorVisits ?? 0) >= 1, `visitorVisits=${vAnalytics.data?.visitorVisits}`);

  const pass2 = await api(officerToken, '/api/access/visitor-passes', {
    method: 'POST',
    body: JSON.stringify({ visitorId, branchId: branchA, validForMinutes: 5 }),
  });
  const pass2Id = pass2.data?.pass?.id;
  const revoke = await api(officerToken, '/api/access/visitor-passes', { method: 'PATCH', body: JSON.stringify({ passId: pass2Id, reason: 'E2E revocation test' }) });
  const revokedScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass2.data?.credential, branchA) });
  check('pass revocation blocks scanning', revoke.data?.ok === true && revokedScan.data?.errorCode === 'REVOKED_QR', `revoke=${revoke.data?.ok} scan=${revokedScan.data?.errorCode}`);

  const expiredToken = signedVisitorPass(visitorId, Date.now() - 3600000);
  const craftedScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(expiredToken, branchA) });
  check('crafted expired visitor pass refused', craftedScan.data?.errorCode === 'EXPIRED_QR', `err=${craftedScan.data?.errorCode}`);

  const pass4 = await api(officerToken, '/api/access/visitor-passes', {
    method: 'POST',
    body: JSON.stringify({ visitorId, branchId: branchA, validForMinutes: 5 }),
  });
  const pass4Id = pass4.data?.pass?.id;
  const patchRes = await svc(`access_visitor_passes?id=eq.${pass4Id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ valid_from: isoDaysAgo(0.0833), valid_until: isoDaysAgo(0.0416) }) });
  const dbExpiredScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass4.data?.credential, branchA) });
  const pass4Row = await svcJson(`access_visitor_passes?id=eq.${pass4Id}&select=status`);
  check('server-side pass expiry enforced and row marked expired', patchRes.status < 300 && dbExpiredScan.data?.errorCode === 'EXPIRED_QR' && pass4Row.body?.[0]?.status === 'expired', `patch=${patchRes.status} scan=${dbExpiredScan.data?.errorCode} status=${pass4Row.body?.[0]?.status}`);

  const pass3 = await api(officerToken, '/api/access/visitor-passes', {
    method: 'POST',
    body: JSON.stringify({ visitorId, branchId: branchB, validForMinutes: 60 }),
  });
  const mismatchScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass3.data?.credential, branchA) });
  check('visitor pass is branch-scoped (cross-branch denied)', mismatchScan.data?.errorCode === 'ACCESS_DENIED', `err=${mismatchScan.data?.errorCode}`);

  console.log('--- E2E JOURNEY 3: correction ---');

  const idB = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: patronBId }) });
  patronBCredential = idB.data?.credential;
  const bIn = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronBCredential, branchA) });
  const incompleteVisitId = bIn.data?.visit?.id;
  if (incompleteVisitId) visitIds.push(incompleteVisitId);
  check('incomplete (open) visit created', bIn.data?.event === 'CHECK_IN' && !!incompleteVisitId, `event=${bIn.data?.event}`);

  const correctedAt = new Date(new Date(bIn.data?.visit?.checked_in_at).getTime() + 45 * 60000).toISOString();
  const correction = await api(officerToken, '/api/access/corrections', {
    method: 'POST',
    body: JSON.stringify({ visitId: incompleteVisitId, newStatus: 'checked_out', newCheckedOutAt: correctedAt, reason: 'E2E: missed checkout at gate' }),
  });
  check('authorized correction succeeds', correction.data?.ok === true && correction.data?.visit?.status === 'checked_out', `ok=${correction.data?.ok} err=${correction.data?.error}`);
  check('correction recalculates duration (45 minutes)', correction.data?.visit?.duration_minutes === 45, `duration=${correction.data?.visit?.duration_minutes}`);

  const corrAudit = await svcJson(`audit_logs?entity_id=eq.${incompleteVisitId}&limit=10`);
  const hasCorrectionAudit = Array.isArray(corrAudit.body) && corrAudit.body.some((r) => String(r.action || '').includes('correct'));
  check('correction written to audit trail', hasCorrectionAudit, `rows=${Array.isArray(corrAudit.body) ? corrAudit.body.length : '?'} actions=${Array.isArray(corrAudit.body) ? corrAudit.body.map((r) => r.action).join('|') : '?'}`);

  const afterCorrVisits = await api(officerToken, `/api/access/visits?branchId=${branchA}&status=checked_out`);
  const corrRow = (afterCorrVisits.data?.rows ?? []).find((r) => r.id === incompleteVisitId);
  check('analytics source data reflects correction', corrRow?.duration_minutes === 45, `duration=${corrRow?.duration_minutes}`);

  const corrOcc = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  check('occupancy corrected after closing incomplete visit', corrOcc.data?.currentlyInside === 0, `inside=${corrOcc.data?.currentlyInside}`);

  const unauthCorr = await api(studentToken, '/api/access/corrections', {
    method: 'POST',
    body: JSON.stringify({ visitId: incompleteVisitId, newStatus: 'checked_in', newCheckedOutAt: null, reason: 'E2E unauthorized revert' }),
  });
  check('unauthorized correction fails (403)', unauthCorr.status === 403, `status=${unauthCorr.status}`);

  const idorCorr = await api(tenant2Token, '/api/access/corrections', {
    method: 'POST',
    body: JSON.stringify({ visitId: incompleteVisitId, newStatus: 'checked_out', newCheckedOutAt: correctedAt, reason: 'E2E cross-institution attempt' }),
  });
  check('cross-institution correction fails (VISIT_NOT_FOUND)', idorCorr.data?.ok === false && idorCorr.data?.error === 'VISIT_NOT_FOUND', `ok=${idorCorr.data?.ok} err=${idorCorr.data?.error}`);

  console.log('--- E2E JOURNEY 4: multi-branch occupancy ---');

  const idX = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: crossPatronId }) });
  crossCredential = idX.data?.credential;

  const xInA = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(crossCredential, branchA) });
  if (xInA.data?.visit?.id) visitIds.push(xInA.data?.visit.id);
  const occA1 = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  const occB0 = await api(officerToken, `/api/access/occupancy?branchId=${branchB}`);
  check('branch A occupancy 1, branch B 0 after A check-in', occA1.data?.currentlyInside === 1 && occB0.data?.currentlyInside === 0, `A=${occA1.data?.currentlyInside} B=${occB0.data?.currentlyInside}`);

  const idB2 = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: patronBId }) });
  patronBCredential = idB2.data?.credential;
  const bInB = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronBCredential, branchB) });
  if (bInB.data?.visit?.id) visitIds.push(bInB.data.visit.id);
  const occA1b = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  const occB1 = await api(officerToken, `/api/access/occupancy?branchId=${branchB}`);
  check('independent branch occupancy (A=1, B=1)', occA1b.data?.currentlyInside === 1 && occB1.data?.currentlyInside === 1, `A=${occA1b.data?.currentlyInside} B=${occB1.data?.currentlyInside}`);

  const multiAnalytics = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const branchAStats = (multiAnalytics.data?.byBranch ?? []).find((b) => b.branchId === branchA);
  const branchBStats = (multiAnalytics.data?.byBranch ?? []).find((b) => b.branchId === branchB);
  check('combined institution analytics include both branches', !!branchAStats && !!branchBStats && branchAStats.totalVisits >= 1 && branchBStats.totalVisits >= 1, `A=${branchAStats?.totalVisits} B=${branchBStats?.totalVisits}`);
  const scopedAnalytics = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&branchId=${branchB}`);
  check('branch-scoped analytics isolates branch B', (scopedAnalytics.data?.byBranch ?? []).length === 1 && scopedAnalytics.data?.byBranch?.[0]?.branchId === branchB, `branches=${scopedAnalytics.data?.byBranch?.length}`);

  await sleep(6300);
  const xOutA = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(crossCredential, branchA) });
  const bOutB = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronBCredential, branchB) });
  const occA2 = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  const occB2 = await api(officerToken, `/api/access/occupancy?branchId=${branchB}`);
  check('both branches return to zero independently', xOutA.data?.event === 'CHECK_OUT' && bOutB.data?.event === 'CHECK_OUT' && occA2.data?.currentlyInside === 0 && occB2.data?.currentlyInside === 0, `A=${occA2.data?.currentlyInside} B=${occB2.data?.currentlyInside}`);

  await sleep(5700);
  const xInA2 = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(crossCredential, branchA) });
  check('patron re-enters branch A for conflict test', xInA2.data?.event === 'CHECK_IN', `event=${xInA2.data?.event}`);
  await sleep(5700);
  const crossConflict = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(crossCredential, branchB) });
  const conflictVisit = crossConflict.data?.visit?.id;
  const conflictRow = conflictVisit ? (await svcJson(`access_visits?id=eq.${conflictVisit}&select=branch_id,status`)) : { body: null };
  const occBFinal = await api(officerToken, `/api/access/occupancy?branchId=${branchB}`);
  check('cross-branch scan handled safely (closed visit stays on branch A, B unchanged)', crossConflict.data?.event === 'CHECK_OUT' && conflictRow.body?.[0]?.branch_id === branchA && occBFinal.data?.currentlyInside === 0, `event=${crossConflict.data?.event} visitBranch=${conflictRow.body?.[0]?.branch_id} B=${occBFinal.data?.currentlyInside}`);

  console.log('--- RED TEAM: authorization negatives ---');

  const anonRoutes = [
    ['GET', '/api/access/visits'], ['GET', '/api/access/analytics?from=2026-01-01T00:00:00Z&to=2026-12-31T00:00:00Z'],
    ['GET', '/api/access/branches'], ['GET', '/api/access/me'], ['GET', `/api/access/occupancy?branchId=${branchA}`],
    ['GET', '/api/access/visitors'], ['POST', '/api/access/scan'], ['POST', '/api/access/corrections'],
    ['POST', '/api/access/identities'], ['POST', '/api/access/visitor-passes'], ['POST', '/api/access/visitors'],
    ['POST', '/api/access/branches'], ['POST', '/api/access/manual'], ['PATCH', '/api/access/identities'],
    ['PATCH', '/api/access/visitor-passes'], ['GET', '/api/access/export?format=csv'],
  ];
  let anonAll401 = true;
  const anonDetails = [];
  for (const [method, path] of anonRoutes) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : probeBody(method, path) });
    if (res.status !== 401) { anonAll401 = false; anonDetails.push(`${method} ${path}=${res.status}`); }
  }
  check('all access endpoints reject anonymous requests with 401', anonAll401, anonDetails.join(' '));

  const studentRoutes = [
    ['GET', '/api/access/analytics?from=2026-01-01T00:00:00Z&to=2026-12-31T00:00:00Z'],
    ['GET', '/api/access/visits'], ['GET', `/api/access/occupancy?branchId=${branchA}`],
    ['GET', '/api/access/export?format=csv'], ['POST', '/api/access/scan'],
    ['POST', '/api/access/corrections'], ['POST', '/api/access/branches'], ['POST', '/api/access/visitor-passes'],
    ['POST', '/api/access/manual'],
  ];
  let studentAll403 = true;
  const studentDetails = [];
  for (const [method, path] of studentRoutes) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : probeBody(method, path) });
    if (res.status !== 403) { studentAll403 = false; studentDetails.push(`${method} ${path}=${res.status}`); }
  }
  check('student role blocked from analytics, export, scan, corrections, capacity (403)', studentAll403, studentDetails.join(' '));

  const studentMe = await api(studentToken, '/api/access/me');
  check('student sees only own registration state, no other user data', studentMe.status === 200 && studentMe.data?.registered === false && (studentMe.data?.visits ?? []).length === 0, `registered=${studentMe.data?.registered} visits=${studentMe.data?.visits?.length}`);

  const t2Analytics = await api(tenant2Token, `/api/access/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  check('cross-institution analytics query returns no foreign visits', t2Analytics.status === 200 && t2Analytics.data?.totalVisits === 0, `total=${t2Analytics.data?.totalVisits}`);
  const t2Visits = await api(tenant2Token, '/api/access/visits');
  check('cross-institution visit history returns no foreign rows', t2Visits.status === 200 && (t2Visits.data?.rows ?? []).length === 0, `rows=${t2Visits.data?.rows?.length}`);
  const t2BranchList = await api(tenant2Token, '/api/access/branches');
  const seesOurBranch = Array.isArray(t2BranchList.data) && t2BranchList.data.some((b) => b.code === 'E2E-SLAAS-A');
  check('cross-institution branch list hides foreign branches', t2BranchList.status === 200 && !seesOurBranch, `sees=${seesOurBranch}`);
  const t2Occ = await api(tenant2Token, `/api/access/occupancy?branchId=${branchA}`);
  check('cross-institution occupancy probe returns 404', t2Occ.status === 404, `status=${t2Occ.status}`);
  const t2Scan = await api(tenant2Token, '/api/access/scan', { method: 'POST', body: scanBody(patronACredential, branchA) });
  check('cross-institution scan at foreign branch refused', t2Scan.data?.errorCode === 'BRANCH_NOT_FOUND', `err=${t2Scan.data?.errorCode}`);
  const t2RevokeIdentity = await api(tenant2Token, '/api/access/identities', { method: 'PATCH', body: JSON.stringify({ identityId: patronAIdentityId }) });
  check('IDOR: foreign identity revoke returns 404', t2RevokeIdentity.status === 404, `status=${t2RevokeIdentity.status}`);
  const t2RevokePass = await api(tenant2Token, '/api/access/visitor-passes', { method: 'PATCH', body: JSON.stringify({ passId: pass3.data?.pass?.id }) });
  check('IDOR: foreign visitor pass revoke returns 404', t2RevokePass.status === 404, `status=${t2RevokePass.status}`);
  const t2ManualSearch = await api(tenant2Token, '/api/access/manual', { method: 'POST', body: JSON.stringify({ action: 'search', query: 'E2E Patron' }) });
  check('cross-institution manual search returns no foreign patrons', t2ManualSearch.status === 200 && (t2ManualSearch.data?.results ?? []).length === 0, `results=${t2ManualSearch.data?.results?.length}`);
  const officerManualSearch = await api(officerToken, '/api/access/manual', { method: 'POST', body: JSON.stringify({ action: 'search', query: 'E2E Patron Aisha' }) });
  check('manual patron search works for authorized officer', officerManualSearch.status === 200 && (officerManualSearch.data?.results ?? []).length >= 1, `results=${officerManualSearch.data?.results?.length}`);

  const anonVisitorData = await fetch(`${BASE}/api/access/me`, { headers: { Authorization: 'Bearer invalid.token.value' } });
  check('visitor/anonymous cannot access user data (invalid session rejected)', anonVisitorData.status === 401, `status=${anonVisitorData.status}`);

  console.log('--- RED TEAM: API and QR negatives ---');

  const invalidBranch = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronACredential, randomUUID()) });
  check('invalid branch refused', invalidBranch.data?.errorCode === 'BRANCH_NOT_FOUND', `err=${invalidBranch.data?.errorCode}`);

  const malformed = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody('garbage-no-dot', branchA) });
  check('malformed QR refused', malformed.data?.errorCode === 'INVALID_QR', `err=${malformed.data?.errorCode}`);

  const forged = hmacSign({ v: 1, sub: patronAIdentityId, iss: 'esut-library', aud: 'esut-access-gate', iat: 1, exp: Math.floor(Date.now() / 1000) + 100, jti: 'forged' }, 'attacker-guess');
  const forgedScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(forged, branchA) });
  check('forged (wrong-secret) token refused', forgedScan.data?.errorCode === 'INVALID_QR', `err=${forgedScan.data?.errorCode}`);

  const guessed = signedDynamicCredential(randomUUID(), 100);
  const guessedScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(guessed, branchA) });
  check('random access identifier guessing refused', guessedScan.data?.errorCode === 'INVALID_QR', `err=${guessedScan.data?.errorCode}`);

  const replayed = signedDynamicCredential(patronAIdentityId, 100);
  const replayScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(replayed, branchA) });
  check('replayed dynamic token (not the stored credential) refused', replayScan.data?.errorCode === 'INVALID_QR', `err=${replayScan.data?.errorCode}`);

  const expiredDynamic = signedDynamicCredential(patronAIdentityId, -10);
  const expiredDynamicScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(expiredDynamic, branchA) });
  check('expired dynamic token refused', expiredDynamicScan.data?.errorCode === 'EXPIRED_QR', `err=${expiredDynamicScan.data?.errorCode}`);

  const huge = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody('A'.repeat(2000000), branchA) });
  check('huge payload handled gracefully (no 5xx)', huge.status < 500, `status=${huge.status}`);

  const revokeMine = await api(officerToken, '/api/access/identities', { method: 'PATCH', body: JSON.stringify({ identityId: patronAIdentityId, reason: 'E2E revoke test' }) });
  const revokedIdentityScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(patronACredential, branchA) });
  check('revoked access identity refuses scanning (REVOKED_QR)', revokeMine.data?.ok === true && revokedIdentityScan.data?.errorCode === 'REVOKED_QR', `revoke=${revokeMine.data?.ok} scan=${revokedIdentityScan.data?.errorCode}`);

  console.log('--- RED TEAM: attendance races and manual operations ---');

  const idR = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: racePatronId }) });
  raceCredential = idR.data?.credential;

  const [race1, race2] = await Promise.all([
    api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(raceCredential, branchA) }),
    api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(raceCredential, branchA) }),
  ]);
  const raceEvents = [race1.data?.event, race2.data?.event];
  const checkIns = raceEvents.filter((e) => e === 'CHECK_IN').length;
  const openRace = await svcJson(`access_visits?patron_id=eq.${racePatronId}&status=eq.checked_in&select=id`);
  check('double scan race produces exactly one check-in', checkIns === 1, `events=${raceEvents.join(',')}`);
  check('multiple open visits impossible (unique index holds)', Array.isArray(openRace.body) && openRace.body.length === 1, `open=${Array.isArray(openRace.body) ? openRace.body.length : '?'}`);
  const raceVisitId = openRace.body?.[0]?.id;
  if (raceVisitId) visitIds.push(raceVisitId);

  const manualOut = await api(officerToken, '/api/access/manual', { method: 'POST', body: JSON.stringify({ action: 'check_out', visitId: raceVisitId, branchId: branchA, reason: 'E2E manual close after race' }) });
  check('manual operation closes race visit', manualOut.data?.ok === true, `ok=${manualOut.data?.ok} err=${manualOut.data?.error}`);

  await sleep(5700);
  const noEntry = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(raceCredential, branchA, 'CHECK_OUT_ONLY') });
  check('checkout without entry denied', noEntry.data?.errorCode === 'NOT_CURRENTLY_INSIDE', `err=${noEntry.data?.errorCode}`);

  const manualIn = await api(officerToken, '/api/access/manual', { method: 'POST', body: JSON.stringify({ action: 'check_in', patronId: racePatronId, branchId: branchA, reason: 'E2E manual entry' }) });
  const manualVisitId = manualIn.data?.visit?.id;
  if (manualVisitId) visitIds.push(manualVisitId);
  const manualOut2 = await api(officerToken, '/api/access/manual', { method: 'POST', body: JSON.stringify({ action: 'check_out', visitId: manualVisitId, branchId: branchA, reason: 'E2E manual exit' }) });
  check('manual check-in and check-out both work', manualIn.data?.ok === true && manualOut2.data?.ok === true, `in=${manualIn.data?.ok} out=${manualOut2.data?.ok}`);

  const manualAuditIn = await svcJson(`audit_logs?action=eq.access.manual_check_in&limit=1`);
  const manualAuditOut = await svcJson(`audit_logs?action=eq.access.manual_check_out&limit=1`);
  check('manual operations audited', Array.isArray(manualAuditIn.body) && manualAuditIn.body.length > 0 && Array.isArray(manualAuditOut.body) && manualAuditOut.body.length > 0, `in=${Array.isArray(manualAuditIn.body) ? manualAuditIn.body.length : '?'} out=${Array.isArray(manualAuditOut.body) ? manualAuditOut.body.length : '?'}`);

  const finalA = await api(officerToken, `/api/access/occupancy?branchId=${branchA}`);
  const finalB = await api(officerToken, `/api/access/occupancy?branchId=${branchB}`);
  check('final occupancy zero on both branches', finalA.data?.currentlyInside === 0 && finalB.data?.currentlyInside === 0, `A=${finalA.data?.currentlyInside} B=${finalB.data?.currentlyInside}`);

  writeFileSync(STATE_FILE, JSON.stringify({ officer, student, patronUser, tenant2User, calendarId, visitIds }, null, 2));
  await cleanupEnd();
  const postBranches = await svcJson('library_branches?select=code&code=like.E2E-SLAAS-%25');
  const postVisitors = await svcJson('access_visitors?select=id&full_name=like.E2E%20Visitor%25');
  const postPatrons = await svcJson('patrons?select=patron_id&patron_id=like.E2E-SLAAS-%25');
  const postVisits = await svcJson('access_visits?select=id&branch_id=not.is.null');
  const postEvents = await svcJson('access_events?select=id&branch_id=not.is.null');
  check('cleanup removed all E2E data', (postBranches.body?.length ?? -1) === 0 && (postVisitors.body?.length ?? -1) === 0 && (postPatrons.body?.length ?? -1) === 0 && (postVisits.body?.length ?? -1) === 0 && (postEvents.body?.length ?? -1) === 0, `branches=${postBranches.body?.length} visitors=${postVisitors.body?.length} patrons=${postPatrons.body?.length} visits=${postVisits.body?.length} events=${postEvents.body?.length}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try { await cleanupEnd(); } catch (cleanupError) { console.error('cleanup failed', cleanupError); }
  process.exit(1);
});
