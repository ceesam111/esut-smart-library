'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface WorkflowRow {
  id: string;
  current_state: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  repository_items?: { title?: string; status?: string } | null;
  theses?: { title?: string; status?: string; reference_no?: string } | null;
  workflow_tasks?: Array<{ id: string; status: string; assigned_to: string | null; claimed_by: string | null }>;
}

interface ReviewTask {
  id: string;
  workflow_instance_id: string;
  status: string;
  assigned_to: string | null;
  claimed_by: string | null;
  workflow_instances?: {
    id?: string;
    current_state?: string;
    repository_items?: { title?: string } | null;
    theses?: { title?: string; reference_no?: string } | null;
  } | null;
}

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  SUPERVISOR_REVIEW: 'Supervisor review',
  DEPARTMENT_REVIEW: 'Department review',
  FACULTY_REVIEW: 'Faculty review',
  LIBRARY_METADATA_REVIEW: 'Library metadata review',
  COPYRIGHT_REVIEW: 'Copyright review',
  FINAL_APPROVAL: 'Final approval',
  RETURNED: 'Returned for correction',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  WITHDRAWN: 'Withdrawn',
};

type Tab = 'queue' | 'all';

export default function AdminWorkflows() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>('queue');
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const canSeeAll = hasRole('super_admin', 'catalog_admin', 'ir_admin', 'dept_ir_officer', 'librarian', 'faculty_librarian');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate('/login');
        return;
      }
      const headers = { Authorization: `Bearer ${data.session.access_token}` };
      const [taskRes, listRes] = await Promise.all([
        fetch('/api/workflows/tasks', { headers }),
        fetch('/api/workflows', { headers }),
      ]);
      const taskJson = await taskRes.json().catch(() => ({}));
      const listJson = await listRes.json().catch(() => ({}));
      setTasks(taskRes.ok ? taskJson.data ?? [] : []);
      setRows(listRes.ok ? listJson.data ?? [] : []);
      if (!taskRes.ok && !listRes.ok) setError(taskJson.error || listJson.error || 'Failed to load workflows');
      else setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (taskId: string, instanceId: string) => {
    setMsg('');
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`/api/workflows/${instanceId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: JSON.stringify({ taskId, action: 'claim' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setError(json.error || 'Could not claim task');
        return;
      }
      setMsg('Task claimed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Submission workflows</h1>
        <p className="text-neutral-600 mt-1">
          Review queue and full workflow history for repository items and theses.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('queue')}
          className={`text-sm px-4 py-2 rounded-lg border ${tab === 'queue' ? 'bg-primary-700 text-white border-primary-700' : 'bg-white border-neutral-300'}`}
        >
          My queue ({tasks.length})
        </button>
        <button
          onClick={() => setTab('all')}
          className={`text-sm px-4 py-2 rounded-lg border ${tab === 'all' ? 'bg-primary-700 text-white border-primary-700' : 'bg-white border-neutral-300'}`}
        >
          All workflows ({rows.length})
        </button>
      </div>

      {msg && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="card p-10 text-center text-neutral-500">Loading…</div>
      ) : tab === 'queue' ? (
        tasks.length === 0 ? (
          <div className="card p-10 text-center text-neutral-500">No pending review tasks assigned to you.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-neutral-50 text-left">
                <tr>
                  <th className="p-3 font-semibold">Item</th>
                  <th className="p-3 font-semibold">Stage</th>
                  <th className="p-3 font-semibold">Claim</th>
                  <th className="p-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const instance = task.workflow_instances;
                  const item = instance?.theses ?? instance?.repository_items ?? null;
                  return (
                    <tr key={task.id} className="border-b hover:bg-neutral-50">
                      <td className="p-3 max-w-md">
                        <p className="font-medium line-clamp-2">{item?.title ?? 'Untitled item'}</p>
                      </td>
                      <td className="p-3">
                        <span className="badge text-xs bg-blue-100 text-blue-800">
                          {STATE_LABELS[instance?.current_state ?? ''] ?? instance?.current_state}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-neutral-500">
                        {task.claimed_by ? 'Claimed' : 'Unclaimed'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {!task.claimed_by && (
                            <button className="btn-outline text-xs py-1 px-2" onClick={() => void claim(task.id, task.workflow_instance_id)}>
                              Claim
                            </button>
                          )}
                          <Link
                            to={`/admin/workflows/${task.workflow_instance_id}`}
                            className="btn-outline text-xs py-1 px-2"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : !canSeeAll ? (
        <div className="card p-10 text-center text-neutral-500">
          Your role can only list workflows assigned to you.
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">No workflows found.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-neutral-50 text-left">
              <tr>
                <th className="p-3 font-semibold">Item</th>
                <th className="p-3 font-semibold">Stage</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Updated</th>
                <th className="p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = row.theses ?? row.repository_items ?? null;
                return (
                  <tr key={row.id} className="border-b hover:bg-neutral-50">
                    <td className="p-3 max-w-md">
                      <p className="font-medium line-clamp-2">{item?.title ?? 'Untitled item'}</p>
                    </td>
                    <td className="p-3">
                      <span className="badge text-xs bg-blue-100 text-blue-800">
                        {STATE_LABELS[row.current_state] ?? row.current_state}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-neutral-500">{row.status}</td>
                    <td className="p-3 text-xs text-neutral-500">
                      {new Date(row.updated_at ?? row.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="p-3">
                      <Link to={`/admin/workflows/${row.id}`} className="btn-outline text-xs py-1 px-2">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
