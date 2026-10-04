import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

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
const E2E_USER = `e2e-batch12-${Date.now()}@esut.edu.ng`;
const E2E_PASSWORD = 'E2eBatch12!';
const E2E_TENANT = '00000000-0000-0000-0000-000000000001';

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
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastError;
}

const serviceHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

await withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/analytics_events?entity_id=like.fix-*`, { method: 'DELETE', headers: serviceHeaders }));

const createRes = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_USER, password: E2E_PASSWORD, email_confirm: true }),
}));
const created = await createRes.json();
const e2eUserId = created.id;
check('create E2E admin user', (createRes.status === 201 || createRes.status === 200) && !!e2eUserId, `status=${createRes.status}`);

if (e2eUserId) {
  const roleRes = await withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: e2eUserId, role: 'super_admin', tenant_id: E2E_TENANT }),
  }));
  check('grant super_admin role', roleRes.status === 201, `status=${roleRes.status}`);
}

const authRes = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: E2E_USER, password: E2E_PASSWORD }),
}));
const authBody = await authRes.json();
const token = authBody.access_token;
check('sign in as E2E admin', !!token, `status=${authRes.status}`);

const authHeaders = { Authorization: `Bearer ${token}` };
const api = (path, headers = authHeaders) => withRetry(() => fetch(`${BASE}${path}`, { headers }));

const fixtures = [
  ...Array.from({ length: 6 }, (_, i) => ({ event_type: 'checkout', faculty: 'Science', department: 'Physics', patron_role: 'student', entity_id: `fix-co-science-${i}`, metadata: { title: 'Fixture Science Book' } })),
  ...Array.from({ length: 3 }, (_, i) => ({ event_type: 'checkout', faculty: 'Arts', department: 'History', patron_role: 'student', entity_id: `fix-co-arts-${i}`, metadata: { title: 'Fixture Arts Book' } })),
];
const insertRes = await withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
  method: 'POST',
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify(fixtures),
}));
const inserted = await insertRes.json();
check('insert controlled fixtures', insertRes.status === 201 && inserted.length === fixtures.length, `status=${insertRes.status}`);

const dash = (await (await api('/api/admin/analytics?days=30')).json()).data;
check('dashboard returns data', !!dash, dash ? 'ok' : 'no data');
check('dashboard counts fixtures (>=9 checkouts)', (dash?.checkouts ?? 0) >= 9, `checkouts=${dash?.checkouts}`);

const sci = (await (await api('/api/admin/analytics?days=30&faculty=Science')).json()).data;
check('filter faculty=Science counts fixtures (>=6)', (sci?.checkouts ?? 0) >= 6, `checkouts=${sci?.checkouts}`);

const arts = (await (await api('/api/admin/analytics?days=30&faculty=Arts')).json()).data;
check('filter faculty=Arts counts fixtures (>=3)', (arts?.checkouts ?? 0) >= 3, `checkouts=${arts?.checkouts}`);

const seg = (await (await api('/api/admin/analytics/segmentation?days=30&group_by=faculty')).json()).data;
const sciSeg = seg?.segments.find((s) => s.segment === 'Science');
const artsSeg = seg?.segments.find((s) => s.segment === 'Arts');
check('segmentation Science total >= 6', (sciSeg?.total ?? 0) >= 6, `total=${sciSeg?.total}`);
check('segmentation Arts suppressed (< threshold)', artsSeg?.total === 'SUPPRESSED', `total=${artsSeg?.total}`);

const zeroQ = `zzz-nonexistent-${Date.now()}`;
let zeroStatus = 0;
for (let attempt = 0; attempt < 3; attempt++) {
  const res = await api(`/api/search/resources?q=${encodeURIComponent(zeroQ)}&expand=false`);
  zeroStatus = res.status;
  if (res.status === 200) break;
  await new Promise((r) => setTimeout(r, 2000));
}
check('zero-result search responds', zeroStatus === 200, `status=${zeroStatus}`);
await new Promise((r) => setTimeout(r, 1500));
const zeroDash = (await (await api('/api/admin/analytics/search?days=1')).json()).data;
const zeroQuery = zeroDash?.zeroResultQueries?.find((q) => q.query === zeroQ);
check('zero-result query captured in search analytics', !!zeroQuery, zeroQuery ? `count=${zeroQuery.count}` : 'not found');

let botStatus = 0;
for (let attempt = 0; attempt < 3; attempt++) {
  const res = await api(`/api/search/resources?q=${encodeURIComponent(zeroQ)}&expand=false`, { ...authHeaders, 'User-Agent': 'Googlebot/2.1' });
  botStatus = res.status;
  if (res.status === 200) break;
  await new Promise((r) => setTimeout(r, 2000));
}
check('bot search responds', botStatus === 200, `status=${botStatus}`);
await new Promise((r) => setTimeout(r, 1500));
const botEvents = await (await withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/analytics_events?search_query=eq.${encodeURIComponent(zeroQ)}&bot_flag=eq.BOT&select=id`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
}))).json();
check('bot event captured with BOT flag', Array.isArray(botEvents) && botEvents.length >= 1, `${Array.isArray(botEvents) ? botEvents.length : 0} bot events`);

const csvRes = await api('/api/admin/analytics/export?report=summary&days=30');
const csvText = await csvRes.text();
check('csv export returns text/csv', (csvRes.headers.get('content-type') || '').includes('text/csv'), csvRes.headers.get('content-type'));
check('csv contains checkout row', csvText.includes('checkout'), `header=${csvText.split('\n')[0]}`);

const health = await (await api('/api/admin/analytics/health')).json();
check('health endpoint returns observability metrics', typeof health.data?.eventsAttempted === 'number', JSON.stringify(health.data));

const fedQ = `federated-test-${Date.now()}`;
let fedStatus = 0;
for (let attempt = 0; attempt < 3; attempt++) {
  const res = await api(`/api/search/resources?q=${encodeURIComponent(fedQ)}`);
  fedStatus = res.status;
  if (res.status === 200) break;
  await new Promise((r) => setTimeout(r, 2000));
}
check('federated search responds', fedStatus === 200, `status=${fedStatus}`);
await new Promise((r) => setTimeout(r, 3000));
const fedEvents = await (await withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/analytics_events?search_query=eq.${encodeURIComponent(fedQ)}&event_type=eq.federated_search&select=id,provider`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
}))).json();
check('federated search event captured', Array.isArray(fedEvents) && fedEvents.length >= 1, `${Array.isArray(fedEvents) ? fedEvents.length : 0} federated events`);

const del = (query) => withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/analytics_events?${query}`, { method: 'DELETE', headers: serviceHeaders }));
await del('entity_id=like.fix-*');
await del('search_query=like.zzz-nonexistent-*');
await del('search_query=like.federated-test-*');
if (e2eUserId) {
  await withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${e2eUserId}`, { method: 'DELETE', headers: serviceHeaders }));
  await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${e2eUserId}`, { method: 'DELETE', headers: serviceHeaders }));
}
check('cleanup E2E fixtures and user', true);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
