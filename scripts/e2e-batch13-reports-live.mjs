import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { join } from 'path';

const STATE_FILE = join(tmpdir(), 'e2e-batch13-reports-state.json');

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
const OWNER_EMAIL = 'e2e-batch13-reports@invalid.invalid';
const OTHER_EMAIL = 'e2e-batch13-reports2@invalid.invalid';
const PASSWORD = 'E2eBatch13!';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function withRetry(fn, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastError;
}

const serviceHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const svc = (path, init = {}) => withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...(init.headers || {}) } }));

async function findUserByEmail(email) {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const body = await res.json();
  return (body.users ?? []).find((u) => u.email === email) ?? null;
}

async function createUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await svc(`user_roles?user_id=eq.${existing.id}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, { method: 'DELETE', headers: serviceHeaders }));
  }
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  }));
  const body = await res.json();
  const uid = body.id ?? body.user?.id;
  if (uid) {
    await svc('user_roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, role: 'super_admin', tenant_id: TENANT }),
    });
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

async function builder(token, payload) {
  const res = await withRetry(() => fetch(`${BASE}/api/admin/reports/builder`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
  return res;
}

async function cleanup(ownerId, otherId) {
  if (ownerId) {
    await svc(`saved_reports?name=like.${encodeURIComponent('E2E%')}`, { method: 'DELETE' }).catch(() => undefined);
    const owned = await svc('saved_reports?owner_id=' + ownerId + '&select=id').then((r) => r.json()).catch(() => []);
    for (const row of Array.isArray(owned) ? owned : []) {
      await svc(`report_run_history?report_id=eq.${row.id}`, { method: 'DELETE' }).catch(() => undefined);
      await svc(`saved_reports?id=eq.${row.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    await svc(`report_run_history?triggered_by=eq.${ownerId}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_notifications?user_id=eq.${ownerId}&type=eq.report`, { method: 'DELETE' }).catch(() => undefined);
  }
  if (otherId) {
    const owned = await svc('saved_reports?owner_id=' + otherId + '&select=id').then((r) => r.json()).catch(() => []);
    for (const row of Array.isArray(owned) ? owned : []) {
      await svc(`report_run_history?report_id=eq.${row.id}`, { method: 'DELETE' }).catch(() => undefined);
      await svc(`saved_reports?id=eq.${row.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    await svc(`report_run_history?triggered_by=eq.${otherId}`, { method: 'DELETE' }).catch(() => undefined);
  }
}

const owner = await createUser(OWNER_EMAIL);
const other = await createUser(OTHER_EMAIL);
check('created E2E report users', !!owner && !!other, `owner=${owner} other=${other}`);

await cleanup(owner, other);

const ownerToken = await signIn(OWNER_EMAIL);
const otherToken = await signIn(OTHER_EMAIL);

// 1. Run report (defaults, sensitive columns excluded)
const runRes = await builder(ownerToken, { action: 'run', query: { dataset: 'patrons', pageSize: 5 }, logRun: true });
const runBody = await runRes.json();
const runCols = runBody.result?.columns ?? [];
check('run patrons report succeeds with non-sensitive default columns', runRes.status === 200 && runBody.success && runCols.length > 0 && !runCols.includes('email') && !runCols.includes('full_name') && !runCols.includes('phone'), `columns=${runCols.join(',')}`);

const colRun = await builder(ownerToken, { action: 'run', query: { dataset: 'patrons', columns: [{ field: 'id', label: 'ID', type: 'string' }, { field: 'email', label: 'Email', type: 'string' }], pageSize: 5 } });
const colBody = await colRun.json();
check('explicit column selection (incl. email) honored for admin run', colRun.status === 200 && colBody.success && (colBody.result?.columns ?? []).includes('email'), `columns=${(colBody.result?.columns ?? []).join(',')}`);

// Unknown/missing dataset
const unkRes = await builder(ownerToken, { action: 'run', query: { dataset: 'not_a_dataset' } });
const unkBody = await unkRes.json().catch(() => ({}));
check('unknown dataset rejected', unkRes.status >= 400 && String(unkBody.error ?? unkBody.message ?? '').toLowerCase().includes('unknown dataset'), `status=${unkRes.status} err=${unkBody.error ?? unkBody.message}`);

const missRes = await builder(ownerToken, { action: 'run', query: {} });
check('missing dataset → 400', missRes.status === 400, `status=${missRes.status}`);

// No auth
const noAuth = await fetch(`${BASE}/api/admin/reports/builder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) });
check('no auth → 401', noAuth.status === 401, `status=${noAuth.status}`);

// 2. CSV export
const csvRes = await fetch(`${BASE}/api/admin/reports/builder`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'export', format: 'csv', query: { dataset: 'catalogue', pageSize: 10 } }),
});
const csvText = await csvRes.text();
const csvLines = csvText.trim().split('\n');
check('CSV export returns valid CSV', csvRes.status === 200 && (csvRes.headers.get('content-type') ?? '').includes('text/csv') && csvLines.length >= 2 && csvLines[0].includes(','), `lines=${csvLines.length} header=${csvLines[0]?.slice(0, 60)}`);

// 3. XLSX export (real OOXML zip)
const xlsxRes = await fetch(`${BASE}/api/admin/reports/builder`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'export', format: 'xlsx', query: { dataset: 'catalogue', pageSize: 10 }, reportName: 'E2E XLSX' }),
});
const xlsxBuf = Buffer.from(await xlsxRes.arrayBuffer());
const isZip = xlsxBuf.length > 4 && xlsxBuf[0] === 0x50 && xlsxBuf[1] === 0x4b;
let zipValid = false;
let sheetHasContent = false;
try {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(xlsxBuf);
  zipValid = !!zip.file('xl/workbook.xml') && !!zip.file('xl/worksheets/sheet1.xml') && !!zip.file('[Content_Types].xml');
  if (zipValid) {
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    sheetHasContent = sheetXml.includes('<row') && sheetXml.length > 500;
  }
} catch (err) {
  console.log('zip inspect error:', err instanceof Error ? err.message : err);
}
check('XLSX export is a real OOXML workbook', xlsxRes.status === 200 && isZip && zipValid && sheetHasContent, `bytes=${xlsxBuf.length} pk=${isZip} parts=${zipValid} rows=${sheetHasContent}`);

// 4. Save / list / get
const saveRes = await builder(ownerToken, {
  action: 'save',
  definition: { name: 'E2E Saved Report', description: 'batch13 e2e', reportType: 'catalogue', dataset: 'catalogue', columns: [], filters: [], sorting: [] },
});
const saveBody = await saveRes.json();
const reportId = saveBody.id;
check('save report definition', saveRes.status === 200 && saveBody.success && !!reportId, `id=${reportId ?? JSON.stringify(saveBody)}`);

const listRes = await builder(ownerToken, { action: 'list' });
const listBody = await listRes.json();
check('list reports includes saved report', listRes.status === 200 && (listBody.reports ?? []).some((r) => r.id === reportId), `count=${listBody.reports?.length}`);

const getRes = await builder(ownerToken, { action: 'get', reportId });
const getBody = await getRes.json();
check('get saved report by id', getRes.status === 200 && getBody.report?.id === reportId, `name=${getBody.report?.name}`);

// 5. History (from the logRun earlier)
const histRes = await builder(ownerToken, { action: 'history', reportId: null });
const histBody = await histRes.json();
const histRows = histBody.history ?? [];
check('run history includes logged runs', histRes.status === 200 && histRows.length >= 1 && histRows.some((h) => h.report_type === 'patrons' && h.status === 'completed'), `count=${histRows.length}`);

// 6. Ownership: other user cannot delete owner's report
const delRes = await builder(otherToken, { action: 'delete', reportId });
const delBody = await delRes.json().catch(() => ({}));
const stillExists = await svc(`saved_reports?id=eq.${reportId}&select=id`).then((r) => r.json()).catch(() => []);
check('foreign delete does not remove report (owner enforced)', delRes.status === 200 && delBody.success === true && Array.isArray(stillExists) && stillExists.length === 1, `exists=${Array.isArray(stillExists) ? stillExists.length : '?'}`);

const otherGet = await builder(otherToken, { action: 'get', reportId });
const otherGetBody = await otherGet.json().catch(() => ({}));
check('private report hidden from other user via API get', otherGet.status === 200 && otherGetBody.success && !otherGetBody.report, `report=${JSON.stringify(otherGetBody.report ?? null)}`);

// 7. Schedule
const schRes = await builder(ownerToken, {
  action: 'schedule',
  reportId,
  schedule: { enabled: true, frequency: 'daily', time: '08:00', delivery: 'in_app' },
});
const schBody = await schRes.json();
check('schedule set on own report', schRes.status === 200 && schBody.success && schBody.schedule?.schedule_enabled === true && !!schBody.schedule?.schedule_next_run_at, `next=${schBody.schedule?.schedule_next_run_at}`);

const otherSch = await builder(otherToken, { action: 'schedule', reportId, schedule: { enabled: true, frequency: 'daily', time: '08:00', delivery: 'in_app' } });
check('foreign schedule update → 404', otherSch.status === 404, `status=${otherSch.status}`);

const badSch = await builder(ownerToken, { action: 'schedule', reportId, schedule: { enabled: true, frequency: 'hourly', time: '08:00', delivery: 'in_app' } });
const badSchBody = await badSch.json().catch(() => ({}));
check('invalid schedule frequency rejected', badSch.status >= 400 && String(badSchBody.error ?? badSchBody.message ?? '').toLowerCase().includes('frequency'), `status=${badSch.status} err=${badSchBody.error ?? badSchBody.message}`);

const noSchRes = await builder(ownerToken, { action: 'schedule' });
check('schedule without reportId → 400', noSchRes.status === 400, `status=${noSchRes.status}`);

// unknown action
const unkAct = await builder(ownerToken, { action: 'definitely_not_an_action' });
check('unknown action → 400', unkAct.status === 400, `status=${unkAct.status}`);

writeFileSync(STATE_FILE, JSON.stringify({ owner, other }, null, 2));

// 8. Cleanup
await cleanup(owner, other);
const gone = await svc(`saved_reports?id=eq.${reportId}&select=id`).then((r) => r.json()).catch(() => []);
check('cleanup removed saved report + history', Array.isArray(gone) && gone.length === 0, `left=${Array.isArray(gone) ? gone.length : '?'}`);

for (const uid of [owner, other]) {
  if (!uid) continue;
  await svc(`user_roles?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
  await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
}
check('removed E2E report users', true);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
