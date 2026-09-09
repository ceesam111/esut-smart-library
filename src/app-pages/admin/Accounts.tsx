import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type AppRole } from '@/config/roles.config';
import { REGISTRATION_POLICY_LABELS, type RegistrationAccessPolicy } from '@/lib/registrationPolicy';
import {
  listAccounts, inviteUser, assignRole, revokeRole, setAccess,
  adminResetPassword, listAudit,
  type AccountRow, type AuditRow, type AssignableRole,
} from '@/lib/admin-accounts.functions';

const ASSIGNABLE: AssignableRole[] = [
  'super_admin', 'librarian', 'faculty_librarian',
  'researcher_lecturer', 'student', 'admin_staff', 'guest',
];

type Tab = 'users' | 'invite' | 'registration' | 'audit';

function Badge({ role }: { role: string }) {
  const isSuper = role === 'super_admin';
  const isAccountManager = isSuper || role === 'librarian';
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: isSuper ? '#FEE2E2' : '#E5F0EA',
        color: isSuper ? '#991B1B' : '#1A4731',
      }}
    >
      {ROLE_LABELS[role as AppRole] ?? role}
    </span>
  );
}

export default function AdminAccounts() {
  const { role, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [registrationPolicy, setRegistrationPolicy] = useState<RegistrationAccessPolicy>('email_verification_with_branch_approval');

  // invite form
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<AssignableRole | ''>('');

  const isSuper = role === 'super_admin';
  const isAccountManager = isSuper || role === 'librarian';

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, l, policy] = await Promise.all([
        listAccounts(),
        isSuper ? listAudit() : Promise.resolve([]),
        isSuper ? authFetch('/api/admin/registration-policy') : Promise.resolve(null),
      ]);
      setAccounts(a);
      setAudit(l);
      if (policy?.policy) setRegistrationPolicy(policy.policy);
    } catch (e) {
      flash('err', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isSuper]);

  useEffect(() => {
    if (isAccountManager) loadAll();
  }, [isAccountManager, loadAll]);

  async function run(key: string, fn: () => Promise<unknown>, okText: string) {
    setBusy(key);
    try {
      await fn();
      flash('ok', okText);
      await loadAll();
    } catch (e) {
      flash('err', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    await run('invite', () =>
      inviteUser({ data: { email: invEmail, role: invRole || undefined, redirectTo: `${window.location.origin}/reset-password` } }),
      `Invitation sent to ${invEmail}`);
    setInvEmail('');
    setInvRole('');
    setTab('users');
  }

  async function handleBroadcast() {
    const text = prompt('Message to broadcast to all users (shown in their notifications):');
    if (!text) return;
    setBusy('broadcast');
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { broadcast: true, title: 'ESUT Library', body: text, url: '/' },
      });
      if (error) throw error;
      flash('ok', `Notification sent to ${data?.count ?? 0} user(s).`);
    } catch (e) {
      flash('err', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function authFetch(url: string, init?: RequestInit) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed with ${res.status}`);
    return json;
  }

  async function saveRegistrationPolicy(policy: RegistrationAccessPolicy) {
    await run('registration-policy', async () => {
      const json = await authFetch('/api/admin/registration-policy', { method: 'PUT', body: JSON.stringify({ policy }) });
      setRegistrationPolicy(json.policy);
    }, 'Registration access policy updated');
  }

  if (authLoading) return <div className="text-sm text-neutral-500">Loading…</div>;

  if (!isAccountManager) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-bold text-primary-900 mb-2">Account Management</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This area is restricted to librarians and super administrators.
        </div>
        <Link to="/admin" className="text-sm text-primary-700 hover:underline mt-3 inline-block">← Back to dashboard</Link>
      </div>
    );
  }

  const filtered = accounts.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (a.email ?? '').toLowerCase().includes(q) || (a.full_name ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary-900">Account Management</h1>
          <p className="text-sm text-neutral-500">Invite users, manage roles, revoke access, and review the audit trail.</p>
        </div>
        <button
          onClick={handleBroadcast}
          disabled={busy === 'broadcast'}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: '#1A4731' }}
        >
          {busy === 'broadcast' ? 'Sending…' : '🔔 Broadcast notice'}
        </button>
      </div>

      {msg && (
        <div
          className="mb-4 rounded-lg p-3 text-sm"
          style={{
            background: msg.kind === 'ok' ? '#D1FAE5' : '#FEE2E2',
            color: msg.kind === 'ok' ? '#065F46' : '#991B1B',
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 mb-4">
        {([['users', 'Users & Roles'], ['invite', 'Invitations'], ...(isSuper ? [['registration', 'Registration Policy'], ['audit', 'Audit Log']] : [])] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === k ? 'border-primary-700 text-primary-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Users & Roles ── */}
      {tab === 'users' && (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full sm:w-80 mb-4 px-3 py-2 rounded-lg border border-neutral-300 text-sm"
          />
          {loading ? (
            <div className="text-sm text-neutral-500">Loading accounts…</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Roles</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const hasSuper = a.roles.includes('super_admin');
                    const targetLocked = !isSuper && hasSuper;
                    return (
                      <tr key={a.user_id} className="border-t border-neutral-100 align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-neutral-800">{a.full_name || '—'}</div>
                          <div className="text-xs text-neutral-500">{a.email}</div>
                            {a.library_number && <div className="text-[10px] text-neutral-400 font-mono">{a.library_number}</div>}
                            {a.superAdminLevel && <div className="text-[10px] text-red-700 font-semibold uppercase">{a.superAdminLevel}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {a.roles.length ? a.roles.map((r) => (
                              <span key={r} className="inline-flex items-center gap-1">
                                <Badge role={r} />
                                <button
                                  title="Remove role"
                                  disabled={targetLocked || (!isSuper && r === 'super_admin')}
                                  onClick={() => run(`rr-${a.user_id}-${r}`, () => revokeRole({ data: { userId: a.user_id, role: r as AssignableRole, email: a.email ?? undefined } }), 'Role removed')}
                                  className="text-[10px] text-neutral-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-neutral-400"
                                >✕</button>
                              </span>
                            )) : <span className="text-xs text-neutral-400">No roles</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {a.banned ? (
                            <span className="text-xs font-semibold text-red-600">Revoked</span>
                          ) : (
                            <span className="text-xs text-neutral-600">{a.status ?? 'active'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const r = e.target.value as AssignableRole;
                                if (r) run(`ar-${a.user_id}`, () => assignRole({ data: { userId: a.user_id, role: r, email: a.email ?? undefined } }), 'Role granted');
                                e.currentTarget.value = '';
                              }}
                              className="text-xs border border-neutral-300 rounded px-2 py-1"
                            >
                              <option value="">+ Add role…</option>
                              {ASSIGNABLE.filter((r) => !a.roles.includes(r) && (isSuper || r !== 'super_admin')).map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                            {isSuper && <button
                              onClick={() => {
                                if (hasSuper) {
                                  run(`super-${a.user_id}`, () => revokeRole({ data: { userId: a.user_id, role: 'super_admin', email: a.email ?? undefined } }), 'Super admin revoked');
                                } else {
                                  run(`super-${a.user_id}`, () => assignRole({ data: { userId: a.user_id, role: 'super_admin', email: a.email ?? undefined } }), 'Super admin granted');
                                }
                              }}
                              className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
                            >
                              {hasSuper ? 'Demote admin' : 'Make ACEO'}
                            </button>}
                            <button
                              onClick={() => a.email && run(`pw-${a.user_id}`, () => adminResetPassword({ data: { email: a.email!, redirectTo: `${window.location.origin}/reset-password` } }), 'Password reset email sent')}
                              disabled={targetLocked}
                              className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
                            >
                              Reset password
                            </button>
                            <button
                              onClick={() => {
                                const verb = a.banned ? 'restore access for' : 'revoke access for';
                                if (confirm(`Are you sure you want to ${verb} ${a.email}?`)) {
                                  run(`acc-${a.user_id}`, () => setAccess({ data: { userId: a.user_id, revoke: !a.banned, email: a.email ?? undefined } }), a.banned ? 'Access restored' : 'Access revoked');
                                }
                              }}
                              disabled={targetLocked}
                              className={`text-xs px-2 py-1 rounded text-white disabled:opacity-40 ${a.banned ? 'bg-emerald-600' : 'bg-red-600'} hover:opacity-90`}
                            >
                              {a.banned ? 'Restore' : 'Revoke'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-400">No accounts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Invitations ── */}
      {tab === 'invite' && (
        <form onSubmit={handleInvite} className="max-w-md rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <p className="text-sm text-neutral-600">
            Send a secure invitation. The recipient gets an email to set their own password and join.
          </p>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Email address</label>
            <input
              type="email"
              required
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              placeholder="person@esut.edu.ng"
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Starting role (optional)</label>
            <select
              value={invRole}
              onChange={(e) => setInvRole(e.target.value as AssignableRole | '')}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm"
            >
              <option value="">No role (assign later)</option>
              {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy === 'invite'}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#1A4731' }}
          >
            {busy === 'invite' ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
      )}

      {tab === 'registration' && isSuper && (
        <div className="max-w-3xl rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-primary-900">Registration Access Policy</h2>
            <p className="text-sm text-neutral-500 mt-1">Controls what new self-registered patrons must complete before dashboard access. Staff/librarian self-registrations still require admin approval for safety.</p>
          </div>
          <div className="space-y-3">
            {(['email_verification_with_branch_approval', 'email_verification', 'direct_access'] as RegistrationAccessPolicy[]).map((policy) => (
              <label key={policy} className={`block rounded-lg border p-4 cursor-pointer ${registrationPolicy === policy ? 'border-primary-700 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                <div className="flex gap-3">
                  <input
                    type="radio"
                    name="registration-policy"
                    checked={registrationPolicy === policy}
                    onChange={() => saveRegistrationPolicy(policy)}
                    disabled={busy === 'registration-policy'}
                    className="mt-1 accent-primary-700"
                  />
                  <div>
                    <div className="font-semibold text-neutral-800">{REGISTRATION_POLICY_LABELS[policy]}</div>
                    <p className="text-sm text-neutral-600 mt-1">
                      {policy === 'direct_access' && 'Normal patrons can sign in and use the dashboard immediately after registration. No verification or approval gate is applied.'}
                      {policy === 'email_verification' && 'Patrons must verify their email address through a Resend-delivered link before dashboard access is activated.'}
                      {policy === 'email_verification_with_branch_approval' && 'Patrons verify email first, then get main library dashboard access while the selected branch/faculty librarian completes final branch approval.'}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === 'audit' && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 text-xs text-neutral-500 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-primary-800">{row.action}</td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{row.actor_email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{row.target_email ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{row.detail ?? '—'}</td>
                </tr>
              ))}
              {!audit.length && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-neutral-400">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
