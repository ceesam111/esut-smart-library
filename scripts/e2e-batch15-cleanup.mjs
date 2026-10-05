import { readFileSync } from 'fs';
const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const q = async (path, init = {}) => {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const terms = await q('sip2_terminals?login_username=like.e2e-%25&select=id,login_username');
console.log('terminals:', JSON.stringify(terms.body));
for (const t of terms.body ?? []) {
  const r = await q(`sip2_terminals?id=eq.${t.id}`, { method: 'DELETE' });
  console.log('deleted', t.login_username, r.status);
}

const patron = await q('patrons?patron_id=eq.E2E15-P1&select=id');
const pid = patron.body?.[0]?.id;
if (pid) {
  const loans = await q(`loans?patron_id=eq.${pid}&select=id,status`);
  console.log('loans:', JSON.stringify(loans.body));
  for (const l of loans.body ?? []) {
    const r = await q(`loans?id=eq.${l.id}`, { method: 'DELETE' });
    console.log('deleted loan', l.id, r.status);
  }
  const txs = await q(`circulation_transactions?patron_id=eq.${pid}&offline_id=like.sip2%25&select=id`);
  console.log('tx rows:', (txs.body ?? []).length);
  for (const t of txs.body ?? []) {
    await q(`circulation_transactions?id=eq.${t.id}`, { method: 'DELETE' });
  }
} else {
  console.log('no patron');
}
for (const title of ['E2E15 Item A', 'E2E15 Item B']) {
  const item = await q(`catalogue_items?title=eq.${encodeURIComponent(title)}&select=id,available_copies`);
  const row = item.body?.[0];
  if (row && (row.available_copies !== 1)) {
    await q(`catalogue_items?id=eq.${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ available_copies: 1, total_copies: 1 }) });
    console.log('reset availability', title);
  } else console.log('item ok', title, JSON.stringify(row));
}
console.log('CLEANUP_DONE');
