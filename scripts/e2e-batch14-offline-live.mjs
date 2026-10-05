import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { setGlobalDispatcher, Agent } from 'undici';

// Large perf batches legitimately take many minutes server-side; raise the
// fetch header/body timeouts so a single clean request is measured (the
// default 300s headers timeout aborted attempts mid-run last time).
setGlobalDispatcher(new Agent({ headersTimeout: 1_800_000, bodyTimeout: 1_800_000 }));

/**
 * Batch 14 live E2E — offline circulation.
 *
 * Modes (process.argv[2]):
 *   checkout    E2E-1 offline checkout apply + side-effect verification
 *   checkin     E2E-2 offline checkout -> checkin round trip
 *   duplicate   E2E-3 duplicate sync is idempotent (hooks fire once)
 *   conflict    E2E-4 conflict detected, librarian resolves (cancel)
 *   restart     E2E-5 file-backed queue survives a Next server restart
 *   perf        14.57 batch sync performance (10 / 100 / 500)
 *   cache       14.58 offline-cache payload size measurement
 *   all         everything (default)
 *
 * Gates: the five E2Es must PASS; perf and cache are measured and reported.
 */

const QUEUE_FILE = join(tmpdir(), 'e2e-batch14-queue.json');
const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..');

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(join(PROJECT_ROOT, '.env.local'));
const SUPABASE_URL = env.SUPABASE_URL;
const ANON_KEY = env.SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'http://localhost:3000';
const TENANT = '00000000-0000-0000-0000-000000000001';
const OPERATOR_EMAIL = 'e2e-batch14@invalid.invalid';
const OPERATOR_EMAIL_2 = 'e2e-batch14-2@invalid.invalid';
const PASSWORD = 'E2eBatch14!';

const MODES = {
  checkout: ['checkout'],
  checkin: ['checkin'],
  duplicate: ['duplicate'],
  conflict: ['conflict'],
  restart: ['restart'],
  perf: ['perf'],
  cache: ['cache'],
  all: ['checkout', 'checkin', 'duplicate', 'conflict', 'cache', 'restart', 'perf'],
  gate5: ['checkout', 'checkin', 'duplicate', 'conflict', 'restart'],
  'checkout-checkin': ['checkin'],
};

const requested = (process.argv[2] ?? 'all').toLowerCase();
const SUMMARY_FILE = join(tmpdir(), `e2e-batch14-summary-${requested}.json`);
const plan = MODES[requested];
if (!plan) {
  console.error(`Unknown mode "${requested}". Use: ${Object.keys(MODES).join(', ')}`);
  process.exit(2);
}

const startIso = new Date().toISOString();
const results = [];
const perfRows = [];
let cacheStats = null;
const usedTxnIds = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const serviceHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const svc = (path, init = {}) =>
  withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...(init.headers || {}) } }));

async function svcJson(path, init = {}) {
  const res = await svc(path, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function like(pattern) {
  return `like.${encodeURIComponent(pattern)}`;
}

async function findUserByEmail(email) {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const body = await res.json();
  return (body.users ?? []).find((u) => u.email === email) ?? null;
}

async function createUser(email) {
  const existing = await findUserByEmail(email);
  let uid = existing?.id ?? null;
  if (!uid) {
    const res = await withRetry(() =>
      fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
      }),
    );
    const body = await res.json();
    uid = body.id ?? body.user?.id ?? null;
    if (!uid) return null;
  }
  // Reuse the existing auth user (audit_logs FKs can block deletion) and just
  // make sure exactly one super_admin role row exists.
  await svc(`user_roles?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
  await svc('user_roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: uid, role: 'super_admin', tenant_id: TENANT }),
  });
  return uid;
}

async function signIn(email) {
  const res = await withRetry(() =>
    fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  const body = await res.json();
  if (!body.access_token) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  return { token: body.access_token, userId: body.user?.id ?? null };
}

async function api(token, path, init = {}) {
  return withRetry(() =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    }),
  );
}

// ── fixtures ─────────────────────────────────────────────────────────────────
async function ensurePatron(patronId, { category = 'undergraduate', userId = null, fullName } = {}) {
  const existing = await svcJson(`patrons?patron_id=eq.${patronId}&select=id,user_id`);
  if (Array.isArray(existing.body) && existing.body.length > 0) return existing.body[0].id;
  const res = await svc('patrons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([
      {
        patron_id: patronId,
        full_name: fullName ?? `E2E Offline ${patronId}`,
        email: `${patronId.toLowerCase()}@invalid.invalid`,
        patron_category: category,
        status: 'active',
        user_id: userId,
        tenant_id: TENANT,
      },
    ]),
  });
  const body = await res.json();
  return body?.[0]?.id ?? null;
}

async function ensureItem(title, available, total = available) {
  const existing = await svcJson(`catalogue_items?title=eq.${encodeURIComponent(title)}&select=id,available_copies,total_copies`);
  if (Array.isArray(existing.body) && existing.body.length > 0) {
    const row = existing.body[0];
    if (row.available_copies !== available || row.total_copies !== total) {
      await svc(`catalogue_items?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ available_copies: available, total_copies: total }),
      });
    }
    return row.id;
  }
  const res = await svc('catalogue_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([
      { title, authors: [], format: 'Book', available_copies: available, total_copies: total, call_number: `E2E14/${title.slice(-3)}` },
    ]),
  });
  const body = await res.json();
  return body?.[0]?.id ?? null;
}

async function getItem(id) {
  const { body } = await svcJson(`catalogue_items?id=eq.${id}&select=id,title,available_copies,total_copies`);
  return Array.isArray(body) ? body[0] : null;
}

async function getLoan(id) {
  const { body } = await svcJson(`loans?id=eq.${id}&select=id,status,due_date,return_date,renewed_count,patron_id,catalogue_item_id`);
  return Array.isArray(body) ? body[0] : null;
}

async function activeLoanCount(patronId) {
  const { body } = await svcJson(`loans?patron_id=eq.${patronId}&status=in.(active,overdue)&select=id`);
  return Array.isArray(body) ? body.length : 0;
}

async function getCache(token) {
  const res = await api(token, '/api/circulation/offline-cache');
  const text = await res.text();
  const body = JSON.parse(text);
  return { res, body, bytes: Buffer.byteLength(text, 'utf8') };
}

async function syncBatch(token, batch) {
  const res = await api(token, '/api/circulation/offline-sync', { method: 'POST', body: JSON.stringify(batch) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }
  const bad = (body.results ?? []).filter((r) => r.status === 'RETRYABLE_ERROR');
  if (bad.length && batch.device_id) {
    try {
      const { body: led } = await svcJson(
        `offline_transactions?device_id=eq.${encodeURIComponent(batch.device_id)}&select=local_seq,status,conflict_code,last_error,attempts&order=local_seq.asc`,
      );
      console.log(
        `[sync-diag] device=${batch.device_id} ${bad.map((r) => `seq${r.local_seq}:${r.status}:${r.message}`).join('; ')} | ledger=${JSON.stringify(led)}`,
      );
    } catch (err) {
      console.log(`[sync-diag] ledger lookup failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { status: res.status, ok: res.ok, text: async () => text, json: async () => body };
}

function makeTx({ seq, operation, payload, queuedBy, cacheFetchedAt, rulesFingerprint }) {
  const id = randomUUID();
  usedTxnIds.push(id);
  return {
    client_txn_id: id,
    local_seq: seq,
    operation,
    client_timestamp: new Date().toISOString(),
    cache_fetched_at: cacheFetchedAt ?? null,
    queued_by: queuedBy ?? null,
    payload: rulesFingerprint ? { ...payload, rules_fingerprint: rulesFingerprint } : payload,
  };
}

function expectedDueDate(category) {
  // Mirrors computeDueDate(): local calendar day + duration, serialized as YYYY-MM-DD.
  const days = category === 'postgraduate' ? 30 : category === 'academic_staff' ? 90 : category === 'non_academic_staff' ? 21 : 14;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── server process control (restart E2E) ─────────────────────────────────────
function findListeningPid(port) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/)) {
      if (new RegExp(`:${port}\\s`).test(line) && /LISTENING/i.test(line)) {
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid && pid !== process.pid) return pid;
      }
    }
  } catch {
    /* netstat failed */
  }
  return null;
}

async function waitForHealth(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1500);
  }
  return false;
}

function startServer() {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3000'], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

async function restartServer() {
  const before = findListeningPid('3000');
  if (before) {
    try {
      execSync(`taskkill /PID ${before} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  }
  await sleep(2500);
  const stillThere = findListeningPid('3000');
  if (stillThere) throw new Error(`port 3000 still held by pid ${stillThere} after taskkill`);
  startServer();
  const healthy = await waitForHealth();
  return { healthy };
}

// ── E2Es ─────────────────────────────────────────────────────────────────────
async function e2eCheckout(ctx) {
  const { token, userId } = ctx;
  const patronId = await ensurePatron('E2E14-P1', { userId });
  const itemId = await ensureItem('[E2E14] Checkout Item', 1, 1);
  check('checkout fixtures ready', !!patronId && !!itemId, `patron=${patronId} item=${itemId}`);

  const cache = await getCache(token);
  check('offline cache preload succeeds', cache.res.status === 200 && cache.body.success === true, `bytes=${cache.bytes}`);

  const before = await getItem(itemId);
  const txn = makeTx({
    seq: 1,
    operation: 'checkout',
    payload: { patron_id: patronId, catalogue_item_id: itemId, patron_name: 'E2E Offline E2E14-P1', item_title: '[E2E14] Checkout Item' },
    queuedBy: userId,
    cacheFetchedAt: cache.body.cache?.fetched_at ?? null,
    rulesFingerprint: cache.body.cache?.rules_fingerprint ?? null,
  });

  const res = await syncBatch(token, { device_id: 'e2e14-checkout', label: 'E2E Checkout Desk', branch: 'main', transactions: [txn] });
  const body = await res.json().catch(() => ({}));
  const row = body.results?.[0] ?? {};
  check('E2E-1 offline checkout applies (APPLIED)', res.status === 200 && body.success && row.status === 'APPLIED', `status=${row.status} msg=${row.message}`);

  const loanId = row.server_entity_id;
  const loan = loanId ? await getLoan(loanId) : null;
  const expectedDue = expectedDueDate('undergraduate');
  const actualDue = loan ? String(loan.due_date).slice(0, 10) : null;
  check(
    'E2E-1 loan created with server-computed due date',
    loan && loan.status === 'active' && actualDue === expectedDue,
    `loan=${loanId} due=${loan?.due_date} expected=${expectedDue}`,
  );

  const after = await getItem(itemId);
  check('E2E-1 availability decremented', after.available_copies === before.available_copies - 1, `${before.available_copies} -> ${after.available_copies}`);

  const { body: ctxRows } = await svcJson(`circulation_transactions?offline_id=eq.${txn.client_txn_id}&select=id,transaction_type,performed_by,loan_id,synced_at,notes`);
  check(
    'E2E-1 circulation_transactions row recorded with offline_id',
    Array.isArray(ctxRows) && ctxRows.length === 1 && ctxRows[0].transaction_type === 'checkout' && ctxRows[0].performed_by === userId,
    `rows=${Array.isArray(ctxRows) ? ctxRows.length : '?'} type=${ctxRows?.[0]?.transaction_type} performed_by=${ctxRows?.[0]?.performed_by}`,
  );

  const { body: wsRows } = await svcJson(`offline_workstations?device_id=eq.e2e14-checkout&select=device_id,last_seq,last_seen_at,last_sync_at`);
  check(
    'E2E-1 workstation registered with last_seq',
    Array.isArray(wsRows) && wsRows.length === 1 && wsRows[0].last_seq === 1 && !!wsRows[0].last_sync_at,
    `last_seq=${wsRows?.[0]?.last_seq}`,
  );

  const { body: ledger } = await svcJson(`offline_transactions?client_txn_id=eq.${txn.client_txn_id}&select=status,applied_at,attempts,server_entity_id`);
  check(
    'E2E-1 ledger row durably APPLIED',
    Array.isArray(ledger) && ledger.length === 1 && ledger[0].status === 'APPLIED' && !!ledger[0].applied_at,
    `status=${ledger?.[0]?.status} attempts=${ledger?.[0]?.attempts}`,
  );

  const { body: events } = await svcJson(`analytics_events?metadata->>client_txn_id=eq.${txn.client_txn_id}&select=id`);
  check('E2E-1 analytics event fired only after apply', Array.isArray(events) && events.length === 1, `count=${Array.isArray(events) ? events.length : '?'}`);

  const { body: audits } = await svcJson(`audit_logs?action=eq.circulation.checkout&record_id=eq.${loanId}&metadata->>source=eq.offline_sync&select=id`);
  check('E2E-1 audit log written with offline_sync source', Array.isArray(audits) && audits.length >= 1, `count=${Array.isArray(audits) ? audits.length : '?'}`);

  const { body: notices } = await svcJson(`notice_delivery_log?idempotency_key=eq.${encodeURIComponent(`offline:${txn.client_txn_id}`)}&select=id,channel`);
  check(
    'E2E-1 in-app notice queued with idempotency key',
    Array.isArray(notices) && notices.length === 1 && notices[0].channel === 'in-app',
    `count=${Array.isArray(notices) ? notices.length : '?'} channel=${notices?.[0]?.channel}`,
  );

  const { body: inbox } = await svcJson(`user_notifications?user_id=eq.${userId}&type=eq.checkout_receipt&created_at=gte.${encodeURIComponent(startIso)}&select=id`);
  check('E2E-1 patron inbox notification created', Array.isArray(inbox) && inbox.length >= 1, `count=${Array.isArray(inbox) ? inbox.length : '?'}`);

  return { patronId, itemId, loanId, txn };
}

async function e2eCheckin(ctx) {
  const { token, userId } = ctx;
  const patronId = await ensurePatron('E2E14-P1', { userId });
  const itemId = await ensureItem('[E2E14] Roundtrip Item', 1, 1);
  const cache = await getCache(token);

  // checkout first (offline), then check in (offline) — full round trip
  const coTxn = makeTx({
    seq: 1,
    operation: 'checkout',
    payload: { patron_id: patronId, catalogue_item_id: itemId, patron_name: 'E2E Offline E2E14-P1', item_title: '[E2E14] Roundtrip Item' },
    queuedBy: userId,
    cacheFetchedAt: cache.body.cache?.fetched_at ?? null,
    rulesFingerprint: cache.body.cache?.rules_fingerprint ?? null,
  });
  const coRes = await syncBatch(token, { device_id: 'e2e14-roundtrip', transactions: [coTxn] });
  const coBody = await coRes.json().catch(() => ({}));
  const loanId = coBody.results?.[0]?.server_entity_id;
  check('E2E-2 checkout leg applies', coBody.results?.[0]?.status === 'APPLIED' && !!loanId, `loan=${loanId}`);

  const before = await getItem(itemId);
  const ciTxn = makeTx({
    seq: 2,
    operation: 'checkin',
    payload: { loan_id: loanId, patron_id: patronId, catalogue_item_id: itemId, patron_name: 'E2E Offline E2E14-P1', item_title: '[E2E14] Roundtrip Item' },
    queuedBy: userId,
    cacheFetchedAt: cache.body.cache?.fetched_at ?? null,
  });
  const ciRes = await syncBatch(token, { device_id: 'e2e14-roundtrip', transactions: [ciTxn] });
  const ciBody = await ciRes.json().catch(() => ({}));
  const ciRow = ciBody.results?.[0] ?? {};
  check('E2E-2 offline checkin applies (APPLIED)', ciRes.status === 200 && ciRow.status === 'APPLIED', `status=${ciRow.status} msg=${ciRow.message}`);

  const loan = await getLoan(loanId);
  check('E2E-2 loan marked returned', loan && loan.status === 'returned' && !!loan.return_date, `status=${loan?.status}`);

  const after = await getItem(itemId);
  check('E2E-2 availability restored', after.available_copies === before.available_copies + 1, `${before.available_copies} -> ${after.available_copies}`);

  const { body: notices } = await svcJson(`notice_delivery_log?idempotency_key=eq.${encodeURIComponent(`offline:${ciTxn.client_txn_id}`)}&select=id`);
  check('E2E-2 checkin notice fired once', Array.isArray(notices) && notices.length === 1, `count=${Array.isArray(notices) ? notices.length : '?'}`);
}

async function e2eDuplicate(ctx) {
  const { token, userId, operator2 } = ctx;
  // NOTE: patrons.user_id is UNIQUE — E2E14-P1 links to the primary operator,
  // so E2E14-P2 links to the secondary operator. In-app notices only fire for
  // patrons with a linked user account (offlineSyncHooks guard), so the link
  // is required to assert notice idempotency on replay.
  const patronId = await ensurePatron('E2E14-P2', { userId: operator2 ?? null });
  const itemId = await ensureItem('[E2E14] Duplicate Item', 1, 1);
  check('duplicate fixtures ready', !!patronId && !!itemId, `patron=${patronId} item=${itemId}`);
  const cache = await getCache(token);

  const txn = makeTx({
    seq: 1,
    operation: 'checkout',
    payload: { patron_id: patronId, catalogue_item_id: itemId, patron_name: 'E2E Offline E2E14-P2', item_title: '[E2E14] Duplicate Item' },
    queuedBy: userId,
    cacheFetchedAt: cache.body.cache?.fetched_at ?? null,
    rulesFingerprint: cache.body.cache?.rules_fingerprint ?? null,
  });

  const first = await (await syncBatch(token, { device_id: 'e2e14-duplicate', transactions: [txn] })).json().catch(() => ({}));
  check('E2E-3 first sync applies', first.results?.[0]?.status === 'APPLIED', `status=${first.results?.[0]?.status}`);

  const mid = await getItem(itemId);
  const { body: loansBefore } = await svcJson(`loans?patron_id=eq.${patronId}&catalogue_item_id=eq.${itemId}&status=eq.active&select=id`);

  const replay = await (await syncBatch(token, { device_id: 'e2e14-duplicate', transactions: [txn] })).json().catch(() => ({}));
  check(
    'E2E-3 duplicate sync returns ALREADY_APPLIED',
    replay.results?.[0]?.status === 'ALREADY_APPLIED',
    `status=${replay.results?.[0]?.status} msg=${replay.results?.[0]?.message}`,
  );

  const end = await getItem(itemId);
  const { body: loansAfter } = await svcJson(`loans?patron_id=eq.${patronId}&catalogue_item_id=eq.${itemId}&status=eq.active&select=id`);
  check(
    'E2E-3 no duplicate loan or availability drift',
    Array.isArray(loansAfter) && loansAfter.length === (Array.isArray(loansBefore) ? loansBefore.length : -1) && end.available_copies === mid.available_copies,
    `loans=${Array.isArray(loansAfter) ? loansAfter.length : '?'} availability=${mid.available_copies} -> ${end.available_copies}`,
  );

  const { body: events } = await svcJson(`analytics_events?metadata->>client_txn_id=eq.${txn.client_txn_id}&select=id`);
  const { body: notices } = await svcJson(`notice_delivery_log?idempotency_key=eq.${encodeURIComponent(`offline:${txn.client_txn_id}`)}&select=id`);
  check(
    'E2E-3 hooks did not fire twice on replay',
    Array.isArray(events) && events.length === 1 && Array.isArray(notices) && notices.length === 1,
    `analytics=${Array.isArray(events) ? events.length : '?'} notices=${Array.isArray(notices) ? notices.length : '?'}`,
  );
}

async function e2eConflict(ctx) {
  const { token, userId } = ctx;
  const p1 = await ensurePatron('E2E14-P1', { userId });
  const p2 = await ensurePatron('E2E14-P2');
  const itemId = await ensureItem('[E2E14] Conflict Item', 2, 2);
  check('conflict fixtures ready', !!p1 && !!p2 && !!itemId, `p1=${p1} p2=${p2} item=${itemId}`);
  const cache = await getCache(token);

  // settle availability (a previous run may have left a loan) — use a fresh copy count
  const item = await getItem(itemId);
  if (item.available_copies < 2) {
    await svc(`catalogue_items?id=eq.${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ available_copies: item.total_copies }),
    });
  }

  const firstTxn = makeTx({
    seq: 1,
    operation: 'checkout',
    payload: { patron_id: p1, catalogue_item_id: itemId, patron_name: 'E2E Offline E2E14-P1', item_title: '[E2E14] Conflict Item' },
    queuedBy: userId,
    cacheFetchedAt: cache.body.cache?.fetched_at ?? null,
    rulesFingerprint: cache.body.cache?.rules_fingerprint ?? null,
  });
  const firstRes = await (await syncBatch(token, { device_id: 'e2e14-conflict', transactions: [firstTxn] })).json().catch(() => ({}));
  check('E2E-4 first checkout applies', firstRes.results?.[0]?.status === 'APPLIED', `status=${firstRes.results?.[0]?.status}`);

  const secondTxn = makeTx({
    seq: 2,
    operation: 'checkout',
    payload: { patron_id: p2, catalogue_item_id: itemId, patron_name: 'E2E Offline E2E14-P2', item_title: '[E2E14] Conflict Item' },
    queuedBy: userId,
    cacheFetchedAt: cache.body.cache?.fetched_at ?? null,
    rulesFingerprint: cache.body.cache?.rules_fingerprint ?? null,
  });
  const conflictRes = await syncBatch(token, { device_id: 'e2e14-conflict', transactions: [secondTxn] });
  const conflictBody = await conflictRes.json().catch(() => ({}));
  const conflictRow = conflictBody.results?.[0] ?? {};
  check(
    'E2E-4 concurrent checkout conflict detected',
    conflictBody.conflicts === 1 && conflictRow.status === 'CONFLICT' && conflictRow.conflict_code === 'ITEM_CHECKED_OUT_TO_DIFFERENT_PATRON',
    `code=${conflictRow.conflict_code} msg=${conflictRow.message}`,
  );

  const resolveRes = await api(token, '/api/circulation/offline-resolve', {
    method: 'POST',
    body: JSON.stringify({ client_txn_id: secondTxn.client_txn_id, action: 'cancel', note: 'E2E: patron will borrow the next available copy.' }),
  });
  const resolveBody = await resolveRes.json().catch(() => ({}));
  check(
    'E2E-4 librarian resolves conflict (cancel)',
    resolveRes.status === 200 && resolveBody.success && resolveBody.client_action === 'remove' && resolveBody.resolution === 'cancel',
    `client_action=${resolveBody.client_action} resolution=${resolveBody.resolution}`,
  );

  const { body: ledger } = await svcJson(`offline_transactions?client_txn_id=eq.${secondTxn.client_txn_id}&select=status,resolution,resolution_note,resolved_by`);
  check(
    'E2E-4 ledger records resolution with note and actor',
    Array.isArray(ledger) && ledger[0]?.resolution === 'cancel' && !!ledger[0]?.resolution_note && ledger[0]?.resolved_by === userId,
    `resolution=${ledger?.[0]?.resolution} resolved_by=${ledger?.[0]?.resolved_by}`,
  );

  const { body: audits } = await svcJson(`audit_logs?action=eq.circulation.offline_cancel&metadata->>source=eq.offline_sync&created_at=gte.${encodeURIComponent(startIso)}&select=id,new_values`);
  check('E2E-4 resolution audited', Array.isArray(audits) && audits.length >= 1, `count=${Array.isArray(audits) ? audits.length : '?'}`);
}

async function e2eRestart(ctx) {
  const { token, userId } = ctx;
  const p1 = await ensurePatron('E2E14-P1', { userId });
  const itemE = await ensureItem('[E2E14] Restart Item A', 1, 1);
  const itemF = await ensureItem('[E2E14] Restart Item B', 1, 1);

  // 1) Build a durable (file-backed) client queue — NOT yet synced.
  const queue = {
    device_id: 'e2e14-restart',
    label: 'E2E Restart Desk',
    branch: 'main',
    queued_at: new Date().toISOString(),
    transactions: [
      makeTx({
        seq: 1,
        operation: 'checkout',
        payload: { patron_id: p1, catalogue_item_id: itemE, patron_name: 'E2E Offline E2E14-P1', item_title: '[E2E14] Restart Item A' },
        queuedBy: userId,
      }),
      makeTx({
        seq: 2,
        operation: 'checkout',
        payload: { patron_id: p1, catalogue_item_id: itemF, patron_name: 'E2E Offline E2E14-P1', item_title: '[E2E14] Restart Item B' },
        queuedBy: userId,
      }),
    ],
  };
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  check('E2E-5 file-backed queue written before restart', existsSync(QUEUE_FILE), QUEUE_FILE);

  const loansBefore = await activeLoanCount(p1);

  // 2) Restart the Next server.
  const restarted = await restartServer();
  check('E2E-5 Next server restarted and healthy', restarted.healthy, `pid_after=${findListeningPid('3000')}`);

  // 3) "Reload the desk": read the queue back from durable storage and sync.
  //    RETRYABLE results are resent exactly like the real client does
  //    (useOfflineCirculation re-syncs failed entries); durability of the
  //    queue across restart is what this E2E proves.
  const reloaded = JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
  const finalBySeq = new Map();
  let attempts = 0;
  let lastRes = null;
  let lastBody = {};
  for (let pass = 0; pass < 3; pass++) {
    attempts += 1;
    const batch = pass === 0
      ? reloaded
      : {
          ...reloaded,
          transactions: reloaded.transactions.filter((t) => {
            const r = finalBySeq.get(t.local_seq);
            return r && r.status === 'RETRYABLE_ERROR';
          }),
        };
    if (pass > 0 && batch.transactions.length === 0) break;
    lastRes = await syncBatch(token, batch);
    lastBody = await lastRes.json().catch(() => ({}));
    for (const r of lastBody.results ?? []) finalBySeq.set(r.local_seq, r);
    const statusesSoFar = [...finalBySeq.values()].map((r) => r.status);
    if (statusesSoFar.every((s) => s === 'APPLIED' || s === 'ALREADY_APPLIED')) break;
    await sleep(500);
  }
  const res = lastRes ?? { status: 0 };
  const body = lastBody;
  const statuses = [...finalBySeq.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.status);
  const resultMsgs = [...finalBySeq.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => `seq${r.local_seq}:${r.status}${r.conflict_code ? `[${r.conflict_code}]` : ''} ${r.message}`);
  const { body: ledRows } = await svcJson(
    `offline_transactions?device_id=eq.e2e14-restart&select=local_seq,status,conflict_code,message,last_error,attempts&order=local_seq.asc`,
  );
  const ledDetail = (Array.isArray(ledRows) ? ledRows : [])
    .map((r) => `seq${r.local_seq}:${r.status}${r.last_error ? ` last_error=${r.last_error}` : ''}`)
    .join(' | ');
  check(
    'E2E-5 queued work survives restart and applies after reconnect',
    res.status === 200 && finalBySeq.size === 2 && statuses.every((s) => s === 'APPLIED' || s === 'ALREADY_APPLIED'),
    `attempts=${attempts} statuses=${statuses.join(',')} | ${resultMsgs.join(' || ')} | ledger: ${ledDetail}`,
  );

  const loansAfter = await activeLoanCount(p1);
  check('E2E-5 both loans exist after restart', loansAfter === loansBefore + 2, `${loansBefore} -> ${loansAfter}`);

  const { body: wsRows } = await svcJson(`offline_workstations?device_id=eq.e2e14-restart&select=device_id,last_seq,last_sync_at`);
  check(
    'E2E-5 workstation registry persisted and advanced to seq 2',
    Array.isArray(wsRows) && wsRows[0]?.last_seq === 2 && !!wsRows[0]?.last_sync_at,
    `last_seq=${wsRows?.[0]?.last_seq}`,
  );
}

// ── perf (14.57) and cache size (14.58) ─────────────────────────────────────
async function perfFixtures(count) {
  const patrons = [];
  const existing = await svcJson(`patrons?patron_id=like.${encodeURIComponent('E2E14-PF-%')}&select=id,patron_id&order=patron_id.asc&limit=200`);
  const byCode = new Map((Array.isArray(existing.body) ? existing.body : []).map((p) => [p.patron_id, p.id]));
  const needed = Math.ceil(count / 20); // academic_staff max 20 loans each — round-robin
  for (let i = 0; i < needed; i++) {
    const code = `E2E14-PF-${String(i).padStart(3, '0')}`;
    if (byCode.has(code)) {
      patrons.push(byCode.get(code));
    } else {
      const id = await ensurePatron(code, { category: 'academic_staff', fullName: `E2E Perf ${i}` });
      patrons.push(id);
    }
  }

  const items = [];
  const ITEM_CHUNK = 100;
  for (let start = 0; start < count; start += ITEM_CHUNK) {
    const end = Math.min(start + ITEM_CHUNK, count);
    const titles = [];
    for (let i = start; i < end; i++) titles.push(`[E2E14] Perf Item ${String(i).padStart(4, '0')}`);
    const { body: existingItems } = await svcJson(`catalogue_items?title=in.(${titles.map((t) => encodeURIComponent(t)).join(',')})&select=id,title`);
    const itemByTitle = new Map((Array.isArray(existingItems) ? existingItems : []).map((r) => [r.title, r.id]));
    const missing = titles.filter((t) => !itemByTitle.has(t));
    if (missing.length) {
      const res = await svc('catalogue_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(missing.map((title) => ({ title, authors: [], format: 'Book', available_copies: 1, total_copies: 1, call_number: 'E2E14/PERF' }))),
      });
      const created = await res.json();
      for (const row of Array.isArray(created) ? created : []) itemByTitle.set(row.title, row.id);
    }
    for (const t of titles) {
      const id = itemByTitle.get(t);
      if (id) items.push(id);
    }
    // reset any availability from a previous run
    if (existingItems?.length) {
      await svc(`catalogue_items?title=in.(${titles.map((t) => encodeURIComponent(t)).join(',')})`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ available_copies: 1 }),
      });
    }
  }
  return { patrons: patrons.filter(Boolean), items };
}

async function runPerf(token, userId) {
  const sizes = [10, 100, 500];
  const total = sizes.reduce((a, b) => a + b, 0);
  const { patrons, items } = await perfFixtures(total);
  check(
    'perf fixtures prepared',
    patrons.length >= Math.ceil(total / 20) && items.length >= total,
    `patrons=${patrons.length} items=${items.length} for txns=${total}`,
  );

  let offset = 0;
  let allApplied = true;
  for (const size of sizes) {
    const txns = [];
    for (let i = 0; i < size; i++) {
      const itemIdx = offset + i;
      txns.push({
        client_txn_id: randomUUID(),
        // local_seq is unique + monotonic PER DEVICE across all batches on
        // this desk (device_id e2e14-perf) — never restart at 1.
        local_seq: offset + i + 1,
        operation: 'checkout',
        client_timestamp: new Date().toISOString(),
        cache_fetched_at: new Date().toISOString(),
        queued_by: userId,
        payload: {
          patron_id: patrons[itemIdx % patrons.length],
          catalogue_item_id: items[itemIdx],
          patron_name: 'E2E Perf Patron',
          item_title: `[E2E14] Perf Item ${String(itemIdx).padStart(4, '0')}`,
        },
      });
    }
    usedTxnIds.push(...txns.map((t) => t.client_txn_id));

    const t0 = Date.now();
    const res = await syncBatch(token, { device_id: 'e2e14-perf', label: 'E2E Perf Desk', branch: 'main', transactions: txns });
    const body = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    const applied = body.applied ?? 0;
    const already = body.already_applied ?? 0;
    const ok = res.status === 200 && applied === size;
    allApplied = allApplied && ok;
    perfRows.push({
      size,
      ms,
      status: res.status,
      applied,
      already_applied: already,
      conflicts: body.conflicts ?? 0,
      rejected: body.rejected ?? 0,
      retryable: body.retryable ?? 0,
      error: res.status === 200 ? undefined : (body.error ?? body.message ?? 'unknown'),
    });
    check(
      `perf batch size=${size} fully applied`,
      ok,
      `ms=${ms} status=${res.status} applied=${applied}/${size} already=${already} conflicts=${body.conflicts ?? 0} rejected=${body.rejected ?? 0} retryable=${body.retryable ?? 0}${res.status === 200 ? '' : ` err=${body.error ?? body.message ?? ''}`}`,
    );
    console.log(`PERF size=${size} ms=${ms} status=${res.status} applied=${applied} tps=${((size / ms) * 1000).toFixed(2)}`);
    offset += size;
  }
  return allApplied;
}

async function measureCache(token) {
  const t0 = Date.now();
  const { res, body, bytes } = await getCache(token);
  const ms = Date.now() - t0;
  const c = body.cache ?? {};
  cacheStats = {
    status: res.status,
    bytes,
    ms,
    patrons: (c.patrons ?? []).length,
    items: (c.items ?? []).length,
    copies: (c.copies ?? []).length,
    loans: (c.loans ?? []).length,
    holds: (c.holds ?? []).length,
    truncated: c.truncated ?? {},
    fingerprint: c.rules_fingerprint,
  };
  check(
    'cache payload measured (14.58)',
    res.status === 200 && body.success === true && bytes > 0,
    `bytes=${bytes} ms=${ms} patrons=${cacheStats.patrons} items=${cacheStats.items} copies=${cacheStats.copies} loans=${cacheStats.loans} holds=${cacheStats.holds} truncated=${JSON.stringify(cacheStats.truncated)}`,
  );
  console.log(`CACHE bytes=${bytes} ms=${ms} rows=${cacheStats.patrons + cacheStats.items + cacheStats.copies + cacheStats.loans + cacheStats.holds}`);
}

// ── cleanup ─────────────────────────────────────────────────────────────────
async function deleteIn(table, column, values) {
  const CHUNK = 50;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    if (!chunk.length) continue;
    await svc(`${table}?${column}=in.(${chunk.map((v) => encodeURIComponent(v)).join(',')})`, { method: 'DELETE' }).catch(() => undefined);
  }
}

async function cleanup() {
  try {
    // loans + circulation rows for our fixture patrons
    const { body: patrons } = await svcJson(`patrons?patron_id=like.${encodeURIComponent('E2E14-%')}&select=id`);
    const patronIds = (Array.isArray(patrons) ? patrons : []).map((p) => p.id);
    if (patronIds.length) {
      const { body: loans } = await svcJson(`loans?patron_id=in.(${patronIds.map((v) => encodeURIComponent(v)).join(',')})&select=id`);
      const loanIds = (Array.isArray(loans) ? loans : []).map((l) => l.id);
      await deleteIn('circulation_transactions', 'loan_id', loanIds);
      await svc(`loans?patron_id=in.(${patronIds.map((v) => encodeURIComponent(v)).join(',')})`, { method: 'DELETE' }).catch(() => undefined);
    }

    // ledger + workstation + observability rows
    await svc(`offline_transactions?device_id=like.${encodeURIComponent('e2e14-%')}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`offline_workstations?device_id=like.${encodeURIComponent('e2e14-%')}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`analytics_events?metadata->>device_id=like.${encodeURIComponent('e2e14-%')}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`audit_logs?metadata->>source=eq.offline_sync&created_at=gte.${encodeURIComponent(startIso)}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(
      `notice_delivery_log?idempotency_key=like.${encodeURIComponent('offline:%')}&created_at=gte.${encodeURIComponent(startIso)}`,
      { method: 'DELETE' },
    ).catch(() => undefined);
    await svc(
      `user_notifications?type=in.(checkout_receipt,checkin_receipt,renewal_confirmation,hold_ready)&created_at=gte.${encodeURIComponent(startIso)}`,
      { method: 'DELETE' },
    ).catch(() => undefined);

    // fixtures
    await svc(`catalogue_items?title=like.${encodeURIComponent('[E2E14]%')}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`patrons?patron_id=like.${encodeURIComponent('E2E14-%')}`, { method: 'DELETE' }).catch(() => undefined);
  } catch (err) {
    console.warn('cleanup warning:', err instanceof Error ? err.message : err);
  }
}

async function deleteUsers() {
  for (const email of [OPERATOR_EMAIL, OPERATOR_EMAIL_2]) {
    const user = await findUserByEmail(email);
    if (!user) continue;
    // audit_logs.user_id has an ON DELETE RESTRICT FK — purge the fixture
    // user's audit rows first, then roles, then the auth user itself.
    await svc(`audit_logs?user_id=eq.${user.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`user_roles?user_id=eq.${user.id}`, { method: 'DELETE' }).catch(() => undefined);
    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: serviceHeaders }).catch(() => null);
    if (del && !del.ok) console.warn(`deleteUsers: auth delete ${user.id} -> ${del.status} (left in place)`);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
let exitCode = 0;
try {
  const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok).catch(() => false);
  check('Next server reachable on :3000', health, `${BASE}/api/health`);

  const operator = await createUser(OPERATOR_EMAIL);
  const operator2 = await createUser(OPERATOR_EMAIL_2);
  check('E2E operators created', !!operator, `operator=${operator} operator2=${operator2}`);
  const { token, userId } = await signIn(OPERATOR_EMAIL);
  check('operator signed in with super_admin role', !!token && !!userId, `userId=${userId}`);
  const ctx = { token, userId, operator, operator2 };

  for (const mode of plan) {
    if (mode === 'checkout') await e2eCheckout(ctx);
    else if (mode === 'checkin') await e2eCheckin(ctx);
    else if (mode === 'duplicate') await e2eDuplicate(ctx);
    else if (mode === 'conflict') await e2eConflict(ctx);
    else if (mode === 'restart') await e2eRestart(ctx);
    else if (mode === 'cache') await measureCache(token);
    else if (mode === 'perf') await runPerf(token, userId);
  }
} catch (err) {
  exitCode = 1;
  check('E2E run completed without runtime errors', false, err instanceof Error ? err.message : String(err));
} finally {
  await cleanup();
  await deleteUsers();
  try {
    if (existsSync(QUEUE_FILE)) writeFileSync(QUEUE_FILE, '');
  } catch {
    /* ignore */
  }
}

const failed = results.filter((r) => !r.ok);
if (failed.length) exitCode = 1;
console.log('');
console.log(`E2E summary: ${results.length - failed.length}/${results.length} checks passed`);
for (const f of failed) console.log(`  FAIL  ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);

try {
  writeFileSync(SUMMARY_FILE, JSON.stringify({ mode: requested, results, perfRows, cacheStats, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`Summary written to ${SUMMARY_FILE}`);
} catch {
  /* ignore */
}

process.exit(exitCode);
