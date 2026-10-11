import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const PROJECT_ROOT = 'C:\\Users\\LENOVO\\Desktop\\DWC_Platform_2.5_Idea_Project_Intake_Stitch\\Projects\\ESUT SMART LIBRARY';
const BACKUP_FILE = `${PROJECT_ROOT}\\scripts\\.dr-backup.json`;
const STATE_FILE = `${PROJECT_ROOT}\\scripts\\.dr-state.json`;

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
const OFFICER_EMAIL = 'dr-slaas-officer@invalid.invalid';
const PATRON_EMAIL = 'dr-slaas-patron@invalid.invalid';
const PASSWORD = 'E2eSlaas!';
const SESSION = 'DR SLAAS/2026';
const BRANCH_CODE = 'DR-SLAAS-A';
const PATRON_CODE = 'DR-SLAAS-P1';
const VISITOR_NAME = 'DR Visitor One';
const VISITOR_LIKE = `${encodeURIComponent('DR Visitor')}%25`;

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

async function authUserList() {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const body = await res.json();
  return body.users ?? [];
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

const scanBody = (credential, branchId) => JSON.stringify({ credential, branchId, mode: 'AUTO', idempotencyKey: randomUUID() });
const isoHoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const dayOnly = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: String(detail ?? '') });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} - ${detail}`);
}

let officer;
let patronUser;
let calendarId;
let branchId;
let patronRowId;
let credential;
let visitorId;
let patronVisitId;
let visitorVisitId;
let officerToken;

async function wipeFixture() {
  const branches = await svcJson('library_branches?select=id&code=like.DR-SLAAS-%25');
  const branchIds = Array.isArray(branches.body) ? branches.body.map((b) => b.id) : [];
  const patrons = await svcJson('patrons?select=id&patron_id=like.DR-SLAAS-%25');
  const patronIds = Array.isArray(patrons.body) ? patrons.body.map((p) => p.id) : [];
  const visitors = await svcJson(`access_visitors?select=id&full_name=like.${VISITOR_LIKE}`);
  const visitorIds = Array.isArray(visitors.body) ? visitors.body.map((v) => v.id) : [];
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
    await svc(`library_scan_workstations?${f}`, { method: 'DELETE' }).catch(() => undefined);
  }
  if (patronIds.length > 0) await svc(`library_access_identities?patron_id=in.(${patronIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  if (visitorIds.length > 0) await svc(`access_visitor_passes?visitor_id=in.(${visitorIds.join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  await svc('library_branches?code=like.DR-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitors?full_name=like.${VISITOR_LIKE}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`academic_calendar?session=eq.${encodeURIComponent(SESSION)}`, { method: 'DELETE' }).catch(() => undefined);
  await svc('patrons?patron_id=like.DR-SLAAS-%25', { method: 'DELETE' }).catch(() => undefined);
  const users = await authUserList();
  for (const u of users.filter((x) => x.email && x.email.startsWith('dr-slaas-'))) {
    await svc(`audit_logs?actor_user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_roles?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  }
}

async function selectRows(table, filter) {
  const res = await svcJson(`${table}?select=*&${filter}`);
  if (res.status !== 200 || !Array.isArray(res.body)) throw new Error(`backup select failed for ${table}: ${res.status}`);
  return res.body;
}

async function insertRows(table, rows) {
  if (rows.length === 0) return;
  const res = await svc(table, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`restore insert failed for ${table}: ${res.status} ${await res.text()}`);
}

async function main() {
  await wipeFixture();
  officer = await createUser(OFFICER_EMAIL, 'super_admin');
  patronUser = await createUser(PATRON_EMAIL, 'student');
  officerToken = await signIn(OFFICER_EMAIL);
  console.log(`users ready officer=${officer} patron=${patronUser}`);

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
  check('fixture: academic period exists', !!calendarId, `id=${calendarId}`);

  const br = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ code: BRANCH_CODE, name: 'DR Drill Branch', capacity: 10, capacityMode: 'warning', warnThresholdPct: 80, active: true }),
  });
  branchId = br.data?.id;
  check('fixture: branch created', br.status === 201 && !!branchId, `status=${br.status}`);

  const br2 = await api(officerToken, '/api/access/branches', {
    method: 'POST',
    body: JSON.stringify({ id: branchId, code: BRANCH_CODE, name: 'DR Drill Branch', capacity: 12, capacityMode: 'warning', warnThresholdPct: 80, active: true, reason: 'DR capacity change' }),
  });
  check('fixture: capacity updated to 12', br2.status === 200 && br2.data?.ok === true, `status=${br2.status}`);

  patronRowId = await ensurePatron(PATRON_CODE, patronUser, 'DR Patron Dana');
  check('fixture: patron linked to auth user', !!patronRowId && !!patronUser, `patron=${patronRowId}`);

  const idRes = await api(officerToken, '/api/access/identities', { method: 'POST', body: JSON.stringify({ patronId: patronRowId }) });
  credential = idRes.data?.credential;
  check('fixture: identity issued', idRes.status === 201 && !!credential, `status=${idRes.status}`);

  const visitorReg = await api(officerToken, '/api/access/visitors', {
    method: 'POST',
    body: JSON.stringify({ fullName: VISITOR_NAME, organization: 'DR Org', purpose: 'DR restore drill' }),
  });
  visitorId = visitorReg.data?.visitorId;
  check('fixture: visitor registered', visitorReg.status === 201 && !!visitorId, `status=${visitorReg.status}`);

  const pass1 = await api(officerToken, '/api/access/visitor-passes', {
    method: 'POST',
    body: JSON.stringify({ visitorId, branchId, validForMinutes: 60 }),
  });
  check('fixture: visitor pass issued', pass1.status === 201 && !!pass1.data?.credential, `status=${pass1.status}`);

  const vIn = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass1.data.credential, branchId) });
  visitorVisitId = vIn.data?.visit?.id;
  check('fixture: visitor checked in', vIn.data?.event === 'CHECK_IN', `event=${vIn.data?.event}`);

  await sleep(5700);
  const vOut = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(pass1.data.credential, branchId) });
  check('fixture: visitor checked out (closed visit)', vOut.data?.event === 'CHECK_OUT', `event=${vOut.data?.event}`);

  const pIn = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(credential, branchId) });
  patronVisitId = pIn.data?.visit?.id;
  check('fixture: patron checked in (open visit)', pIn.data?.event === 'CHECK_IN', `event=${pIn.data?.event}`);

  await svc(`access_visits?id=eq.${patronVisitId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ checked_in_at: isoHoursAgo(2) }) });

  const occPre = await api(officerToken, `/api/access/occupancy?branchId=${branchId}`);
  check('fixture: occupancy 1 with capacity 12', occPre.data?.currentlyInside === 1 && occPre.data?.capacity === 12, `inside=${occPre.data?.currentlyInside} capacity=${occPre.data?.capacity}`);

  const t0 = performance.now();
  const tables = {};
  tables.academic_calendar = await selectRows('academic_calendar', `session=eq.${encodeURIComponent(SESSION)}`);
  tables.library_branches = await selectRows('library_branches', 'code=eq.DR-SLAAS-A');
  tables.patrons = await selectRows('patrons', 'patron_id=eq.DR-SLAAS-P1');
  tables.access_visitors = await selectRows('access_visitors', `full_name=eq.${encodeURIComponent(VISITOR_NAME)}`);
  tables.library_access_identities = await selectRows('library_access_identities', `patron_id=eq.${patronRowId}`);
  tables.access_visits = await selectRows('access_visits', `branch_id=eq.${branchId}`);
  tables.access_events = await selectRows('access_events', `branch_id=eq.${branchId}`);
  tables.access_visitor_passes = await selectRows('access_visitor_passes', `branch_id=eq.${branchId}`);
  tables.library_branch_capacity_history = await selectRows('library_branch_capacity_history', `branch_id=eq.${branchId}`);
  tables.analytics_events = await selectRows('analytics_events', `entity_id=in.(${[patronVisitId, visitorVisitId].join(',')})`);
  const auditOfficer = await selectRows('audit_logs', `or=(actor_user_id.eq.${officer},user_id.eq.${officer})`);
  const auditPatron = await selectRows('audit_logs', `or=(actor_user_id.eq.${patronUser},user_id.eq.${patronUser})`);
  const auditById = new Map();
  for (const row of [...auditOfficer, ...auditPatron]) auditById.set(row.id, row);
  tables.audit_logs = [...auditById.values()];
  tables.user_roles = await selectRows('user_roles', `or=(user_id.eq.${officer},user_id.eq.${patronUser})`);
  const usersAll = await authUserList();
  const authUsers = usersAll
    .filter((u) => u.email === OFFICER_EMAIL || u.email === PATRON_EMAIL)
    .map((u) => ({ id: u.id, email: u.email }));
  const backupMs = Math.round(performance.now() - t0);

  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  counts.auth_users = authUsers.length;
  console.log('backup counts:', JSON.stringify(counts));
  check('backup: 2 visits (1 open + 1 closed)', counts.access_visits === 2, `n=${counts.access_visits}`);
  check('backup: branch, calendar, patron, identity, visitor, pass present',
    counts.library_branches === 1 && counts.academic_calendar === 1 && counts.patrons === 1
    && counts.library_access_identities === 1 && counts.access_visitors === 1 && counts.access_visitor_passes === 1,
    JSON.stringify(counts));
  check('backup: capacity history + roles + users captured',
    counts.library_branch_capacity_history >= 1 && counts.user_roles === 2 && counts.auth_users === 2, JSON.stringify(counts));
  check('backup: events, analytics and audit captured',
    counts.access_events >= 3 && counts.analytics_events >= 2 && counts.audit_logs >= 3,
    JSON.stringify({ events: counts.access_events, analytics: counts.analytics_events, audit: counts.audit_logs }));

  writeFileSync(BACKUP_FILE, JSON.stringify({ backedUpAt: new Date().toISOString(), backupMs, counts, tables, authUsers }, null, 2));

  const t1 = performance.now();
  await svc('analytics_events?entity_id=in.(' + [patronVisitId, visitorVisitId].join(',') + ')', { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_events?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visits?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitor_passes?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_branch_capacity_history?branch_id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_access_identities?patron_id=eq.${patronRowId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`library_branches?id=eq.${branchId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`access_visitors?full_name=like.${VISITOR_LIKE}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`academic_calendar?id=eq.${calendarId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`patrons?id=eq.${patronRowId}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`audit_logs?actor_user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`audit_logs?user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`audit_logs?actor_user_id=eq.${patronUser}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`audit_logs?user_id=eq.${patronUser}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`user_roles?user_id=eq.${officer}`, { method: 'DELETE' }).catch(() => undefined);
  await svc(`user_roles?user_id=eq.${patronUser}`, { method: 'DELETE' }).catch(() => undefined);
  await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${officer}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${patronUser}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  const lossMs = Math.round(performance.now() - t1);

  const lossVisits = await svcJson(`access_visits?branch_id=eq.${branchId}&select=id`);
  const lossBranch = await svcJson(`library_branches?id=eq.${branchId}&select=id`);
  const lossUsers = (await authUserList()).filter((u) => u.email === OFFICER_EMAIL || u.email === PATRON_EMAIL);
  check('loss simulated: visits, branch and users gone',
    (lossVisits.body?.length ?? -1) === 0 && (lossBranch.body?.length ?? -1) === 0 && lossUsers.length === 0,
    JSON.stringify({ visits: lossVisits.body?.length, branches: lossBranch.body?.length, users: lossUsers.length }));

  const t2 = performance.now();
  for (const u of authUsers) {
    const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, email: u.email, password: PASSWORD, email_confirm: true }),
    }));
    if (!res.ok) throw new Error(`auth user restore failed for ${u.email}: ${res.status} ${await res.text()}`);
  }
  const RESTORE_ORDER = [
    'user_roles',
    'academic_calendar',
    'patrons',
    'access_visitors',
    'library_branches',
    'library_access_identities',
    'access_visitor_passes',
    'access_visits',
    'access_events',
    'library_branch_capacity_history',
    'analytics_events',
    'audit_logs',
  ];
  for (const table of RESTORE_ORDER) await insertRows(table, tables[table]);
  const restoreMs = Math.round(performance.now() - t2);

  const t3 = performance.now();
  const auditAfter = await selectRows('audit_logs', `or=(actor_user_id.eq.${officer},user_id.eq.${officer})`)
    .catch(() => []);
  const auditAfter2 = await selectRows('audit_logs', `or=(actor_user_id.eq.${patronUser},user_id.eq.${patronUser})`)
    .catch(() => []);
  const auditRestoredIds = new Set([...auditAfter, ...auditAfter2].map((r) => r.id));
  const backupAuditIds = new Set(tables.audit_logs.map((r) => r.id));
  const auditMissing = [...backupAuditIds].filter((id) => !auditRestoredIds.has(id));
  check('restore: all audit rows returned', auditMissing.length === 0, `missing=${auditMissing.length} of ${backupAuditIds.size}`);

  officerToken = await signIn(OFFICER_EMAIL);
  const patronToken = await signIn(PATRON_EMAIL);
  check('restore: both users can sign in again', !!officerToken && !!patronToken, 'sign-in ok');

  const usersAfter = await authUserList();
  const idsAfter = Object.fromEntries(usersAfter.filter((u) => u.email === OFFICER_EMAIL || u.email === PATRON_EMAIL).map((u) => [u.email, u.id]));
  const backupIds = Object.fromEntries(authUsers.map((u) => [u.email, u.id]));
  check('restore: user ids preserved', idsAfter[OFFICER_EMAIL] === backupIds[OFFICER_EMAIL] && idsAfter[PATRON_EMAIL] === backupIds[PATRON_EMAIL], JSON.stringify(idsAfter));

  const visitsList = await api(officerToken, `/api/access/visits?branchId=${branchId}`);
  const rows = visitsList.data?.rows ?? [];
  const backupVisitIds = tables.access_visits.map((v) => v.id).sort();
  const restoredVisitIds = rows.map((v) => v.id).sort();
  const statuses = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
  check('restore: visits list shows 2 visits with original ids',
    rows.length === 2 && JSON.stringify(backupVisitIds) === JSON.stringify(restoredVisitIds),
    `rows=${rows.length} ids=${JSON.stringify(restoredVisitIds)}`);
  check('restore: open/closed visit state preserved',
    statuses.checked_in === 1 && statuses.checked_out === 1, JSON.stringify(statuses));

  const occ = await api(officerToken, `/api/access/occupancy?branchId=${branchId}`);
  check('restore: occupancy derived from open visit = 1, capacity 12',
    occ.data?.currentlyInside === 1 && occ.data?.capacity === 12, `inside=${occ.data?.currentlyInside} capacity=${occ.data?.capacity}`);

  const csv = await api(officerToken, `/api/access/export?format=csv&branchId=${branchId}`);
  const csvText = csv.buffer ? csv.buffer.toString('utf8') : '';
  check('restore: CSV report contains both visits',
    csv.status === 200 && backupVisitIds.every((id) => csvText.includes(id)), `status=${csv.status}`);

  const analytics = await api(officerToken, `/api/access/analytics?from=${encodeURIComponent(isoHoursAgo(48))}&to=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`);
  check('restore: analytics counts restored visits',
    (analytics.data?.totalVisits ?? 0) >= 2 && (analytics.data?.visitorVisits ?? 0) >= 1,
    `total=${analytics.data?.totalVisits} visitor=${analytics.data?.visitorVisits}`);

  const me = await api(patronToken, '/api/access/me');
  check('restore: personal attendance history intact',
    (me.data?.stats?.totalVisits ?? 0) >= 1 && (me.data?.visits ?? []).some((r) => r.id === patronVisitId),
    `total=${me.data?.stats?.totalVisits}`);

  const passRow = await svcJson(`access_visitor_passes?branch_id=eq.${branchId}&select=id,status,secure_token_hash,valid_from,valid_until`);
  const backupPass = tables.access_visitor_passes[0];
  const restoredPass = Array.isArray(passRow.body) ? passRow.body[0] : null;
  check('restore: visitor pass row restored intact (status + token hash)',
    !!restoredPass && restoredPass.id === backupPass.id && restoredPass.status === backupPass.status
    && restoredPass.secure_token_hash === backupPass.secure_token_hash,
    `status=${restoredPass?.status}`);

  const calAfter = await svcJson(`academic_calendar?session=eq.${encodeURIComponent(SESSION)}&select=id`);
  check('restore: academic period restored with original id',
    Array.isArray(calAfter.body) && calAfter.body[0]?.id === calendarId, `id=${calAfter.body?.[0]?.id}`);

  await sleep(5700);
  const finalScan = await api(officerToken, '/api/access/scan', { method: 'POST', body: scanBody(credential, branchId) });
  const finalDuration = finalScan.data?.visit?.duration_minutes;
  check('restore: credential still valid, checkout works, duration recalculated',
    finalScan.data?.event === 'CHECK_OUT' && typeof finalDuration === 'number' && finalDuration >= 115 && finalDuration <= 125,
    `event=${finalScan.data?.event} duration=${finalDuration}`);

  const finalOcc = await api(officerToken, `/api/access/occupancy?branchId=${branchId}`);
  check('restore: occupancy 0 after post-restore checkout', finalOcc.data?.currentlyInside === 0, `inside=${finalOcc.data?.currentlyInside}`);

  const verifyMs = Math.round(performance.now() - t3);
  const allPassed = checks.every((c) => c.ok);
  const lossToVerifiedMs = Math.round(lossMs + restoreMs + verifyMs);

  console.log('');
  console.log(`backupMs=${backupMs} lossMs=${lossMs} restoreMs=${restoreMs} verifyMs=${verifyMs} lossToVerifiedMs=${lossToVerifiedMs}`);
  console.log(`${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
  writeFileSync(STATE_FILE, JSON.stringify({
    allPassed,
    checks,
    backupMs,
    lossMs,
    restoreMs,
    verifyMs,
    lossToVerifiedMs,
    counts,
    ranAt: new Date().toISOString(),
  }, null, 2));

  await wipeFixture();
  console.log(`DR RESTORE TEST ${allPassed ? 'PASSED' : 'FAILED'}`);
  if (!allPassed) process.exit(1);
}

main().catch(async (err) => {
  console.error('FATAL', err);
  try { await wipeFixture(); } catch (cleanupError) { console.error('cleanup failed', cleanupError); }
  process.exit(1);
});
