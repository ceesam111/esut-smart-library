import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, type AppRole } from '@/config/roles.config';

type Tab = 'registrations' | 'queue' | 'audit';

interface ApprovalQueueItem {
  id: string;
  content_type: string;
  action_type: string;
  risk_tier: string;
  status: string;
  title: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  submitted_by: string | null;
  assigned_to: string | null;
}

interface FoundationAuditLog {
  id: string;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PendingPatron {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  account_role: string | null;
  patron_category: string;
  faculty_name: string | null;
  department: string | null;
  preferred_branch: string | null;
  matric_number: string | null;
  staff_id: string | null;
  student_type: string | null;
  current_level: string | null;
  email_verified_at: string | null;
  main_library_access_at: string | null;
  registration_policy: string | null;
  created_at: string;
}

export default function Approvals() {
  const { loading: authLoading, can, hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>('registrations');
  const [rows, setRows] = useState<PendingPatron[]>([]);
  const [queue, setQueue] = useState<ApprovalQueueItem[]>([]);
  const [audit, setAudit] = useState<FoundationAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const isSuperAdmin = hasRole('super_admin');

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

  const fetchPending = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('patrons')
      .select('id,user_id,full_name,email,account_role,patron_category,faculty_name,department,preferred_branch,matric_number,staff_id,student_type,current_level,email_verified_at,main_library_access_at,registration_policy,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setRows((data as PendingPatron[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (!authLoading && can('approvals')) fetchPending(); }, [authLoading, can, fetchPending]);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const json = await authFetch('/api/admin/approvals?status=pending');
      setQueue(json.approvals ?? []);
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const json = await authFetch('/api/admin/audit-logs');
      setAudit(json.auditLogs ?? []);
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !can('approvals')) return;
    if (tab === 'queue') fetchQueue();
    if (tab === 'audit' && isSuperAdmin) fetchAudit();
  }, [authLoading, can, fetchAudit, fetchQueue, isSuperAdmin, tab]);

  async function approve(p: PendingPatron) {
    setWorking(p.id); setMsg('');
    try {
      await authFetch(`/api/admin/patron-approvals/${p.id}/approve`, { method: 'POST', body: '{}' });
      setRows((r) => r.filter((x) => x.id !== p.id));
      setMsg(`Approved ${p.full_name}.`);
    } catch (error) {
      setMsg('Approval failed: ' + (error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function reject(p: PendingPatron) {
    setWorking(p.id); setMsg('');
    try {
      await authFetch(`/api/admin/patron-approvals/${p.id}/reject`, { method: 'POST', body: '{}' });
      setRows((r) => r.filter((x) => x.id !== p.id));
      setMsg(`Rejected ${p.full_name}.`);
    } catch (error) {
      setMsg('Action failed: ' + (error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  async function decideQueue(item: ApprovalQueueItem, decision: 'approve' | 'reject') {
    const note = window.prompt(`${decision === 'approve' ? 'Approval' : 'Rejection'} note (optional):`) ?? '';
    setWorking(item.id); setMsg('');
    try {
      await authFetch(`/api/admin/approvals/${item.id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: note || null }),
      });
      setQueue((current) => current.filter((row) => row.id !== item.id));
      setMsg(`${decision === 'approve' ? 'Approved' : 'Rejected'} ${item.title || item.content_type}.`);
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  if (authLoading) return <Center>Loading…</Center>;

  if (!can('approvals')) {
    return (
      <div className="max-w-md mx-auto card p-8 text-center mt-10">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-neutral-800 mb-2">Not Authorised</h2>
        <p className="text-neutral-500 text-sm mb-6">Only librarians and administrators can approve registrations.</p>
        <Link to="/admin" className="btn-primary">Back to Admin Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-serif font-semibold text-primary-800 mb-1">Approvals</h1>
      <p className="text-neutral-500 text-sm mb-6">
        Review patron registrations, shared approval queue items, and administrative audit activity.
      </p>

      <div className="flex gap-1 border-b border-neutral-200 mb-5">
        {([
          ['registrations', 'Pending Registrations'],
          ['queue', 'Foundation Queue'],
          ...(isSuperAdmin ? [['audit', 'Audit Logs']] : []),
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-primary-700 text-primary-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 px-4 py-3 rounded-lg bg-primary-50 border border-primary-200 text-primary-800 text-sm">{msg}</div>}

      {tab === 'registrations' && (loading ? <Center>Loading registrations…</Center> : rows.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">🎉 No pending registrations.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((p) => (
            <div key={p.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-neutral-800">{p.full_name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium">
                    {ROLE_LABELS[(p.account_role as AppRole) ?? 'guest'] ?? p.patron_category}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.email_verified_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.email_verified_at ? 'Email verified' : 'Email not verified'}
                  </span>
                  {p.main_library_access_at && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">Main library active</span>
                  )}
                </div>
                <p className="text-sm text-neutral-500">{p.email}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {[p.faculty_name, p.department, p.current_level, p.preferred_branch].filter(Boolean).join(' • ')}
                  {p.matric_number ? ` • ${p.matric_number}` : ''}{p.staff_id ? ` • ${p.staff_id}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => approve(p)} disabled={working === p.id} className="btn-primary text-sm px-4 py-2">
                  {working === p.id ? '…' : 'Approve'}
                </button>
                <button onClick={() => reject(p)} disabled={working === p.id} className="btn-outline text-sm px-4 py-2">Reject</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'queue' && (queueLoading ? <Center>Loading approval queue…</Center> : queue.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">No foundation approval items are pending.</div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-neutral-800">{item.title || item.content_type}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium">{item.action_type}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">{item.risk_tier}</span>
                    {typeof item.payload?.source === 'string' && (
                      <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
                        Generated by {item.payload.source}
                      </span>
                    )}
                  </div>
                  {item.summary && <p className="text-sm text-neutral-500 mt-1">{item.summary}</p>}
                  <p className="text-xs text-neutral-400 mt-2">
                    {item.content_type} • {new Date(item.created_at).toLocaleString()}
                  </p>
                  <details className="mt-3">
                    <summary className="text-xs text-primary-700 cursor-pointer">Payload</summary>
                    <pre className="mt-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-3 overflow-auto max-h-56">
                      {JSON.stringify(item.payload ?? {}, null, 2)}
                    </pre>
                  </details>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decideQueue(item, 'approve')} disabled={working === item.id} className="btn-primary text-sm px-4 py-2">
                    {working === item.id ? '…' : 'Approve'}
                  </button>
                  <button onClick={() => decideQueue(item, 'reject')} disabled={working === item.id} className="btn-outline text-sm px-4 py-2">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'audit' && isSuperAdmin && (auditLoading ? <Center>Loading audit logs…</Center> : audit.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">No audit logs yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-3 font-medium text-neutral-800">{entry.action}</td>
                  <td className="px-3 py-3 text-neutral-500">
                    <div>{entry.entity_type}</div>
                    {entry.entity_id && <div className="text-[10px] font-mono text-neutral-400">{entry.entity_id}</div>}
                  </td>
                  <td className="px-3 py-3 text-neutral-500">{entry.actor_role || '—'}</td>
                  <td className="px-3 py-3 text-neutral-500">{new Date(entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[40vh] flex items-center justify-center text-neutral-500">{children}</div>;
}
