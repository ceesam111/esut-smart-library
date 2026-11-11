import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type ProviderKind = 'resend' | 'emailbump' | 'smtp';

interface MaskedSecret {
  set: boolean;
  last4: string | null;
}

interface ProviderRow {
  id: string;
  provider: ProviderKind;
  label: string;
  fromEmail: string;
  fromName: string | null;
  isEnabled: boolean;
  priority: number;
  apiKey: MaskedSecret;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean | null;
  smtpPassword: MaskedSecret;
  createdAt: string;
  updatedAt: string;
}

interface StatusResponse {
  resend: { configured: boolean };
  gmail: { configured: boolean; user?: string };
  database: { active: boolean; providers: { id: string; provider: string; label: string; priority: number }[] };
  healthy: boolean;
}

const PROVIDER_OPTIONS: { value: ProviderKind; label: string; hint: string }[] = [
  { value: 'resend', label: 'Resend (API)', hint: 'api.resend.com HTTP API key' },
  { value: 'emailbump', label: 'EmailBump (API)', hint: 'emailbump.com HTTP API key' },
  { value: 'smtp', label: 'SMTP (Brevo, Unipost, Gmail, any server)', hint: 'host, port, username, password' },
];

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

interface FormState {
  id: string | null;
  provider: ProviderKind;
  label: string;
  fromEmail: string;
  fromName: string;
  isEnabled: boolean;
  priority: string;
  apiKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
}

function blankForm(provider: ProviderKind = 'emailbump'): FormState {
  return {
    id: null,
    provider,
    label: '',
    fromEmail: '',
    fromName: '',
    isEnabled: true,
    priority: '100',
    apiKey: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: false,
  };
}

function rowToForm(row: ProviderRow): FormState {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    fromEmail: row.fromEmail,
    fromName: row.fromName ?? '',
    isEnabled: row.isEnabled,
    priority: String(row.priority),
    apiKey: '',
    smtpHost: row.smtpHost ?? '',
    smtpPort: row.smtpPort ? String(row.smtpPort) : '587',
    smtpUser: row.smtpUser ?? '',
    smtpPassword: '',
    smtpSecure: row.smtpSecure ?? false,
  };
}

export default function EmailSettings() {
  const { loading: authLoading, hasRole } = useAuth();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testProviderId, setTestProviderId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testError, setTestError] = useState('');

  const allowed = !authLoading && hasRole('super_admin', 'librarian');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, health] = await Promise.all([
        authFetch('/api/admin/email/providers'),
        authFetch('/api/admin/email/test'),
      ]);
      setProviders(list.providers ?? []);
      setStatus(health ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
    else if (!authLoading) setLoading(false);
  }, [allowed, authLoading, load]);

  function startAdd() {
    setForm(blankForm());
    setView('form');
    setMsg('');
    setError('');
  }

  function startEdit(row: ProviderRow) {
    setForm(rowToForm(row));
    setView('form');
    setMsg('');
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const config: Record<string, unknown> = {};
      if (form.provider === 'resend' || form.provider === 'emailbump') {
        if (form.apiKey) config.api_key = form.apiKey;
      } else {
        config.smtp_host = form.smtpHost;
        config.smtp_port = Number(form.smtpPort) || 587;
        config.smtp_user = form.smtpUser;
        if (form.smtpPassword) config.smtp_password = form.smtpPassword;
        config.smtp_secure = form.smtpSecure;
      }
      await authFetch('/api/admin/email/providers', {
        method: 'POST',
        body: JSON.stringify({
          id: form.id,
          provider: form.provider,
          label: form.label,
          fromEmail: form.fromEmail,
          fromName: form.fromName,
          isEnabled: form.isEnabled,
          priority: Number(form.priority) || 100,
          config,
        }),
      });
      setMsg(form.id ? 'Provider updated.' : 'Provider added.');
      setView('list');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ProviderRow) {
    if (!window.confirm(`Delete the "${row.label}" provider configuration?`)) return;
    setError('');
    try {
      await authFetch(`/api/admin/email/providers?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      setMsg('Provider deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  async function runTest(e: React.FormEvent) {
    e.preventDefault();
    setTesting(true);
    setTestResult('');
    setTestError('');
    try {
      const json = await authFetch('/api/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', to: testTo, providerId: testProviderId || undefined }),
      });
      setTestResult(`Sent via ${json.provider}.`);
      await load();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test send failed.');
    } finally {
      setTesting(false);
    }
  }

  if (!allowed) {
    return <div className="p-8 text-sm text-neutral-500">You do not have access to this page.</div>;
  }

  const providerLabel = (kind: ProviderKind) => PROVIDER_OPTIONS.find((option) => option.value === kind)?.label ?? kind;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-neutral-900">Email Providers</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Configure outgoing email providers, their credentials, and the fallback order.
          </p>
        </div>
        {view === 'list' && (
          <button onClick={startAdd} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#6B1D2A' }}>
            Add provider
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>}

      {status && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm space-y-1">
          <p className="font-medium text-neutral-900">Delivery chain</p>
          {status.database.active ? (
            <ul className="text-neutral-600">
              {status.database.providers.map((item) => (
                <li key={item.id}>• {item.label} (priority {item.priority})</li>
              ))}
            </ul>
          ) : (
            <p className="text-neutral-600">
              No database provider is enabled — the environment fallback is in use
              {status.resend.configured ? ' (Resend configured)' : ''}
              {status.gmail.configured ? ` (Gmail SMTP: ${status.gmail.user ?? 'configured'})` : ''}
              {!status.resend.configured && !status.gmail.configured ? ', but no environment provider is configured' : ''}.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : view === 'form' ? (
        <form onSubmit={save} className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-neutral-700 mb-1">Provider type</span>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as ProviderKind })}
                disabled={!!form.id}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-neutral-700 mb-1">Label</span>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="EmailBump fallback"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-neutral-700 mb-1">From address</span>
              <input
                type="email"
                required
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="noreply@viaemailbump.com"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="block text-neutral-700 mb-1">From name (optional)</span>
              <input
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                placeholder="ESUT Library"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
          </div>

          {(form.provider === 'resend' || form.provider === 'emailbump') && (
            <label className="text-sm block">
              <span className="block text-neutral-700 mb-1">API key {form.id && <span className="text-neutral-400">(leave blank to keep the saved key)</span>}</span>
              <input
                type="password"
                required={!form.id}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="ebk_… / re_…"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
          )}

          {form.provider === 'smtp' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="block text-neutral-700 mb-1">Host</span>
                  <input
                    required
                    value={form.smtpHost}
                    onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                    placeholder="smtp.emailbump.com"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-neutral-700 mb-1">Port</span>
                  <input
                    type="number"
                    value={form.smtpPort}
                    onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-neutral-700 mb-1">Username</span>
                  <input
                    required
                    value={form.smtpUser}
                    onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </label>
              </div>
              <label className="text-sm block">
                <span className="block text-neutral-700 mb-1">Password {form.id && <span className="text-neutral-400">(leave blank to keep the saved password)</span>}</span>
                <input
                  type="password"
                  required={!form.id}
                  value={form.smtpPassword}
                  onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                />
                <span className="text-neutral-700">Use implicit TLS (port 465); off means STARTTLS (587)</span>
              </label>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-neutral-700 mb-1">Priority (lower runs first)</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              />
              <span className="text-neutral-700">Enabled</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60" style={{ background: '#6B1D2A' }}>
              {saving ? 'Saving…' : 'Save provider'}
            </button>
            <button type="button" onClick={() => setView('list')} className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
            {providers.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">No provider configured yet. Add one to take over delivery from the environment defaults.</p>
            ) : (
              providers.map((row) => (
                <div key={row.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900 text-sm">
                      {row.label}{' '}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${row.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {row.isEnabled ? 'enabled' : 'disabled'}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {providerLabel(row.provider)} · from {row.fromEmail} · priority {row.priority}
                      {row.apiKey.set ? ` · key ••••${row.apiKey.last4 ?? ''}` : ''}
                      {row.smtpPassword.set ? ` · password ••••${row.smtpPassword.last4 ?? ''}` : ''}
                      {row.smtpHost ? ` · ${row.smtpHost}:${row.smtpPort ?? ''}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(row)} className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs text-neutral-700">Edit</button>
                    <button onClick={() => void remove(row)} className="px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-700">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={runTest} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
            <p className="font-medium text-neutral-900 text-sm">Test send</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-neutral-700 mb-1">Recipient</span>
                <input
                  type="email"
                  required
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="block text-neutral-700 mb-1">Provider (blank = full chain)</span>
                <select
                  value={testProviderId}
                  onChange={(e) => setTestProviderId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                >
                  <option value="">Full chain</option>
                  {providers.filter((row) => row.isEnabled).map((row) => (
                    <option key={row.id} value={row.id}>{row.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={testing} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60" style={{ background: '#6B1D2A' }}>
              {testing ? 'Sending…' : 'Send test email'}
            </button>
            {testResult && <p className="text-sm text-emerald-700">{testResult}</p>}
            {testError && <p className="text-sm text-red-700">{testError}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
