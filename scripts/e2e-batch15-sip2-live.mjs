import { readFileSync, writeFileSync, existsSync, openSync, mkdirSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import net from 'net';
import tls from 'tls';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, '..');
const TMP = join(tmpdir(), 'batch15');
mkdirSync(TMP, { recursive: true });

const BASE = 'http://localhost:3000';
const SIP2_PORT = 6000;
const SIP2_HEALTH = 8788;
const TENANT = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'e2e-batch15@invalid.invalid';
const PASSWORD = 'E2eBatch15!';
const EXPECTED_REF = 'rnnjspkdhojoigncdgmy';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  return !!ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p2 = (n) => String(n).padStart(2, '0');

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
if (!SUPABASE_URL || !SUPABASE_URL.includes(EXPECTED_REF)) {
  console.error(`DATABASE RULE: SUPABASE_URL ref is not ${EXPECTED_REF}. Aborting.`);
  process.exit(3);
}

const serviceHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function withRetry(fn, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      await sleep(900 * (i + 1));
    }
  }
  throw last;
}

const svc = (path, init = {}) =>
  withRetry(() => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders, ...(init.headers || {}) } }));

async function svcJson(path, init = {}) {
  const res = await svc(path, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function sip2Checksum(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum = (sum + (data.charCodeAt(i) & 0xff)) & 0xffff;
  return (((~sum + 1) & 0xffff).toString(16).toUpperCase().padStart(4, '0'));
}

function now18() {
  const d = new Date();
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}    ${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

function build(code, fixed, fields, seq = null) {
  let msg = code + fixed;
  for (const [id, value] of fields) msg += `${id}${value}|`;
  if (seq !== null) msg += `AY${seq}`;
  msg += `AZ${sip2Checksum(msg + 'AZ')}`;
  return `${msg}\r`;
}

const FIXED_LENS = {
  98: [1, 1, 1, 1, 1, 1, 3, 3, 18, 4],
  94: [1],
  24: [14, 3, 18],
  64: [14, 3, 18, 4, 4, 4, 4, 4, 4],
  18: [2, 2, 2, 18],
  12: [1, 1, 1, 1, 18],
  30: [1, 1, 1, 1, 18],
  10: [1, 1, 1, 1, 18],
  36: [1, 18],
  66: [1, 4, 4, 18],
  26: [14, 3, 18],
  16: [1, 1, 18],
  20: [1, 18],
  38: [1, 18],
  96: [],
};
const OK_CODES = new Set(['94', '12', '10', '16', '30', '20', '38', '26']);

function parseResp(raw) {
  let msg = String(raw).replace(/[\r\n]+$/, '');
  let checksumOk = null;
  if (msg.length >= 6 && msg.slice(-6, -4) === 'AZ') {
    checksumOk = sip2Checksum(msg.slice(0, -6) + 'AZ') === msg.slice(-4).toUpperCase();
    msg = msg.slice(0, -6);
  }
  const code = msg.slice(0, 2);
  let rest = msg.slice(2);
  const seqMatch = rest.match(/AY(\d)$/);
  const sequence = seqMatch ? seqMatch[1] : null;
  if (sequence !== null) rest = rest.slice(0, -3);
  const fixed = [];
  for (const len of FIXED_LENS[code] ?? []) {
    if (rest.length < len) break;
    fixed.push(rest.slice(0, len));
    rest = rest.slice(len);
  }
  const fields = {};
  let i = 0;
  while (i + 3 <= rest.length) {
    const id = rest.slice(i, i + 2);
    if (!/^[A-Z][A-Z0-9]$/.test(id)) break;
    const delim = rest.indexOf('|', i + 2);
    if (delim === -1) break;
    const value = rest.slice(i + 2, delim);
    (fields[id] ??= []).push(value);
    i = delim + 1;
  }
  const ok = OK_CODES.has(code) ? (fixed[0] ?? null) : null;
  return { code, ok, fixed, fields, sequence, checksumOk, raw: String(raw).replace(/[\r\n]+$/, '') };
}

class Sip2Conn {
  constructor(useTls = false) {
    this.useTls = useTls;
    this.buf = '';
    this.sock = null;
  }

  connect(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const opts = { host: '127.0.0.1', port: SIP2_PORT };
      const s = this.useTls ? tls.connect({ ...opts, rejectUnauthorized: false }) : net.connect(opts);
      const event = this.useTls ? 'secureConnect' : 'connect';
      const onErr = (err) => reject(err);
      s.once('error', onErr);
      s.once(event, () => {
        s.removeListener('error', onErr);
        s.setEncoding('utf8');
        this.sock = s;
        resolve();
      });
    });
  }

  send(text) {
    this.sock.write(text);
  }

  readFrame(timeoutMs = 6000) {
    return new Promise((resolve) => {
      const take = () => {
        for (;;) {
          const cr = this.buf.indexOf('\r');
          const lf = this.buf.indexOf('\n');
          const idxs = [cr, lf].filter((x) => x >= 0);
          if (idxs.length === 0) return null;
          const idx = Math.min(...idxs);
          const frame = this.buf.slice(0, idx);
          const consumed = this.buf[idx] === '\r' && this.buf[idx + 1] === '\n' ? idx + 2 : idx + 1;
          this.buf = this.buf.slice(consumed);
          if (frame.length > 0) return frame;
        }
      };
      const first = take();
      if (first !== null) {
        resolve(first);
        return;
      }
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.sock.removeListener('data', onData);
        this.sock.removeListener('close', onClose);
        resolve(value);
      };
      const onData = (chunk) => {
        this.buf += chunk;
        const frame = take();
        if (frame !== null) finish(frame);
      };
      const onClose = () => finish(null);
      const timer = setTimeout(() => finish(null), timeoutMs);
      this.sock.on('data', onData);
      this.sock.once('close', onClose);
    });
  }

  async request(msg, timeoutMs = 8000) {
    this.send(msg);
    return this.readFrame(timeoutMs);
  }

  close() {
    if (this.sock) this.sock.destroy();
    this.sock = null;
    this.buf = '';
  }
}

async function connect(useTls = false) {
  const conn = new Sip2Conn(useTls);
  await conn.connect();
  return conn;
}

function loginFrame(user, password, seq) {
  return build('93', '00', [['CN', user], ['CO', password], ['CP', 'SC-E2E']], seq);
}

async function waitForSip2Health(timeoutMs = 25000, wantTls = null) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${SIP2_HEALTH}/health`, { signal: AbortSignal.timeout(2500) });
      const body = await res.json();
      if (res.ok && body.status === 'ok') {
        if (wantTls === null || body.tls === wantTls) return body;
        lastErr = `tls=${body.tls}`;
      }
    } catch (err) {
      lastErr = err.message;
    }
    await sleep(400);
  }
  throw new Error(`SIP2 health not ready: ${lastErr}`);
}

function startListener(extraEnv = {}) {
  const outFd = openSync(join(TMP, 'sip2-listener.out.log'), 'a');
  const errFd = openSync(join(TMP, 'sip2-listener.err.log'), 'a');
  return spawn(process.execPath, ['--import', 'tsx', 'sip2/index.ts'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      SIP2_PORT: String(SIP2_PORT),
      SIP2_HEALTH_PORT: String(SIP2_HEALTH),
      SIP2_MAX_CONNECTIONS: '32',
      SIP2_IDLE_TIMEOUT_MS: '300000',
      SIP2_MAX_MESSAGE_BYTES: '8192',
      ...extraEnv,
    },
    stdio: ['ignore', outFd, errFd],
  });
}

async function stopListener(child) {
  if (child && !child.killed && child.pid) {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already exited */
    }
  }
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${SIP2_HEALTH}/health`, { signal: AbortSignal.timeout(700) });
    } catch {
      return;
    }
    await sleep(300);
  }
}

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

async function waitForAppHealth(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      /* not up */
    }
    await sleep(1200);
  }
  return false;
}

function startApp() {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3000'], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
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
  const res = await withRetry(() =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    }),
  );
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
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
  await svc(`user_roles?user_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined);
  await svc('user_roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: uid, role: 'super_admin', tenant_id: TENANT }),
  });
  return uid;
}

async function ensurePatron(patronId, category = 'undergraduate') {
  const existing = await svcJson(`patrons?patron_id=eq.${patronId}&select=id`);
  if (Array.isArray(existing.body) && existing.body.length > 0) return existing.body[0].id;
  const res = await svc('patrons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([
      {
        patron_id: patronId,
        full_name: `E2E SIP2 ${patronId}`,
        email: `${patronId.toLowerCase()}@invalid.invalid`,
        patron_category: category,
        status: 'active',
        user_id: null,
        tenant_id: TENANT,
      },
    ]),
  });
  const body = await res.json();
  return body?.[0]?.id ?? null;
}

async function ensureItem(title, barcode) {
  const existing = await svcJson(`catalogue_items?title=eq.${encodeURIComponent(title)}&select=id,available_copies,total_copies,isbn`);
  if (Array.isArray(existing.body) && existing.body.length > 0) {
    const row = existing.body[0];
    const patch = {};
    if (row.available_copies !== 1 || row.total_copies !== 1) {
      patch.available_copies = 1;
      patch.total_copies = 1;
    }
    if (row.isbn !== barcode) patch.isbn = barcode;
    if (Object.keys(patch).length > 0) {
      await svc(`catalogue_items?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
    }
    return row.id;
  }
  const res = await svc('catalogue_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([
      {
        title,
        authors: [],
        format: 'Book',
        isbn: barcode,
        available_copies: 1,
        total_copies: 1,
        call_number: `E2E15/${barcode.slice(-3)}`,
      },
    ]),
  });
  const body = await res.json();
  return body?.[0]?.id ?? null;
}

const terminals = {};
async function createTerminal(token, key, name, loginUsername, allowedOperations, permittedIpCidr = null) {
  const res = await api(token, '/api/admin/sip2/terminals', {
    method: 'POST',
    body: JSON.stringify({ name, loginUsername, allowedOperations, permittedIpCidr }),
  });
  terminals[key] = { ...res.body?.data?.terminal, plainPassword: res.body?.data?.plainPassword, createStatus: res.status };
  return terminals[key];
}

function runPython(args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const child = spawn('python', [join(PROJECT_ROOT, 'scripts', 'sip2-client.py'), ...args], {
      cwd: PROJECT_ROOT,
      timeout: timeoutMs,
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

const startIso = new Date().toISOString();
let listener = null;
let previousHealth = null;
let preRestartHealth = null;

async function phase0Setup() {
  const stale = findListeningPid(String(SIP2_PORT));
  if (stale) {
    try {
      execSync(`taskkill /PID ${stale} /T /F`, { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
    await sleep(1200);
  }
  const appUp = await waitForAppHealth(8000);
  if (!appUp) {
    startApp();
    const ok = await waitForAppHealth(60000);
    check('app server running on :3000', ok);
  } else {
    check('app server running on :3000', true, 'already up');
  }
  listener = startListener();
  const health = await waitForSip2Health();
  check('SIP2 TCP listener up, health endpoint ok', health.status === 'ok', `tls=${health.tls} port=${health.port}`);
  previousHealth = health;
}

async function phase1AdminApi() {
  await createUser(ADMIN_EMAIL);
  const { token } = await signIn(ADMIN_EMAIL);

  const kiosk = await createTerminal(token, 'kiosk', 'E2E Kiosk A', 'e2e-js', ['*'], null);
  check('admin API creates terminal + returns one-time password', kiosk.createStatus === 200 && !!kiosk.plainPassword && kiosk.plainPassword.length >= 16, `id=${kiosk.id}`);

  const list = await api(token, '/api/admin/sip2/terminals');
  const rows = list.body?.data?.terminals ?? [];
  const noHash = rows.every((r) => !('password_hash' in r));
  check('GET list never exposes password_hash', list.status === 200 && noHash && rows.some((r) => r.id === kiosk.id), `${rows.length} rows`);

  const dup = await api(token, '/api/admin/sip2/terminals', {
    method: 'POST',
    body: JSON.stringify({ name: 'Dup', loginUsername: 'e2e-js', allowedOperations: ['*'], permittedIpCidr: null }),
  });
  check('duplicate login_username rejected 400', dup.status === 400 && String(dup.body?.error).startsWith('Invalid'), dup.body?.error);

  const badOps = await api(token, '/api/admin/sip2/terminals', {
    method: 'POST',
    body: JSON.stringify({ name: 'BadOps', loginUsername: 'e2e-badops', allowedOperations: ['root'], permittedIpCidr: null }),
  });
  check('invalid operation name rejected 400', badOps.status === 400, badOps.body?.error);

  const badCidr = await api(token, '/api/admin/sip2/terminals', {
    method: 'POST',
    body: JSON.stringify({ name: 'BadCidr', loginUsername: 'e2e-badcidr', allowedOperations: ['*'], permittedIpCidr: '999.1.1.1/99' }),
  });
  check('invalid CIDR rejected 400', badCidr.status === 400, badCidr.body?.error);

  const reset = await api(token, '/api/admin/sip2/terminals', {
    method: 'PATCH',
    body: JSON.stringify({ id: kiosk.id, action: 'reset-secret' }),
  });
  const newSecret = reset.body?.data?.plainPassword;
  check('reset-secret rotates password', reset.status === 200 && !!newSecret && newSecret !== kiosk.plainPassword);
  kiosk.plainPassword = newSecret;

  const off = await api(token, '/api/admin/sip2/terminals', { method: 'PATCH', body: JSON.stringify({ id: kiosk.id, isActive: false }) });
  const listed = await api(token, '/api/admin/sip2/terminals');
  const listedRow = (listed.body?.data?.terminals ?? []).find((r) => r.id === kiosk.id);
  check('disable/enable toggle persists', off.status === 200 && listedRow?.is_active === false);
  await api(token, '/api/admin/sip2/terminals', { method: 'PATCH', body: JSON.stringify({ id: kiosk.id, isActive: true }) });

  await createTerminal(token, 'ops', 'E2E Ops Limited', 'e2e-ops', ['patron_info'], null);
  await createTerminal(token, 'cidr', 'E2E CIDR Locked', 'e2e-cidr', ['*'], '10.255.255.255/32');
  await createTerminal(token, 'lock', 'E2E Lockout', 'e2e-lock', ['*'], null);
  await createTerminal(token, 'py', 'E2E Python Client', 'e2e-py', ['*'], null);
  check('auxiliary terminals created (ops/cidr/lockout/python)', ['ops', 'cidr', 'lock', 'py'].every((k) => terminals[k]?.id && terminals[k]?.plainPassword));

  const forbidden = await fetch(`${BASE}/api/admin/sip2/terminals`);
  check('route requires auth (no token → 401)', forbidden.status === 401, `status=${forbidden.status}`);

  return token;
}

async function phase2Protocol(token) {
  const kiosk = terminals.kiosk;
  const main = await connect();
  const r1 = parseResp(await main.request(build('99', `00402.00`, [], 1)));
  check('99 → 98 status response valid', r1.code === '98' && r1.checksumOk === true && r1.fields.AO?.[0] === 'ESUT' && r1.fixed[9] === '2.00', `online=${r1.fixed[0]} bx=${r1.fields.BX?.[0]?.length}`);
  check('98 BX supported-messages flags match profile', (r1.fields.BX?.[0] ?? '').length === 16 && r1.fields.BX[0][3] === 'N' && r1.fields.BX[0][14] === 'Y', r1.fields.BX?.[0]);
  check('sequence number echoed (AY)', r1.sequence === '1', `seq=${r1.sequence}`);

  await api(token, '/api/admin/sip2/terminals', { method: 'PATCH', body: JSON.stringify({ id: kiosk.id, isActive: false }) });
  const disabledLogin = parseResp(await main.request(loginFrame('e2e-js', kiosk.plainPassword, 2), 15000));
  check('disabled terminal login rejected (94 ok=0)', disabledLogin.code === '94' && disabledLogin.ok === '0');
  await api(token, '/api/admin/sip2/terminals', { method: 'PATCH', body: JSON.stringify({ id: kiosk.id, isActive: true }) });

  const login = parseResp(await main.request(loginFrame('e2e-js', kiosk.plainPassword, 3), 15000));
  check('93 login accepted (94 ok=1)', login.code === '94' && login.ok === '1', `checksum=${login.checksumOk}`);

  main.send(build('42', '', [], 4));
  const authUnknownSilence = await main.readFrame(700);
  check('unrecognized command ignored while authenticated', authUnknownSilence === null);

  const pre = await connect();
  const blocked = parseResp(await pre.request(build('23', `000${now18()}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AD', '']], 1)));
  check('pre-login 23 blocked → 24 failure form', blocked.code === '24' && String(blocked.fields.AF?.[0]).includes('Login required'), blocked.fields.AF?.[0]);

  const preStatus = parseResp(await pre.request(build('99', `00402.00`, [], 2)));
  check('pre-login 99 still allowed → 98', preStatus.code === '98' && preStatus.checksumOk === true);

  const badSum = parseResp(await pre.request(`9900402.00AY3AZ0000\r`, 6000));
  check('corrupted checksum → 96 Request SC Resend', badSum.code === '96' && badSum.checksumOk === true);

  const unknown = build('42', '', [], 4);
  const silence = await (async () => {
    pre.send(unknown);
    const frame = await pre.readFrame(700);
    return frame;
  })();
  check('unrecognized command ignored (no response)', silence === null);

  const alive = parseResp(await pre.request(build('99', `00402.00`, [], 5)));
  check('connection alive after ignored frame', alive.code === '98');

  const dupA = await pre.request(build('99', `00402.00`, [], 6));
  const dupB = await pre.request(build('99', `00402.00`, [], 6));
  check('duplicate request resent identical response', dupA !== null && dupA === dupB);

  const resendFrame = `97AZ${sip2Checksum('97AZ')}\r`;
  const resend = parseResp(await pre.request(resendFrame));
  check('97 Request ACS Resend retransmits last response', resend.code === '98' && resend.raw === dupB.replace(/[\r\n]+$/, ''));

  const two = build('99', `00402.00`, [], 8) + build('99', `00402.00`, [], 9);
  pre.send(two);
  const c1 = await pre.readFrame(6000);
  const c2 = await pre.readFrame(6000);
  check('coalesced frames processed independently', c1 !== null && c2 !== null && c1 !== c2, `got ${c1 ? 1 : 0}+${c2 ? 1 : 0}`);

  const fullPartial = '9900402.00AY7';
  pre.send('99');
  await sleep(150);
  pre.send('0040');
  await sleep(150);
  const partial = parseResp(await pre.request(`2.00AY7AZ${sip2Checksum(`${fullPartial}AZ`)}\r`, 6000));
  check('split TCP segments reassembled', partial.code === '98' && partial.checksumOk === true, `code=${partial.code}`);

  const junk = new Sip2Conn(false);
  await junk.connect();
  junk.send(`99${'X'.repeat(9000)}AZ0000\r`);
  const closed = await junk.readFrame(5000);
  check('oversize frame closes connection', closed === null);
  junk.close();

  const preEvents = await svcJson('sip2_audit_log?event=in.(pre_login_blocked,checksum_failed,unknown_command)&created_at=gte.' + encodeURIComponent(startIso) + '&select=event,details');
  const eventNames = new Set((preEvents.body ?? []).map((r) => r.event));
  check('protocol edge events audited', eventNames.has('pre_login_blocked') && eventNames.has('checksum_failed'), [...eventNames].join(','));

  main.close();
  pre.close();
  return { main, loginSeqUsed: true };
}

async function phase3PatronItemInfo() {
  const kiosk = terminals.kiosk;
  const conn = await connect();
  const login = parseResp(await conn.request(loginFrame('e2e-js', kiosk.plainPassword, 1), 15000));
  check('circulation session login (reuse conn)', login.ok === '1');

  const patronStatus = parseResp(await conn.request(build('23', `000${now18()}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AD', '']], 2)));
  check('23 → 24 patron status (BL=Y, 14-char flags)', patronStatus.code === '24' && patronStatus.fields.BL?.[0] === 'Y' && (patronStatus.fixed[0]?.length ?? 0) === 14 && patronStatus.checksumOk === true, `flags="${patronStatus.fixed[0]}"`);

  const unknownPatron = parseResp(await conn.request(build('23', `000${now18()}`, [['AO', 'ESUT'], ['AA', 'E2E15-NOBODY'], ['AD', '']], 3)));
  check('23 unknown patron → BL=N + AF note', unknownPatron.code === '24' && unknownPatron.fields.BL?.[0] === 'N' && !!unknownPatron.fields.AF?.[0], unknownPatron.fields.AF?.[0]);

  const patronInfo = parseResp(await conn.request(build('63', `000${now18()}${' '.repeat(10)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1']], 4)));
  const countsOk = patronInfo.code === '64' && patronInfo.fields.BL?.[0] === 'Y' && /^[0-9]{4}$/.test(patronInfo.fixed[3] ?? '') && /^[0-9]{4}$/.test(patronInfo.fixed[5] ?? '');
  check('63 → 64 counts fixed block valid', countsOk, `holds=${patronInfo.fixed[3]} overdue=${patronInfo.fixed[4]} charged=${patronInfo.fixed[5]}`);

  const patronInfoY = parseResp(await conn.request(build('63', `000${now18()}Y${' '.repeat(9)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1']], 5)));
  check('63 with detail summary answered', patronInfoY.code === '64' && patronInfoY.checksumOk === true);

  const itemInfo = parseResp(await conn.request(build('17', now18(), [['AO', 'ESUT'], ['AB', 'E2E15-A']], 6)));
  check('17 → 18 item info (circ=03 available, AB/AJ present)', itemInfo.code === '18' && itemInfo.fixed[0] === '03' && itemInfo.fields.AB?.[0] === 'E2E15-A' && !!itemInfo.fields.AJ?.[0], `circ=${itemInfo.fixed[0]}`);

  const unknownItem = parseResp(await conn.request(build('17', now18(), [['AO', 'ESUT'], ['AB', 'E2E15-NOPE']], 7)));
  check('17 unknown item → circ=01 + AF note', unknownItem.code === '18' && unknownItem.fixed[0] === '01' && !!unknownItem.fields.AF?.[0], unknownItem.fields.AF?.[0]);

  return conn;
}

async function phase4Circulation(conn) {
  const checkoutFrame = build('11', `YN${now18()}${'0'.repeat(18)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-A']], 8);
  const checkoutResp = await conn.request(checkoutFrame);
  const checkout = parseResp(checkoutResp);
  const dueOk = /^\d{8}$/.test(checkout.fields.AH?.[0] ?? '');
  check('11 checkout → 12 ok=1 with due date', checkout.code === '12' && checkout.ok === '1' && checkout.fixed[1] === 'N' && dueOk && checkout.checksumOk === true, `due=${checkout.fields.AH?.[0]}`);

  const loanRows = await svcJson(`loans?patron_id=eq.${terminals.p1id}&catalogue_item_id=eq.${terminals.itemA}&select=id,status,return_date,renewed_count`);
  const loan = Array.isArray(loanRows.body) ? loanRows.body[0] : null;
  check('loan row created active in DB', !!loan && loan.status === 'active' && loan.return_date === null, `loan=${loan?.id}`);

  const avail = await svcJson(`catalogue_items?id=eq.${terminals.itemA}&select=available_copies`);
  check('available_copies decremented on checkout', avail.body?.[0]?.available_copies === 0, `available=${avail.body?.[0]?.available_copies}`);

  const tx = await svcJson(`circulation_transactions?patron_id=eq.${terminals.p1id}&transaction_type=eq.checkout&offline_id=like.${encodeURIComponent('sip2%')}&select=id`);
  check('circulation_transactions audit row written', Array.isArray(tx.body) && tx.body.length >= 1, `rows=${tx.body?.length}`);

  const resendCheckout = await conn.request(checkoutFrame);
  check('byte-identical resend returns identical response', resendCheckout !== null && resendCheckout === checkoutResp);

  const held = parseResp(await conn.request(build('11', `YN${now18()}${'0'.repeat(18)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-A']], 9)));
  check('repeat checkout (new seq) idempotent → ok=1 renewal=Y', held.code === '12' && held.ok === '1' && held.fixed[1] === 'Y', held.fields.AF?.[0]);

  const loanCount = await svcJson(`loans?patron_id=eq.${terminals.p1id}&catalogue_item_id=eq.${terminals.itemA}&select=id`);
  check('still exactly one loan for pair', (loanCount.body ?? []).length === 1, `count=${loanCount.body?.length}`);

  const renew = parseResp(await conn.request(build('29', `NN${now18()}${'0'.repeat(18)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-A']], 10)));
  check('29 renew → 30 ok=1', renew.code === '30' && renew.ok === '1' && /^\d{8}$/.test(renew.fields.AH?.[0] ?? ''), `due=${renew.fields.AH?.[0]}`);
  const renewed = await svcJson(`loans?id=eq.${loan?.id}&select=renewed_count`);
  check('renewed_count incremented', renewed.body?.[0]?.renewed_count === 1, `renewed=${renewed.body?.[0]?.renewed_count}`);

  const checkin = parseResp(await conn.request(build('09', `N${now18()}${now18()}`, [['AP', 'SC-E2E'], ['AO', 'ESUT'], ['AB', 'E2E15-A']], 11)));
  check('09 checkin → 10 ok=1, alert=N (no fine)', checkin.code === '10' && checkin.ok === '1' && checkin.fixed[3] === 'N' && checkin.checksumOk === true, `alert=${checkin.fixed[3]}`);

  const returned = await svcJson(`loans?id=eq.${loan?.id}&select=status,return_date`);
  check('loan returned in DB', returned.body?.[0]?.status === 'returned' && !!returned.body?.[0]?.return_date, `status=${returned.body?.[0]?.status}`);

  const availBack = await svcJson(`catalogue_items?id=eq.${terminals.itemA}&select=available_copies`);
  check('available_copies restored on checkin', availBack.body?.[0]?.available_copies === 1, `available=${availBack.body?.[0]?.available_copies}`);

  const noLoan = parseResp(await conn.request(build('09', `N${now18()}${now18()}`, [['AP', 'SC-E2E'], ['AO', 'ESUT'], ['AB', 'E2E15-A']], 12)));
  check('second checkin idempotent → ok=1 + AF note', noLoan.code === '10' && noLoan.ok === '1' && !!noLoan.fields.AF?.[0], noLoan.fields.AF?.[0]);

  return conn;
}

async function phase5Concurrency() {
  const kiosk = terminals.kiosk;
  const connA = await connect();
  const connB = await connect();
  const la = parseResp(await connA.request(loginFrame('e2e-js', kiosk.plainPassword, 1), 15000));
  const lb = parseResp(await connB.request(loginFrame('e2e-js', kiosk.plainPassword, 2), 15000));
  check('two self-check stations connected + logged in', la.ok === '1' && lb.ok === '1');

  const frameA = build('11', `YN${now18()}${'0'.repeat(18)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-B']], 3);
  const frameB = build('11', `YN${now18()}${'0'.repeat(18)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-B']], 4);
  connA.send(frameA);
  connB.send(frameB);
  const [ra, rb] = await Promise.all([connA.readFrame(15000), connB.readFrame(15000)]);
  const pa = parseResp(ra);
  const pb = parseResp(rb);
  check('both stations received a 12 response', pa.code === '12' && pb.code === '12', `A ok=${pa.ok} B ok=${pb.ok}`);

  const loans = await svcJson(`loans?patron_id=eq.${terminals.p1id}&catalogue_item_id=eq.${terminals.itemB}&status=in.(active,overdue)&select=id`);
  check('raced checkout produced exactly one active loan (DB unique backstop)', (loans.body ?? []).length === 1, `count=${loans.body?.length}`);
  check('at least one station won the race', pa.ok === '1' || pb.ok === '1', `A=${pa.ok} B=${pb.ok}`);

  const cleanup = parseResp(await connA.request(build('09', `N${now18()}${now18()}`, [['AP', 'SC-E2E'], ['AO', 'ESUT'], ['AB', 'E2E15-B']], 5)));
  check('raced item checked back in', cleanup.ok === '1');
  connA.close();
  connB.close();
}

async function phase6Unsupported(conn) {
  const cases = [
    ['65', now18(), [], '66'],
    ['01', `N${now18()}`, [['AO', 'ESUT'], ['AL', 'e2e'], ['AA', 'E2E15-P1'], ['AC', 'x']], '24'],
    ['15', `+${now18()}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-A']], '16'],
    ['37', `${now18()}0100NGN`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['BV', '0.00']], '38'],
    ['19', now18(), [['AO', 'ESUT'], ['AB', 'E2E15-A']], '20'],
    ['25', now18(), [['AO', 'ESUT'], ['AA', 'E2E15-P1']], '26'],
  ];
  let seq = 20;
  const observed = [];
  for (const [code, fixed, fields, expect] of cases) {
    const resp = parseResp(await conn.request(build(code, fixed, fields, seq++), 12000));
    const okZero = ['16', '20'].includes(expect) ? resp.ok === '0' : true;
    const passedOne = resp.code === expect && okZero && resp.checksumOk === true && !!resp.fields.AF?.[0];
    if (passedOne) observed.push(`${code}→${resp.code}`);
    check(`unsupported ${code} → ${expect} failure form`, passedOne, `got ${resp.code} ok=${resp.ok} af=${resp.fields.AF?.[0] ?? ''}`);
  }
  check('all recognized-unsupported pairs answered', observed.length === cases.length, observed.join(' '));
}

async function phase7OpPermissions() {
  const conn = await connect();
  const login = parseResp(await conn.request(loginFrame('e2e-ops', terminals.ops.plainPassword, 1), 15000));
  check('op-limited terminal login', login.ok === '1');

  const denied = parseResp(await conn.request(build('11', `YN${now18()}${'0'.repeat(18)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1'], ['AB', 'E2E15-A']], 2)));
  check('checkout denied by allowed_operations (12 ok=0)', denied.code === '12' && denied.ok === '0' && String(denied.fields.AF?.[0]).includes('not allowed'), denied.fields.AF?.[0]);

  const deniedCheckin = parseResp(await conn.request(build('09', `N${now18()}${now18()}`, [['AO', 'ESUT'], ['AB', 'E2E15-A']], 3)));
  check('checkin denied by allowed_operations (10 ok=0)', deniedCheckin.code === '10' && deniedCheckin.ok === '0');

  const allowed = parseResp(await conn.request(build('63', `000${now18()}${' '.repeat(10)}`, [['AO', 'ESUT'], ['AA', 'E2E15-P1']], 4)));
  check('patron_info permitted for op-limited terminal', allowed.code === '64' && allowed.fields.BL?.[0] === 'Y');

  const audited = await svcJson(`sip2_audit_log?event=eq.operation_denied&created_at=gte.${encodeURIComponent(startIso)}&select=event,details`);
  check('operation_denied audited', (audited.body ?? []).length >= 2, `rows=${audited.body?.length}`);
  conn.close();
}

async function phase8Cidr() {
  const conn = await connect();
  const login = parseResp(await conn.request(loginFrame('e2e-cidr', terminals.cidr.plainPassword, 1), 15000));
  check('CIDR-mismatched terminal login rejected (94 ok=0)', login.code === '94' && login.ok === '0');
  const audited = await svcJson(`sip2_audit_log?event=eq.login_failed&created_at=gte.${encodeURIComponent(startIso)}&select=event,details`);
  const ipDenied = (audited.body ?? []).some((r) => r.details?.reason === 'ip_not_allowed');
  check('ip_not_allowed audited', ipDenied);
  conn.close();
}

async function phase9Lockout() {
  const conn = new Sip2Conn(false);
  await conn.connect();
  const terminal = terminals.lock;
  for (let i = 1; i <= 5; i++) {
    const attempt = parseResp(await conn.request(loginFrame('e2e-lock', `WrongPass${i}!x`, i), 15000));
    if (attempt.ok !== '0') check(`bad login attempt ${i} rejected`, false, `ok=${attempt.ok}`);
  }
  check('5 bad logins all rejected', true);

  const whileLocked = parseResp(await conn.request(loginFrame('e2e-lock', terminal.plainPassword, 6), 15000));
  check('correct password still rejected while locked (94 ok=0)', whileLocked.code === '94' && whileLocked.ok === '0');

  const row = await svcJson(`sip2_terminals?id=eq.${terminal.id}&select=failed_attempts,locked_until`);
  check('failed_attempts=5 and locked_until set in DB', row.body?.[0]?.failed_attempts === 5 && !!row.body?.[0]?.locked_until, `attempts=${row.body?.[0]?.failed_attempts}`);

  const { token } = await signIn(ADMIN_EMAIL);
  const reset = await api(token, '/api/admin/sip2/terminals', {
    method: 'PATCH',
    body: JSON.stringify({ id: terminal.id, action: 'reset-secret' }),
  });
  check('admin reset-secret unlocks terminal', reset.status === 200 && !!reset.body?.data?.plainPassword);
  terminal.plainPassword = reset.body.data.plainPassword;
  const unlocked = parseResp(await conn.request(loginFrame('e2e-lock', terminal.plainPassword, 7), 15000));
  check('login succeeds after unlock (94 ok=1)', unlocked.ok === '1');
  conn.close();
}

async function phase10PythonClient() {
  const common = ['--json', '--host', '127.0.0.1', '--port', String(SIP2_PORT), '--user', 'e2e-py', '--password', terminals.py.plainPassword, '--timeout', '20'];
  const run = async (args, expectCode) => {
    const r = await runPython([...common, ...args]);
    let parsed = null;
    try {
      parsed = JSON.parse(r.out.split('\n').filter(Boolean).pop());
    } catch {
      /* not json */
    }
    const ok = r.code === 0 && parsed?.code === expectCode && parsed?.checksum_ok !== false;
    check(`python client ${args[0]} → ${expectCode}`, ok, `exit=${r.code} code=${parsed?.code} checksum=${parsed?.checksum_ok}${r.err ? ` err=${r.err.slice(0, 80)}` : ''}`);
    return parsed;
  };

  await run(['status'], '98');
  await run(['patron-status', '--barcode', 'E2E15-P1'], '24');
  await run(['patron-info', '--barcode', 'E2E15-P1'], '64');
  await run(['item', '--barcode', 'E2E15-A'], '18');
  const pyCheckout = await run(['checkout', '--barcode', 'E2E15-P1', '--item', 'E2E15-A'], '12');
  check('python checkout ok=1', pyCheckout?.ok === '1', `ok=${pyCheckout?.ok}`);
  await run(['renew', '--barcode', 'E2E15-P1', '--item', 'E2E15-A'], '30');
  const pyCheckin = await run(['checkin', '--item', 'E2E15-A'], '10');
  check('python checkin ok=1', pyCheckin?.ok === '1', `ok=${pyCheckin?.ok}`);
  await run(['end-session', '--barcode', 'E2E15-P1'], '36');
}

async function phase11Restart() {
  const before = previousHealth;
  await stopListener(listener);
  listener = startListener();
  const health = await waitForSip2Health();
  check('listener restart: health ok, counters reset', health.status === 'ok' && Date.parse(health.startedAt) > Date.parse(before.startedAt), `messages=${health.messagesProcessed}`);

  const conn = await connect();
  const status = parseResp(await conn.request(build('99', `00402.00`, [], 1)));
  check('after restart: 99 → 98 works', status.code === '98' && status.checksumOk === true);
  const login = parseResp(await conn.request(loginFrame('e2e-js', terminals.kiosk.plainPassword, 2), 15000));
  check('after restart: login works (stateless)', login.ok === '1');
  const withTraffic = await waitForSip2Health(3000, null);
  check('after restart: counters count new traffic', withTraffic.messagesProcessed >= 2 && withTraffic.responsesSent >= 2, `processed=${withTraffic.messagesProcessed}`);
  conn.close();
  previousHealth = health;
}

async function phase12Tls() {
  const opensslCandidates = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
  ];
  const openssl = opensslCandidates.find((p) => existsSync(p));
  if (!openssl) {
    check('TLS listener E2E (openssl unavailable — skipped)', true, 'skipped: openssl not found');
    return;
  }
  const certDir = TMP;
  const keyPath = join(certDir, 'sip2-e2e-key.pem');
  const certPath = join(certDir, 'sip2-e2e-cert.pem');
  execSync(
    `"${openssl}" req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 2 -subj "/CN=localhost"`,
    { stdio: 'ignore' },
  );
  await stopListener(listener);
  listener = startListener({ SIP2_TLS_CERT: certPath, SIP2_TLS_KEY: keyPath });
  const health = await waitForSip2Health(25000, true);
  check('TLS listener up (health tls=true)', health.tls === true);

  const conn = new Sip2Conn(true);
  await conn.connect();
  const status = parseResp(await conn.request(build('99', `00402.00`, [], 1)));
  check('TLS connection serves 99 → 98', status.code === '98' && status.checksumOk === true);
  const login = parseResp(await conn.request(loginFrame('e2e-js', terminals.kiosk.plainPassword, 2), 15000));
  check('TLS login works', login.ok === '1');
  conn.close();

  await stopListener(listener);
  listener = startListener();
  await waitForSip2Health(25000, false);
  check('returned to plain TCP listener', true);
}

async function phase13Observability() {
  const health = await waitForSip2Health(5000, null);
  check('final listener process healthy after plain restart', health.status === 'ok' && health.tls === false, `tls=${health.tls}`);
  const cumulative = preRestartHealth ?? health;
  check(
    'health counters accumulate traffic',
    cumulative.messagesProcessed >= 10 && cumulative.responsesSent >= 10 && cumulative.connectionsTotal >= 5 && cumulative.ignoredFrames >= 1,
    `processed=${cumulative.messagesProcessed} responses=${cumulative.responsesSent} conns=${cumulative.connectionsTotal} ignored=${cumulative.ignoredFrames}`,
  );

  const { body: events } = await svcJson(
    `sip2_audit_log?created_at=gte.${encodeURIComponent(startIso)}&select=event,success,details&order=created_at.asc`,
  );
  const names = new Set((events ?? []).map((r) => r.event));
  const required = [
    'status_request',
    'login_success',
    'login_failed',
    'pre_login_blocked',
    'checksum_failed',
    'acs_resend_requested',
    'duplicate_request',
    'unknown_command',
    'patron_status',
    'patron_info',
    'item_info',
    'checkout',
    'checkout_duplicate',
    'renew',
    'checkin',
    'checkin_no_loan',
    'operation_denied',
    'unsupported_command',
    'end_session',
  ];
  const missing = required.filter((e) => !names.has(e));
  check('audit log covers full SIP2 event surface', missing.length === 0, missing.length ? `missing=${missing.join(',')}` : `${required.length} events present (${events.length} rows)`);
}

async function phase14Cleanup(token) {
  for (const key of Object.keys(terminals)) {
    const t = terminals[key];
    if (!t?.id) continue;
    const res = await api(token, `/api/admin/sip2/terminals?id=${t.id}`, { method: 'DELETE' });
    check(`delete terminal ${key}`, res.status === 200 && res.body?.success === true, `status=${res.status}`);
  }
  const remaining = await svcJson('sip2_terminals?login_username=like.e2e-%&select=id');
  check('no e2e terminals remain', (remaining.body ?? []).length === 0, `count=${remaining.body?.length}`);

  const loans = await svcJson(`loans?patron_id=eq.${terminals.p1id}&checkout_date=gte.${encodeURIComponent(startIso)}&select=id`);
  for (const row of loans.body ?? []) {
    await svc(`loans?id=eq.${row.id}`, { method: 'DELETE' });
  }
  const tx = await svcJson(`circulation_transactions?patron_id=eq.${terminals.p1id}&offline_id=like.${encodeURIComponent('sip2%')}&select=id`);
  for (const row of tx.body ?? []) {
    await svc(`circulation_transactions?id=eq.${row.id}`, { method: 'DELETE' });
  }
  check('test loans + circulation rows removed', true, `loans=${(loans.body ?? []).length} transactions=${(tx.body ?? []).length}`);
}

async function main() {
  const t0 = Date.now();
  try {
    await phase0Setup();
    const token = await phase1AdminApi();
    terminals.p1id = await ensurePatron('E2E15-P1');
    terminals.itemA = await ensureItem('E2E15 Item A', 'E2E15-A');
    terminals.itemB = await ensureItem('E2E15 Item B', 'E2E15-B');
    check('fixtures ready (patron + 2 items)', !!terminals.p1id && !!terminals.itemA && !!terminals.itemB, `p1=${terminals.p1id} A=${terminals.itemA} B=${terminals.itemB}`);

    await phase2Protocol(token);
    const conn = await phase3PatronItemInfo();
    await phase4Circulation(conn);
    await phase6Unsupported(conn);
    conn.close();
    await phase5Concurrency();
    await phase7OpPermissions();
    await phase8Cidr();
    await phase9Lockout();
    await phase10PythonClient();
    preRestartHealth = await waitForSip2Health(5000, null);
    await phase11Restart();
    await phase12Tls();
    await phase13Observability();
    await phase14Cleanup(token);
  } catch (err) {
    check('E2E completed without exception', false, err.message);
    console.error(err);
  } finally {
    await stopListener(listener);
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    durationMs: Date.now() - t0,
    results,
  };
  writeFileSync(join(TMP, 'e2e-batch15-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nBATCH15 SIP2 E2E: ${summary.passed}/${summary.total} passed, ${failed.length} failed, ${(summary.durationMs / 1000).toFixed(1)}s`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
