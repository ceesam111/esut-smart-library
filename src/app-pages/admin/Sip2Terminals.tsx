import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface TerminalRow {
  id: string;
  name: string;
  institution_id: string;
  login_username: string;
  is_active: boolean;
  allowed_operations: string[];
  permitted_ip_cidr: string | null;
  credential_scheme: string;
  failed_attempts: number;
  locked_until: string | null;
  last_successful_auth: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  terminal_id: string | null;
  event: string;
  success: boolean;
  ip_address: string | null;
  created_at: string;
}

interface OneTimeSecret {
  username: string;
  password: string;
  label: string;
}

const ALL_OPS = ['checkout', 'checkin', 'patron_info', 'item_info', '*'];

async function authFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed with ${res.status}`);
  return json;
}

function blankForm() {
  return { name: '', loginUsername: '', allowedOperations: ['checkout', 'checkin'] as string[], permittedIpCidr: '' };
}

export default function Sip2Terminals() {
  const { loading: authLoading, hasRole } = useAuth();
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<TerminalRow | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const json = await authFetch('/api/admin/sip2/terminals');
      setTerminals(json.data?.terminals ?? []);
      setAudit(json.data?.audit ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (authLoading) return <div className="p-8 text-sm text-neutral-500">Loading...</div>;
  if (!hasRole('super_admin', 'librarian', 'faculty_librarian', 'catalog_admin')) {
    return <div className="p-8"><div className="card p-8 max-w-lg"><h1 className="font-semibold text-lg mb-2">Admin access required</h1></div></div>;
  }

  function openNew() {
    setEditing(null);
    setForm(blankForm());
    setMsg('');
    setView('form');
  }

  function openEdit(row: TerminalRow) {
    setEditing(row);
    setForm({
      name: row.name,
      loginUsername: row.login_username,
      allowedOperations: row.allowed_operations,
      permittedIpCidr: row.permitted_ip_cidr ?? '',
    });
    setMsg('');
    setView('form');
  }

  function toggleOp(op: string) {
    setForm((f) => ({
      ...f,
      allowedOperations: f.allowedOperations.includes(op)
        ? f.allowedOperations.filter((o) => o !== op)
        : [...f.allowedOperations, op],
    }));
  }

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      if (editing) {
        await authFetch('/api/admin/sip2/terminals', {
          method: 'PATCH',
          body: JSON.stringify({
            id: editing.id,
            name: form.name,
            allowedOperations: form.allowedOperations,
            permittedIpCidr: form.permittedIpCidr || null,
          }),
        });
        setMsg(`Terminal "${form.name}" updated.`);
      } else {
        const json = await authFetch('/api/admin/sip2/terminals', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setSecret({
          username: json.data?.terminal?.login_username ?? form.loginUsername,
          password: json.data?.plainPassword ?? '',
          label: 'created',
        });
        setMsg('');
      }
      setView('list');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to save.');
    }
    setSaving(false);
  }

  async function resetSecret(row: TerminalRow) {
    if (!window.confirm(`Generate a new password for "${row.name}"? The old password stops working immediately.`)) return;
    try {
      const json = await authFetch('/api/admin/sip2/terminals', {
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, action: 'reset-secret' }),
      });
      setSecret({ username: row.login_username, password: json.data?.plainPassword ?? '', label: 'reset' });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to reset secret.');
    }
  }

  async function toggleActive(row: TerminalRow) {
    try {
      await authFetch('/api/admin/sip2/terminals', {
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, isActive: !row.is_active }),
      });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to update terminal.');
    }
  }

  async function remove(row: TerminalRow) {
    if (!window.confirm(`Delete terminal "${row.name}"? Its audit history is kept.`)) return;
    try {
      await authFetch(`/api/admin/sip2/terminals?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to delete terminal.');
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.password);
      setMsg('Password copied to clipboard.');
    } catch {
      setMsg('Clipboard unavailable — select and copy manually.');
    }
  }

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">SIP2 Terminals</h1>
          <p className="text-neutral-500 mt-1">
            Self-check station credentials for the SIP2 protocol service (standard port 6000).
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/circulation" className="btn-secondary">Back to Circulation</Link>
          {view === 'list' && <button className="btn-primary" onClick={openNew}>New Terminal</button>}
        </div>
      </div>

      {msg && <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3">{msg}</div>}
      {error && <div className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">{error}</div>}

      {secret && (
        <div className="card p-4 border-amber-300 bg-amber-50">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="font-semibold text-amber-900">
                Terminal password {secret.label} — shown only once
              </h2>
              <p className="text-sm text-amber-800 mt-1">
                Configure the self-check machine now; this password is stored only as a hash and cannot be viewed again.
              </p>
              <div className="mt-2 text-sm text-neutral-700">
                Login user id (CN): <code className="font-mono font-semibold">{secret.username}</code>
              </div>
              <div className="mt-1 text-sm text-neutral-700">
                Password (CO): <code className="font-mono font-semibold select-all">{secret.password}</code>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="btn-secondary" onClick={() => void copySecret()}>Copy password</button>
              <button className="btn-secondary" onClick={() => setSecret(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {view === 'form' ? (
        <div className="card p-6 max-w-2xl space-y-4">
          <h2 className="font-semibold text-lg">{editing ? 'Edit Terminal' : 'New Terminal'}</h2>
          <div>
            <label className="label">Terminal name</label>
            <input className="input" value={form.name} placeholder="Main Lobby Self-Check"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Login user id (CN)</label>
            <input className="input" value={form.loginUsername} disabled={Boolean(editing)}
              placeholder="kiosk-lobby-1"
              onChange={(e) => setForm((f) => ({ ...f, loginUsername: e.target.value }))} />
            {editing && <p className="text-xs text-neutral-500 mt-1">Username cannot be changed after creation.</p>}
          </div>
          <div>
            <label className="label">Allowed operations</label>
            <div className="flex flex-wrap gap-3 mt-1">
              {ALL_OPS.map((op) => (
                <label key={op} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.allowedOperations.includes(op)} onChange={() => toggleOp(op)} />
                  {op === '*' ? 'all operations (*)' : op.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Permitted IP / CIDR (optional)</label>
            <input className="input" value={form.permittedIpCidr} placeholder="192.168.10.0/24"
              onChange={(e) => setForm((f) => ({ ...f, permittedIpCidr: e.target.value }))} />
            <p className="text-xs text-neutral-500 mt-1">Leave empty to allow any source IP.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving || !form.name.trim() || !form.loginUsername.trim()}
              onClick={() => void save()}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create terminal'}
            </button>
            <button className="btn-secondary" onClick={() => setView('list')}>Cancel</button>
          </div>
          {!editing && (
            <p className="text-xs text-neutral-500">
              Institution id is fixed to <code>ESUT</code>. The password is generated by the server and shown once.
            </p>
          )}
        </div>
      ) : (
        <div className="card p-4 overflow-x-auto">
          {loading ? (
            <div className="p-4 text-sm text-neutral-500">Loading terminals...</div>
          ) : terminals.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">No SIP2 terminals yet. Create one to connect a self-check station.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-neutral-500 border-b">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Username (CN)</th>
                  <th className="py-2 pr-3">Operations</th>
                  <th className="py-2 pr-3">IP filter</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last login</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {terminals.map((row) => {
                  const locked = row.locked_until && new Date(row.locked_until) > new Date();
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{row.name}</td>
                      <td className="py-2 pr-3 font-mono">{row.login_username}</td>
                      <td className="py-2 pr-3">{row.allowed_operations.join(', ')}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{row.permitted_ip_cidr ?? 'any'}</td>
                      <td className="py-2 pr-3">
                        {locked ? (
                          <span className="badge badge-error">locked until {new Date(row.locked_until!).toLocaleString()}</span>
                        ) : row.is_active ? (
                          <span className="badge badge-success">active</span>
                        ) : (
                          <span className="badge">disabled</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-neutral-500">
                        {row.last_successful_auth ? new Date(row.last_successful_auth).toLocaleString() : 'never'}
                        {row.failed_attempts > 0 && !locked && ` (${row.failed_attempts} failed)`}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-2 text-xs">
                          <button className="btn-secondary px-2 py-1" onClick={() => openEdit(row)}>Edit</button>
                          <button className="btn-secondary px-2 py-1" onClick={() => void resetSecret(row)}>Reset password</button>
                          <button className="btn-secondary px-2 py-1" onClick={() => void toggleActive(row)}>
                            {row.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn-secondary px-2 py-1 text-red-600" onClick={() => void remove(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-semibold text-lg mb-3">Recent SIP2 events</h2>
        {audit.length === 0 ? (
          <div className="text-sm text-neutral-500">No SIP2 activity recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-neutral-500 border-b">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Event</th>
                <th className="py-2 pr-3">Result</th>
                <th className="py-2 pr-3">Terminal</th>
                <th className="py-2 pr-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 15).map((row) => {
                const terminal = terminals.find((t) => t.id === row.terminal_id);
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs text-neutral-500">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">{row.event}</td>
                    <td className="py-2 pr-3">
                      <span className={row.success ? 'badge badge-success' : 'badge badge-error'}>
                        {row.success ? 'ok' : 'failed'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{terminal?.name ?? row.terminal_id ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.ip_address ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
