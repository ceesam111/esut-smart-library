import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { join } from 'path';

const STATE_FILE = join(tmpdir(), 'e2e-batch13-notices-state.json');

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
const ADMIN_EMAIL = 'e2e-batch13-admin@invalid.invalid';
const ADMIN_PASSWORD = 'E2eBatch13!';
const MARKER = '[E2E-MARKER]';
const REPO_ITEM = '11111111-1111-1111-1111-111111111111';

const phase = (process.argv[2] || 'all').toLowerCase();
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

function stripMarker(subject) {
  return String(subject).replace(/\s*\[E2E-MARKER[^\]]*\]/g, '').trim();
}

function findOverdue(templates) {
  return (templates ?? []).find((t) => t.notice_type === 'overdue' && !String(t.name).startsWith('E2E Copy'))
    ?? (templates ?? []).find((t) => t.notice_type === 'overdue');
}

async function findUserByEmail(email) {
  const res = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders }));
  const body = await res.json();
  const users = body.users ?? [];
  return users.find((u) => u.email === email) ?? null;
}

async function ensureAdminUser() {
  const existing = await findUserByEmail(ADMIN_EMAIL);
  if (existing) {
    await svc(`user_roles?user_id=eq.${existing.id}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, { method: 'DELETE', headers: serviceHeaders }));
  }
  const createRes = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true }),
  }));
  const created = await createRes.json();
  const uid = created.id ?? created.user?.id;
  check('create/recreate E2E admin user', (createRes.status === 200 || createRes.status === 201) && !!uid, `status=${createRes.status}`);
  if (uid) {
    const roleRes = await svc('user_roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: uid, role: 'super_admin', tenant_id: TENANT }),
    });
    check('grant super_admin role', roleRes.status === 201, `status=${roleRes.status}`);
  }
  return uid;
}

async function signIn() {
  const authRes = await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }));
  const body = await authRes.json();
  check('sign in as E2E admin', !!body.access_token, `status=${authRes.status}`);
  return body.access_token;
}

async function api(path, token, init = {}) {
  return withRetry(() => fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  }));
}

async function fetchTemplates(token) {
  let last = { status: 0, body: {} };
  for (let i = 0; i < 5; i++) {
    const res = await api('/api/admin/notices/templates?enabled=false', token);
    const body = await res.json().catch(() => ({}));
    last = { status: res.status, body };
    if (res.status === 200 && body.success) return body;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return last.body;
}

async function deleteFixtureDeliveries(uid) {
  const filter = `or=(recipient_user_id.eq.${uid},recipient_email.in.("e2e-retry@invalid.invalid","not-a-valid-address","+2340000000000"))`;
  await svc(`notice_delivery_log?${encodeURIComponent(filter)}`, { method: 'DELETE' }).catch(() => undefined);
}

async function deleteWorkflowInstancesForItem() {
  const inst = await svc(`workflow_instances?repository_item_id=eq.${REPO_ITEM}&select=id`).then((r) => r.json()).catch(() => []);
  for (const row of Array.isArray(inst) ? inst : []) {
    await svc(`workflow_tasks?workflow_instance_id=eq.${row.id}`, { method: 'DELETE' }).catch(() => undefined);
    await svc(`workflow_instances?id=eq.${row.id}`, { method: 'DELETE' }).catch(() => undefined);
  }
}

async function preClean(uid) {
  await svc(`notice_templates?name=like.${encodeURIComponent('E2E Copy%')}`, { method: 'DELETE' }).catch(() => undefined);
  if (uid) {
    await svc(`user_notifications?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await deleteFixtureDeliveries(uid);
  }
  await deleteWorkflowInstancesForItem();
}

const context = { patron_name: 'E2E Patron', item_title: 'E2E Fixture Item', due_date: '2026-10-10' };

if (phase === 'edit' || phase === 'all') {
  const uid = await ensureAdminUser();
  const token = await signIn();
  await preClean(uid);

  const listRes = await api('/api/admin/notices/templates?enabled=false', token);
  const listBody = await listRes.json();
  check('GET templates returns DB list', listRes.status === 200 && listBody.success && Array.isArray(listBody.templates) && listBody.templates.length > 0, `count=${listBody.templates?.length}`);

  const overdue = findOverdue(listBody.templates);
  check('found overdue template', !!overdue, overdue ? `id=${overdue.id} v${overdue.version}` : 'missing');

  let instanceId = null;

  if (overdue) {
    const baseSubject = stripMarker(overdue.subject);
    const newSubject = `${baseSubject} ${MARKER}`;

    const updRes = await api('/api/admin/notices/templates', token, {
      method: 'POST',
      body: JSON.stringify({ action: 'update', templateId: overdue.id, expectedVersion: overdue.version, changes: { subject: newSubject } }),
    });
    const updBody = await updRes.json();
    check('template update persists with version bump', updRes.status === 200 && updBody.success && updBody.template.subject === newSubject && updBody.template.version === overdue.version + 1, `v${overdue.version}→${updBody.template?.version}`);

    const staleRes = await api('/api/admin/notices/templates', token, {
      method: 'POST',
      body: JSON.stringify({ action: 'update', templateId: overdue.id, expectedVersion: 999999, changes: { subject: 'stale write' } }),
    });
    check('stale expectedVersion rejected with 409', staleRes.status === 409, `status=${staleRes.status}`);

    const prevRes = await api('/api/admin/notices/templates', token, {
      method: 'POST',
      body: JSON.stringify({ action: 'preview', template: { ...overdue, subject: newSubject }, context }),
    });
    const prevBody = await prevRes.json();
    check('preview renders updated subject', prevRes.status === 200 && prevBody.success && String(prevBody.rendered?.subject ?? '').includes(MARKER), prevBody.rendered?.subject);

    const offRes = await api('/api/admin/notices/templates', token, {
      method: 'POST', body: JSON.stringify({ action: 'toggle', templateId: overdue.id, enabled: false }),
    });
    const offBody = await offRes.json();
    const onRes = await api('/api/admin/notices/templates', token, {
      method: 'POST', body: JSON.stringify({ action: 'toggle', templateId: overdue.id, enabled: true }),
    });
    const onBody = await onRes.json();
    check('toggle disables then re-enables template', offRes.status === 200 && offBody.template?.enabled === false && onRes.status === 200 && onBody.template?.enabled === true, `off=${offBody.template?.enabled} on=${onBody.template?.enabled}`);

    const dupRes = await api('/api/admin/notices/templates', token, {
      method: 'POST', body: JSON.stringify({ action: 'duplicate', templateId: overdue.id, newName: `E2E Copy ${Date.now()}` }),
    });
    const dupBody = await dupRes.json();
    check('duplicate creates new template row', dupRes.status === 200 && dupBody.success && !!dupBody.template?.id, dupBody.template?.id ?? `status=${dupRes.status}`);
  }

  const dispatchRes = await api('/api/admin/notices/dispatch', token, {
    method: 'POST',
    body: JSON.stringify({ action: 'checkout', userId: uid, itemTitle: 'E2E Fixture Item', dueDate: '2026-10-10', channel: 'in-app' }),
  });
  const dispatchBody = await dispatchRes.json();
  check('dispatch in-app succeeds with SENT status', dispatchRes.status === 200 && dispatchBody.success && dispatchBody.delivery?.status === 'SENT', JSON.stringify(dispatchBody.delivery ?? dispatchBody));

  const key = `checkout_receipt:${uid}:checkout:in-app`;
  const logRows = await svc(`notice_delivery_log?idempotency_key=eq.${encodeURIComponent(key)}&select=id,status,channel,notice_type`).then((r) => r.json());
  check('delivery log row written (idempotent key)', Array.isArray(logRows) && logRows.length === 1 && logRows[0].status === 'SENT', JSON.stringify(logRows));

  const notifRows = await svc(`user_notifications?user_id=eq.${uid}&select=id,title,body`).then((r) => r.json());
  check('in-app notification inserted for user', Array.isArray(notifRows) && notifRows.length >= 1 && !!notifRows[0]?.title, `count=${notifRows?.length}`);

  const printRes = await api('/api/admin/notices/dispatch', token, {
    method: 'POST',
    body: JSON.stringify({ action: 'hold_ready', userId: uid, itemTitle: 'E2E Fixture Item', channel: 'print' }),
  });
  const printBody = await printRes.json();
  check('dispatch print returns rendered content', printRes.status === 200 && printBody.success && !!printBody.rendered?.subject && !!printBody.rendered?.text, printBody.rendered?.subject);

  const inAppTest = await api('/api/admin/notices/test-send', token, {
    method: 'POST',
    body: JSON.stringify({ noticeType: 'due_soon', channel: 'in-app', email: 'ignored@invalid.invalid', userId: uid, context }),
  });
  const inAppBody = await inAppTest.json();
  check('test-send in-app is SENT', inAppTest.status === 200 && inAppBody.success && inAppBody.delivery?.status === 'SENT', JSON.stringify(inAppBody.delivery ?? {}));

  const emailTest = await api('/api/admin/notices/test-send', token, {
    method: 'POST',
    body: JSON.stringify({ noticeType: 'due_soon', channel: 'email', email: 'e2e-retry@invalid.invalid', context }),
  });
  const emailBody = await emailTest.json();
  const emailDelivery = emailBody.delivery ?? {};
  check('test-send email attempt recorded (reserved .invalid TLD, no real recipient)', emailTest.status === 200 && emailBody.success && !!emailDelivery.id && ['FAILED', 'SUPPRESSED', 'SENT'].includes(emailDelivery.status), `status=${emailDelivery.status} category=${emailDelivery.error_category ?? '—'}`);

  const permTest = await api('/api/admin/notices/test-send', token, {
    method: 'POST',
    body: JSON.stringify({ noticeType: 'due_soon', channel: 'email', email: 'not-a-valid-address', context }),
  });
  const permBody = await permTest.json();
  const permDelivery = permBody.delivery ?? {};
  check('invalid address classified FAILED/permanent without network send', permTest.status === 200 && permBody.success && permDelivery.status === 'FAILED' && permDelivery.error_category === 'permanent', JSON.stringify({ status: permDelivery.status, category: permDelivery.error_category }));

  const smsTest = await api('/api/admin/notices/test-send', token, {
    method: 'POST',
    body: JSON.stringify({ noticeType: 'due_soon', channel: 'sms', email: '+2340000000000', context }),
  });
  const smsBody = await smsTest.json();
  const smsDelivery = smsBody.delivery ?? {};
  check('unconfigured SMS classified SUPPRESSED/BLOCKED_EXTERNAL (retryable)', smsTest.status === 200 && smsBody.success && smsDelivery.status === 'SUPPRESSED' && smsDelivery.error_category === 'BLOCKED_EXTERNAL', JSON.stringify({ status: smsDelivery.status, category: smsDelivery.error_category }));

  let budgetOk = true;
  let budgetDetail = '';
  for (let i = 1; i <= 4; i++) {
    const r = await api('/api/admin/notices/test-send', token, {
      method: 'POST', body: JSON.stringify({ action: 'retry', deliveryId: smsDelivery.id }),
    });
    const b = await r.json();
    const d = b.delivery ?? {};
    if (i <= 3) {
      if (d.retry_count !== i) { budgetOk = false; budgetDetail = `retry ${i}: retry_count=${d.retry_count}`; }
    } else if (!(d.status === 'FAILED' && d.error_detail === 'Max retries exceeded')) {
      budgetOk = false;
      budgetDetail = `retry 4: status=${d.status} detail=${d.error_detail}`;
    }
  }
  check('retryable delivery retries to max_retries then stops', budgetOk, budgetDetail || 'retry_count 1→2→3 then Max retries exceeded');

  const permRetry = await api('/api/admin/notices/test-send', token, {
    method: 'POST', body: JSON.stringify({ action: 'retry', deliveryId: permDelivery.id }),
  });
  const permRetryBody = await permRetry.json();
  check('permanent failure refused on retry (retry_count stays 0)', permRetry.status === 200 && permRetryBody.delivery?.retry_count === 0 && permRetryBody.delivery?.status === 'FAILED', JSON.stringify({ rc: permRetryBody.delivery?.retry_count, status: permRetryBody.delivery?.status }));

  const emRetry = await api('/api/admin/notices/test-send', token, {
    method: 'POST', body: JSON.stringify({ action: 'retry', deliveryId: emailDelivery.id }),
  });
  const emBody = await emRetry.json();
  if (emailDelivery.status === 'SENT' || emailDelivery.status === 'DELIVERED') {
    check('successful email delivery refuses retry (no increment)', emRetry.status === 200 && emBody.delivery?.retry_count === 0 && emBody.delivery?.status === emailDelivery.status, `retry_count=${emBody.delivery?.retry_count} status=${emBody.delivery?.status}`);
  } else if (emailDelivery.error_category === 'permanent') {
    check('permanent email retry refused without increment', emRetry.status === 200 && emBody.delivery?.retry_count === 0, `retry_count=${emBody.delivery?.retry_count}`);
  } else {
    check('retryable email retry increments retry_count', emRetry.status === 200 && emBody.delivery?.retry_count === 1, `retry_count=${emBody.delivery?.retry_count}`);
  }

  const histRes = await api('/api/admin/notices/test-send?limit=100', token);
  const histBody = await histRes.json();
  const histIds = new Set((histBody.history ?? []).map((h) => h.id));
  check('delivery history lists test entries', histRes.status === 200 && histBody.success && histIds.has(smsDelivery.id) && histIds.has(permDelivery.id), `count=${histBody.history?.length}`);

  // ── Workflow transition notice (fire-and-forget) ─────────────────────
  const itemRes = await svc(`repository_items?id=eq.${REPO_ITEM}&select=status`).then((r) => r.json()).catch(() => []);
  const originalItemStatus = itemRes?.[0]?.status ?? null;

  const wfCreate = await api('/api/workflows', token, {
    method: 'POST', body: JSON.stringify({ repositoryItemId: REPO_ITEM }),
  });
  const wfBody = await wfCreate.json();
  instanceId = wfBody?.data?.id;
  check('workflow instance created for fixture item', wfCreate.status === 201 && !!instanceId, `status=${wfCreate.status} id=${instanceId ?? wfBody?.error}`);

  if (instanceId) {
    const transRes = await api(`/api/workflows/${instanceId}/transition`, token, {
      method: 'POST', body: JSON.stringify({ action: 'submit', comment: 'E2E submit' }),
    });
    const transBody = await transRes.json();
    check('workflow submit transition succeeds', transRes.status === 200 && transBody.success === true, JSON.stringify(transBody));

    await new Promise((r) => setTimeout(r, 2500));
    const wfKey = `workflow:${instanceId}:submit:in-app`;
    const wfLog = await svc(`notice_delivery_log?idempotency_key=eq.${encodeURIComponent(wfKey)}&select=id,status`).then((r) => r.json()).catch(() => []);
    check('workflow transition fired in-app notice', Array.isArray(wfLog) && wfLog.length === 1 && wfLog[0].status === 'SENT', JSON.stringify(wfLog));

    const wfNotif = await svc(`user_notifications?user_id=eq.${uid}&select=id,title`).then((r) => r.json()).catch(() => []);
    check('workflow notice delivered to instance creator', Array.isArray(wfNotif) && wfNotif.length >= 3, `notifications=${wfNotif?.length}`);
  }

  writeFileSync(STATE_FILE, JSON.stringify({ uid, originalItemStatus, instanceId }, null, 2));
  console.log(`\nEDIT PHASE DONE — restart the server, then run: node scripts/e2e-batch13-notices-live.mjs verify`);
}

if (phase === 'verify' || phase === 'all') {
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
  const existing = await findUserByEmail(ADMIN_EMAIL);
  const uid = existing?.id ?? state.uid;
  check('admin user persisted across restart', !!uid, uid ?? 'missing');
  const token = uid ? await signIn() : null;

  if (token) {
    const listBody = await fetchTemplates(token);
    const overdue = findOverdue(listBody.templates);
    check('template edit persisted after server restart (DB authoritative)', !!overdue && String(overdue.subject).includes(MARKER), overdue?.subject);

    const dup = (listBody.templates ?? []).find((t) => String(t.name).startsWith('E2E Copy'));
    check('duplicated template persisted after restart', !!dup, dup?.id ?? 'missing');

    if (overdue) {
      const prevRes = await api('/api/admin/notices/templates', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'preview', template: overdue, context }),
      });
      const prevBody = await prevRes.json();
      check('preview after restart still renders marker', prevRes.status === 200 && String(prevBody.rendered?.subject ?? '').includes(MARKER), prevBody.rendered?.subject);
    }

    const wfLog = await svc('notice_delivery_log?idempotency_key=like.' + encodeURIComponent('workflow:%:submit:in-app') + '&select=id,status').then((r) => r.json()).catch(() => []);
    check('workflow notice log survived restart', Array.isArray(wfLog) && wfLog.length >= 1 && wfLog[0].status === 'SENT', JSON.stringify(wfLog));

    const notifRows = await svc(`user_notifications?user_id=eq.${uid}&select=id`).then((r) => r.json()).catch(() => []);
    check('in-app notifications survived restart', Array.isArray(notifRows) && notifRows.length >= 3, `count=${notifRows?.length}`);

    // ── Cleanup ────────────────────────────────────────────────────────
    if (overdue && String(overdue.subject).includes(MARKER)) {
      await api('/api/admin/notices/templates', token, {
        method: 'POST',
        body: JSON.stringify({ action: 'update', templateId: overdue.id, expectedVersion: overdue.version, changes: { subject: stripMarker(overdue.subject) } }),
      }).then((r) => r.json()).catch(() => null);
    }
    await svc(`notice_templates?name=like.${encodeURIComponent('E2E Copy%')}`, { method: 'DELETE' }).catch(() => undefined);
    await deleteFixtureDeliveries(uid);
    await svc(`user_notifications?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await deleteWorkflowInstancesForItem();

    const itemState = await svc(`repository_items?id=eq.${REPO_ITEM}&select=status`).then((r) => r.json()).catch(() => []);
    const itemNow = itemState?.[0]?.status ?? null;
    const originalItemStatus = state.originalItemStatus;
    if (originalItemStatus && itemNow && originalItemStatus !== itemNow) {
      await svc(`repository_items?id=eq.${REPO_ITEM}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: originalItemStatus }),
      }).catch(() => undefined);
      console.log(`restored repository item status ${itemNow} -> ${originalItemStatus}`);
    }

    const afterList = await fetchTemplates(token).catch(() => ({ templates: [] }));
    const afterOverdue = findOverdue(afterList.templates);
    const afterDup = (afterList.templates ?? []).find((t) => String(t.name).startsWith('E2E Copy'));
    check('cleanup restored template subject and removed duplicate', !!afterOverdue && !String(afterOverdue.subject).includes(MARKER) && !afterDup, afterOverdue?.subject);

    await svc(`user_roles?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
    await withRetry(() => fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: serviceHeaders })).catch(() => undefined);
  }

  console.log('\nVERIFY/CLEANUP PHASE DONE');
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
